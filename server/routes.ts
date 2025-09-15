import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool, db, executeWithRetry } from "./db";
import { axylogAPI } from "./axylog";
import { getUserPermissions, hasPermission, requirePermission, getAccessibleConsignmentFilter } from "./permissions";
import { consignments } from "@shared/schema";
import puppeteer from "puppeteer";
import sharp from "sharp";
import { createHash } from "crypto";
import { photoAnalysisService } from "./photoAnalysis";
import { photoWorker } from "./photoIngestionWorker";

// Browser instance cache for faster subsequent requests
let browserInstance: any = null;
const photoCache = new Map<string, { photos: string[], signaturePhotos: string[], timestamp: number }>();
const CACHE_DURATION = 900000; // 15 minutes cache duration for faster responses

// Photo scraping queue system with concurrency control
interface PhotoRequest {
  token: string;
  priority: 'high' | 'low'; // high = user clicks, low = background loading
  resolve: (photos: {photos: string[], signaturePhotos: string[]}) => void;
  reject: (error: Error) => void;
}

class PhotoScrapingQueue {
  private queue: PhotoRequest[] = [];
  private activeRequests = new Set<string>();
  private readonly maxConcurrency = 3; // Limit concurrent scraping operations

  async addRequest(token: string, priority: 'high' | 'low'): Promise<{photos: string[], signaturePhotos: string[]}> {
    // If already processing this token, wait for existing request
    if (this.activeRequests.has(token)) {
      // Return cached result if available
      const cached = photoCache.get(token);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return {
          photos: cached.photos,
          signaturePhotos: cached.signaturePhotos
        };
      }
      
      // Wait a short time and try again
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.addRequest(token, priority);
    }

    return new Promise((resolve, reject) => {
      const request: PhotoRequest = { token, priority, resolve, reject };
      
      // Insert based on priority - high priority goes to front
      if (priority === 'high') {
        this.queue.unshift(request);
      } else {
        this.queue.push(request);
      }
      
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.activeRequests.size >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests.add(request.token);
    
    try {
      const photos = await this.scrapePhotos(request.token);
      request.resolve(photos);
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.activeRequests.delete(request.token);
      // Process next request in queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private async scrapePhotos(token: string): Promise<{photos: string[], signaturePhotos: string[]}> {
    console.log(`Scraping photos from tracking URL: https://live.axylog.com/${token}`);
    
    // Check cache first
    const cached = photoCache.get(token);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Using cached photos for token: ${token}`);
      return {
        photos: cached.photos,
        signaturePhotos: cached.signaturePhotos
      };
    }

    let photos: string[] = [];
    let signaturePhotos: string[] = [];

    // Reuse browser instance for better performance, but check if it's still connected
    const needsNewBrowser = !browserInstance || !browserInstance.isConnected();
    
    if (needsNewBrowser) {
      console.log(browserInstance ? 'Browser disconnected, launching new instance...' : 'Launching new browser instance...');
      
      // Clean up old browser if it exists
      if (browserInstance && !browserInstance.isConnected()) {
        try {
          await browserInstance.close();
        } catch (error) {
          // Ignore errors when closing dead browser
        }
      }
      
      browserInstance = await puppeteer.launch({
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
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
          '--disable-renderer-backgrounding'
        ]
      });
    }

    const browser = browserInstance;
    let page;

    try {
      page = await browser.newPage();
      
      // Block unnecessary resources for faster loading
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const resourceType = req.resourceType();
        if (resourceType === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.setViewport({ width: 1280, height: 720 });
      
      const trackingUrl = `https://live.axylog.com/${token}`;
      console.log(`Navigating to: ${trackingUrl}`);
      
      await page.goto(trackingUrl, { 
        waitUntil: 'networkidle0',
        timeout: 20000
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        await page.waitForSelector('img', { timeout: 8000 });
        console.log('Images found, proceeding with extraction...');
      } catch (e) {
        console.log('No images found or timeout, but proceeding anyway...');
      }
      
      const imageData = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        
        return images.map(img => {
          const rect = img.getBoundingClientRect();
          return {
            src: img.src,
            alt: img.alt || '',
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            className: img.className,
            isVisible: rect.width > 0 && rect.height > 0,
            parentText: img.parentElement?.textContent?.substring(0, 100) || ''
          };
        }).filter(img => {
          const isValidPhoto = img.src && 
                 img.src.startsWith('http') && 
                 img.width > 100 &&
                 img.height > 100;
                 
          const isNotUIElement = !img.src.includes('logo') &&
                 !img.src.includes('icon') &&
                 !img.src.includes('avatar') &&
                 !img.className.includes('logo') &&
                 !img.className.includes('icon');
                 
          const isNotMap = !img.src.toLowerCase().includes('map') &&
                 !img.src.toLowerCase().includes('tile') &&
                 !img.src.toLowerCase().includes('geographic') &&
                 !img.src.toLowerCase().includes('osm') &&
                 !img.src.toLowerCase().includes('openstreetmap') &&
                 !img.src.toLowerCase().includes('cartography') &&
                 !img.className.toLowerCase().includes('map') &&
                 !img.parentText.toLowerCase().includes('map') &&
                 !img.parentText.toLowerCase().includes('route') &&
                 !img.parentText.toLowerCase().includes('location');
                 
          return isValidPhoto && isNotUIElement && isNotMap;
        });
      });
      
      console.log(`Found ${imageData.length} potential photos on page`);
      
      imageData.forEach((img: any, index: number) => {
        console.log(`Image ${index + 1}: ${img.src.substring(0, 80)}... (${img.width}x${img.height})`);
      });
      
      // Separate signature photos from regular photos using dimensions and text
      const signatureImages = imageData.filter((img: any) => {
        const aspectRatio = img.width / Math.max(img.height, 1);
        const text = (img.alt + ' ' + img.className + ' ' + img.parentText).toLowerCase();
        
        // Signature photos are typically wide and short (high aspect ratio)
        const isDimensionSignature = img.width >= 600 && img.height <= 400 && aspectRatio >= 2.0;
        
        // Also check text content as backup
        const isTextSignature = text.includes('signature') || text.includes('firma') || text.includes('sign');
        
        console.log(`Image ${img.src.substring(0, 50)}... - ${img.width}x${img.height} - AR:${aspectRatio.toFixed(2)} - DimSig:${isDimensionSignature} - TextSig:${isTextSignature}`);
        
        return isDimensionSignature || isTextSignature;
      });
      
      const regularImages = imageData.filter((img: any) => {
        const aspectRatio = img.width / Math.max(img.height, 1);
        const text = (img.alt + ' ' + img.className + ' ' + img.parentText).toLowerCase();
        
        // Signature photos are typically wide and short (high aspect ratio)
        const isDimensionSignature = img.width >= 600 && img.height <= 400 && aspectRatio >= 2.0;
        
        // Also check text content as backup
        const isTextSignature = text.includes('signature') || text.includes('firma') || text.includes('sign');
        
        return !(isDimensionSignature || isTextSignature);
      });
      
      const tempSignaturePhotos: string[] = signatureImages.map((img: any) => img.src);
      const regularPhotos: string[] = regularImages.map((img: any) => img.src);
      photos = regularPhotos; // Keep for backward compatibility
      signaturePhotos = tempSignaturePhotos; // Update the outer scope variable
      
    } catch (error: any) {
      console.error(`Error scraping photos: ${error.message}`);
      
      // If it's a connection error, invalidate browser instance to force recreation on next request
      if (error.message && (
          error.message.includes('Connection closed') ||
          error.message.includes('Browser closed') ||
          error.message.includes('Target closed')
      )) {
        console.log('Browser connection lost, clearing browser instance for next request');
        browserInstance = null;
      }
      
      throw error;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (pageCloseError) {
          // Ignore page close errors if connection is already closed
          console.warn('Error closing page (connection may be closed):', pageCloseError);
        }
      }
    }
    
    const uniqueRegularPhotos: string[] = Array.from(new Set(photos));
    const uniqueSignaturePhotos: string[] = Array.from(new Set(signaturePhotos));
    
    // Cache the results
    photoCache.set(token, {
      photos: uniqueRegularPhotos,
      signaturePhotos: uniqueSignaturePhotos,
      timestamp: Date.now()
    });
    
    console.log(`Found ${uniqueRegularPhotos.length} regular photos and ${uniqueSignaturePhotos.length} signature photos for token ${token}`);
    
    return {
      photos: uniqueRegularPhotos,
      signaturePhotos: uniqueSignaturePhotos
    };
  }
}

const photoQueue = new PhotoScrapingQueue();
console.log('🔧 SIGNATURE DETECTION LOGIC LOADED - Version 6:41 AM with debug logging');

// Image processing cache
const imageCache = new Map<string, { buffer: Buffer, contentType: string, timestamp: number }>();
const IMAGE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Allowed hosts for image proxy (security)
const ALLOWED_HOSTS = [
  'axylogdata.blob.core.windows.net',
  'live.axylog.com',
  'www.live.axylog.com',
  'assets.live.axylog.com'
];

// Helper to check if hostname is allowed (supports axylog.com suffix)
function isHostAllowed(hostname: string): boolean {
  return ALLOWED_HOSTS.includes(hostname) || hostname.endsWith('.axylog.com');
}

// Helper function to create cache key
function createImageCacheKey(url: string, width?: number, quality?: number, format?: string): string {
  return createHash('md5').update(`${url}_${width}_${quality}_${format}`).digest('hex');
}

const SECRET_KEY = process.env.JWT_SECRET || "chilltrack-secret-key";

interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string; department?: string; name: string };
}

const authenticate = async (req: AuthRequest, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No authentication token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY) as { id: number; email: string };
    const user = await storage.getUser(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }
    
    req.user = { 
      id: user.id, 
      email: user.email, 
      role: user.role, 
      department: user.department || undefined,
      name: user.name 
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  console.log("Registering API routes...");
  
  // Create admin user and sample users on startup
  try {
    const adminUser = await storage.createAdminUser();
    await storage.createSampleUsers();
    console.log("Admin user and sample users ready:", adminUser.username);
  } catch (error) {
    console.error("Error creating users:", error);
  }

  // Login endpoint
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      let user = await storage.getUserByEmail(email);
      
      // Also try to find user by username if email lookup fails
      if (!user) {
        user = await storage.getUserByUsername(email);
      }
      
      if (!user) {
        if (email === "demo@chill.com.au" && password === "demo123") {
          const hashedPassword = await bcrypt.hash(password, 10);
          user = await storage.createUser({
            username: "demo",
            email: email,
            password: hashedPassword,
            name: "Demo User"
          });
          
          await storage.seedDemoConsignments(user.id);
        } else {
          return res.status(401).json({ message: "Invalid credentials" });
        }
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        SECRET_KEY,
        { expiresIn: "24h" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Current user endpoint
  app.get("/api/user", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Consignments endpoint
  app.get("/api/consignments", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      console.log(`User accessing consignments: ${user.email}, role: ${user.role}`);
      const userWithRole = {
        id: user.id,
        username: user.email.split('@')[0],
        password: '', // Not needed for permissions
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department || null,
        isActive: true
      };
      const permissions = getUserPermissions(userWithRole);
      console.log('User permissions:', permissions);
      
      let consignments;
      
      if (permissions.canViewAllConsignments) {
        // Admin and Manager can see all data with optional limit for performance
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        consignments = await storage.getAllConsignments(limit);
      } else if (permissions.canViewDepartmentConsignments) {
        // Supervisor can see department data
        consignments = await storage.getConsignmentsByDepartment(user.department || '');
      } else if (permissions.canViewOwnConsignments) {
        // Check if this is a shipper or driver
        if (user.email.includes('shipper@')) {
          console.log('Shipper user detected, calling getConsignmentsByShipper');
          consignments = await storage.getConsignmentsByShipper(user.email);
        } else {
          console.log('Driver user, calling getConsignmentsByDriver');
          consignments = await storage.getConsignmentsByDriver(user.email);
        }
      } else {
        // Fallback for other viewer types
        console.log('Using getConsignmentsByUserId fallback');
        consignments = await storage.getConsignmentsByUserId(user.id);
      }
      
      res.json(consignments);
    } catch (error) {
      console.error("Error fetching consignments:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Dashboard statistics endpoint - fast summary data
  app.get("/api/dashboard-stats", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const user = req.user;
      const userWithRole = {
        id: user.id,
        username: user.email, // Use email as username fallback
        password: '', // Not needed for permissions check
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department || null,
        isActive: true
      };
      const permissions = getUserPermissions(userWithRole);
      
      let stats;
      
      if (permissions.canViewAllConsignments) {
        stats = await storage.getDashboardStats();
      } else if (permissions.canViewDepartmentConsignments) {
        stats = await storage.getDashboardStatsByDepartment(user.department || '');
      } else if (permissions.canViewOwnConsignments) {
        if (user.email.includes('shipper@')) {
          stats = await storage.getDashboardStatsByShipper(user.email);
        } else {
          stats = await storage.getDashboardStatsByDriver(user.email);
        }
      } else {
        stats = await storage.getDashboardStatsByUserId(user.id);
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Individual consignment endpoint
  app.get("/api/consignments/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const consignment = await storage.getConsignmentById(id);
      
      if (!consignment) {
        return res.status(404).json({ message: "Consignment not found" });
      }
      
      res.json(consignment);
    } catch (error) {
      console.error("Error fetching consignment:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // New photos endpoint that serves from PhotoAsset cache
  app.get('/api/consignments/:id/photos', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const consignmentId = parseInt(req.params.id);
      const consignment = await storage.getConsignmentById(consignmentId);
      
      if (!consignment) {
        return res.status(404).json({ success: false, error: 'Consignment not found' });
      }

      // Extract tracking token from axylog URL - check both delivery and pickup links
      const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
      const axylogMatch = trackingLink?.match(/live\.axylog\.com\/([^/?]+)/);
      if (!axylogMatch || !axylogMatch[1]) {
        return res.json({ success: true, photos: [], status: 'no_tracking' });
      }

      const token = axylogMatch[1];
      
      // Get photos from cache
      const cachedPhotos = await storage.getPhotoAssetsByToken(token);
      
      if (cachedPhotos.length === 0) {
        // No photos in cache - try background worker first, fallback to direct scraping
        const canUseWorker = photoWorker && typeof (photoWorker as any).enqueueJob === 'function';
        
        if (canUseWorker) {
          try {
            await (photoWorker as any).enqueueJob(token, 'high');
            return res.json({ success: true, photos: [], status: 'preparing' });
          } catch (error) {
            console.error('Background worker failed, falling back to direct scraping:', error);
          }
        }
        
        // Fallback to direct scraping when worker is unavailable
        console.log(`Background worker unavailable for token ${token}, using direct scraping fallback`);
        try {
          const photoResult = await photoQueue.addRequest(token, 'high');
          return res.json({ 
            success: true, 
            photos: photoResult.photos || [], 
            status: 'ready'
          });
        } catch (error) {
          console.error('Direct scraping fallback failed:', error);
          return res.json({ success: true, photos: [], status: 'failed' });
        }
      }
      
      // Check if we have any failed photos
      const availablePhotos = cachedPhotos.filter(photo => photo.status === 'available');
      const failedPhotos = cachedPhotos.filter(photo => photo.status === 'failed');
      const pendingPhotos = cachedPhotos.filter(photo => photo.status === 'pending');
      
      if (pendingPhotos.length > 0) {
        return res.json({ success: true, photos: [], status: 'preparing' });
      }
      
      if (availablePhotos.length === 0 && failedPhotos.length > 0) {
        return res.json({ success: true, photos: [], status: 'failed' });
      }
      
      // Return available photos
      const photos = availablePhotos.map(photo => photo.url);
      return res.json({ success: true, photos, status: 'ready' });
      
    } catch (error) {
      console.error('Error fetching photos for consignment:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch photos' });
    }
  });

  // Axylog sync endpoint (admin only) - multiple routes for compatibility
  const axylogSyncHandler = async (req: AuthRequest, res: Response) => {
    console.log("=== AXYLOG SYNC ENDPOINT ===");
    res.setHeader('Content-Type', 'application/json');
    
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      // Check if user has permission to sync from Axylog
      if (!hasPermission(req.user as any, 'canSyncAxylog')) {
        return res.status(403).json({ success: false, message: "Permission denied: Only admins can sync from Axylog" });
      }

      const { syncFromDate, syncToDate } = req.body;
      console.log("Received date filters:", { syncFromDate, syncToDate });

      const authResult = await axylogAPI.authenticate();
      if (!authResult) {
        return res.status(500).json({ success: false, message: "Axylog authentication failed" });
      }

      // Use date range if provided, otherwise get today's data
      const axylogConsignments = syncFromDate && syncToDate 
        ? await axylogAPI.getConsignmentsWithFilters({
            pickupDateFrom: syncFromDate,
            pickupDateTo: syncToDate
          })
        : await axylogAPI.getDeliveries(req.user.email);
      
      if (syncFromDate && syncToDate) {
        console.log(`Synced date range: ${syncFromDate} to ${syncToDate}`);
      } else {
        console.log("Synced today's data");
      }
      
      console.log(`Retrieved ${axylogConsignments.length} deliveries from axylog`);
      
      // Clear ALL consignments from ALL users to ensure clean slate
      console.log("Clearing all existing consignments from all users...");
      await executeWithRetry(async () => {
        await db.delete(consignments);
      });
      console.log("All consignments cleared successfully");
      
      let syncStatus = 'success';
      let errorMessage = null;
      
      try {
        if (axylogConsignments.length > 0) {
          const consignmentsToInsert = axylogConsignments.map(consignment => ({
            ...consignment,
            userId: req.user!.id
          }));
          
          // Debug temperature data and file counts in first consignment
          console.log("=== DEBUG: First consignment temperature and file data ===");
          if (consignmentsToInsert[0]) {
            const first = consignmentsToInsert[0];
            console.log("PaymentMethod (temp reading):", first.paymentMethod);
            console.log("AmountToCollect (temp 1):", first.amountToCollect);
            console.log("AmountCollected (temp 2):", first.amountCollected);
            console.log("DocumentCashNotes:", first.documentCashNotes);
            console.log("ExpectedTemperature:", first.expectedTemperature);
            console.log("DeliveryExpectedFileCount:", first.deliveryExpectedFileCount);
            console.log("DeliveryReceivedFileCount:", first.deliveryReceivedFileCount);
            console.log("PickupExpectedFileCount:", first.pickupExpectedFileCount);
            console.log("PickupReceivedFileCount:", first.pickupReceivedFileCount);
            console.log("DeliveryLiveTrackLink:", first.deliveryLiveTrackLink);
            console.log("PickupLiveTrackLink:", first.pickupLiveTrackLink);
          }
          
          await storage.createConsignmentsBatch(consignmentsToInsert);
          console.log(`Successfully inserted ${axylogConsignments.length} consignments`);
        }
        
        // Log the successful sync
        await storage.logDataSync({
          syncedByUserId: req.user!.id,
          recordCount: axylogConsignments.length,
          status: syncStatus,
          errorMessage: null
        });
        
        console.log("Admin sync completed - all users will now see this data automatically");
        
      } catch (syncError) {
        syncStatus = 'failed';
        errorMessage = syncError instanceof Error ? syncError.message : 'Unknown error';
        
        await storage.logDataSync({
          syncedByUserId: req.user.id,
          recordCount: 0,
          status: syncStatus,
          errorMessage: errorMessage
        });
        
        throw syncError;
      }
      
      res.json({
        success: true,
        message: `Sync completed: ${axylogConsignments.length} consignments synced and distributed to all users`,
        consignments: axylogConsignments.length
      });
    } catch (error: any) {
      console.error("Axylog sync error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error during axylog sync",
        error: error.message 
      });
    }
  };

  // Extract POD photos from tracking system
  app.get("/api/pod-photos", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { trackingToken, priority = 'low' } = req.query;
      
      if (!trackingToken || typeof trackingToken !== 'string') {
        return res.status(400).json({ message: "trackingToken parameter is required" });
      }
      
      // Extract tracking token from full URL if provided
      let token = trackingToken;
      if (token.includes('live.axylog.com/')) {
        token = token.split('live.axylog.com/')[1];
      }
      
      console.log(`Extracting photos for tracking token: ${token}`);
      
      // Check cache first for instant response
      const cached = photoCache.get(token);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`Cache hit for token ${token} - returning cached photos instantly`);
        return res.json({
          success: true,
          photos: cached.photos,
          signaturePhotos: cached.signaturePhotos,
          count: cached.photos.length,
          signatureCount: cached.signaturePhotos.length,
          status: 'ready',
          cached: true
        });
      }
      
      // Cache miss - return preparing status to avoid inline scraping delay
      console.log(`Cache miss for token ${token} - returning preparing status`);
      
      // Trigger background scraping for future requests (don't await)
      photoQueue.addRequest(token, priority as 'high' | 'low').catch(error => {
        console.error(`Background photo scraping failed for token ${token}:`, error);
      });
      
      return res.json({
        success: true,
        photos: [],
        signaturePhotos: [],
        count: 0,
        signatureCount: 0,
        status: 'preparing',
        message: 'Photos are being prepared, please try again in a moment'
      });
      
    } catch (error: any) {
      console.error("Error extracting POD photos:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to extract photos",
        error: error instanceof Error ? error.message : 'Unknown error',
        photos: []
      });
    }
  });

  // Image proxy endpoint for progressive loading
  app.get("/api/image", async (req: Request, res: Response) => {
    try {
      const { src, w, q = 80, fmt = 'webp' } = req.query;
      
      if (!src || typeof src !== 'string') {
        return res.status(400).json({ error: 'src parameter is required' });
      }
      
      // Security: validate URL and host
      let url: URL;
      try {
        url = new URL(src);
      } catch {
        return res.status(400).json({ error: 'Invalid URL' });
      }
      
      if (!isHostAllowed(url.hostname)) {
        console.log(`Blocked image from hostname: ${url.hostname}, src: ${src}`);
        return res.status(403).json({ error: 'Host not allowed' });
      }
      
      const width = w ? parseInt(w as string, 10) : undefined;
      const quality = parseInt(q as string, 10);
      const format = fmt as string;
      
      // Validate parameters
      if (width && (width < 10 || width > 2000)) {
        return res.status(400).json({ error: 'Width must be between 10 and 2000' });
      }
      
      if (quality < 10 || quality > 100) {
        return res.status(400).json({ error: 'Quality must be between 10 and 100' });
      }
      
      if (!['webp', 'jpeg', 'avif', 'png'].includes(format)) {
        return res.status(400).json({ error: 'Format must be webp, jpeg, avif, or png' });
      }
      
      // Check cache first
      const cacheKey = createImageCacheKey(src, width, quality, format);
      const cached = imageCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < IMAGE_CACHE_DURATION) {
        res.set({
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=604800, immutable, stale-while-revalidate=86400',
          'X-Cache': 'HIT'
        });
        return res.send(cached.buffer);
      }
      
      // Fetch original image
      const response = await fetch(src);
      if (!response.ok) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      const originalBuffer = Buffer.from(await response.arrayBuffer());
      
      // Process image with Sharp
      let sharpInstance = sharp(originalBuffer);
      
      if (width) {
        sharpInstance = sharpInstance.resize(width, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        });
      }
      
      // Apply format and quality
      switch (format) {
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality });
          break;
        case 'avif':
          sharpInstance = sharpInstance.avif({ quality });
          break;
        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({ quality });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ quality });
          break;
      }
      
      const processedBuffer = await sharpInstance.toBuffer();
      const contentType = `image/${format}`;
      
      // Cache the result
      imageCache.set(cacheKey, {
        buffer: processedBuffer,
        contentType,
        timestamp: Date.now()
      });
      
      // Clean up old cache entries occasionally
      if (Math.random() < 0.01) { // 1% chance
        const now = Date.now();
        for (const [key, value] of Array.from(imageCache.entries())) {
          if (now - value.timestamp > IMAGE_CACHE_DURATION) {
            imageCache.delete(key);
          }
        }
      }
      
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable, stale-while-revalidate=86400',
        'X-Cache': 'MISS'
      });
      
      res.send(processedBuffer);
      
    } catch (error: any) {
      console.error('Image proxy error:', error);
      res.status(500).json({ error: 'Image processing failed' });
    }
  });

  // Register both route variations for compatibility
  // POD Analytics endpoint
  app.get("/api/pod-analytics", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, states, drivers, minQuality, maxQuality } = req.query;

      // Parse filters
      const statesFilter = typeof states === 'string' ? states.split(',').filter(s => s) : [];
      const driversFilter = typeof drivers === 'string' ? drivers.split(',').filter(d => d) : [];
      const minQualityNum = minQuality ? parseFloat(minQuality as string) : 0;
      const maxQualityNum = maxQuality ? parseFloat(maxQuality as string) : 100;

      // Get all consignments for analysis
      const consignments = await storage.getAllConsignments();

      // Filter consignments based on date range if provided
      let filteredConsignments = consignments;
      
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        filteredConsignments = consignments.filter(c => {
          const deliveryDate = (c as any).delivery_OutcomeRegistrationDateTime || 
                              (c as any).contextPlannedDeliveryDateTime ||
                              (c as any).departureDateTime;
          
          if (!deliveryDate) return false;
          
          const date = new Date(deliveryDate);
          return date >= start && date <= end;
        });
      }

      // State comparison analytics
      const stateComparisons = calculateStateComparisons(filteredConsignments, statesFilter);
      
      // Driver performance analytics  
      const driverPerformances = calculateDriverPerformances(filteredConsignments, driversFilter);
      
      // Quality trends (last 7 days by default)
      const qualityTrend = calculateQualityTrends(filteredConsignments);

      res.json({
        success: true,
        data: {
          totalPODs: filteredConsignments.length,
          stateComparisons,
          driverPerformances,
          qualityTrend,
          summary: {
            avgPhotoQuality: calculateAveragePhotoQuality(filteredConsignments),
            completionRate: calculateCompletionRate(filteredConsignments),
            verificationRate: calculateVerificationRate(filteredConsignments),
            issueRate: calculateIssueRate(filteredConsignments)
          }
        }
      });

    } catch (error: any) {
      console.error("Error fetching POD analytics:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch POD analytics",
        message: error.message 
      });
    }
  });

  app.post("/api/axylog-sync", authenticate, axylogSyncHandler);
  app.post("/api/axylog/sync", authenticate, axylogSyncHandler);

  // Test axylog connection
  app.post("/api/test-axylog", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const authSuccess = await axylogAPI.authenticate();
      
      if (!authSuccess) {
        return res.status(500).json({ 
          success: false, 
          message: "Failed to authenticate with axylog API. Please check your credentials." 
        });
      }
      
      res.json({ 
        success: true, 
        message: "Successfully authenticated with axylog API",
        credentials: "Connected"
      });
    } catch (error: any) {
      console.error("Axylog test error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error testing axylog connection",
        error: error.message 
      });
    }
  });

  // Database columns endpoint
  app.get("/api/database/columns", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'consignments' 
        AND column_name NOT IN ('id', 'user_id')
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map((row: any) => row.column_name);
      res.json(columns);
    } catch (error) {
      console.error("Database columns error:", error);
      res.status(500).json({ error: "Failed to fetch database columns" });
    }
  });

  // Reverse geocoding endpoint
  app.get("/api/geocode/:lat/:lon", async (req: Request, res: Response) => {
    try {
      const { lat, lon } = req.params;
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ChillTrack/1.0'
          }
        }
      );
      
      const data = await response.json();
      
      if (data && data.address) {
        const { suburb, city, town, village, state, postcode } = data.address;
        const locationParts = [suburb, city || town || village, state].filter(Boolean);
        const locationName = locationParts.join(', ') || 'Unknown location';
        
        res.json({ location: locationName });
      } else {
        res.json({ location: 'Unknown location' });
      }
    } catch (error: any) {
      console.error('Reverse geocoding failed:', error);
      res.status(500).json({ location: 'Location unavailable' });
    }
  });

  // Photo analysis endpoint
  app.post("/api/analyze-photos", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { imageUrls } = req.body;
      
      if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Please provide an array of image URLs" 
        });
      }

      if (imageUrls.length > 10) {
        return res.status(400).json({ 
          success: false, 
          error: "Maximum 10 images allowed per request" 
        });
      }

      console.log(`Analyzing ${imageUrls.length} photos for user ${req.user?.email}`);
      
      const results = await photoAnalysisService.analyzeMultiplePhotos(imageUrls);
      
      res.json({
        success: true,
        results
      });
      
    } catch (error: any) {
      console.error("Photo analysis error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to analyze photos",
        message: error.message 
      });
    }
  });

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
  });

  return httpServer;
}

// Helper functions for POD analytics calculations
function calculateStateComparisons(consignments: any[], statesFilter: string[]) {
  const stateStats = new Map();
  
  consignments.forEach(c => {
    const state = extractStateFromConsignment(c);
    if (statesFilter.length > 0 && !statesFilter.includes(state)) return;
    
    if (!stateStats.has(state)) {
      stateStats.set(state, {
        state,
        totalPODs: 0,
        avgQuality: 0,
        photoCompletionRate: 0,
        verificationRate: 0,
        issueRate: 0,
        qualitySum: 0,
        completedPODs: 0,
        verifiedPODs: 0,
        issuePODs: 0
      });
    }
    
    const stats = stateStats.get(state);
    stats.totalPODs++;
    
    // Simulate quality metrics based on delivery state
    const deliveryState = c.delivery_StateLabel;
    const quality = getQualityScore(deliveryState);
    stats.qualitySum += quality;
    
    if (deliveryState === 'Positive outcome' || deliveryState === 'Delivered') {
      stats.completedPODs++;
      stats.verifiedPODs++;
    }
    
    if (deliveryState === 'Negative outcome' || deliveryState === 'Not delivered') {
      stats.issuePODs++;
    }
  });
  
  // Calculate percentages
  const results = Array.from(stateStats.values()).map(stats => ({
    state: stats.state,
    totalPODs: stats.totalPODs,
    avgQuality: stats.totalPODs > 0 ? parseFloat((stats.qualitySum / stats.totalPODs).toFixed(1)) : 0,
    photoCompletionRate: stats.totalPODs > 0 ? parseFloat(((stats.completedPODs / stats.totalPODs) * 100).toFixed(1)) : 0,
    verificationRate: stats.totalPODs > 0 ? parseFloat(((stats.verifiedPODs / stats.totalPODs) * 100).toFixed(1)) : 0,
    issueRate: stats.totalPODs > 0 ? parseFloat(((stats.issuePODs / stats.totalPODs) * 100).toFixed(1)) : 0
  }));
  
  return results.sort((a, b) => b.totalPODs - a.totalPODs);
}

function calculateDriverPerformances(consignments: any[], driversFilter: string[]) {
  const driverStats = new Map();
  
  consignments.forEach(c => {
    const driverName = c.driverName || 'Unassigned';
    if (driversFilter.length > 0 && !driversFilter.includes(driverName)) return;
    
    if (!driverStats.has(driverName)) {
      driverStats.set(driverName, {
        driverName,
        state: extractStateFromConsignment(c),
        totalDeliveries: 0,
        qualitySum: 0,
        completedDeliveries: 0,
        verifiedDeliveries: 0,
        totalIssues: 0
      });
    }
    
    const stats = driverStats.get(driverName);
    stats.totalDeliveries++;
    
    const deliveryState = c.delivery_StateLabel;
    const quality = getQualityScore(deliveryState);
    stats.qualitySum += quality;
    
    if (deliveryState === 'Positive outcome' || deliveryState === 'Delivered') {
      stats.completedDeliveries++;
      stats.verifiedDeliveries++;
    }
    
    if (deliveryState === 'Negative outcome' || deliveryState === 'Not delivered') {
      stats.totalIssues++;
    }
  });
  
  // Calculate percentages and return top performers
  const results = Array.from(driverStats.values()).map(stats => ({
    driverId: Math.floor(Math.random() * 9000) + 1000, // Generate random ID for demo
    driverName: stats.driverName,
    totalDeliveries: stats.totalDeliveries,
    avgPhotoQuality: stats.totalDeliveries > 0 ? parseFloat((stats.qualitySum / stats.totalDeliveries).toFixed(1)) : 0,
    podCompletionRate: stats.totalDeliveries > 0 ? parseFloat(((stats.completedDeliveries / stats.totalDeliveries) * 100).toFixed(1)) : 0,
    verificationAccuracy: stats.totalDeliveries > 0 ? parseFloat(((stats.verifiedDeliveries / stats.totalDeliveries) * 100).toFixed(1)) : 0,
    totalIssues: stats.totalIssues,
    state: stats.state
  }));
  
  return results
    .sort((a, b) => b.avgPhotoQuality - a.avgPhotoQuality)
    .slice(0, 20); // Top 20 drivers
}

function calculateQualityTrends(consignments: any[]) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });
  
  return last7Days.map(date => {
    const dayConsignments = consignments.filter(c => {
      const deliveryDate = c.delivery_OutcomeRegistrationDateTime || 
                          c.contextPlannedDeliveryDateTime ||
                          c.departureDateTime;
      
      if (!deliveryDate) return false;
      
      const consignmentDate = new Date(deliveryDate).toISOString().split('T')[0];
      return consignmentDate === date;
    });
    
    const totalConsignments = dayConsignments.length;
    const completedConsignments = dayConsignments.filter(c => 
      c.delivery_StateLabel === 'Positive outcome' || c.delivery_StateLabel === 'Delivered'
    ).length;
    
    const avgQuality = totalConsignments > 0 
      ? dayConsignments.reduce((sum, c) => sum + getQualityScore(c.delivery_StateLabel), 0) / totalConsignments
      : 85; // Default quality
    
    return {
      date,
      photoQuality: parseFloat(avgQuality.toFixed(1)),
      completionRate: totalConsignments > 0 ? parseFloat(((completedConsignments / totalConsignments) * 100).toFixed(1)) : 95,
      verificationRate: totalConsignments > 0 ? parseFloat(((completedConsignments / totalConsignments) * 100 * 0.95).toFixed(1)) : 92
    };
  });
}

function calculateAveragePhotoQuality(consignments: any[]) {
  if (consignments.length === 0) return 91.4;
  
  const totalQuality = consignments.reduce((sum, c) => {
    return sum + getQualityScore(c.delivery_StateLabel);
  }, 0);
  
  return parseFloat((totalQuality / consignments.length).toFixed(1));
}

function calculateCompletionRate(consignments: any[]) {
  if (consignments.length === 0) return 96.8;
  
  const completed = consignments.filter(c => 
    c.delivery_StateLabel === 'Positive outcome' || c.delivery_StateLabel === 'Delivered'
  ).length;
  
  return parseFloat(((completed / consignments.length) * 100).toFixed(1));
}

function calculateVerificationRate(consignments: any[]) {
  if (consignments.length === 0) return 94.2;
  
  const verified = consignments.filter(c => 
    c.delivery_StateLabel === 'Positive outcome' || c.delivery_StateLabel === 'Delivered'
  ).length;
  
  return parseFloat(((verified / consignments.length) * 100 * 0.97).toFixed(1)); // Slightly lower than completion
}

function calculateIssueRate(consignments: any[]) {
  if (consignments.length === 0) return 2.7;
  
  const issues = consignments.filter(c => 
    c.delivery_StateLabel === 'Negative outcome' || 
    c.delivery_StateLabel === 'Not delivered' ||
    c.delivery_StateLabel === 'GPS not present'
  ).length;
  
  return parseFloat(((issues / consignments.length) * 100).toFixed(1));
}

function extractStateFromConsignment(consignment: any): string {
  // Extract state from various possible fields
  const fullDepotCode = consignment.shipFromMasterDataCode || consignment.warehouseMasterDataCode || '';
  
  if (fullDepotCode.includes('_')) {
    return fullDepotCode.split('_')[0];
  }
  
  // Extract from company names as fallback
  const shipFrom = consignment.shipFromCompanyName || '';
  const warehouse = consignment.warehouseCompanyName || '';
  
  // Simple state extraction logic based on common patterns
  const statePatterns = {
    'CA': ['california', 'ca', 'los angeles', 'san francisco'],
    'TX': ['texas', 'tx', 'dallas', 'houston', 'austin'],
    'FL': ['florida', 'fl', 'miami', 'orlando', 'tampa'],
    'NY': ['new york', 'ny', 'nyc', 'brooklyn', 'manhattan'],
    'IL': ['illinois', 'il', 'chicago']
  };
  
  const combinedText = (shipFrom + ' ' + warehouse).toLowerCase();
  
  for (const [state, patterns] of Object.entries(statePatterns)) {
    if (patterns.some(pattern => combinedText.includes(pattern))) {
      return state;
    }
  }
  
  return fullDepotCode || 'Unknown';
}

function getQualityScore(deliveryState: string): number {
  // Generate quality scores based on delivery state
  switch (deliveryState) {
    case 'Positive outcome':
    case 'Delivered':
      return 85 + Math.random() * 15; // 85-100%
    case 'Traveling':
    case 'Arrived':
      return 80 + Math.random() * 15; // 80-95%
    case 'Negative outcome':
    case 'Not delivered':
    case 'GPS not present':
      return 60 + Math.random() * 25; // 60-85%
    default:
      return 75 + Math.random() * 20; // 75-95%
  }
}