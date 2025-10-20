import { AxylogAPI } from './axylog';
import { storage } from './storage';
import { db, executeWithRetry } from './db';
import { axylogSyncState, consignments } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { photoWorker } from './photoIngestionWorker';

export class LiveSyncWorker {
  private axylogAPI: AxylogAPI;
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs: number;
  private isRunning = false;

  constructor() {
    this.axylogAPI = new AxylogAPI();
    // Poll every 3 minutes (180000ms)
    this.pollIntervalMs = parseInt(process.env.LIVE_SYNC_INTERVAL_MS || '180000', 10);
  }

  async start() {
    if (this.isRunning) {
      console.log('[LiveSync] Worker already running');
      return;
    }

    this.isRunning = true;
    console.log(`[LiveSync] Starting worker with ${this.pollIntervalMs / 1000}s interval`);

    // Initialize sync state if needed
    await this.initializeSyncState();

    // Run first sync immediately
    await this.pollAndSync();

    // Then poll on interval
    this.pollingInterval = setInterval(async () => {
      await this.pollAndSync();
    }, this.pollIntervalMs);
  }

  async stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isRunning = false;
    console.log('[LiveSync] Worker stopped');
  }

  private async initializeSyncState() {
    try {
      const existing = await executeWithRetry(async () => {
        return await db.select().from(axylogSyncState).limit(1);
      });

      const startDate = new Date('2025-10-06T00:00:00.000Z');

      if (existing.length === 0) {
        // Initialize with timestamp from October 6th, 2025
        await executeWithRetry(async () => {
          await db.insert(axylogSyncState).values({
            lastSyncTimestamp: startDate,
            isPolling: false,
          });
        });
        console.log(`[LiveSync] Initialized sync state with timestamp: ${startDate.toISOString()}`);
      } else {
        // Check if existing timestamp is before October 6th, 2025 - if so, reset it
        const existingTimestamp = new Date(existing[0].lastSyncTimestamp);
        if (existingTimestamp < startDate) {
          await executeWithRetry(async () => {
            await db.update(axylogSyncState)
              .set({
                lastSyncTimestamp: startDate,
                updatedAt: new Date(),
              })
              .where(eq(axylogSyncState.id, existing[0].id));
          });
          console.log(`[LiveSync] Reset sync state from ${existingTimestamp.toISOString()} to ${startDate.toISOString()} to enable historical backfill`);
        }
      }
    } catch (error) {
      console.error('[LiveSync] Error initializing sync state:', error);
    }
  }

  private async getSyncState() {
    const state = await executeWithRetry(async () => {
      return await db.select()
        .from(axylogSyncState)
        .orderBy(desc(axylogSyncState.id))
        .limit(1);
    });
    return state[0];
  }

  private async updateSyncState(timestamp: Date) {
    const state = await this.getSyncState();
    if (state) {
      await executeWithRetry(async () => {
        await db.update(axylogSyncState)
          .set({
            lastSyncTimestamp: timestamp,
            updatedAt: new Date(),
          })
          .where(eq(axylogSyncState.id, state.id));
      });
    }
  }

  private async pollAndSync() {
    try {
      console.log('[LiveSync] Starting poll cycle...');
      
      // Authenticate with Axylog
      const authSuccess = await this.axylogAPI.authenticate();
      if (!authSuccess) {
        console.error('[LiveSync] Authentication failed, skipping this cycle');
        return;
      }

      // Get last sync timestamp
      const syncState = await this.getSyncState();
      if (!syncState) {
        console.error('[LiveSync] No sync state found, skipping');
        return;
      }

      const lastSyncTime = syncState.lastSyncTimestamp;
      const now = new Date();
      
      // Only track from October 6th, 2025 onwards
      const MIN_TRACKING_DATE = new Date('2025-10-06T00:00:00.000Z');
      const fromDate = lastSyncTime > MIN_TRACKING_DATE ? lastSyncTime : MIN_TRACKING_DATE;
      
      console.log(`[LiveSync] Checking for consignments from: ${fromDate.toISOString()}`);

      // Fetch consignments that were completed/closed since last sync (but not before Oct 6th)
      // Use a date range from the later of (last sync or Oct 6th) to now
      const allConsignments = await this.axylogAPI.getConsignmentsWithFilters({
        pickupDateFrom: fromDate.toISOString().split('T')[0],
        pickupDateTo: now.toISOString().split('T')[0],
      });

      // Filter to only include consignments with Positive delivery outcome
      const newConsignments = allConsignments.filter(c => c.delivery_OutcomeEnum === 'Positive');

      console.log(`[LiveSync] Found ${newConsignments.length} consignments with Positive outcome (${allConsignments.length} total in date range)`);

      if (newConsignments.length > 0) {
        // Get existing consignment numbers efficiently (just IDs, not full records)
        const existingConsignmentNos = new Set(
          (await executeWithRetry(async () => {
            return await db.select({ consignmentNo: consignments.consignmentNo })
              .from(consignments);
          })).map(c => c.consignmentNo)
        );

        const toInsert: typeof newConsignments = [];
        const toUpdate: typeof newConsignments = [];

        for (const consignment of newConsignments) {
          if (existingConsignmentNos.has(consignment.consignmentNo)) {
            toUpdate.push(consignment);
          } else {
            toInsert.push(consignment);
          }
        }

        let totalProcessed = 0;

        // Insert new consignments
        if (toInsert.length > 0) {
          console.log(`[LiveSync] Inserting ${toInsert.length} new consignments`);
          const consignmentsToInsert = toInsert.map(c => ({
            ...c,
            userId: 1,
            syncedAt: now, // Set sync timestamp
          }));
          await storage.createConsignmentsBatch(consignmentsToInsert);
          totalProcessed += toInsert.length;

          // Queue photo ingestion for new consignments
          for (const consignment of toInsert) {
            const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
            if (trackingLink) {
              const token = trackingLink.split('/').pop();
              if (token) {
                await photoWorker.enqueueJob(token, 'high');
              }
            }
          }
        }

        // Update existing consignments
        if (toUpdate.length > 0) {
          console.log(`[LiveSync] Updating ${toUpdate.length} existing consignments`);
          for (const consignment of toUpdate) {
            if (consignment.consignmentNo) {
              await storage.updateConsignmentByNumber(consignment.consignmentNo, {
                ...consignment,
                userId: 1,
                syncedAt: now, // Update sync timestamp
              });
            }
          }
          totalProcessed += toUpdate.length;

          // Queue photo ingestion for updated consignments (POD may have been added)
          for (const consignment of toUpdate) {
            const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
            if (trackingLink) {
              const token = trackingLink.split('/').pop();
              if (token) {
                await photoWorker.enqueueJob(token, 'high');
              }
            }
          }
        }

        if (totalProcessed > 0) {
          // Log successful sync
          await storage.logDataSync({
            syncedByUserId: 1,
            recordCount: totalProcessed,
            status: 'success',
            errorMessage: null,
          });
          console.log(`[LiveSync] Successfully synced ${totalProcessed} consignments (${toInsert.length} new, ${toUpdate.length} updated)`);
        } else {
          console.log('[LiveSync] No changes to sync');
        }
      } else {
        console.log('[LiveSync] No consignments found in date range');
      }

      // Update last sync timestamp
      await this.updateSyncState(now);
      console.log(`[LiveSync] Updated sync state to: ${now.toISOString()}`);

    } catch (error) {
      console.error('[LiveSync] Error during poll cycle:', error);
      
      // Log failed sync
      try {
        await storage.logDataSync({
          syncedByUserId: 1,
          recordCount: 0,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      } catch (logError) {
        console.error('[LiveSync] Failed to log sync error:', logError);
      }
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      pollIntervalMs: this.pollIntervalMs,
    };
  }
}

// Export singleton instance
export const liveSyncWorker = new LiveSyncWorker();
