import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool, db } from "./db";
import { axylogAPI } from "./axylog";
import { getUserPermissions, hasPermission, requirePermission, getAccessibleConsignmentFilter } from "./permissions";
import { consignments } from "@shared/schema";

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
        // Admin and Manager can see all data - limit initial load for performance
        const limit = req.query.all === 'true' ? undefined : 100;
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

  // Axylog sync endpoint (admin only)
  app.post("/api/axylog-sync", authenticate, async (req: AuthRequest, res: Response) => {
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
      await db.delete(consignments);
      console.log("All consignments cleared successfully");
      
      let syncStatus = 'success';
      let errorMessage = null;
      
      try {
        if (axylogConsignments.length > 0) {
          const consignmentsToInsert = axylogConsignments.map(consignment => ({
            ...consignment,
            userId: req.user!.id
          }));
          
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
  });

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
    } catch (error) {
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

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
  });

  return httpServer;
}