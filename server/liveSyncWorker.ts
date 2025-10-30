import { AxylogAPI } from './axylog';
import { storage } from './storage';
import { db, executeWithRetry } from './db';
import { axylogSyncState, consignments, consignmentScoreHistory, type Consignment } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { photoWorker } from './photoIngestionWorker';

// Simple server-side POD score calculator
function calculatePODScore(consignment: Consignment): {
  total: number;
  photoScore: number;
  signatureScore: number;
  receiverScore: number;
  temperatureScore: number;
} {
  let photoScore = 0;
  let signatureScore = 0;
  let receiverScore = 0;
  let temperatureScore = 0;

  // Photos (25 points) - based on received vs expected
  const received = consignment.pickupReceivedFileCount || 0;
  const expected = consignment.pickupExpectedFileCount || 0;
  if (expected > 0 && received >= expected) {
    photoScore = 25;
  }

  // Signature (15 points)
  if (consignment.deliverySignatureName || consignment.pickupSignatureName) {
    signatureScore = 15;
  }

  // Receiver name (20 points)
  if (consignment.deliverySignatureName) {
    receiverScore = 20;
  }

  // Temperature (40 points) - check if temperature is within valid ranges
  const temp1 = consignment.paymentMethod; // Primary temperature field
  const temp2 = consignment.amountToCollect; // Secondary temperature field
  
  const isValidTemp = (tempStr: string | null | undefined): boolean => {
    if (!tempStr || tempStr === 'null' || tempStr === '') return false;
    try {
      const temp = parseFloat(tempStr);
      if (isNaN(temp)) return false;
      // Frozen range: -25 to -15°C, Chilled range: 0 to 5°C
      return (temp >= -25 && temp <= -15) || (temp >= 0 && temp <= 5);
    } catch {
      return false;
    }
  };

  if (isValidTemp(temp1) || isValidTemp(temp2)) {
    temperatureScore = 40;
  }

  const total = photoScore + signatureScore + receiverScore + temperatureScore;

  return { total, photoScore, signatureScore, receiverScore, temperatureScore };
}

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
        // ALWAYS reset to October 6th on startup to ensure we get all data
        // This ensures both preview and production always sync from the beginning
        await executeWithRetry(async () => {
          await db.update(axylogSyncState)
            .set({
              lastSyncTimestamp: startDate,
              updatedAt: new Date(),
            })
            .where(eq(axylogSyncState.id, existing[0].id));
        });
        console.log(`[LiveSync] Reset sync state to ${startDate.toISOString()} to sync all data from October 6th`);
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

      // Fetch ALL consignments since last sync (but not before Oct 6th)
      // Include all statuses: pending, in-transit, delivered, etc.
      const newConsignments = await this.axylogAPI.getConsignmentsWithFilters({
        pickupDateFrom: fromDate.toISOString().split('T')[0],
        pickupDateTo: now.toISOString().split('T')[0],
      });

      console.log(`[LiveSync] Found ${newConsignments.length} total consignments in date range`);

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

        // Update existing consignments and track score changes
        if (toUpdate.length > 0) {
          console.log(`[LiveSync] Updating ${toUpdate.length} existing consignments`);
          for (const consignment of toUpdate) {
            if (consignment.consignmentNo) {
              // Get the old consignment to compare scores
              const oldConsignment = await storage.getConsignmentByNumber(consignment.consignmentNo);
              
              // Update the consignment
              await storage.updateConsignmentByNumber(consignment.consignmentNo, {
                ...consignment,
                userId: 1,
                syncedAt: now, // Update sync timestamp
              });

              // Track score changes (if old consignment exists)
              if (oldConsignment) {
                const oldScore = calculatePODScore(oldConsignment);
                const newScore = calculatePODScore({...oldConsignment, ...consignment});

                // Only log if score changed
                if (oldScore.total !== newScore.total) {
                  // Determine what changed
                  const changes: string[] = [];
                  if (oldScore.photoScore !== newScore.photoScore) changes.push('photos');
                  if (oldScore.signatureScore !== newScore.signatureScore) changes.push('signature');
                  if (oldScore.receiverScore !== newScore.receiverScore) changes.push('receiver');
                  if (oldScore.temperatureScore !== newScore.temperatureScore) changes.push('temperature');

                  await executeWithRetry(async () => {
                    await db.insert(consignmentScoreHistory).values({
                      consignmentNo: consignment.consignmentNo!,
                      warehouseName: consignment.warehouseCompanyName || null,
                      driverName: consignment.driverName || null,
                      orderRef: consignment.orderNumberRef || null,
                      score: newScore.total,
                      photoScore: newScore.photoScore,
                      signatureScore: newScore.signatureScore,
                      receiverScore: newScore.receiverScore,
                      temperatureScore: newScore.temperatureScore,
                      changeType: changes.length > 0 ? changes.join(', ') + ' updated' : 'full_sync',
                      changeDetails: `Score changed from ${oldScore.total} to ${newScore.total} (${changes.join(', ')})`,
                      syncSource: 'live_sync',
                    });
                  });
                }
              }
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
