import { Cluster } from 'puppeteer-cluster';
import { storage } from './storage';
import { createHash } from 'crypto';
import { invalidatePhotoCache, normalizeToken } from './routes';
import { filterAndClassifyPhotos, extractThumbnails, extractFullResolution, type PhotoCandidate } from './photoFilters';

// Security-aware browser arguments based on environment
function getSecureBrowserArgs(): string[] {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isNixOS = process.env.NIX_PATH || process.env.nixPkgs || process.env.REPLIT_ENVIRONMENT;
  
  const baseArgs = [
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-features=VizDisplayCompositor',
    '--disable-plugins',
    '--disable-sync',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--memory-pressure-off'
  ];
  
  // Handle sandbox configuration based on environment
  if (isNixOS) {
    // NixOS/Replit environment - sandbox permissions can't be fixed by user
    console.log('🔧 [ENVIRONMENT] NixOS detected - using --no-sandbox due to SUID sandbox configuration restrictions');
    baseArgs.push('--no-sandbox', '--disable-setuid-sandbox');
  } else if (isDevelopment && process.env.PUPPETEER_SKIP_SANDBOX === 'true') {
    console.warn('⚠️ [SECURITY WARNING] Running Chromium without sandbox in development mode');
    baseArgs.push('--no-sandbox', '--disable-setuid-sandbox');
  } else {
    console.log('✅ [SECURITY] Running Chromium with sandbox enabled');
  }
  
  return baseArgs;
}

interface PhotoIngestionJob {
  token: string;
  priority: 'high' | 'low';
  retryCount?: number;
}

interface ExtractedPhoto {
  url: string;
  kind: 'photo' | 'signature';
  width?: number;
  height?: number;
}

export class PhotoIngestionWorker {
  private cluster: Cluster | null = null;
  private jobQueue: PhotoIngestionJob[] = [];
  private activeJobs = new Set<string>();
  private isProcessing = false;
  private readonly maxRetries = 3;
  private readonly batchSize = 5;
  
  // Rate limiting to respect Axylog servers
  private readonly concurrency = this.parseConcurrencyConfig(); // Configurable, default 3
  private readonly rateLimitDelay = 500; // 500ms between requests
  
  /**
   * Safely parse PHOTO_WORKER_CONCURRENCY environment variable with validation and fallback
   * @returns Valid concurrency value between 1-6, defaulting to 3
   */
  private parseConcurrencyConfig(): number {
    const DEFAULT_CONCURRENCY = 3;
    const MIN_CONCURRENCY = 1;
    const MAX_CONCURRENCY = 6;
    
    const envValue = process.env.PHOTO_WORKER_CONCURRENCY;
    
    // Handle undefined, null, empty string, or whitespace-only values
    if (!envValue || typeof envValue !== 'string' || envValue.trim().length === 0) {
      console.log(`[Worker Config] PHOTO_WORKER_CONCURRENCY not set or empty, using default: ${DEFAULT_CONCURRENCY}`);
      return DEFAULT_CONCURRENCY;
    }
    
    // Parse the trimmed value
    const parsed = parseInt(envValue.trim(), 10);
    
    // Handle NaN or non-finite numbers
    if (isNaN(parsed) || !isFinite(parsed)) {
      console.warn(`[Worker Config] Invalid PHOTO_WORKER_CONCURRENCY value "${envValue}", using default: ${DEFAULT_CONCURRENCY}`);
      return DEFAULT_CONCURRENCY;
    }
    
    // Clamp to reasonable range
    const clamped = Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, parsed));
    
    if (clamped !== parsed) {
      console.warn(`[Worker Config] PHOTO_WORKER_CONCURRENCY value ${parsed} out of range [${MIN_CONCURRENCY}-${MAX_CONCURRENCY}], clamped to: ${clamped}`);
    } else {
      console.log(`[Worker Config] Using PHOTO_WORKER_CONCURRENCY: ${clamped}`);
    }
    
    return clamped;
  }
  
  async initialize(): Promise<void> {
    console.log('Initializing photo ingestion worker with puppeteer-cluster...');
    
    this.cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_CONTEXT, // Each task gets its own browser context
      maxConcurrency: this.concurrency,
      timeout: 30000, // 30 second timeout
      puppeteerOptions: {
        headless: true,
        // Use system Chromium or fallback to bundled version
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: getSecureBrowserArgs()
      }
    });

    // Define the photo extraction task for the cluster
    await this.cluster.task(async ({ page, data: token }: { page: any; data: string }) => {
      const trackingUrl = `https://live.axylog.com/${token}`;
      console.log(`[Worker] Extracting photos for token: ${token}`);
      
      try {
        // Apply improved resource blocking logic for photo extraction
        await page.setRequestInterception(true);
        page.on('request', (req: any) => {
          const resourceType = req.resourceType();
          const url = req.url();
          const isDebugMode = process.env.PHOTO_WORKER_DEBUG === 'true';
          
          // CRITICAL FIX: Allow data: URI images (base64 images - often signatures)
          if (url.startsWith('data:image/')) {
            if (isDebugMode) console.log(`🔓 [WORKER] Allowing data URI image: ${url.substring(0, 50)}...`);
            req.continue();
            return;
          }
          
          try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            
            const isAxylogDomain = hostname === 'live.axylog.com' || hostname.endsWith('.axylog.com');
            const isBlobStorage = hostname.includes('blob.core.windows.net') || hostname === 'axylogdata.blob.core.windows.net';
            
            // Allow ALL resources for axylog domains and blob storage - no blocking
            if (isAxylogDomain || isBlobStorage) {
              if (isDebugMode) console.log(`🔓 [WORKER] Allowing ${resourceType}: ${url.substring(0, 80)}...`);
              req.continue();
              return;
            }
            
            // Allow stylesheets for trusted CDNs and scripts
            const isTrustedCDN = url.includes('cdnjs.cloudflare.com') || url.includes('unpkg.com');
            const isGoogleResource = url.includes('googleapis.com') || url.includes('gstatic.com');
            
            // Allow essential external resources but be more selective
            const isEssentialExternal = (
              (resourceType === 'script' || resourceType === 'stylesheet') && (isTrustedCDN || isGoogleResource)
            );
            
            // Block OpenStreetMap tiles entirely - not needed for photo extraction
            const isOpenStreetMap = url.includes('openstreetmap.org') || url.includes('tile.openstreetmap.org');
            
            // Block SignalR and other real-time connections that cause noise
            const isSignalR = url.includes('signalr.net') || url.includes('signalr');
            const isWebSocket = resourceType === 'websocket' || url.includes('ws:/') || url.includes('wss:/');
            
            if (isOpenStreetMap || isSignalR || isWebSocket) {
              // Silently block these - they're expected to fail and cause log noise
              req.abort();
              return;
            }
            
            if (isEssentialExternal) {
              if (isDebugMode) console.log(`🔓 [WORKER] Allowing external: ${url.substring(0, 80)}...`);
              req.continue();
            } else if (resourceType === 'image') {
              // Be more permissive with images - they might be POD photos
              if (isDebugMode) console.log(`🔓 [WORKER] Allowing image (permissive): ${url.substring(0, 80)}...`);
              req.continue();
            } else {
              // Block non-essential resources silently to reduce log noise
              if (isDebugMode) console.log(`🚫 [WORKER] Blocking ${resourceType}: ${url.substring(0, 80)}...`);
              req.abort();
            }
          } catch (error) {
            // Only log URL parsing errors for axylog domains - others are expected
            if (url.includes('axylog.com') || url.includes('blob.core.windows.net')) {
              console.log(`❌ [WORKER] URL parsing failed for: ${url}, allowing request`);
            }
            req.continue(); // Allow on parsing error to avoid breaking the page
          }
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setViewport({ width: 1280, height: 720 });
        
        await page.goto(trackingUrl, { 
          waitUntil: 'networkidle2', // Wait for network to be idle (better for dynamic content)
          timeout: 20000 // Increased timeout for slower pages
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000)); // Increased wait time for dynamic content
        
        try {
          await page.waitForSelector('img', { timeout: 8000 });
        } catch (e) {
          console.log(`[Worker] No images found for token ${token}, but proceeding...`);
        }
        
        // Extract all image elements and their metadata
        const images: PhotoCandidate[] = await page.evaluate(() => {
          const imgElements = Array.from(document.querySelectorAll('img'));
          return imgElements.map(img => ({
            src: img.src,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            alt: img.alt || '',
            className: img.className || ''
          }));
        });
        
        console.log(`[Worker] Extracted ${images.length} raw images from page for token ${token}`);
        
        // THUMBNAIL-FIRST STRATEGY: Extract smaller images for fast loading
        const filteredPhotos = extractThumbnails(images);
        
        console.log(`[Worker] After thumbnail extraction: ${filteredPhotos.length} thumbnails (${filteredPhotos.filter(p => p.kind === 'photo').length} delivery photos, ${filteredPhotos.filter(p => p.kind === 'signature').length} signatures) from ${images.length} raw images`);
        
        // Convert to ExtractedPhoto format
        const extractedPhotos: ExtractedPhoto[] = filteredPhotos.map(photo => ({
          url: photo.url,
          kind: photo.kind,
          width: photo.width,
          height: photo.height
        }));
        
        return extractedPhotos;
        
      } catch (error) {
        console.error(`[Worker] Error extracting photos for token ${token}:`, error);
        throw error;
      }
    });
    
    // Start processing queue
    this.startProcessing();
    console.log('Photo ingestion worker initialized successfully');
  }
  
  async enqueueJob(token: string, priority: 'high' | 'low' = 'low'): Promise<void> {
    // Skip if already processing this token
    if (this.activeJobs.has(token)) {
      return;
    }
    
    // Check if we already have delivery photos (kind='photo') for this token
    // Note: We don't skip if we only have signatures - we need delivery photos too!
    const existingPhotos = await storage.getPhotoAssetsByToken(token);
    const hasDeliveryPhotos = existingPhotos.some(p => p.status === 'available' && p.kind === 'photo');
    if (hasDeliveryPhotos) {
      return; // Already have delivery photos
    }
    
    // Remove any existing jobs for this token and add new one
    this.jobQueue = this.jobQueue.filter(job => job.token !== token);
    
    const job: PhotoIngestionJob = { token, priority, retryCount: 0 };
    
    // Insert based on priority
    if (priority === 'high') {
      this.jobQueue.unshift(job);
    } else {
      this.jobQueue.push(job);
    }
    
    console.log(`[Worker] Enqueued job for token ${token} with priority ${priority}`);
  }
  
  private async startProcessing(): Promise<void> {
    if (this.isProcessing || !this.cluster) return;
    
    this.isProcessing = true;
    console.log('[Worker] Started processing photo ingestion queue');
    
    while (this.isProcessing) {
      try {
        // Process jobs in batches
        const batch = this.jobQueue.splice(0, this.batchSize);
        if (batch.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s if no jobs
          continue;
        }
        
        // Process batch concurrently with rate limiting
        const promises = batch.map(async (job, index) => {
          // Stagger requests to respect rate limit
          await new Promise(resolve => setTimeout(resolve, index * this.rateLimitDelay));
          return this.processJob(job);
        });
        
        await Promise.allSettled(promises);
        
      } catch (error) {
        console.error('[Worker] Error in processing loop:', error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s on error
      }
    }
  }
  
  private async processJob(job: PhotoIngestionJob): Promise<void> {
    const { token, priority, retryCount = 0 } = job;
    
    if (this.activeJobs.has(token)) {
      return; // Already processing
    }
    
    this.activeJobs.add(token);
    
    try {
      console.log(`[Worker] Processing job for token ${token} (attempt ${retryCount + 1})`);
      
      // Mark token as pending in database
      await this.markTokenAsPending(token);
      
      // Extract photos using cluster
      const extractedPhotos = await this.cluster!.execute(token);
      
      if (extractedPhotos && extractedPhotos.length > 0) {
        // Store photos in database
        await this.storePhotos(token, extractedPhotos);
        console.log(`[Worker] Successfully processed ${extractedPhotos.length} photos for token ${token}`);
      } else {
        // No photos found, still mark as processed
        await this.markTokenAsNoPhotos(token);
        console.log(`[Worker] No photos found for token ${token}`);
      }
      
    } catch (error: any) {
      console.error(`[Worker] Error processing token ${token}:`, error);
      
      // Retry logic
      if (retryCount < this.maxRetries) {
        const retryJob = { ...job, retryCount: retryCount + 1 };
        // Add retry job back to queue with delay
        setTimeout(() => {
          this.jobQueue.push(retryJob);
        }, Math.pow(2, retryCount) * 1000); // Exponential backoff
        
        console.log(`[Worker] Scheduled retry ${retryCount + 1}/${this.maxRetries} for token ${token}`);
      } else {
        // Mark as failed after max retries
        await this.markTokenAsFailed(token, error.message);
        console.error(`[Worker] Failed to process token ${token} after ${this.maxRetries} attempts`);
      }
    } finally {
      this.activeJobs.delete(token);
    }
  }
  
  private async markTokenAsPending(token: string): Promise<void> {
    try {
      // Create a pending placeholder asset
      await storage.createPhotoAsset({
        token,
        url: '', // Placeholder
        fullResUrl: null,
        kind: 'photo',
        width: null,
        height: null,
        hash: null,
        status: 'pending',
        fullResStatus: 'pending',
        errorMessage: null
      });
    } catch (error) {
      // Ignore if already exists
    }
  }
  
  private async markTokenAsNoPhotos(token: string): Promise<void> {
    // Update any pending assets to indicate no photos found
    const existingAssets = await storage.getPhotoAssetsByToken(token);
    const pendingAssets = existingAssets.filter(asset => asset.status === 'pending');
    
    if (pendingAssets.length > 0) {
      // Update pending assets to failed status with appropriate message
      for (const asset of pendingAssets) {
        await storage.updatePhotoAssetStatus(asset.id, 'failed', 'No photos found in tracking page');
      }
    } else {
      // Create a marker asset to indicate this token was processed but has no photos
      await storage.createPhotoAsset({
        token,
        url: '', // Empty URL for no-photos marker
        fullResUrl: null,
        kind: 'photo',
        width: null,
        height: null,
        hash: null,
        status: 'failed',
        fullResStatus: 'failed',
        errorMessage: 'No photos found in tracking page'
      });
    }
  }
  
  private async markTokenAsFailed(token: string, errorMessage: string): Promise<void> {
    // Update any pending assets to failed status
    const existingAssets = await storage.getPhotoAssetsByToken(token);
    const pendingAssets = existingAssets.filter(asset => asset.status === 'pending');
    
    if (pendingAssets.length > 0) {
      // Update pending assets to failed status
      for (const asset of pendingAssets) {
        await storage.updatePhotoAssetStatus(asset.id, 'failed', errorMessage);
      }
    } else {
      // Create a marker asset to indicate this token failed processing
      await storage.createPhotoAsset({
        token,
        url: '', // Empty URL for failed marker
        fullResUrl: null,
        kind: 'photo',
        width: null,
        height: null,
        hash: null,
        status: 'failed',
        fullResStatus: 'failed',
        errorMessage
      });
    }
  }
  
  private async storePhotos(token: string, photos: ExtractedPhoto[]): Promise<void> {
    // Create photo assets with proper deduplication
    const photoAssets = await Promise.all(
      photos.map(async photo => {
        const hash = this.generatePhotoHash(photo.url);
        return {
          token,
          url: photo.url,
          fullResUrl: null, // Full-res will be fetched on-demand
          kind: photo.kind,
          width: photo.width || null,
          height: photo.height || null,
          hash,
          status: 'available' as const,
          fullResStatus: 'pending' as const, // Full-res pending until requested
          errorMessage: null
        };
      })
    );
    
    // Deduplicate by hash within this batch
    const uniqueAssets = photoAssets.filter((asset, index, arr) => 
      arr.findIndex(a => a.hash === asset.hash) === index
    );
    
    if (uniqueAssets.length > 0) {
      // Get existing assets to check for cross-batch duplicates BEFORE deleting
      const existingAssets = await storage.getPhotoAssetsByToken(token);
      const existingHashes = new Set(existingAssets.map(asset => asset.hash).filter(hash => hash));
      
      // Only delete pending placeholders, preserve actual photo assets
      const pendingAssets = existingAssets.filter(asset => asset.status === 'pending');
      if (pendingAssets.length > 0) {
        await storage.deletePhotoAssetsByToken(token);
        // Re-create non-pending assets that weren't placeholders
        const nonPendingAssets = existingAssets.filter(asset => asset.status !== 'pending');
        if (nonPendingAssets.length > 0) {
          await storage.createPhotoAssetsBatch(nonPendingAssets.map(asset => ({
            token: asset.token,
            url: asset.url,
            fullResUrl: asset.fullResUrl || null,
            kind: asset.kind,
            width: asset.width,
            height: asset.height,
            hash: asset.hash,
            status: asset.status,
            fullResStatus: asset.fullResStatus || 'pending',
            errorMessage: asset.errorMessage
          })));
        }
      }
      
      // Filter out assets that already exist by hash
      const newAssets = uniqueAssets.filter(asset => !existingHashes.has(asset.hash));
      
      if (newAssets.length > 0) {
        await storage.createPhotoAssetsBatch(newAssets);
        console.log(`[Worker] Stored ${newAssets.length} unique photos for token ${token} (${photoAssets.length - newAssets.length} duplicates filtered)`);
        
        // Invalidate in-memory cache after successful photo storage
        try {
          const { invalidatePhotoCache } = await import('./routes');
          const normalizedToken = token.toLowerCase().trim(); // Basic normalization
          const cacheCleared = invalidatePhotoCache(normalizedToken);
          if (cacheCleared) {
            console.log(`[Worker] Invalidated cache for token ${normalizedToken}`);
          }
        } catch (error) {
          console.error(`[Worker] Failed to invalidate cache for token ${token}:`, error);
        }
      } else {
        console.log(`[Worker] All ${photoAssets.length} photos for token ${token} were duplicates, none stored`);
      }
    }
  }
  
  private generatePhotoHash(url: string): string {
    return createHash('md5').update(url).digest('hex');
  }
  
  async stop(): Promise<void> {
    console.log('[Worker] Stopping photo ingestion worker...');
    this.isProcessing = false;
    
    if (this.cluster) {
      await this.cluster.close();
      this.cluster = null;
    }
    
    console.log('[Worker] Photo ingestion worker stopped');
  }
  
  // Method to bulk enqueue jobs from consignments  
  async enqueueFromConsignments(): Promise<void> {
    try {
      const consignments = await storage.getAllConsignments();
      console.log(`[Worker] Found ${consignments.length} consignments for photo ingestion`);
      
      // Process ALL consignments to ensure complete photo coverage
      // Photos that already exist will be skipped by the enqueueJob method
      for (const consignment of consignments) {
        // Extract token from delivery tracking link
        if (consignment.deliveryLiveTrackLink) {
          const token = this.extractTokenFromUrl(consignment.deliveryLiveTrackLink);
          if (token) {
            await this.enqueueJob(token, 'low'); // Low priority for background preload
          }
        }
        
        // Extract token from pickup tracking link
        if (consignment.pickupLiveTrackLink) {
          const token = this.extractTokenFromUrl(consignment.pickupLiveTrackLink);
          if (token) {
            await this.enqueueJob(token, 'low'); // Low priority for background preload
          }
        }
      }
      
      console.log(`[Worker] Enqueued ${this.jobQueue.length} photo ingestion jobs for all consignments`);
    } catch (error) {
      console.error('[Worker] Error enqueuing jobs from consignments:', error);
    }
  }
  
  private extractTokenFromUrl(url: string): string | null {
    try {
      const match = url.match(/https:\/\/live\.axylog\.com\/(.+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
  
  // Status methods
  getQueueStatus() {
    return {
      queueLength: this.jobQueue.length,
      activeJobs: this.activeJobs.size,
      isProcessing: this.isProcessing
    };
  }
}

// Export singleton instance
export const photoWorker = new PhotoIngestionWorker();