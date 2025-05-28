import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET_KEY = process.env.JWT_SECRET || "chilltrack-secret-key";

interface AuthRequest extends Request {
  user?: { id: number; email: string };
}

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
  const httpServer = createServer(app);

  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      let user = await storage.getUserByEmail(email);
      
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

  app.get("/api/consignments", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      console.log("Fetching consignments for user ID:", req.user?.id);
      const consignments = await storage.getConsignmentsByUserId(req.user!.id);
      console.log(`Found ${consignments.length} consignments in database`);
      res.json(consignments);
    } catch (error) {
      console.error("Error fetching consignments:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

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
    console.log("=== NEW IMPORT ROUTE HIT ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      console.log("=== IMPORT DEBUG ===");
      console.log("Import request received with proper field mapping");
      console.log("Request body keys:", Object.keys(req.body));
      console.log("importRows length:", req.body.importRows?.length);
      console.log("Sample row:", req.body.importRows?.[0]);
      
      // Handle both direct importRows and mapped CSV data
      const { importRows, fieldMapping, combineFields } = req.body;
      
      if (!importRows || !Array.isArray(importRows)) {
        console.log("No importRows found in request");
        return res.status(400).json({ message: "No import data provided" });
      }
      
      console.log(`Processing ${importRows.length} rows with field mapping:`, fieldMapping);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Process each row and save to database
      for (let i = 0; i < importRows.length; i++) {
        const row = importRows[i];
        
        try {
          const consignmentData = {
            userId,
            consignmentNumber: row.consignmentNumber || `IMP-${Date.now()}-${i}`,
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
            quantity: row.quantity ? parseInt(row.quantity) : null,
            pallets: row.pallets ? parseInt(row.pallets) : null,
            spaces: row.spaces ? parseInt(row.spaces) : null,
            cubicMeters: row.cubicMeters || null,
            weightKg: row.weightKg || null,
            // Additional CSV columns
            shipper: row.shipper || null,
            deliveryLivetrackLink: row.deliveryLivetrackLink || null,
            customerOrderNumber: row.customerOrderNumber || null,
            documentString2: row.documentString2 || null,
            fromLocation: row.fromLocation || null,
            groupCausalDeliveryOutcome: row.groupCausalDeliveryOutcome || null,
            deliveryPlannedEta: row.deliveryPlannedEta || null,
            recordedTemperature: row.recordedTemperature || null,
            quantityUnitOfMeasurement1: row.quantityUnitOfMeasurement1 || null,
            quantityUnitOfMeasurement2: row.quantityUnitOfMeasurement2 || null,
            events: [
              {
                timestamp: new Date().toISOString(),
                description: "Package imported from CSV",
                location: "Import Center",
                type: "import"
              }
            ]
          };
          
          await storage.createConsignment(consignmentData);
          successCount++;
          
          if (successCount % 100 === 0) {
            console.log(`Saved ${successCount} consignments so far...`);
          }
          
        } catch (error) {
          console.error(`Error saving row ${i + 1}:`, error);
          errorCount++;
        }
      }
      
      console.log(`Import complete: ${successCount} saved, ${errorCount} errors`);
      
      return res.json({
        success: true,
        importedCount: successCount,
        errorCount,
        message: `Successfully imported ${successCount} consignments to database.`
      });

      return res.status(400).json({ message: "No import data provided" });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
  });

  return httpServer;
}