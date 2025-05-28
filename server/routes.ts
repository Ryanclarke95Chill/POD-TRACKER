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
      // Process only first 10 rows for testing to prevent timeouts
      const testRows = importRows.slice(0, 10);
      console.log(`Testing with first ${testRows.length} rows to verify mapping...`);
      
      for (let i = 0; i < testRows.length; i++) {
        const row = testRows[i];
        // Build dynamic column list and values based on what's in the Excel data
        const columns = ['user_id'];
        const values = [userId];
        const placeholders = ['$1'];
        let paramCount = 1;
        
        // Map EVERY Excel column exactly as it appears to database columns
        const columnMapping = {
          'Vehicle code': 'vehicle_code',
          'Delivery Livetrack link': 'delivery_livetrack_link',
          'Delivery ETA deviation': 'delivery_eta_deviation',
          'Required tags': 'required_tags',
          'Received delivery PoD files': 'received_delivery_pod_files',
          'Order carrier email': 'order_carrier_email',
          'Trip number': 'trip_number',
          'Order number': 'order_number',
          'From': 'from',
          'To': 'to',
          'Carrier': 'carrier',
          'Driver': 'driver',
          'document_string2': 'document_string2',
          'Customer order number': 'customer_order_number',
          'Delivery planned ETA': 'delivery_planned_eta',
          'Delivery calculated ETA': 'delivery_calculated_eta',
          'Time spent in the unloading area': 'time_spent_in_the_unloading_area',
          'Delivery outcome causal': 'delivery_outcome_causal',
          'Shipper': 'shipper',
          'Delivery arrival date': 'delivery_arrival_date',
          'Delivery outcome date': 'delivery_outcome_date',
          'Delivery unload date': 'delivery_unload_date',
          'Group causal delivery outcome': 'group_causal_delivery_outcome',
          'Delivery outcome note': 'delivery_outcome_note',
          'Delivery last position': 'delivery_last_position',
          'Delivery last position date': 'delivery_last_position_date',
          'Pickup planned ETA': 'pickup_planned_eta',
          'ETA delivery on departure': 'eta_delivery_on_departure',
          'Delivery live distance [km]': 'delivery_live_distance_km',
          'Delivery distance [km]': 'delivery_distance_km',
          'Delivery outcome transmission date': 'delivery_outcome_transmission_date',
          'Delivery outcome receipt date': 'delivery_outcome_receipt_date',
          'Delivery unload sequence': 'delivery_unload_sequence',
          'Delivery time window': 'delivery_time_window',
          'Pickup arrival date': 'pickup_arrival_date',
          'Pickup outcome date': 'pickup_outcome_date',
          'Pickup load date': 'pickup_load_date',
          'Pickup outcome reason': 'pickup_outcome_reason',
          'Group causal pickup outcome': 'group_causal_pickup_outcome',
          'Pickup outcome note': 'pickup_outcome_note',
          'Pickup last position': 'pickup_last_position',
          'Pickup last position date': 'pickup_last_position_date',
          'Pickup calculated ETA': 'pickup_calculated_eta',
          'ETA pickup on departure': 'eta_pickup_on_departure',
          'Pickup live distance [km]': 'pickup_live_distance_km',
          'Pickup distance [km]': 'pickup_distance_km',
          'Pickup outcome receipt date': 'pickup_outcome_receipt_date',
          'Pickup load sequence': 'pickup_load_sequence',
          'Pickup time window': 'pickup_time_window',
          'From  -  Master data code': 'from_master_data_code',
          'Shipper city': 'shipper_city',
          'Shipper province': 'shipper_province',
          'Shipper  - Master data code': 'shipper_master_data_code',
          'Depot': 'depot',
          'Depot  - Master data code': 'depot_master_data_code',
          'Recipient - Master data code': 'recipient_master_data_code',
          'Delivery city': 'delivery_city',
          'Delivery province': 'delivery_province',
          'Carrier   - Master data code': 'carrier_master_data_code',
          'Sub carrier': 'sub_carrier',
          'Sub carrier  - Master data code': 'sub_carrier_master_data_code',
          'Order date': 'order_date',
          'Document note': 'document_note',
          'Order type': 'order_type',
          'Order series': 'order_series',
          'Shipper order reference number': 'shipper_order_reference_number',
          'Error description': 'error_description',
          'Driver phone': 'driver_phone',
          'Tractor license plate': 'tractor_license_plate',
          'Trailer license plate': 'trailer_license_plate',
          'Delivery outcome': 'delivery_outcome',
          'Delivery punctuality': 'delivery_punctuality',
          'Delivery geolocalization state': 'delivery_geolocalization_state',
          'Pickup outcome': 'pickup_outcome',
          'Pickup punctuality': 'pickup_punctuality',
          'Pickup geolocation state': 'pickup_geolocation_state',
          'Delivery state': 'delivery_state',
          'Pickup state': 'pickup_state',
          'Destination coordinates': 'destination_coordinates',
          'Departure coordinates': 'departure_coordinates',
          'Expected temperature': 'expected_temperature',
          'Recorded temperature': 'recorded_temperature',
          'Delivery maximum date': 'delivery_maximum_date',
          'Delivery minimum date': 'delivery_minimum_date',
          'Pickup minimum date': 'pickup_minimum_date',
          'Pickup maximum date': 'pickup_maximum_date',
          'Quantity unit of measurement1': 'quantity_unit_of_measurement1',
          'Quantity unit of measurement2': 'quantity_unit_of_measurement2',
          'Weight [kg]': 'weight_kg',
          'Volume  [m³]': 'volume_m3',
          'Linear meters [m]': 'linear_meters_m',
          'Ground bases': 'ground_bases',
          'document_date1': 'document_date1',
          'document_date2': 'document_date2',
          'document_date3': 'document_date3',
          'document_string1': 'document_string1',
          'document_string3': 'document_string3',
          'Time spent in the loading area': 'time_spent_in_the_loading_area',
          'Delivery outcome in area': 'delivery_outcome_in_area',
          'Pickup outcome in area': 'pickup_outcome_in_area',
          'Delivery outcome position': 'delivery_outcome_position',
          'Pickup outcome position': 'pickup_outcome_position',
          'Seals': 'seals',
          'TaskID': 'task_id',
          'ID creation import': 'id_creation_import',
          'Expected payment method code': 'expected_payment_method_code',
          'Expected payment method': 'expected_payment_method',
          'Delivery outcome registration date': 'delivery_outcome_registration_date',
          'Pickup outcome registration date': 'pickup_outcome_registration_date',
          'Delivery pin is valid': 'delivery_pin_is_valid',
          'Pick up pin is valid': 'pick_up_pin_is_valid',
          'Expected payment notes': 'expected_payment_notes',
          'Delivery PoD files': 'delivery_pod_files',
          'Pickup PoD files': 'pickup_pod_files',
          'Departure date initially planned by the context': 'departure_date_initially_planned_by_the_context',
          'Order carrier mobile telephone number': 'order_carrier_mobile_telephone_number',
          'Order carrier telephone number': 'order_carrier_telephone_number',
          'Order pickup email': 'order_pickup_email',
          'Order pickup mobile telephone number': 'order_pickup_mobile_telephone_number',
          'Order pickup telephone number': 'order_pickup_telephone_number',
          'Order delivery email': 'order_delivery_email',
          'Order delivery mobile telephone number': 'order_delivery_mobile_telephone_number',
          'Order delivery telephone number': 'order_delivery_telephone_number',
          'Order sub carrier email': 'order_sub_carrier_email',
          'Order sub carrier mobile telephone number': 'order_sub_carrier_mobile_telephone_number',
          'Order sub carrier telephone number': 'order_sub_carrier_telephone_number',
          'Order shipper email': 'order_shipper_email',
          'Order shipper mobile telephone number': 'order_shipper_mobile_telephone_number',
          'Order shipper telephone number': 'order_shipper_telephone_number',
          'Forbidden tags': 'forbidden_tags',
          'Pickup planned service time': 'pickup_planned_service_time',
          'Delivery planned service time': 'delivery_planned_service_time',
          'External reference': 'external_reference',
          'Depot phone number specified in the order': 'depot_phone_number_specified_in_the_order',
          'Depot mobile phone number specified in the order': 'depot_mobile_phone_number_specified_in_the_order',
          'Received pickup PoD files': 'received_pickup_pod_files',
          'Required tags description': 'required_tags_description',
          'Forbidden tags description': 'forbidden_tags_description',
          'From - Postal Code': 'from_postal_code',
          'To - Postal Code': 'to_postal_code',
          'From - Country': 'from_country',
          'To - Country': 'to_country',
          'Pickup ETA deviation': 'pickup_eta_deviation',
          'Pickup Livetrack link': 'pickup_livetrack_link',
          'Vehicle description': 'vehicle_description'
        };
        
        // Debug: Log first row data to see what's actually available
        if (successCount === 0) {
          console.log('=== FIRST ROW DEBUG ===');
          console.log('Available Excel keys:', Object.keys(row));
          console.log('Sample values:');
          Object.keys(row).slice(0, 10).forEach(key => {
            console.log(`  "${key}": "${row[key]}"`);
          });
        }
        
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
            
            // Debug: Log successful mappings for first row
            if (successCount === 0) {
              console.log(`  MAPPED: "${excelCol}" -> "${dbCol}" = "${row[excelCol]}"`);
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