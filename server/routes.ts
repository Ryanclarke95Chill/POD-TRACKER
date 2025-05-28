import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { axylogAPI } from "./axylog";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET_KEY = process.env.JWT_SECRET || "chilltrack-secret-key";
// Always use demo data for reliability
// Completely deactivated Axylog API
const USE_AXYLOG_API = false;

interface AuthRequest extends Request {
  user?: { id: number; email: string };
}

// Authentication middleware
const authenticate = async (req: AuthRequest, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No authentication token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY) as { id: number; email: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize demo user and ensure we have demo consignments
  let demoUser = await storage.getUserByEmail("demo@chill.com.au");
  if (!demoUser) {
    console.log("Creating demo user...");
    const hashedPassword = await bcrypt.hash("demo123", 10);
    await storage.createUser({
      username: "demo",
      password: hashedPassword,
      email: "demo@chill.com.au",
      name: "Demo User",
    });
    demoUser = await storage.getUserByEmail("demo@chill.com.au");
  }

  // Check if demo user has consignments, if not seed them
  if (demoUser) {
    const existingConsignments = await storage.getConsignmentsByUserId(demoUser.id);
    if (existingConsignments.length === 0) {
      console.log("No consignments found for demo user. Seeding demo data...");
      await storage.seedDemoConsignments(demoUser.id);
    } else {
      console.log(`Found ${existingConsignments.length} existing consignments for demo user`);
    }
  }

  // Login route
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, {
        expiresIn: "24h",
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get consignments for the authenticated user
  app.get("/api/consignments", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;
      
      if (!userId || !userEmail) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Always use demo data for reliability
      console.log(`Fetching demo consignments for user ID: ${userId}`);
      const consignments = await storage.getConsignmentsByUserId(userId);
      res.json(consignments);
    } catch (error) {
      console.error("Error fetching consignments:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get a specific consignment by ID
  app.get("/api/consignments/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const consignmentId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // For now, we're only using demo data for individual consignment details
      // as the Axylog API may not provide individual consignment retrieval
      const consignment = await storage.getConsignmentById(consignmentId);
      
      if (!consignment) {
        return res.status(404).json({ message: "Consignment not found" });
      }
      
      if (consignment.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(consignment);
    } catch (error) {
      console.error("Error fetching consignment:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Admin route to import consignments from CSV or filter parameters
  app.post("/api/admin/clear", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      await storage.clearAllConsignments();
      res.json({ success: true, message: "All consignments cleared" });
    } catch (error) {
      console.error("Error clearing consignments:", error);
      res.status(500).json({ success: false, message: "Failed to clear consignments" });
    }
  });

  app.post("/api/admin/import", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      // Check if this is data from the simple import page
      if (req.body.importRows) {
        const { importRows, importToDatabase } = req.body;
        
        console.log(`Processing simple import with ${importRows.length} rows`);
        console.log(`Import to database flag: ${importToDatabase}`);
        console.log(`Sample row data:`, importRows[0]);
        
        // Always import to database now that we have PostgreSQL
        if (true) {
          let importedCount = 0;
          
          // Process each row and create consignments
          for (const row of importRows) {
            try {
              // Create a consignment from the mapped data with all required fields
              const consignmentData = {
                userId,
                consignmentNumber: row.consignmentNumber || `IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                customerName: row.customerName || "Imported Customer", 
                consignmentReference: row.consignmentReference || null,
                trackingLink: row.trackingLink || null,
                pickupAddress: row.pickupAddress || "Unknown Pickup",
                deliveryAddress: row.deliveryAddress || "Unknown Address",
                status: row.status || "In Transit",
                estimatedDeliveryDate: row.estimatedDeliveryDate || new Date().toISOString(),
                deliveryDate: row.deliveryDate || null,
                dateDelivered: row.dateDelivered || null,
                consignmentRequiredDeliveryDate: row.consignmentRequiredDeliveryDate || null,
                temperatureZone: row.temperatureZone || "Dry",
                lastKnownLocation: row.lastKnownLocation || "Processing Facility",
                deliveryRun: row.deliveryRun || null,
                quantity: parseInt(row.quantity) || null,
                pallets: parseInt(row.pallets) || null, 
                spaces: parseInt(row.spaces) || null,
                cubicMeters: row.cubicMeters || null,
                weightKg: row.weightKg || null,
                events: [
                  {
                    timestamp: new Date().toISOString(),
                    description: "Package imported into system",
                    location: "Import Center", 
                    type: "import"
                  }
                ]
              };
              
              console.log(`Attempting to save consignment ${importedCount + 1}:`, consignmentData);
              await storage.createConsignment(consignmentData);
              console.log(`Successfully saved consignment ${importedCount + 1}`);
              importedCount++;
            } catch (error) {
              console.error("Error creating consignment:", error);
              console.error("Failed row data:", row);
              console.error("Full error details:", error);
            }
          }
          
          return res.json({
            success: true,
            importedCount,
            message: `Successfully imported ${importedCount} consignments.`
          });
        }
      }
      
      // Handle legacy CSV file upload format
      const isFileUpload = req.headers['content-type']?.includes('multipart/form-data');
      
      if (isFileUpload) {
        // Handle CSV file import
        const fieldMapping = req.body.fieldMapping ? JSON.parse(req.body.fieldMapping) : {};
        const combineFields = req.body.combineFields ? JSON.parse(req.body.combineFields) : {};
        const importToDatabase = req.body.importToDatabase === 'true';
        const updateExisting = req.body.updateExisting === 'true';
        
        // Process the file here
        console.log("Processing CSV import with field mapping", { 
          fieldMappingKeys: Object.keys(fieldMapping),
          combineFieldsKeys: Object.keys(combineFields),
          importToDb: importToDatabase,
          update: updateExisting
        });
        
        // This path shouldn't be used anymore - redirect to proper processing
        return res.status(400).json({
          success: false,
          message: "Please use the new import format with importRows"
        });
      }
      
      // Otherwise, handle filter-based import (existing functionality)
      const { 
        pickupDateFrom, 
        pickupDateTo, 
        deliveryEmail, 
        customerName,
        importToDatabase,
        refreshExisting 
      } = req.body;
      
      if (!pickupDateFrom || !pickupDateTo) {
        return res.status(400).json({ message: "Date range is required" });
      }
      
      // Always using demo data for reliability and easier testing
      console.log("Using demo data for consignment imports");
      
      console.log(`Admin importing consignments with filters:`, {
        pickupDateFrom,
        pickupDateTo,
        deliveryEmail: deliveryEmail || "Any",
        customerName: customerName || "Any"
      });
      
      // Use demo data for all imports
      let consignments = [];
      try {
        // Get data from the demo user
        const user = await storage.getUserByEmail("demo@chill.com.au");
        if (user) {
          consignments = await storage.getConsignmentsByUserId(user.id);
          
          // Apply filters if provided
          if (deliveryEmail) {
            consignments = consignments.filter(c => 
              c.deliveryAddress.toLowerCase().includes(deliveryEmail.toLowerCase())
            );
          }
          
          if (customerName) {
            consignments = consignments.filter(c => 
              c.customerName.toLowerCase().includes(customerName.toLowerCase())
            );
          }
        }
      } catch (error) {
        console.error("Error fetching consignments:", error);
        return res.status(500).json({ 
          message: "Failed to fetch consignments",
          error: String(error) 
        });
      }
      
      // Import to database if requested
      let importedCount = 0;
      let errors = 0;
      
      if (importToDatabase && consignments.length > 0) {
        for (const consignment of consignments) {
          try {
            // Check if consignment already exists
            const existingConsignment = await storage.getConsignmentByNumber(
              consignment.consignmentNumber
            );
            
            if (existingConsignment) {
              if (refreshExisting) {
                // Update existing consignment
                await storage.updateConsignment({
                  ...consignment,
                  id: existingConsignment.id,
                  userId // Ensure user ID is set correctly
                });
                importedCount++;
              }
            } else {
              // Add new consignment
              await storage.createConsignment({
                ...consignment,
                userId // Ensure user ID is set correctly
              });
              importedCount++;
            }
          } catch (error) {
            console.error(`Error importing consignment ${consignment.consignmentNumber}:`, error);
            errors++;
          }
        }
      }
      
      res.json({
        fetched: consignments.length,
        imported: importedCount,
        errors
      });
    } catch (error) {
      console.error("Error during admin import:", error);
      res.status(500).json({ message: "Import failed", error: String(error) });
    }
  });

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Something went wrong" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
