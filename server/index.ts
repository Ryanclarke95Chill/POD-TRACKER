import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { photoWorker } from "./photoIngestionWorker";
import { liveSyncWorker } from "./liveSyncWorker";
import axylogProxy from "./axylog-proxy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add unhandled rejection and exception handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log the error but don't exit the process
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log the error but don't exit the process in development
  if (process.env.NODE_ENV === 'production') {
    // In production, we might want to gracefully shut down
    process.exit(1);
  }
});

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Ensure API routes are handled before Vite middleware
app.use('/api', (req, res, next) => {
  // Mark API requests for special handling
  req.isApiRequest = true;
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Mount axylog proxy routes FIRST to bypass all middleware
  app.use('/axylog-proxy', axylogProxy);
  
  // Register all other API routes
  const server = await registerRoutes(app);
  
  // In production, serve built frontend files
  if (app.get("env") === "production") {
    serveStatic(app);
  } else {
    // Development mode - use Vite dev server
    await setupVite(app, server);
  }

  // Enhanced global error handler (after Vite setup)
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    // Log the error for debugging
    console.error('Express error handler caught:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    // Check if this is a database connection error
    const isDatabaseError = err.message?.includes('connection') ||
                           err.message?.includes('database') ||
                           err.message?.includes('WebSocket closed') ||
                           err.message?.includes('SQL client unable to establish connection') ||
                           err.code === '57P01' ||
                           err.code === '57P03' ||
                           err.code === '08006' ||
                           err.code === '08000' ||
                           err.code === 'ECONNRESET' ||
                           err.code === 'ECONNREFUSED' ||
                           err.code === 'ETIMEDOUT' ||
                           err.code === 'EHOSTUNREACH';

    let status = err.status || err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // Provide user-friendly messages for database errors
    if (isDatabaseError) {
      status = 503; // Service Unavailable
      message = "Database temporarily unavailable. Please try again in a moment.";
    }
    
    // Only send response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(status).json({ 
        message,
        ...(process.env.NODE_ENV === 'development' && { 
          stack: err.stack,
          originalError: err.message 
        })
      });
    }
  });

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Initialize and start background photo ingestion worker
    try {
      console.log('Starting background photo ingestion worker...');
      await photoWorker.initialize();
      
      // Enqueue existing consignments for background processing
      await photoWorker.enqueueFromConsignments();
      
      console.log('Photo ingestion worker started successfully');
    } catch (error) {
      console.error('Failed to start photo ingestion worker:', error);
      // Continue running server even if worker fails to start
    }

    // Start live sync worker for real-time Axylog integration
    try {
      console.log('Starting live Axylog sync worker...');
      await liveSyncWorker.start();
      console.log('Live sync worker started successfully');
    } catch (error) {
      console.error('Failed to start live sync worker:', error);
      // Continue running server even if worker fails to start
    }
  });
})();
