import { Consignment, ConsignmentEvent } from "@shared/schema";
import axios from "axios";

// Axylog API URLs
const BASE_URL = "https://api.axylog.com";
const AUTH_URL = `${BASE_URL}/authentication/service`;
const DELIVERIES_URL = `${BASE_URL}/Deliveries?v=2`;

// Interface for Axylog authentication response
interface AxylogAuthResponse {
  token: string;
  userTree: {
    userId: string;
    companiesOwners: Array<{
      company: string;
      contextOwners: Array<{
        contextOwner: string;
      }>;
    }>;
  };
}

// Interface for Axylog credentials
interface AxylogCredentials {
  token: string;
  userId: string;
  companyId: string;
  contextOwnerId: string;
}

// Interface for Axylog delivery (consignment)
// Use a generic interface since we're mapping all fields directly
interface AxylogDelivery {
  [key: string]: any; // This allows us to access any field from the axylog response
}

// Class to handle Axylog API integration
export class AxylogAPI {
  private credentials: AxylogCredentials | null = null;
  private username: string;
  private password: string;

  constructor() {
    // Get credentials from environment variables
    this.username = process.env.AXYLOG_USERNAME || "";
    this.password = process.env.AXYLOG_PASSWORD || "";
    
    // Check if credentials are provided
    if (!this.username || !this.password) {
      console.warn("Axylog credentials not found in environment variables");
    }
  }

  // Authenticate with Axylog API
  async authenticate(): Promise<boolean> {
    try {
      // Skip if we already have valid credentials
      if (this.credentials) {
        return true;
      }

      // Check if we have the required credentials
      if (!this.username || !this.password) {
        console.error("Missing Axylog credentials");
        return false;
      }

      // Make authentication request
      const response = await axios.post<AxylogAuthResponse>(AUTH_URL, {
        username: this.username,
        password: this.password
      }, {
        headers: {
          "Content-Type": "application/json"
        }
      });

      // Extract credentials from response
      const authData = response.data;
      this.credentials = {
        token: authData.token,
        userId: authData.userTree.userId,
        companyId: authData.userTree.companiesOwners[0].company,
        contextOwnerId: authData.userTree.companiesOwners[0].contextOwners[0].contextOwner
      };

      console.log("Successfully authenticated with Axylog API");
      return true;
    } catch (error) {
      console.error("Failed to authenticate with Axylog API:", error);
      return false;
    }
  }

  // Get deliveries (consignments) from Axylog for a specific user email
  async getDeliveries(userEmail: string): Promise<Consignment[]> {
    try {
      // Get only today's deliveries in AEST timezone
      const todayAEST = new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney" });
      const todayDate = new Date(todayAEST);
      const todayString = todayDate.toISOString().split('T')[0];

      const filters = {
        pickupDateFrom: todayString,
        pickupDateTo: todayString
      };

      console.log("Using today's date filters (AEST):", filters, "AEST date:", todayAEST);
      return this.getConsignmentsWithFilters(filters);
    } catch (error) {
      console.error("Failed to get deliveries from Axylog API:", error);
      return [];
    }
  }

  // Get consignments with custom filters
  async getConsignmentsWithFilters(filters: {
    pickupDateFrom: string;
    pickupDateTo: string;
    deliveryEmail?: string;
    customerName?: string;
    warehouseCompanyName?: string;
  }): Promise<Consignment[]> {
    try {
      // Authenticate if needed
      if (!this.credentials && !(await this.authenticate())) {
        console.error("Authentication failed, cannot get deliveries");
        return [];
      }

      console.log("Fetching consignments from Axylog with filters:", filters);

      // Build dynamic date filters
      const pickupFromDate = `${filters.pickupDateFrom}T00:00:00.000Z`;
      const pickupToDate = `${filters.pickupDateTo}T23:59:59.000Z`;
      
      console.log(`Requesting data from ${pickupFromDate} to ${pickupToDate}`);

      // Fetch all deliveries using pagination
      let allDeliveries: any[] = [];
      let skip = 0;
      const pageSize = 500;
      let hasMoreData = true;
      let pageNumber = 1;

      while (hasMoreData) {
        console.log(`Fetching page ${pageNumber} (skip: ${skip}, pageSize: ${pageSize})`);
        
        console.log(`API Request - pickUp_Delivery_From: ${pickupFromDate}, pickUp_Delivery_To: ${pickupToDate}`);
        
        const response = await axios.post(DELIVERIES_URL, {
          pagination: {
            skip: skip,
            pageSize: pageSize
          },
          filters: {
            type: "",
            pickUp_Delivery_From: pickupFromDate,
            pickUp_Delivery_To: pickupToDate
          }
        }, {
          headers: {
            "Authorization": `Bearer ${this.credentials!.token}`,
            "ContextOwner": this.credentials!.contextOwnerId,
            "User": this.credentials!.userId,
            "Company": this.credentials!.companyId,
            "SourceDeviceType": "3",
            "Content-Type": "application/json"
          }
        });

        console.log("=== AXYLOG RESPONSE SUMMARY ===");
        console.log("Response status:", response.status);
        console.log("Response data keys:", Object.keys(response.data || {}));
        
        if (!response.data || !response.data.itemList) {
          console.warn("No deliveries found in Axylog response");
          console.log("Available data fields:", response.data ? Object.keys(response.data) : "No data");
          hasMoreData = false;
          break;
        }

        const pageDeliveries = response.data.itemList;
        console.log(`Received ${pageDeliveries.length} deliveries on page ${pageNumber}`);

        if (pageDeliveries.length === 0 || pageDeliveries.length < pageSize) {
          hasMoreData = false;
        }

        allDeliveries.push(...pageDeliveries);
        skip += pageSize;
        pageNumber++;

        // Safety check to prevent infinite loops
        if (pageNumber > 100) {
          console.log("Reached maximum safety limit of 100 pages");
          break;
        }
      }

      console.log(`Total deliveries retrieved across ${pageNumber - 1} pages: ${allDeliveries.length}`);

      // Debug: Check full first delivery record
      console.log("=== FULL FIRST DELIVERY RECORD ===");
      if (allDeliveries.length > 0) {
        console.log('First delivery:', JSON.stringify(allDeliveries[0], null, 2));
      }
      console.log("=== END FULL DELIVERY RECORD ===");

      // Apply additional filters and convert to our format
      let deliveries = allDeliveries;
      
      console.log('No email filter applied, returning all consignments');
      
      // Filter by customer name if provided
      if (filters.customerName) {
        deliveries = deliveries.filter((delivery: AxylogDelivery) => 
          delivery.receiverCompanyName?.toLowerCase().includes(filters.customerName?.toLowerCase() || '')
        );
        console.log(`Filtered to ${deliveries.length} deliveries by customer name: ${filters.customerName}`);
      }
      
      // Filter by warehouse company name if provided
      if (filters.warehouseCompanyName) {
        deliveries = deliveries.filter((delivery: AxylogDelivery) => 
          delivery.warehouseCompanyName?.toLowerCase().includes(filters.warehouseCompanyName?.toLowerCase() || '')
        );
        console.log(`Filtered to ${deliveries.length} deliveries by warehouse company name: ${filters.warehouseCompanyName}`);
      }

      // Filter out auto-generated consignments using master data codes
      const initialCount = deliveries.length;
      
      // Debug: Show first few master data code combinations
      for (let i = 0; i < Math.min(5, deliveries.length); i++) {
        const d = deliveries[i];
        console.log(`Sample ${i+1}: Order ${d.orderNumberRef} - From: "${d.shipFromMasterDataCode}" To: "${d.shipToMasterDataCode}"`);
      }
      
      // Filter out depot transfers where pickup and delivery are the same depot
      const depotTransferPatterns = [
        { from: 'WA_8', to: 'WA_8D' },
        { from: 'WA_8D', to: 'WA_8' },
        { from: 'NSW_5', to: 'NSW_5D' },
        { from: 'NSW_5D', to: 'NSW_5' },
        { from: 'VIC_29963', to: 'VIC_29963D' },
        { from: 'VIC_29963D', to: 'VIC_29963' },
        { from: 'QLD_829', to: 'QLD_829D' },
        { from: 'QLD_829D', to: 'QLD_829' }
      ];

      deliveries = deliveries.filter((delivery: AxylogDelivery) => {
        const from = delivery.shipFromMasterDataCode;
        const to = delivery.shipToMasterDataCode;
        
        // Check if this is a depot transfer
        const isDepotTransfer = depotTransferPatterns.some(pattern => 
          pattern.from === from && pattern.to === to
        );
        
        // Check if customer or warehouse is a Chill depot (exclude depot deliveries)
        const customerName = (delivery.shipToCompanyName || '').toLowerCase();
        const warehouseName = (delivery.warehouseCompanyName || '').toLowerCase();
        const isChillDepotCustomer = 
          (customerName.includes('chill') && customerName.includes('depot')) ||
          (warehouseName.includes('chill') && warehouseName.includes('depot')) ||
          (customerName.includes('chill') && warehouseName.includes('depot'));
        
        // Check if this is an auto-generated reference (year-code-prog format like "2025-134639-3")
        // Check BOTH orderNumberRef AND consignmentNo fields
        const orderRef = delivery.orderNumberRef;
        const consignmentNo = delivery.consignmentNo;
        const autoGenPattern = /^\d{4}-\d{5,}-\d+$/;
        const isAutoGeneratedRef = autoGenPattern.test(orderRef) || autoGenPattern.test(consignmentNo);
        
        return !isDepotTransfer && !isChillDepotCustomer && !isAutoGeneratedRef;
      });

      const filteredCount = deliveries.length;
      const depotTransfers = initialCount - filteredCount;
      console.log(`Filtered out ${depotTransfers} internal transfers (depot-to-depot, auto-generated, Chill depot customers), keeping ${filteredCount} customer deliveries`);

      // Convert to our format
      return this.convertAndFilterDeliveries(deliveries, '');
    } catch (error) {
      console.error("Failed to get deliveries from Axylog API:", error);
      return [];
    }
  }

  // Convert Axylog deliveries to our Consignment format and filter by email
  private convertAndFilterDeliveries(deliveries: AxylogDelivery[], userEmail: string): Consignment[] {
    if (!deliveries || !Array.isArray(deliveries)) {
      return [];
    }

    console.log("=== CONVERTING AXYLOG DATA TO FULL PAYLOAD ===");
    console.log(`Processing ${deliveries.length} deliveries from axylog`);
    
    // Check first delivery for orderNumberRef
    if (deliveries.length > 0) {
      console.log("=== FIRST DELIVERY ORDERNUMBERREF CHECK ===");
      console.log("orderNumberRef:", deliveries[0].orderNumberRef);
      console.log("Reference fields available:", Object.keys(deliveries[0]).filter(key => 
        key.toLowerCase().includes('order') || key.toLowerCase().includes('reference') || key.toLowerCase().includes('consignment')
      ));
    }

    // Return all deliveries without email filtering to get all data
    return deliveries.map((delivery, index) => {
        
        // Map status from Axylog to our status types
        const statusMap: Record<string, string> = {
          "In Transit": "In Transit",
          "Delivered": "Delivered",
          "Created": "Awaiting Pickup",
          "Picked Up": "In Transit",
          "Back to depot": "Delivered",
          // Add more status mappings as needed
        };

        // Map temperature zone to our format
        const tempZoneMap: Record<string, string> = {
          "AMB": "Dry",
          "DRY": "Dry",
          "CHI": "Chiller (0–4°C)",
          "CHILLER": "Chiller (0–4°C)",
          "FRE": "Freezer (-20°C)",
          "FREEZER": "Freezer (-20°C)",
          "WIN": "Wine (14°C)",
          "WINE": "Wine (14°C)",
          "CON": "Confectionery (15–20°C)",
          "PHA": "Pharma (2–8°C)",
          // Add more temperature zone mappings as needed
        };
        
        // Parse temperature zone from documentNote (first line typically contains the zone)
        const parseTempZone = (note: string | null) => {
          if (!note) return null;
          const firstLine = note.split('\\n')[0]?.trim().toUpperCase();
          return tempZoneMap[firstLine] || tempZoneMap[delivery.expectedTemperature] || delivery.expectedTemperature || null;
        };

        // Convert events to our format with null checking
        const events: ConsignmentEvent[] = (delivery.events || []).map((event: any) => ({
          timestamp: new Date(event.timestamp).toLocaleString('en-AU', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          }),
          description: event.description,
          location: event.location,
          type: event.type
        }));

        // Convert to new schema format - direct mapping from axylog fields
        return {
          // Core system fields
          id: index + 1,
          userId: 1, // This will be replaced with the actual user ID
          
          // Direct axylog field mapping - no translation needed!
          contextOwnerVatNumber: delivery.contextOwnerVatNumber || null,
          type: delivery.type || null,
          year: delivery.year || null,
          code: delivery.code || null,
          prog: delivery.prog || null,
          consignmentNo: (() => {
            // Use the best available reference field
            
            return delivery.consignmentNo || 
                   delivery.documentReference || 
                   delivery.orderNumberRef || 
                   delivery.shipperOrderReferenceNumber || 
                   delivery.externalReference ||
                   delivery.documentNumber ||
                   `${delivery.year}-${delivery.code}-${delivery.prog}` || 
                   `REF-${delivery.id || Math.random().toString(36).substr(2, 9)}`;
          })(),
          
          // Cargo fields extracted directly from delivery object
          qty1: delivery.qty1 || null,
          um1: delivery.um1 || null,
          qty2: delivery.qty2 || null,
          um2: delivery.um2 || null,
          volumeInM3: delivery.volumeInM3 || null,
          totalWeightInKg: delivery.totalWeightInKg || null,
          departureDateTime: delivery.departureDateTime || null,
          contextPlannedDepartureDateTime: delivery.contextPlannedDepartureDateTime || null,
          delivery_OutcomeDateTime: delivery.delivery_OutcomeDateTime || null,
          deleted: delivery.deleted || null,
          deleteDateTime: delivery.deleteDateTime || null,
          delivery_ArrivalDateTime: delivery.delivery_ArrivalDateTime || null,
          appDeliveryArrivalDateTime: delivery.appDeliveryArrivalDateTime || null,
          geoArriveDeliveryLastPositionDateTime: delivery.geoArriveDeliveryLastPositionDateTime || null,
          delivery_GeoArriveDateTime: delivery.delivery_GeoArriveDateTime || null,
          deliveryGeoLoadingArriveDateTime: delivery.deliveryGeoLoadingArriveDateTime || null,
          delivery_UnloadDateTime: delivery.delivery_UnloadDateTime || null,
          pickUp_OutcomeDateTime: delivery.pickUp_OutcomeDateTime || null,
          pickUp_ArrivalDateTime: delivery.pickUp_ArrivalDateTime || null,
          appPickUpArrivalDateTime: delivery.appPickUpArrivalDateTime || null,
          pickUp_GeoArriveDateTime: delivery.pickUp_GeoArriveDateTime || null,
          geoArrivePickUpLastPositionDateTime: delivery.geoArrivePickUpLastPositionDateTime || null,
          pickUp_LoadDateTime: delivery.pickUp_LoadDateTime || null,
          delivery_AwaitedOutcome: delivery.delivery_AwaitedOutcome || null,
          delivery_OutcomeEnum: delivery.delivery_OutcomeEnum || null,
          delivery_Outcome: delivery.delivery_Outcome || null,
          delivery_NotDeliverd: delivery.delivery_NotDeliverd || null,
          delivery_OutcomePODReasonContextCode: delivery.delivery_OutcomePODReasonContextCode || null,
          delivery_OutcomePODReason: delivery.delivery_OutcomePODReason || null,
          delivery_OutcomePODReasonGroup: delivery.delivery_OutcomePODReasonGroup || null,
          delivery_OutcomeNote: delivery.delivery_OutcomeNote || null,
          delivery_OutcomePosition: delivery.delivery_OutcomePosition || null,
          secondsSpentInUnloadArea: delivery.secondsSpentInUnloadArea || null,
          pickUp_AwaitedOutcome: delivery.pickUp_AwaitedOutcome || null,
          pickUp_OutcomeEnum: delivery.pickUp_OutcomeEnum || null,
          pickUp_Outcome: delivery.pickUp_Outcome || null,
          pickUp_NotPickedup: delivery.pickUp_NotPickedup || null,
          pickUp_OutcomePODReasonContextCode: delivery.pickUp_OutcomePODReasonContextCode || null,
          pickUp_OutcomePODReason: delivery.pickUp_OutcomePODReason || null,
          pickUp_OutcomePODReasonGroup: delivery.pickUp_OutcomePODReasonGroup || null,
          pickUp_OutcomeNote: delivery.pickUp_OutcomeNote || null,
          pickUp_OutcomePosition: delivery.pickUp_OutcomePosition || null,
          secondsSpentInLoadArea: delivery.secondsSpentInLoadArea || null,
          documentNote: delivery.documentNote || null,
          maxScheduledDeliveryTime: delivery.maxScheduledDeliveryTime || null,
          minScheduledDeliveryTime: delivery.minScheduledDeliveryTime || null,
          maxScheduledPickUpTime: delivery.maxScheduledPickUpTime || null,
          minScheduledPickUpTime: delivery.minScheduledPickUpTime || null,
          shipFromCode: delivery.shipFromCode || null,
          shipFromMasterDataCode: delivery.shipFromMasterDataCode || null,
          shipFromCompanyName: delivery.shipFromCompanyName || null,
          shipFromZipCode: delivery.shipFromZipCode || null,
          shipFromCountry: delivery.shipFromCountry || null,
          shipFromCity: delivery.shipFromCity || null,
          shipFromAddress: delivery.shipFromAddress || null,
          shipFromProvince: delivery.shipFromProvince || null,
          shipFromLatLon: delivery.shipFromLatLon || null,
          shipFromLatLonPartialMatch: delivery.shipFromLatLonPartialMatch || null,
          shipFromCoordinatesLocked: delivery.shipFromCoordinatesLocked || null,
          shipperCode: delivery.shipperCode || null,
          shipperMasterDataCode: delivery.shipperMasterDataCode || null,
          shipperCompanyName: delivery.shipperCompanyName || null,
          documentPlantCode: delivery.documentPlantCode || null,
          warehouseCode: delivery.warehouseCode || null,
          warehouseMasterDataCode: delivery.warehouseMasterDataCode || null,
          warehouseCompanyName: delivery.warehouseCompanyName || null,
          shipToCode: delivery.shipToCode || null,
          shipToMasterDataCode: delivery.shipToMasterDataCode || null,
          shipToCompanyName: delivery.shipToCompanyName || null,
          shipToZipCode: delivery.shipToZipCode || null,
          shipToCountry: delivery.shipToCountry || null,
          shipToCity: delivery.shipToCity || null,
          shipToAddress: delivery.shipToAddress || null,
          shipToProvince: delivery.shipToProvince || null,
          shipToLatLon: delivery.shipToLatLon || null,
          shipToLatLonPartialMatch: delivery.shipToLatLonPartialMatch || null,
          shipToCoordinatesLocked: delivery.shipToCoordinatesLocked || null,
          vehicleCode: delivery.vehicleCode || null,
          vehicleMasterDataCode: delivery.vehicleMasterDataCode || null,
          vehicleDescription: delivery.vehicleDescription || null,
          vehicleLatLon: delivery.vehicleLatLon || null,
          vehicleLatLonPartialMatch: delivery.vehicleLatLonPartialMatch || null,
          vehicleCoordinatesLocked: delivery.vehicleCoordinatesLocked || null,
          vehicleLatLonDateTime: delivery.vehicleLatLonDateTime || null,
          driverCode: delivery.driverCode || null,
          driverMasterDataCode: delivery.driverMasterDataCode || null,
          driverDescription: delivery.driverDescription || null,
          driverName: delivery.driverName || null,
          driverPhoneNumber: delivery.driverPhoneNumber || null,
          quantity: delivery.quantity || null,
          pallets: delivery.pallets || null,
          spaces: delivery.spaces || null,
          volumeM3: delivery.volumeM3 || null,
          weightKg: delivery.weightKg || null,
          linearMetersM: delivery.linearMetersM || null,
          groundBases: delivery.groundBases || null,
          deliveryLiveTrackLink: delivery.deliveryLiveTrackLink || null,
          pickupLiveTrackLink: delivery.pickupLiveTrackLink || null,
          delivery_EtaCalculated: delivery.delivery_EtaCalculated || null,
          pickUp_EtaCalculated: delivery.pickUp_EtaCalculated || null,
          deliveryLiveDistanceKm: delivery.deliveryLiveDistanceKm || null,
          pickupLiveDistanceKm: delivery.pickupLiveDistanceKm || null,
          deliveryDistanceKm: delivery.deliveryDistanceKm || null,
          pickupDistanceKm: delivery.pickupDistanceKm || null,
          deliveryTimeWindow: delivery.deliveryTimeWindow || null,
          pickupTimeWindow: delivery.pickupTimeWindow || null,
          deliveryPlannedServiceTime: delivery.deliveryPlannedServiceTime || null,
          pickupPlannedServiceTime: delivery.pickupPlannedServiceTime || null,
          orderCarrierEmail: delivery.orderCarrierEmail || null,
          orderCarrierTelephoneNumber: delivery.orderCarrierTelephoneNumber || null,
          orderCarrierMobileTelephoneNumber: delivery.orderCarrierMobileTelephoneNumber || null,
          orderDeliveryEmail: delivery.orderDeliveryEmail || null,
          orderDeliveryTelephoneNumber: delivery.orderDeliveryTelephoneNumber || null,
          orderDeliveryMobileTelephoneNumber: delivery.orderDeliveryMobileTelephoneNumber || null,
          orderPickupEmail: delivery.orderPickupEmail || null,
          orderPickupTelephoneNumber: delivery.orderPickupTelephoneNumber || null,
          orderPickupMobileTelephoneNumber: delivery.orderPickupMobileTelephoneNumber || null,
          orderShipperEmail: delivery.orderShipperEmail || null,
          orderShipperTelephoneNumber: delivery.orderShipperTelephoneNumber || null,
          orderShipperMobileTelephoneNumber: delivery.orderShipperMobileTelephoneNumber || null,
          orderDate: delivery.orderDate || null,
          orderType: delivery.orderType || null,
          orderSeries: delivery.orderSeries || null,
          orderNumberRef: delivery.orderNumberRef || null,
          shipperOrderReferenceNumber: delivery.shipperOrderReferenceNumber || null,
          externalReference: delivery.externalReference || null,
          expectedPaymentMethod: delivery.expectedPaymentMethod || null,
          expectedPaymentMethodCode: delivery.expectedPaymentMethodCode || null,
          expectedPaymentNotes: delivery.expectedPaymentNotes || null,
          expectedTemperature: parseTempZone(delivery.documentNote),
          // Actual payment and temperature data
          paymentMethod: delivery.paymentMethod || null, // Contains actual recorded temperature
          amountToCollect: delivery.amountToCollect || null,
          amountCollected: delivery.amountCollected || null,
          documentCashNotes: delivery.documentCashNotes || null,
          requiredTags: delivery.requiredTags || null,
          forbiddenTags: delivery.forbiddenTags || null,
          requiredTagsDescription: delivery.requiredTagsDescription || null,
          forbiddenTagsDescription: delivery.forbiddenTagsDescription || null,
          deliveryPodFiles: delivery.deliveryPodFiles || null,
          pickupPodFiles: delivery.pickupPodFiles || null,
          receivedDeliveryPodFiles: delivery.receivedDeliveryPodFiles || null,
          receivedPickupPodFiles: delivery.receivedPickupPodFiles || null,
          // File count fields from Axylog API
          deliveryExpectedFileCount: delivery.deliveryExpectedFileCount || null,
          deliveryReceivedFileCount: delivery.deliveryReceivedFileCount || null,
          pickupExpectedFileCount: delivery.pickupExpectedFileCount || null,
          pickupReceivedFileCount: delivery.pickupReceivedFileCount || null,
          deliverySignatureName: delivery.deliverySignatureName || null,
          pickupSignatureName: delivery.pickupSignatureName || null,
          deliveryState: delivery.deliveryState || null,
          pickupState: delivery.pickupState || null,
          delivery_StateId: delivery.delivery_StateId || null,
          delivery_StateLabel: delivery.delivery_StateLabel || null,
          pickUp_StateId: delivery.pickUp_StateId || null,
          pickUp_StateLabel: delivery.pickUp_StateLabel || null,
          deliveryOutcome: delivery.deliveryOutcome || null,
          pickupOutcome: delivery.pickupOutcome || null,
          deliveryPunctuality: delivery.deliveryPunctuality || null,
          pickupPunctuality: delivery.pickupPunctuality || null,
          destinationCoordinates: delivery.destinationCoordinates || null,
          departureCoordinates: delivery.departureCoordinates || null,
          deliveryLastPosition: delivery.deliveryLastPosition || null,
          pickupLastPosition: delivery.pickupLastPosition || null,
          deliveryLastPositionDate: delivery.deliveryLastPositionDate || null,
          pickupLastPositionDate: delivery.pickupLastPositionDate || null,
          documentString1: delivery.documentString1 || null,
          documentString2: delivery.documentString2 || null,
          documentString3: delivery.documentString3 || null,
          documentDate1: delivery.documentDate1 || null,
          documentDate2: delivery.documentDate2 || null,
          documentDate3: delivery.documentDate3 || null,
          deliveryMinimumDate: delivery.deliveryMinimumDate || null,
          deliveryMaximumDate: delivery.deliveryMaximumDate || null,
          pickupMinimumDate: delivery.pickupMinimumDate || null,
          pickupMaximumDate: delivery.pickupMaximumDate || null,
          departureDateInitiallyPlannedByTheContext: delivery.departureDateInitiallyPlannedByTheContext || null,
          errorDescription: delivery.errorDescription || null,
          carrierCode: delivery.carrierCode || null,
          carrierMasterDataCode: delivery.carrierMasterDataCode || null,
          subCarrierCode: delivery.subCarrierCode || null,
          subCarrierMasterDataCode: delivery.subCarrierMasterDataCode || null,
          distributionType: delivery.distributionType || null,
          driverId: delivery.driverId || null,
          pickupDeliveryKey: delivery.pickupDeliveryKey || null,
          taskId: delivery.taskId || null,
          idCreationImport: delivery.idCreationImport || null,
          vehicleRequirementsMustCodes: delivery.vehicleRequirementsMustCodes || null,
          vehicleRequirementsMustNotCodes: delivery.vehicleRequirementsMustNotCodes || null,
          vehicleRequirementsMust: delivery.vehicleRequirementsMust || null,
          vehicleRequirementsMustNot: delivery.vehicleRequirementsMustNot || null,
          deliveryExternalStateCode: delivery.deliveryExternalStateCode || null,
          deliveryExternalStateDescription: delivery.deliveryExternalStateDescription || null,
          deliveryExternalStateReceptionDateTime: delivery.deliveryExternalStateReceptionDateTime || null,
          deliveryExternalStateDateTime: delivery.deliveryExternalStateDateTime || null,
          deliveryExternalStateNote: delivery.deliveryExternalStateNote || null,
          pickupExternalStateCode: delivery.pickupExternalStateCode || null,
          pickupExternalStateDescription: delivery.pickupExternalStateDescription || null,
          pickupExternalStateReceptionDateTime: delivery.pickupExternalStateReceptionDateTime || null,
          pickupExternalStateDateTime: delivery.pickupExternalStateDateTime || null,
          pickupExternalStateNote: delivery.pickupExternalStateNote || null,
          
          // Planned ETA fields
          delivery_PlannedETA: delivery.delivery_PlannedETA || null,
          pickUp_PlannedETA: delivery.pickUp_PlannedETA || null,
          
          // Location tracking fields
          lastPositionLatLon: delivery.lastPositionLatLon || null,
          lastPositionDateTime: delivery.lastPositionDateTime || null,
          delivery_LastPositionLatLon: delivery.delivery_LastPositionLatLon || null,
          delivery_LastPositionType: delivery.delivery_LastPositionType || null,
          delivery_LastPositionDateTime: delivery.delivery_LastPositionDateTime || null,
          pickUp_LastPositionLatLon: delivery.pickUp_LastPositionLatLon || null,
          pickUp_LastPositionType: delivery.pickUp_LastPositionType || null,
          pickUp_LastPositionDateTime: delivery.pickUp_LastPositionDateTime || null,
          
          // Events data
          events: JSON.stringify(events)
        };
      });
  }
}

// Export singleton instance
export const axylogAPI = new AxylogAPI();