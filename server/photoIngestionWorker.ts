import { Cluster } from 'puppeteer-cluster';
import { storage } from './storage';
import { createHash } from 'crypto';

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
  private readonly concurrency = 8; // Increased from 3 to 8
  private readonly rateLimitDelay = 500; // 500ms between requests
  
  async initialize(): Promise<void> {
    console.log('Initializing photo ingestion worker with puppeteer-cluster...');
    
    this.cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_CONTEXT, // Each task gets its own browser context
      maxConcurrency: this.concurrency,
      timeout: 30000, // 30 second timeout
      puppeteerOptions: {
        headless: true,
        // Let Puppeteer use its bundled Chromium for better portability
        ...(process.env.PUPPETEER_EXECUTABLE_PATH && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
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
        ]
      }
    });

    // Define the photo extraction task for the cluster
    await this.cluster.task(async ({ page, data: token }: { page: any; data: string }) => {
      const trackingUrl = `https://live.axylog.com/${token}`;
      console.log(`[Worker] Extracting photos for token: ${token}`);
      
      try {
        // Block unnecessary resources for faster loading
        await page.setRequestInterception(true);
        page.on('request', (req: any) => {
          const resourceType = req.resourceType();
          if (['font', 'stylesheet'].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setViewport({ width: 1280, height: 720 });
        
        await page.goto(trackingUrl, { 
          waitUntil: 'networkidle0',
          timeout: 20000
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          await page.waitForSelector('img', { timeout: 8000 });
        } catch (e) {
          console.log(`[Worker] No images found for token ${token}, but proceeding...`);
        }
        
        // Extract all image elements and their metadata
        const images = await page.evaluate(() => {
          const imgElements = Array.from(document.querySelectorAll('img'));
          return imgElements.map(img => ({
            src: img.src,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            alt: img.alt || '',
            className: img.className || ''
          }));
        });
        
        const extractedPhotos: ExtractedPhoto[] = [];
        
        for (const img of images) {
          // Filter out UI elements and invalid images
          if (!img.src || img.width < 50 || img.height < 50) continue;
          if (img.src.includes('ghost.svg') || img.src.includes('loading')) continue;
          if (img.alt?.toLowerCase().includes('logo') || img.className?.includes('logo')) continue;
          
          // Classify as signature or regular photo using dimensions and text
          const aspectRatio = img.width / Math.max(img.height, 1);
          const text = (img.alt + ' ' + img.className).toLowerCase();
          
          // Signature photos are typically wide and short (high aspect ratio)
          const isDimensionSignature = img.width >= 600 && img.height <= 400 && aspectRatio >= 2.0;
          
          // Also check text content as backup
          const isTextSignature = text.includes('signature') || text.includes('firma') || text.includes('sign');
          
          const isSignature = isDimensionSignature || isTextSignature;
          
          extractedPhotos.push({
            url: img.src,
            kind: isSignature ? 'signature' : 'photo',
            width: img.width,
            height: img.height
          });
        }
        
        console.log(`[Worker] Found ${extractedPhotos.length} photos for token ${token}`);
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
    
    // Check if we already have processed photos for this token
    const existingPhotos = await storage.getPhotoAssetsByToken(token);
    if (existingPhotos.length > 0 && existingPhotos.some(p => p.status === 'available')) {
      return; // Already have photos
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
        kind: 'photo',
        width: null,
        height: null,
        hash: null,
        status: 'pending',
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
        kind: 'photo',
        width: null,
        height: null,
        hash: null,
        status: 'failed',
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
        kind: 'photo',
        width: null,
        height: null,
        hash: null,
        status: 'failed',
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
          kind: photo.kind,
          width: photo.width || null,
          height: photo.height || null,
          hash,
          status: 'available' as const,
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
            kind: asset.kind,
            width: asset.width,
            height: asset.height,
            hash: asset.hash,
            status: asset.status,
            errorMessage: asset.errorMessage
          })));
        }
      }
      
      // Filter out assets that already exist by hash
      const newAssets = uniqueAssets.filter(asset => !existingHashes.has(asset.hash));
      
      if (newAssets.length > 0) {
        await storage.createPhotoAssetsBatch(newAssets);
        console.log(`[Worker] Stored ${newAssets.length} unique photos for token ${token} (${photoAssets.length - newAssets.length} duplicates filtered)`);
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
      
      for (const consignment of consignments) {
        // Extract token from delivery tracking link
        if (consignment.deliveryLiveTrackLink) {
          const token = this.extractTokenFromUrl(consignment.deliveryLiveTrackLink);
          if (token) {
            await this.enqueueJob(token, 'low');
          }
        }
        
        // Extract token from pickup tracking link
        if (consignment.pickupLiveTrackLink) {
          const token = this.extractTokenFromUrl(consignment.pickupLiveTrackLink);
          if (token) {
            await this.enqueueJob(token, 'low');
          }
        }
      }
      
      console.log(`[Worker] Enqueued ${this.jobQueue.length} photo ingestion jobs`);
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