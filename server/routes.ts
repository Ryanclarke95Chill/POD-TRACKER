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
      console.log("Fetching demo consignments for user ID:", req.user?.id);
      const consignments = await storage.getConsignmentsByUserId(req.user!.id);
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
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      if (req.body.importRows) {
        const { importRows } = req.body;
        
        console.log(`Processing simple import with ${importRows.length} rows`);
        console.log(`Sample row:`, importRows[0]);
        
        let importedCount = 0;
        
        for (const row of importRows) {
          try {
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
            
            console.log(`About to save consignment ${importedCount + 1}`);
            await storage.createConsignment(consignmentData);
            console.log(`Saved consignment ${importedCount + 1} successfully`);
            importedCount++;
          } catch (error) {
            console.error("Error creating consignment:", error);
            console.error("Error details:", error);
          }
        }
        
        return res.json({
          success: true,
          importedCount,
          message: `Successfully imported ${importedCount} consignments.`
        });
      }

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