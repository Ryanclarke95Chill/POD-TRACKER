import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool, db } from "./db";
import { consignments } from "@shared/schema";
import { sql } from "drizzle-orm";

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

  app.get("/api/consignments", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      console.log("=== CONSIGNMENTS ENDPOINT DEBUG ===");
      console.log("Fetching consignments for user ID:", req.user?.id);
      
      // Force direct database query to bypass any caching
      const directQuery = await pool.query('SELECT COUNT(*) FROM consignments WHERE user_id = $1', [req.user!.id]);
      console.log("Direct database count:", directQuery.rows[0].count);
      
      const consignments = await storage.getConsignmentsByUserId(req.user!.id);
      console.log(`Storage returned ${consignments.length} consignments`);
      console.log("First consignment sample:", consignments[0]?.consignmentNumber);
      
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

  // Completely rebuilt import route that can handle any Excel columns
  app.post("/api/admin/import-direct", authenticate, async (req: AuthRequest, res: Response) => {
    console.log("=== REBUILT IMPORT ROUTE ===");
    const userId = req.user!.id;
    const { importRows } = req.body;
    
    console.log(`Processing ${importRows?.length || 0} rows for database import`);
    
    if (!importRows || !Array.isArray(importRows)) {
      console.log("ERROR: No import data provided");
      return res.status(400).json({ success: false, message: "No import data provided" });
    }
    
    let successCount = 0;
    
    try {
      for (const row of importRows) {
        // Build dynamic column list and values based on what's in the Excel data
        const columns = ['user_id'];
        const values = [userId];
        const placeholders = ['$1'];
        let paramCount = 1;
        
        // Map common Excel columns to database columns
        const columnMapping = {
          'consignmentNumber': 'consignment_number',
          'customerName': 'customer_name',
          'pickupAddress': 'pickup_address',
          'deliveryAddress': 'delivery_address',
          'status': 'status',
          'estimatedDeliveryDate': 'estimated_delivery_date',
          'temperatureZone': 'temperature_zone',
          'lastKnownLocation': 'last_known_location',
          'quantity': 'quantity',
          'pallets': 'pallets',
          'spaces': 'spaces',
          'deliveryRun': 'delivery_run',
          'weightKg': 'weight_kg',
          'cubicMeters': 'cubic_meters',
          'shipper': 'shipper',
          'receiver': 'receiver',
          'notes': 'notes',
          'driver': 'driver',
          'vehicle': 'vehicle',
          'route': 'route'
        };
        
        // Add each available column from the Excel data
        for (const [excelCol, dbCol] of Object.entries(columnMapping)) {
          if (row[excelCol] !== undefined && row[excelCol] !== null && row[excelCol] !== '') {
            columns.push(dbCol);
            paramCount++;
            placeholders.push(`$${paramCount}`);
            
            // Handle different data types
            if (dbCol === 'quantity' || dbCol === 'pallets' || dbCol === 'spaces') {
              values.push(parseInt(row[excelCol]) || 0);
            } else {
              values.push(String(row[excelCol]));
            }
          }
        }
        
        // Always add events column
        columns.push('events');
        paramCount++;
        placeholders.push(`$${paramCount}`);
        values.push(JSON.stringify([{
          timestamp: new Date().toISOString(),
          description: "Excel import",
          location: "Import Center",
          type: "import"
        }]));
        
        // Build and execute the dynamic SQL with conflict handling
        const sql = `
          INSERT INTO consignments (${columns.join(', ')})
          VALUES (${placeholders.join(', ')})
          ON CONFLICT (consignment_number) DO NOTHING
          RETURNING id
        `;
        
        console.log(`Inserting row ${successCount + 1} with ${columns.length} columns`);
        const result = await pool.query(sql, values);
        
        // Only count as success if the row was actually inserted
        if (result.rows.length > 0) {
          successCount++;
        } else {
          console.log(`Skipped duplicate consignment: ${row.consignmentNumber || 'unknown'}`);
        }
        
        if (successCount % 100 === 0) {
          console.log(`Imported ${successCount} records...`);
        }
      }
      
      console.log(`Import completed: ${successCount} records saved to database`);
      return res.json({
        success: true,
        importedCount: successCount,
        message: `Successfully imported ${successCount} consignments to database.`
      });
      
    } catch (error: any) {
      console.error("Import error:", error);
      console.error("Error message:", error.message);
      return res.status(500).json({ 
        success: false, 
        message: "Import failed: " + error.message,
        importedCount: successCount 
      });
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
          
          // Force direct database insert bypassing any cache
          const insertQuery = `
            INSERT INTO consignments (
              user_id, consignment_number, customer_name, delivery_address, pickup_address,
              status, estimated_delivery_date, temperature_zone, last_known_location,
              quantity, pallets, events
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `;
          
          await pool.query(insertQuery, [
            consignmentData.userId,
            consignmentData.consignmentNumber,
            consignmentData.customerName,
            consignmentData.deliveryAddress,
            consignmentData.pickupAddress,
            consignmentData.status,
            consignmentData.estimatedDeliveryDate,
            consignmentData.temperatureZone,
            consignmentData.lastKnownLocation,
            consignmentData.quantity,
            consignmentData.pallets,
            JSON.stringify(consignmentData.events)
          ]);
          
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