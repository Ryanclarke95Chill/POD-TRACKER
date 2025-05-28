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

  // Smart Excel import with dynamic header normalization
  app.post("/api/admin/import-direct", authenticate, async (req: AuthRequest, res: Response) => {
    console.log("=== SMART EXCEL IMPORT ===");
    const userId = req.user!.id;
    const { importRows } = req.body;
    
    console.log(`Processing ${importRows?.length || 0} rows for database import`);
    
    if (!importRows || !Array.isArray(importRows)) {
      console.log("ERROR: No import data provided");
      return res.status(400).json({ success: false, message: "No import data provided" });
    }
    
    // Function to normalize Excel headers to database field names
    const normalizeHeader = (header: string): string => {
      // Specific mappings for your Excel headers - AVOID RESERVED SQL KEYWORDS
      const specificMappings: { [key: string]: string } = {
        'Vehicle code': 'vehicle_code',
        'Delivery Livetrack link': 'delivery_livetrack_link',
        'Delivery ETA deviation': 'delivery_eta_deviation',
        'Required tags': 'required_tags',
        'Received delivery PoD files': 'received_delivery_pod_files',
        'Order carrier email': 'order_carrier_email',
        'Trip number': 'trip_number',
        'Order number': 'order_number',
        'From': 'origin',
        'To': 'destination',
        'Carrier': 'carrier',
        'Driver': 'driver',
        'Customer order number': 'customer_order_number',
        'Shipper': 'shipper',
        'Weight [kg]': 'weight_kg',
        'document_string2': 'document_string2',
        'Delivery last position': 'delivery_last_position',
        'Delivery last position date': 'delivery_last_position_date',
        'Pickup planned ETA': 'pickup_planned_eta',
        'Pickup outcome date': 'pickup_outcome_date',
        'Pickup outcome reason': 'pickup_outcome_reason',
        'Group causal pickup outcome': 'group_causal_pickup_outcome',
        'Pickup last position': 'pickup_last_position',
        'Pickup last position date': 'pickup_last_position_date',
        'Pickup calculated ETA': 'pickup_calculated_eta'
      };
      
      // Check for exact match first
      if (specificMappings[header]) {
        return specificMappings[header];
      }
      
      // Fall back to general normalization
      return header
        .toLowerCase()                    // Convert to lowercase
        .trim()                          // Remove leading/trailing spaces
        .replace(/[\[\]()]/g, '')        // Remove brackets and parentheses
        .replace(/[^a-z0-9]/g, '_')      // Replace non-alphanumeric with underscores
        .replace(/_+/g, '_')             // Collapse multiple underscores
        .replace(/^_|_$/g, '');          // Remove leading/trailing underscores
    };
    
    // Get all database columns from the schema to match against
    const allDbColumns = [
      'consignment_number', 'customer_name', 'consignment_reference', 'tracking_link',
      'pickup_address', 'delivery_address', 'status', 'estimated_delivery_date',
      'delivery_date', 'date_delivered', 'consignment_required_delivery_date',
      'temperature_zone', 'last_known_location', 'delivery_run', 'quantity',
      'pallets', 'spaces', 'cubic_meters', 'weight_kg', 'shipper', 'receiver',
      'pickup_company', 'delivery_company', 'pickup_contact_name', 'delivery_contact_name',
      'pickup_contact_phone', 'delivery_contact_phone', 'special_instructions',
      'product_description', 'delivery_instructions', 'pickup_instructions',
      'delivery_livetrack_link', 'customer_order_number', 'document_string2',
      'from_location', 'to_location', 'group_causal_delivery_outcome',
      'delivery_planned_eta', 'recorded_temperature', 'quantity_unit_of_measurement',
      'quantity_unit_of_measurement1', 'quantity_unit_of_measurement2', 'route',
      'driver', 'vehicle', 'delivery_time', 'pickup_time', 'consignment_type',
      'priority', 'delivery_zone', 'pickup_zone', 'notes', 'customer_reference',
      'invoice_number', 'pod_signature', 'delivery_proof', 'vehicle_code',
      'delivery_eta_deviation', 'received_delivery_pod_files', 'trip_number',
      'from', 'to', 'carrier', 'required_tags', 'order_carrier_email', 'order_number',
      'delivery_calculated_eta', 'time_spent_in_the_unloading_area',
      'delivery_outcome_causal', 'delivery_arrival_date', 'delivery_outcome_date',
      'delivery_unload_date', 'delivery_outcome_note', 'delivery_last_position',
      'delivery_last_position_date', 'pickup_planned_eta', 'eta_delivery_on_departure',
      'delivery_live_distance_km', 'delivery_distance_km', 'delivery_outcome_transmission_date',
      'delivery_outcome_receipt_date', 'delivery_unload_sequence', 'delivery_time_window',
      'pickup_arrival_date', 'pickup_outcome_date', 'pickup_load_date',
      'pickup_outcome_reason', 'group_causal_pickup_outcome', 'pickup_outcome_note',
      'pickup_last_position', 'pickup_last_position_date', 'pickup_calculated_eta',
      'eta_pickup_on_departure', 'pickup_live_distance_km', 'pickup_distance_km',
      'pickup_outcome_receipt_date', 'pickup_load_sequence', 'pickup_time_window',
      'from_master_data_code', 'shipper_city', 'shipper_province',
      'shipper_master_data_code', 'depot', 'depot_master_data_code',
      'recipient_master_data_code', 'delivery_city', 'delivery_province',
      'carrier_master_data_code', 'sub_carrier', 'sub_carrier_master_data_code',
      'order_date', 'document_note', 'order_type', 'order_series',
      'shipper_order_reference_number', 'error_description', 'driver_phone',
      'tractor_license_plate', 'trailer_license_plate', 'delivery_outcome',
      'delivery_punctuality', 'delivery_geolocalization_state', 'pickup_outcome',
      'pickup_punctuality', 'pickup_geolocation_state', 'delivery_state',
      'pickup_state', 'destination_coordinates', 'departure_coordinates',
      'expected_temperature', 'delivery_maximum_date', 'delivery_minimum_date',
      'pickup_minimum_date', 'pickup_maximum_date', 'volume_m3', 'linear_meters_m',
      'ground_bases', 'document_date1', 'document_date2', 'document_date3',
      'document_string1', 'document_string3', 'time_spent_in_the_loading_area',
      'delivery_outcome_in_area', 'pickup_outcome_in_area', 'delivery_outcome_position',
      'pickup_outcome_position', 'seals', 'task_id', 'id_creation_import',
      'expected_payment_method_code', 'expected_payment_method',
      'delivery_outcome_registration_date', 'pickup_outcome_registration_date',
      'delivery_pin_is_valid', 'pick_up_pin_is_valid', 'expected_payment_notes',
      'delivery_pod_files', 'pickup_pod_files', 'departure_date_initially_planned_by_the_context',
      'order_carrier_mobile_telephone_number', 'order_carrier_telephone_number',
      'order_pickup_email', 'order_pickup_mobile_telephone_number',
      'order_pickup_telephone_number', 'order_delivery_email',
      'order_delivery_mobile_telephone_number', 'order_delivery_telephone_number',
      'order_sub_carrier_email', 'order_sub_carrier_mobile_telephone_number',
      'order_sub_carrier_telephone_number', 'order_shipper_email',
      'order_shipper_mobile_telephone_number', 'order_shipper_telephone_number',
      'forbidden_tags', 'pickup_planned_service_time', 'delivery_planned_service_time',
      'external_reference', 'depot_phone_number_specified_in_the_order',
      'depot_mobile_phone_number_specified_in_the_order', 'received_pickup_pod_files',
      'required_tags_description', 'forbidden_tags_description', 'from_postal_code',
      'to_postal_code', 'from_country', 'to_country', 'pickup_eta_deviation',
      'pickup_livetrack_link', 'vehicle_description'
    ];
    
    let successCount = 0;
    
    try {
      // Process first 10 rows for debugging
      const testRows = importRows.slice(0, 10);
      console.log(`Testing with first ${testRows.length} rows to verify mapping...`);
      
      // Build dynamic mapping from Excel headers to database columns
      const firstRow = testRows[0];
      const excelHeaders = Object.keys(firstRow);
      const headerMapping: { [key: string]: string } = {};
      
      console.log('\n=== HEADER NORMALIZATION ===');
      excelHeaders.forEach(header => {
        const normalized = normalizeHeader(header);
        if (allDbColumns.includes(normalized)) {
          headerMapping[header] = normalized;
          console.log(`✓ "${header}" → "${normalized}"`);
        } else {
          console.log(`✗ "${header}" → "${normalized}" (no DB match)`);
        }
      });
      
      console.log(`\nFound ${Object.keys(headerMapping).length} matching columns out of ${excelHeaders.length} Excel headers\n`);
      
      for (let i = 0; i < testRows.length; i++) {
        const row = testRows[i];
        const columns = ['user_id'];
        const values = [userId];
        const placeholders = ['$1'];
        let paramCount = 1;
        
        // Map each Excel column to database column using normalized headers
        for (const [excelHeader, dbColumn] of Object.entries(headerMapping)) {
          const value = row[excelHeader];
          if (value !== undefined && value !== null && value !== '') {
            // Escape reserved SQL keywords by wrapping in quotes
            const reservedKeywords = ['from', 'to', 'order', 'where', 'select', 'insert', 'update', 'delete'];
            const needsEscaping = reservedKeywords.some(keyword => dbColumn.toLowerCase().includes(keyword));
            const escapedColumn = needsEscaping ? `"${dbColumn}"` : dbColumn;
            
            columns.push(escapedColumn);
            paramCount++;
            placeholders.push(`$${paramCount}`);
            values.push(String(value));
            
            // Debug first row mapping
            if (successCount === 0) {
              console.log(`  MAPPED: "${excelHeader}" → "${dbColumn}" = "${value}"`);
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
        
        // Escape reserved SQL keywords by wrapping in quotes
        const escapedColumns = columns.map(col => {
          const reservedKeywords = ['from', 'to', 'order', 'where', 'select', 'insert', 'update', 'delete'];
          if (reservedKeywords.includes(col.toLowerCase())) {
            return `"${col}"`;
          }
          return col;
        });
        
        // Build and execute the dynamic SQL with conflict handling
        const sql = `
          INSERT INTO consignments (${escapedColumns.join(', ')})
          VALUES (${placeholders.join(', ')})
          RETURNING id
        `;
        
        console.log(`Inserting row ${successCount + 1} with ${columns.length} columns`);
        console.log('SQL Query:', sql);
        console.log('Escaped columns:', escapedColumns);
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