import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool, db } from "./db";
import { consignments } from "@shared/schema";
import { sql } from "drizzle-orm";
import { axylogAPI } from "./axylog";

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

  // Ensure API routes are registered BEFORE any catch-all handlers
  console.log("Registering API routes...");
  


  // Axylog API Proxy - bypasses Vite dev server completely
  app.post("/axylog-proxy/sync", authenticate, async (req: AuthRequest, res: Response) => {
    console.log("=== AXYLOG PROXY SYNC ===");
    res.setHeader('Content-Type', 'application/json');
    
    try {
      if (!req.user?.email) {
        return res.status(400).json({ success: false, message: "User email required" });
      }

      // Direct axylog authentication and data fetch
      const authResult = await axylogAPI.authenticate();
      if (!authResult) {
        return res.status(500).json({ success: false, message: "Axylog authentication failed" });
      }

      const deliveries = await axylogAPI.getDeliveries(req.user.email);
      console.log(`Proxy retrieved ${deliveries.length} deliveries from axylog`);
      
      // Clear and insert consignments
      await storage.clearUserConsignments(req.user.id);
      
      let inserted = 0;
      for (const delivery of deliveries) {
        try {
          await storage.createConsignment({
            userId: req.user.id,
            consignmentNumber: delivery.consignmentNumber || null,
            customerName: delivery.customerName || null,
            consignmentReference: null,
            trackingLink: null,
            pickupAddress: delivery.pickupAddress || null,
            deliveryAddress: delivery.deliveryAddress || null,
            status: delivery.status || null,
            estimatedDeliveryDate: delivery.estimatedDeliveryDate || null,
            deliveryDate: null,
            dateDelivered: null,
            consignmentRequiredDeliveryDate: null,
            temperatureZone: delivery.temperatureZone || null,
            lastKnownLocation: delivery.lastKnownLocation || null,
            deliveryRun: null,
            quantity: null,
            pallets: null,
            spaces: null,
            cubicMeters: null,
            weightKg: null,
            shipper: null,
            receiver: null,
            pickupCompany: null,
            deliveryCompany: null,
            pickupContactName: null,
            deliveryContactName: null,
            pickupContactPhone: null,
            deliveryContactPhone: null,
            specialInstructions: null,
            productDescription: null,
            deliveryInstructions: null,
            pickupInstructions: null,
            deliveryLivetrackLink: null,
            customerOrderNumber: null,
            documentString2: null,
            fromLocation: null,
            toLocation: null,
            groupCausalDeliveryOutcome: null,
            deliveryPlannedEta: null,
            recordedTemperature: null,
            quantityUnitOfMeasurement: null,
            quantityUnitOfMeasurement1: null,
            quantityUnitOfMeasurement2: null,
            route: null,
            driver: null,
            vehicle: null,
            origin: null,
            destination: null,
            originPostalCode: null,
            originCountry: null,
            originMasterDataCode: null,
            destinationPostalCode: null,
            destinationCountry: null,
            deliveryTime: null,
            pickupTime: null,
            consignmentType: null,
            priority: null,
            deliveryZone: null,
            pickupZone: null,
            notes: null,
            customerReference: null,
            invoiceNumber: null,
            podSignature: null,
            deliveryProof: null,
            vehicleCode: null,
            deliveryEtaDeviation: null,
            requiredTags: null,
            receivedDeliveryPodFiles: null,
            orderCarrierEmail: null,
            tripNumber: null,
            orderNumber: null,
            from: null,
            to: null,
            carrier: null,
            deliveryCalculatedEta: null,
            timeSpentInTheUnloadingArea: null,
            deliveryOutcomeCausal: null,
            deliveryArrivalDate: null,
            deliveryOutcomeDate: null,
            deliveryUnloadDate: null,
            deliveryOutcomeNote: null,
            deliveryLastPosition: null,
            deliveryLastPositionDate: null,
            pickupPlannedEta: null,
            etaDeliveryOnDeparture: null,
            deliveryLiveDistanceKm: null,
            deliveryDistanceKm: null,
            deliveryOutcomeTransmissionDate: null,
            deliveryOutcomeReceiptDate: null,
            deliveryUnloadSequence: null,
            deliveryTimeWindow: null,
            pickupArrivalDate: null,
            pickupOutcomeDate: null,
            pickupLoadDate: null,
            pickupOutcomeReason: null,
            groupCausalPickupOutcome: null,
            pickupOutcomeNote: null,
            pickupLastPosition: null,
            pickupLastPositionDate: null,
            pickupCalculatedEta: null,
            etaPickupOnDeparture: null,
            pickupLiveDistanceKm: null,
            pickupDistanceKm: null,
            pickupOutcomeReceiptDate: null,
            pickupLoadSequence: null,
            pickupTimeWindow: null,
            fromMasterDataCode: null,
            shipperCity: null,
            shipperProvince: null,
            shipperMasterDataCode: null,
            depot: null,
            depotMasterDataCode: null,
            recipientMasterDataCode: null,
            deliveryCity: null,
            deliveryProvince: null,
            carrierMasterDataCode: null,
            subCarrier: null,
            subCarrierMasterDataCode: null,
            orderDate: null,
            documentNote: null,
            orderType: null,
            orderSeries: null,
            shipperOrderReferenceNumber: null,
            errorDescription: null,
            driverPhone: null,
            tractorLicensePlate: null,
            trailerLicensePlate: null,
            deliveryOutcome: null,
            deliveryPunctuality: null,
            deliveryGeolocalizationState: null,
            pickupOutcome: null,
            pickupPunctuality: null,
            pickupGeolocationState: null,
            deliveryState: null,
            pickupState: null,
            destinationCoordinates: null,
            departureCoordinates: null,
            expectedTemperature: null,
            deliveryMaximumDate: null,
            deliveryMinimumDate: null,
            pickupMinimumDate: null,
            pickupMaximumDate: null,
            volumeM3: null,
            linearMetersM: null,
            groundBases: null,
            documentDate1: null,
            documentDate2: null,
            documentDate3: null,
            documentString1: null,
            documentString3: null,
            timeSpentInTheLoadingArea: null,
            deliveryOutcomeInArea: null,
            pickupOutcomeInArea: null,
            deliveryOutcomePosition: null,
            pickupOutcomePosition: null,
            seals: null,
            taskId: null,
            idCreationImport: null,
            expectedPaymentMethodCode: null,
            expectedPaymentMethod: null,
            deliveryOutcomeRegistrationDate: null,
            pickupOutcomeRegistrationDate: null,
            deliveryPinIsValid: null,
            pickUpPinIsValid: null,
            expectedPaymentNotes: null,
            deliveryPodFiles: null,
            pickupPodFiles: null,
            departureDateInitiallyPlannedByTheContext: null,
            orderCarrierMobileTelephoneNumber: null,
            orderCarrierTelephoneNumber: null,
            orderPickupEmail: null,
            orderPickupMobileTelephoneNumber: null,
            orderPickupTelephoneNumber: null,
            orderDeliveryEmail: null,
            orderDeliveryMobileTelephoneNumber: null,
            orderDeliveryTelephoneNumber: null,
            orderSubCarrierEmail: null,
            orderSubCarrierMobileTelephoneNumber: null,
            orderSubCarrierTelephoneNumber: null,
            orderShipperEmail: null,
            orderShipperMobileTelephoneNumber: null,
            orderShipperTelephoneNumber: null,
            forbiddenTags: null,
            pickupPlannedServiceTime: null,
            deliveryPlannedServiceTime: null,
            externalReference: null,
            depotPhoneNumberSpecifiedInTheOrder: null,
            depotMobilePhoneNumberSpecifiedInTheOrder: null,
            receivedPickupPodFiles: null,
            requiredTagsDescription: null,
            forbiddenTagsDescription: null,
            fromPostalCode: null,
            toPostalCode: null,
            fromCountry: null,
            toCountry: null,
            pickupEtaDeviation: null,
            pickupLivetrackLink: null,
            vehicleDescription: null,
            events: JSON.stringify(delivery.events || [])
          });
          inserted++;
        } catch (insertError) {
          console.error("Insert error:", insertError);
        }
      }
      
      res.json({
        success: true,
        message: "Sync completed via proxy",
        synced: inserted,
        total: deliveries.length
      });
      
    } catch (error) {
      console.error("Proxy sync error:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

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

  app.get("/api/consignments", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      console.log("=== CONSIGNMENTS ENDPOINT DEBUG ===");
      console.log("Fetching consignments for user ID:", req.user?.id);
      
      // Force direct database query to bypass any caching
      const directQuery = await pool.query('SELECT COUNT(*) FROM consignments WHERE user_id = $1', [req.user!.id]);
      console.log("Direct database count:", directQuery.rows[0].count);
      
      const consignments = await storage.getConsignmentsByUserId(req.user!.id);
      console.log(`Storage returned ${consignments.length} consignments`);
      
      if (consignments.length > 0) {
        console.log("=== COMPLETE PAYLOAD SAMPLE ===");
        console.log("Full consignment record:");
        console.log(JSON.stringify(consignments[0], null, 2));
        
        console.log("\n=== FIELD BREAKDOWN ===");
        const sample = consignments[0];
        Object.keys(sample).forEach(key => {
          console.log(`${key}:`, sample[key as keyof typeof sample]);
        });
      }
      
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

  // Test endpoint to verify axylog connection
  app.post("/api/test-axylog", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      console.log("=== TESTING AXYLOG CONNECTION ===");
      
      // Test authentication
      const authSuccess = await axylogAPI.authenticate();
      console.log("Axylog authentication result:", authSuccess);
      
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

  // Working axylog sync endpoint with proper error handling
  app.post("/api/sync-axylog-now", authenticate, async (req: AuthRequest, res: Response) => {
    console.log("=== AXYLOG SYNC ENDPOINT REACHED ===");
    
    // Immediately set response headers to prevent routing issues
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    try {
      if (!req.user?.email) {
        return res.status(400).json({ 
          success: false, 
          message: "User email not found" 
        });
      }

      // Get date range from request body first
      const { fromDate, toDate } = req.body;
      
      console.log("Starting axylog sync for user:", req.user.email);
      console.log("Date parameters received:", { fromDate, toDate });
      
      // Test authentication first
      console.log("Attempting axylog authentication...");
      const authResult = await axylogAPI.authenticate();
      console.log("Authentication result:", authResult);
      
      if (!authResult) {
        console.log("Authentication failed");
        return res.status(500).json({
          success: false,
          message: "Failed to authenticate with axylog API"
        });
      }

      console.log("Axylog authentication successful");
      
      // Get deliveries from axylog with date range and filters
      const todayString = new Date().toISOString().split('T')[0];
      console.log("Calling axylogAPI.getConsignmentsWithFilters with:", {
        deliveryEmail: req.user.email,
        pickupDateFrom: fromDate || todayString,
        pickupDateTo: toDate || todayString
      });
      
      const axylogConsignments = await axylogAPI.getConsignmentsWithFilters({
        deliveryEmail: req.user.email,
        pickupDateFrom: fromDate || todayString,
        pickupDateTo: toDate || todayString
      });
      console.log(`Retrieved ${axylogConsignments.length} consignments from axylog`);
      
      if (axylogConsignments.length > 0) {
        console.log("=== FIRST CONSIGNMENT ETA DEBUG ===");
        const first = axylogConsignments[0];
        console.log("delivery_ETA:", first.delivery_ETA);
        console.log("delivery_FirstCalculatedETA:", first.delivery_FirstCalculatedETA);
        console.log("delivery_PlannedETA:", first.delivery_PlannedETA);
      }
      
      if (axylogConsignments.length === 0) {
        return res.json({
          success: true,
          message: "No consignments found in axylog",
          synced: 0
        });
      }

      // Clear existing consignments for this user first
      await storage.clearUserConsignments(req.user.id);
      console.log("Cleared existing consignments");
      
      // Insert new consignments one by one
      let successCount = 0;
      for (const consignment of axylogConsignments.slice(0, 10)) { // Limit to first 10 for testing
        try {
          await storage.createConsignment({
            userId: req.user.id,
            consignmentNumber: consignment.consignmentNumber || null,
            customerName: consignment.customerName || null,
            pickupAddress: consignment.pickupAddress || null,
            deliveryAddress: consignment.deliveryAddress || null,
            status: consignment.status || null,
            estimatedDeliveryDate: consignment.estimatedDeliveryDate || null,
            temperatureZone: consignment.temperatureZone || null,
            lastKnownLocation: consignment.lastKnownLocation || null,
            events: JSON.stringify(consignment.events || [])
          });
          successCount++;
        } catch (insertError) {
          console.error("Error inserting consignment:", insertError);
        }
      }
      
      console.log(`Successfully inserted ${successCount} consignments`);
      
      res.json({
        success: true,
        message: "Axylog sync completed successfully",
        synced: successCount,
        total: axylogConsignments.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Axylog sync error:", error);
      res.status(500).json({ 
        success: false,
        message: "Sync failed", 
        error: String(error) 
      });
    }
  });

  // Keep the old endpoint for compatibility
  // New endpoint to store axylog deliveries
  app.post("/api/consignments/sync-from-axylog", authenticate, async (req: AuthRequest, res: Response) => {
    try {
      // Storing deliveries
      
      const { deliveries } = req.body;
      if (!deliveries || !Array.isArray(deliveries)) {
        return res.status(400).json({ message: "Invalid deliveries data" });
      }
      
      // Clear existing consignments for this user
      await storage.clearUserConsignments(req.user!.id);
      
      let inserted = 0;
      for (const delivery of deliveries) {
        try {
          // Map axylog delivery fields to your consignment schema
          const consignmentData = {
            userId: req.user!.id,
            contextOwnerVatNumber: delivery.contextOwnerVatNumber,
            type: delivery.type,
            year: delivery.year,
            code: delivery.code,
            prog: delivery.prog,
            consignmentNo: delivery.consignmentNo,
            departureDateTime: delivery.departureDateTime,
            contextPlannedDepartureDateTime: delivery.contextPlannedDepartureDateTime,
            contextDateTime: delivery.contextDateTime,
            contextOptimal: delivery.contextOptimal,
            contextOptimalMustDate: delivery.contextOptimalMustDate,
            contextOptimalMustTime: delivery.contextOptimalMustTime,
            contextStateId: delivery.contextStateId,
            contextStateLabel: delivery.contextStateLabel,
            shipFromCode: delivery.shipFromCode,
            shipFromMasterDataCode: delivery.shipFromMasterDataCode,
            shipFromCompanyName: delivery.shipFromCompanyName,
            shipFromZipCode: delivery.shipFromZipCode,
            shipFromCountry: delivery.shipFromCountry,
            shipFromCity: delivery.shipFromCity,
            shipFromAddress: delivery.shipFromAddress,
            shipFromProvince: delivery.shipFromProvince,
            shipFromLatLon: delivery.shipFromLatLon,
            shipFromLatLonPartialMatch: delivery.shipFromLatLonPartialMatch,
            shipFromCoordinatesLocked: delivery.shipFromCoordinatesLocked,
            shipperCode: delivery.shipperCode,
            shipperMasterDataCode: delivery.shipperMasterDataCode,
            shipperCompanyName: delivery.shipperCompanyName,
            warehouseCode: delivery.warehouseCode,
            warehouseMasterDataCode: delivery.warehouseMasterDataCode,
            warehouseCompanyName: delivery.warehouseCompanyName,
            shipToCode: delivery.shipToCode,
            shipToMasterDataCode: delivery.shipToMasterDataCode,
            shipToCompanyName: delivery.shipToCompanyName,
            shipToZipCode: delivery.shipToZipCode,
            shipToCountry: delivery.shipToCountry,
            shipToCity: delivery.shipToCity,
            shipToAddress: delivery.shipToAddress,
            shipToProvince: delivery.shipToProvince,
            shipToLatLon: delivery.shipToLatLon,
            shipToLatLonPartialMatch: delivery.shipToLatLonPartialMatch,
            shipToCoordinatesLocked: delivery.shipToCoordinatesLocked,
            orderNumberRef: delivery.orderNumberRef,
            qty1: delivery.qty1,
            um1: delivery.um1,
            qty2: delivery.qty2,
            um2: delivery.um2,
            volumeInM3: delivery.volumeInM3,
            totalWeightInKg: delivery.totalWeightInKg,
            deliveryLiveTrackLink: delivery.deliveryLiveTrackLink,
            delivery_PlannedETA: delivery.delivery_PlannedETA,
            delivery_StateId: delivery.delivery_StateId,
            delivery_StateLabel: delivery.delivery_StateLabel,
            pickUp_StateId: delivery.pickUp_StateId,
            pickUp_StateLabel: delivery.pickUp_StateLabel,
            deliverySignatureName: delivery.deliverySignatureName,
            pickupSignatureName: delivery.pickupSignatureName,
            lastPositionLatLon: delivery.lastPositionLatLon,
            lastPositionDateTime: delivery.lastPositionDateTime,
            delivery_LastPositionLatLon: delivery.delivery_LastPositionLatLon,
            delivery_LastPositionType: delivery.delivery_LastPositionType,
            delivery_LastPositionDateTime: delivery.delivery_LastPositionDateTime,
            carrierMasterDataCode: delivery.carrierMasterDataCode,
            events: JSON.stringify([])
          };
          
          await storage.createConsignment(consignmentData);
          inserted++;
          
          // Log only the first delivery for error checking
          if (inserted === 1) {
            console.log("Sample delivery processed:", {
              orderNumberRef: delivery.orderNumberRef,
              shipFromCompanyName: delivery.shipFromCompanyName,
              shipToCompanyName: delivery.shipToCompanyName,
              qty1: delivery.qty1,
              um1: delivery.um1
            });
          }
        } catch (insertError) {
          console.error("Insert error:", insertError);
        }
      }
      
      res.json({
        success: true,
        message: "Axylog deliveries stored successfully",
        synced: inserted,
        total: deliveries.length
      });
      
    } catch (error) {
      console.error("Store deliveries error:", error);
      res.status(500).json({ message: "Failed to store deliveries", error: String(error) });
    }
  });

  app.post("/api/consignments/sync", authenticate, async (req: AuthRequest, res: Response) => {
    console.log("=== OLD SYNC ENDPOINT - REDIRECTING ===");
    
    try {
      console.log("Starting axylog sync for user:", req.user?.email);
      
      if (!req.user?.email) {
        return res.status(400).json({ message: "User email not found" });
      }

      // Authenticate with axylog
      const authSuccess = await axylogAPI.authenticate();
      if (!authSuccess) {
        return res.status(500).json({ message: "Failed to authenticate with axylog API" });
      }

      // For now, let's test with your actual axylog email
      const testEmail = "api.chill@axylog.com"; // Your actual axylog account email
      console.log(`Fetching deliveries for: ${testEmail}`);
      
      // Fetch deliveries from axylog
      const axylogConsignments = await axylogAPI.getDeliveries(testEmail);
      console.log(`Fetched ${axylogConsignments.length} consignments from axylog`);

      // Clear existing consignments for this user to avoid duplicates
      await storage.clearUserConsignments(req.user.id);

      // For testing, let's create a simple response first
      if (axylogConsignments.length === 0) {
        console.log("No consignments found, returning test message");
        return res.json({ 
          message: "Connected to axylog successfully but no consignments found for this timeframe", 
          count: 0,
          consignments: []
        });
      }

      // Prepare all consignments for batch insert
      console.log(`Preparing ${axylogConsignments.length} consignments for batch insert...`);
      const consignmentsToInsert = [];
      
      for (const consignment of axylogConsignments) {
        try {
          // Create a complete consignment record with all required fields
          const insertData = {
            userId: req.user.id,
            consignmentNumber: consignment.consignmentNumber || null,
            customerName: consignment.customerName || null,
            consignmentReference: null,
            trackingLink: null,
            pickupAddress: consignment.pickupAddress || null,
            deliveryAddress: consignment.deliveryAddress || null,
            status: consignment.status || null,
            estimatedDeliveryDate: consignment.estimatedDeliveryDate || null,
            deliveryDate: null,
            dateDelivered: null,
            consignmentRequiredDeliveryDate: null,
            temperatureZone: consignment.temperatureZone || null,
            lastKnownLocation: consignment.lastKnownLocation || null,
            deliveryRun: null,
            quantity: null,
            pallets: null,
            spaces: null,
            cubicMeters: null,
            weightKg: null,
            shipper: null,
            receiver: null,
            pickupCompany: null,
            deliveryCompany: null,
            pickupContactName: null,
            deliveryContactName: null,
            pickupContactPhone: null,
            deliveryContactPhone: null,
            specialInstructions: null,
            productDescription: null,
            deliveryInstructions: null,
            pickupInstructions: null,
            deliveryLivetrackLink: null,
            customerOrderNumber: null,
            documentString2: null,
            fromLocation: null,
            toLocation: null,
            groupCausalDeliveryOutcome: null,
            deliveryPlannedEta: null,
            recordedTemperature: null,
            quantityUnitOfMeasurement: null,
            quantityUnitOfMeasurement1: null,
            quantityUnitOfMeasurement2: null,
            route: null,
            driver: null,
            vehicle: null,
            origin: null,
            destination: null,
            originPostalCode: null,
            originCountry: null,
            originMasterDataCode: null,
            destinationPostalCode: null,
            destinationCountry: null,
            deliveryTime: null,
            pickupTime: null,
            consignmentType: null,
            priority: null,
            deliveryZone: null,
            pickupZone: null,
            notes: null,
            customerReference: null,
            invoiceNumber: null,
            podSignature: null,
            deliveryProof: null,
            vehicleCode: null,
            deliveryEtaDeviation: null,
            requiredTags: null,
            receivedDeliveryPodFiles: null,
            orderCarrierEmail: null,
            tripNumber: null,
            orderNumber: null,
            from: null,
            to: null,
            carrier: null,
            deliveryCalculatedEta: null,
            timeSpentInTheUnloadingArea: null,
            deliveryOutcomeCausal: null,
            deliveryArrivalDate: null,
            deliveryOutcomeDate: null,
            deliveryUnloadDate: null,
            deliveryOutcomeNote: null,
            deliveryLastPosition: null,
            deliveryLastPositionDate: null,
            pickupPlannedEta: null,
            etaDeliveryOnDeparture: null,
            deliveryLiveDistanceKm: null,
            deliveryDistanceKm: null,
            deliveryOutcomeTransmissionDate: null,
            deliveryOutcomeReceiptDate: null,
            deliveryUnloadSequence: null,
            deliveryTimeWindow: null,
            pickupArrivalDate: null,
            pickupOutcomeDate: null,
            pickupLoadDate: null,
            pickupOutcomeReason: null,
            groupCausalPickupOutcome: null,
            pickupOutcomeNote: null,
            pickupLastPosition: null,
            pickupLastPositionDate: null,
            pickupCalculatedEta: null,
            etaPickupOnDeparture: null,
            pickupLiveDistanceKm: null,
            pickupDistanceKm: null,
            pickupOutcomeReceiptDate: null,
            pickupLoadSequence: null,
            pickupTimeWindow: null,
            fromMasterDataCode: null,
            shipperCity: null,
            shipperProvince: null,
            shipperMasterDataCode: null,
            depot: null,
            depotMasterDataCode: null,
            recipientMasterDataCode: null,
            deliveryCity: null,
            deliveryProvince: null,
            carrierMasterDataCode: null,
            subCarrier: null,
            subCarrierMasterDataCode: null,
            orderDate: null,
            documentNote: null,
            orderType: null,
            orderSeries: null,
            shipperOrderReferenceNumber: null,
            errorDescription: null,
            driverPhone: null,
            tractorLicensePlate: null,
            trailerLicensePlate: null,
            deliveryOutcome: null,
            deliveryPunctuality: null,
            deliveryGeolocalizationState: null,
            pickupOutcome: null,
            pickupPunctuality: null,
            pickupGeolocationState: null,
            deliveryState: null,
            pickupState: null,
            destinationCoordinates: null,
            departureCoordinates: null,
            expectedTemperature: null,
            deliveryMaximumDate: null,
            deliveryMinimumDate: null,
            pickupMinimumDate: null,
            pickupMaximumDate: null,
            volumeM3: null,
            linearMetersM: null,
            groundBases: null,
            documentDate1: null,
            documentDate2: null,
            documentDate3: null,
            documentString1: null,
            documentString3: null,
            timeSpentInTheLoadingArea: null,
            deliveryOutcomeInArea: null,
            pickupOutcomeInArea: null,
            deliveryOutcomePosition: null,
            pickupOutcomePosition: null,
            seals: null,
            taskId: null,
            idCreationImport: null,
            expectedPaymentMethodCode: null,
            expectedPaymentMethod: null,
            deliveryOutcomeRegistrationDate: null,
            pickupOutcomeRegistrationDate: null,
            deliveryPinIsValid: null,
            pickUpPinIsValid: null,
            expectedPaymentNotes: null,
            deliveryPodFiles: null,
            pickupPodFiles: null,
            departureDateInitiallyPlannedByTheContext: null,
            orderCarrierMobileTelephoneNumber: null,
            orderCarrierTelephoneNumber: null,
            orderPickupEmail: null,
            orderPickupMobileTelephoneNumber: null,
            orderPickupTelephoneNumber: null,
            orderDeliveryEmail: null,
            orderDeliveryMobileTelephoneNumber: null,
            orderDeliveryTelephoneNumber: null,
            orderSubCarrierEmail: null,
            orderSubCarrierMobileTelephoneNumber: null,
            orderSubCarrierTelephoneNumber: null,
            orderShipperEmail: null,
            orderShipperMobileTelephoneNumber: null,
            orderShipperTelephoneNumber: null,
            forbiddenTags: null,
            pickupPlannedServiceTime: null,
            deliveryPlannedServiceTime: null,
            externalReference: null,
            depotPhoneNumberSpecifiedInTheOrder: null,
            depotMobilePhoneNumberSpecifiedInTheOrder: null,
            receivedPickupPodFiles: null,
            requiredTagsDescription: null,
            forbiddenTagsDescription: null,
            fromPostalCode: null,
            toPostalCode: null,
            fromCountry: null,
            toCountry: null,
            pickupEtaDeviation: null,
            pickupLivetrackLink: null,
            vehicleDescription: null,
            events: JSON.stringify(consignment.events || [])
          };
          
          consignmentsToInsert.push(insertData);
        } catch (prepareError) {
          console.error("Error preparing consignment:", prepareError);
          console.error("Consignment data:", consignment);
        }
      }

      // Batch insert all consignments at once
      console.log(`Batch inserting ${consignmentsToInsert.length} consignments...`);
      const insertedConsignments = await storage.createConsignmentsBatch(consignmentsToInsert);
      console.log(`Successfully synced ${insertedConsignments.length} consignments`);
      res.setHeader('Content-Type', 'application/json');
      res.json({ 
        message: "Consignments synced successfully", 
        count: insertedConsignments.length,
        consignments: insertedConsignments
      });
    } catch (error) {
      console.error("Error syncing axylog data:", error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ message: "Failed to sync axylog data", error: error.message });
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
    console.log("=== SMART EXCEL IMPORT ROUTE HIT ===");
    console.log("🔥 URGENT: DEBUGGING 10 ROW LIMIT ISSUE");
    const userId = req.user!.id;
    const { importRows } = req.body;
    console.log(`📊 Received ${importRows?.length || 0} rows from frontend`);
    
    console.log(`Processing ${importRows?.length || 0} rows for database import`);
    
    if (!importRows || !Array.isArray(importRows)) {
      console.log("ERROR: No import data provided");
      return res.status(400).json({ success: false, message: "No import data provided" });
    }

    // IMMEDIATE DEBUG - Show Excel columns at the very start
    const firstRow = importRows[0];
    const allExcelHeaders = Object.keys(firstRow);
    
    console.log(`\n🔍 COMPREHENSIVE MAPPING ANALYSIS - MOVED TO TOP`);
    console.log(`📊 Total Excel Headers Found: ${allExcelHeaders.length}`);
    console.log(`\n📋 ALL EXCEL HEADERS DETECTED:`);
    allExcelHeaders.forEach((header, index) => {
      console.log(`  ${index + 1}. "${header}"`);
    });
    console.log('');
    
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
        // Map Excel columns to dashboard display fields (avoid duplicates)
        'Customer order number': 'consignment_reference', // For reference column  
        'Shipper': 'customer_name', // For customer name column
        'Delivery Livetrack link': 'pickup_livetrack_link', // For tracking link button
        'Pickup planned ETA': 'estimated_delivery_date', // For ETA column
        'Pickup outcome reason': 'status', // For status column
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
        'Pickup calculated ETA': 'pickup_calculated_eta',
        'ETA pickup on departure': 'eta_pickup_on_departure',
        'Pickup live distance [km]': 'pickup_live_distance_km',
        'ETA delivery on departure': 'eta_delivery_on_departure',
        'Delivery live distance [km]': 'delivery_live_distance_km',
        'Delivery calculated ETA': 'delivery_calculated_eta',
        'From - Postal Code': 'origin_postal_code',
        'From - Country': 'origin_country',
        'From  -  Master data code': 'origin_master_data_code',
        'To - Postal Code': 'destination_postal_code', 
        'To - Country': 'destination_country',
        
        // Add many more Excel columns from your comprehensive data
        'Pickup outcome transmission date': 'pickup_outcome_transmission_date',
        'Pickup outcome receipt date': 'pickup_outcome_receipt_date',
        'Pickup load date': 'pickup_load_date',
        'Pickup outcome in area': 'pickup_outcome_in_area',
        'Pickup outcome position': 'pickup_outcome_position',
        'Pickup outcome registration date': 'pickup_outcome_registration_date',
        'Pickup outcome note': 'pickup_outcome_note',
        'Pickup PoD files': 'pickup_pod_files',
        'Pickup planned service time': 'pickup_planned_service_time',
        'Received pickup PoD files': 'received_pickup_pod_files',
        'Pickup ETA deviation': 'pickup_eta_deviation',
        'Pickup Livetrack link': 'pickup_livetrack_link',
        'Pickup distance [km]': 'pickup_distance_km',
        'Pickup outcome receipt date': 'pickup_outcome_receipt_date',
        'Pickup load sequence': 'pickup_load_sequence',
        'Pickup time window': 'pickup_time_window',
        'From  -  Master data code': 'origin_master_data_code',
        'Shipper city': 'shipper_city',
        'Shipper - Province': 'shipper_province',
        'Shipper  -  Master data code': 'shipper_master_data_code',
        'Depot': 'depot',
        'Depot  -  Master data code': 'depot_master_data_code',
        'Recipient  -  Master data code': 'recipient_master_data_code',
        'Delivery city': 'delivery_city',
        'Delivery - Province': 'delivery_province',
        'Carrier  -  Master data code': 'carrier_master_data_code',
        'Sub-carrier': 'sub_carrier',
        'Sub-carrier  -  Master data code': 'sub_carrier_master_data_code',
        'Order date': 'order_date',
        'Document note': 'document_note',
        'Order type': 'order_type',
        'Order series': 'order_series',
        'Order carrier telephone number': 'order_carrier_telephone_number',
        'Order carrier mobile telephone number': 'order_carrier_mobile_telephone_number',
        'Driver phone': 'driver_phone',
        'Tractor license plate': 'tractor_license_plate',
        'Trailer license plate': 'trailer_license_plate',
        'Expected temperature': 'expected_temperature',
        'Weight [kg]': 'weight_kg',
        'Ground bases': 'ground_bases',
        'document_string1': 'document_string1',
        'ID creation import': 'id_creation_import'
      };
      
      // Check for exact match first
      if (specificMappings[header]) {
        console.log(`SPECIFIC MAPPING: "${header}" → "${specificMappings[header]}"`);
        return specificMappings[header];
      }
      
      // Fall back to general normalization and avoid "from" keyword
      let normalized = header
        .toLowerCase()                    // Convert to lowercase
        .trim()                          // Remove leading/trailing spaces
        .replace(/\[km\]/g, '_km')       // Handle [km] specifically  
        .replace(/[\[\]()]/g, '')        // Remove other brackets and parentheses
        .replace(/[^a-z0-9]/g, '_')      // Replace non-alphanumeric with underscores
        .replace(/_+/g, '_')             // Collapse multiple underscores
        .replace(/^_|_$/g, '');          // Remove leading/trailing underscores
      
      // Replace any occurrence of "from" with "origin" to avoid SQL conflicts
      normalized = normalized.replace(/from/g, 'origin');
      
      // For any unmapped field, just accept it as-is for now to capture more data
      console.log(`FALLBACK MAPPING: "${header}" → "${normalized}"`);
      
      return normalized;
    };
    
    // EXPANDED database columns to accept ALL Excel variations and capture 150+ columns
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
      'origin', 'destination', 'group_causal_delivery_outcome',
      'delivery_planned_eta', 'recorded_temperature', 'quantity_unit_of_measurement',
      'quantity_unit_of_measurement1', 'quantity_unit_of_measurement2', 'route',
      'driver', 'vehicle', 'delivery_time', 'pickup_time', 'consignment_type',
      'priority', 'delivery_zone', 'pickup_zone', 'notes', 'customer_reference',
      'invoice_number', 'pod_signature', 'delivery_proof', 'vehicle_code',
      'delivery_eta_deviation', 'received_delivery_pod_files', 'trip_number',
      'origin_postal_code', 'origin_country', 'origin_master_data_code', 'destination_postal_code', 'destination_country', 'carrier', 'required_tags', 'order_carrier_email', 'order_number',
      'delivery_calculated_eta', 'eta_pickup_on_departure', 'pickup_live_distance_km', 'pickup_load_sequence', 'pickup_time_window',
      'shipper_city', 'shipper_master_data_code', 'depot', 'depot_master_data_code', 'recipient_master_data_code', 'delivery_city', 'carrier_master_data_code',
      'order_date', 'document_note', 'order_type', 'driver_phone', 'tractor_license_plate', 'pickup_outcome', 'pickup_punctuality',
      'pickup_geolocation_state', 'pickup_state', 'destination_coordinates', 'departure_coordinates', 'expected_temperature',
      'pickup_minimum_date', 'pickup_maximum_date', 'pickup_outcome_in_area', 'pickup_outcome_position', 'id_creation_import',
      'pickup_outcome_registration_date', 'pickup_pod_files', 'pickup_planned_service_time', 'received_pickup_pod_files', 'pickup_eta_deviation', 'pickup_livetrack_link',
      'delivery_calculated_eta', 'time_spent_in_the_unloading_area',
      'delivery_outcome_causal', 'delivery_arrival_date', 'delivery_outcome_date',
      'delivery_unload_date', 'delivery_outcome_note', 'delivery_last_position',
      'delivery_last_position_date', 'pickup_planned_eta', 'eta_delivery_on_departure',
      'delivery_live_distance_km', 'delivery_distance_km', 'delivery_outcome_transmission_date',
      
      // Add the missing Excel columns that are causing NULL values
      'pickup_live_distance_km', 'eta_pickup_on_departure', 'pickup_calculated_eta',
      'pickup_outcome_reason', 'group_causal_pickup_outcome', 'pickup_outcome_date',
      'pickup_outcome_causal', 'pickup_outcome_transmission_date', 'pickup_outcome_receipt_date',
      'eta_delivery_on_departure', 'delivery_live_distance_km', 'delivery_calculated_eta',
      'delivery_outcome_reason', 'group_causal_delivery_outcome_detailed', 'delivery_outcome_causal_detailed',
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
      console.log(`Processing all ${importRows.length} rows...`);
      
      // Build dynamic mapping from Excel headers to database columns
      const firstRow = importRows[0];
      const excelHeaders = Object.keys(firstRow);
      const headerMapping: { [key: string]: string } = {};
      
      console.log('\n=== HEADER NORMALIZATION ===');
      excelHeaders.forEach(header => {
        const normalized = normalizeHeader(header);
        // ACCEPT ALL COLUMNS - don't restrict to predefined list
        headerMapping[header] = normalized;
        console.log(`✓ ACCEPTING: "${header}" → "${normalized}"`);
      });
      
      console.log(`\n=== COMPREHENSIVE MAPPING ANALYSIS ===`);
      console.log(`📊 Total Excel Headers: ${excelHeaders.length}`);
      console.log(`✅ Successfully Mapped: ${Object.keys(headerMapping).length}`);
      
      // Show ALL original Excel headers
      console.log('\n📋 ALL EXCEL HEADERS:');
      excelHeaders.forEach((header, index) => {
        console.log(`  ${index + 1}. "${header}"`);
      });
      
      // Show successfully mapped headers
      console.log('\n✅ MAPPED HEADERS:');
      Object.entries(headerMapping).forEach(([original, normalized]) => {
        console.log(`  "${original}" → "${normalized}"`);
      });
      
      // Show unmapped headers (should be none now since we accept all)
      const unmappedHeaders = excelHeaders.filter(header => !headerMapping[header]);
      console.log(`\n❌ UNMAPPED HEADERS (${unmappedHeaders.length}):`);
      unmappedHeaders.forEach(header => {
        console.log(`  "${header}" - NOT CAPTURED`);
      });
      
      if (unmappedHeaders.length > 0) {
        console.log(`\n🚨 WARNING: ${unmappedHeaders.length} columns will be lost!`);
      } else {
        console.log(`\n🎉 SUCCESS: All ${excelHeaders.length} columns will be captured!`);
      }
      console.log('');
      
      console.log(`🚀 Starting loop to process ${importRows.length} rows`);
      
      for (let i = 0; i < importRows.length; i++) {
        console.log(`🔄 Processing row ${i + 1} of ${importRows.length}`);
        
        const row = importRows[i];
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
        
        console.log(`Inserting row ${i + 1} of ${importRows.length} with ${columns.length} columns`);
        
        try {
          const result = await pool.query(sql, values);
          
          // Only count as success if the row was actually inserted
          if (result.rows.length > 0) {
            successCount++;
            console.log(`✅ Successfully inserted row ${i + 1}`);
          } else {
            console.log(`⚠️ Skipped duplicate consignment: ${row.consignmentNumber || 'unknown'}`);
          }
        } catch (rowError: any) {
          console.error(`❌ Error inserting row ${i + 1}:`, rowError.message);
          console.error('Failed SQL:', sql);
          console.error('Failed values:', values);
          // Continue processing other rows instead of stopping
          continue;
        }
        
        // CRITICAL DEBUG: Track exactly where we stop
        if (i === 9) {
          console.log("🚨 CRITICAL: Just finished row 10! About to continue to row 11...");
        }
        if (i === 10) {
          console.log("🚨 CRITICAL: Processing row 11! The loop IS continuing!");
        }
        if (i === 11) {
          console.log("🚨 CRITICAL: Processing row 12! No 10-row limit found!");
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
    console.log("🚨 WRONG ROUTE: /api/admin/import was called instead of /api/admin/import-direct");
    console.log("This route has the 10-row limitation!");
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