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
interface AxylogDelivery {
  // Core document info
  consignmentNo: string;
  documentNote: string;
  
  // Company information
  shipToCompanyName: string;
  shipFromCompanyName: string;
  shipperCompanyName: string;
  
  // Address information
  shipToCity: string;
  shipFromCity: string;
  shipToAddress: string;
  shipFromAddress: string;
  shipToZipCode: string;
  shipFromZipCode: string;
  shipToCountry: string;
  shipFromCountry: string;
  
  // Vehicle and tracking
  vehicleDescription: string;
  deliveryLiveTrackLink: string;
  pickupLiveTrackLink: string;
  
  // Timing
  departureDateTime: string;
  delivery_OutcomeDateTime: string;
  pickUp_OutcomeDateTime: string;
  maxScheduledDeliveryTime: string;
  minScheduledDeliveryTime: string;
  
  // Operational details
  quantity: number;
  pallets: number;
  spaces: number;
  volumeM3: number;
  weightKg: number;
  
  // Status and outcomes
  delivery_Outcome: boolean;
  pickUp_Outcome: boolean;
  delivery_OutcomeNote: string;
  pickUp_OutcomeNote: string;
  
  events: Array<{
    timestamp: string;
    description: string;
    location: string;
    type: string;
  }>;
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
      // Prepare date range for last 6 months to future 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const sixMonthsAhead = new Date();
      sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

      const filters = {
        pickupDateFrom: sixMonthsAgo.toISOString(),
        pickupDateTo: sixMonthsAhead.toISOString(),
        deliveryEmail: userEmail
      };

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
  }): Promise<Consignment[]> {
    try {
      // Authenticate if needed
      if (!this.credentials && !(await this.authenticate())) {
        console.error("Authentication failed, cannot get deliveries");
        return [];
      }

      console.log("Fetching consignments from Axylog with filters:", filters);

      // Make request to get deliveries - enhanced to match your Postman collection
      const response = await axios.post(`${DELIVERIES_URL}?v=2`, {
        pagination: {
          skip: 0,
          pageSize: 100
        },
        filters: {
          type: "",
          tripNumber: [],
          plateNumber: [],
          documentNumber: [],
          pickUp_Delivery_From: filters.pickupDateFrom,
          pickUp_Delivery_To: filters.pickupDateTo,
          states: {
            posOutcome: false,
            negOutcome: false,
            notDelOutcome: false,
            waitingForOutcome: null,
            inAdvance: false,
            ot: false,
            notOt: false,
            deliveryLoading: false,
            deliveryUnloading_PickupLoading: false,
            travel: false,
            delivery_Pickup_Complete: false,
            unknown: false
          }
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

      if (!response.data || !response.data.deliveries) {
        console.warn("No deliveries found in Axylog response");
        return [];
      }
      
      console.log(`Received ${response.data.deliveries.length} deliveries from Axylog API`);

      // Apply additional filters and convert to our format
      let deliveries = response.data.deliveries;
      
      // Filter by email if provided and not empty
      if (filters.deliveryEmail && filters.deliveryEmail.trim() !== '') {
        deliveries = deliveries.filter((delivery: AxylogDelivery) => 
          delivery.deliveryAddress.email?.toLowerCase() === filters.deliveryEmail?.toLowerCase()
        );
        console.log(`Filtered to ${deliveries.length} deliveries by email: ${filters.deliveryEmail}`);
      } else {
        console.log('No email filter applied, returning all consignments');
      }
      
      // Filter by customer name if provided
      if (filters.customerName) {
        deliveries = deliveries.filter((delivery: AxylogDelivery) => 
          delivery.receiverCompanyName?.toLowerCase().includes(filters.customerName?.toLowerCase() || '')
        );
        console.log(`Filtered to ${deliveries.length} deliveries by customer name: ${filters.customerName}`);
      }

      // Convert to our format
      return this.convertAndFilterDeliveries(deliveries, filters.deliveryEmail || '');
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

    // Return all deliveries without email filtering to get all data
    return deliveries.map((delivery, index) => {
        console.log(`Converting delivery ${index + 1}: ${delivery.consignmentNo || 'Unknown'}`);
        
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
          "CHI": "Chiller (0–4°C)",
          "FRE": "Freezer (-20°C)",
          "WIN": "Wine (14°C)",
          "CON": "Confectionery (15–20°C)",
          "PHA": "Pharma (2–8°C)",
          // Add more temperature zone mappings as needed
        };

        // Convert events to our format
        const events: ConsignmentEvent[] = delivery.events.map(event => ({
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
          consignmentNo: delivery.consignmentNo || null,
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
          shipperOrderReferenceNumber: delivery.shipperOrderReferenceNumber || null,
          externalReference: delivery.externalReference || null,
          expectedPaymentMethod: delivery.expectedPaymentMethod || null,
          expectedPaymentMethodCode: delivery.expectedPaymentMethodCode || null,
          expectedPaymentNotes: delivery.expectedPaymentNotes || null,
          expectedTemperature: delivery.expectedTemperature || null,
          requiredTags: delivery.requiredTags || null,
          forbiddenTags: delivery.forbiddenTags || null,
          requiredTagsDescription: delivery.requiredTagsDescription || null,
          forbiddenTagsDescription: delivery.forbiddenTagsDescription || null,
          deliveryPodFiles: delivery.deliveryPodFiles || null,
          pickupPodFiles: delivery.pickupPodFiles || null,
          receivedDeliveryPodFiles: delivery.receivedDeliveryPodFiles || null,
          receivedPickupPodFiles: delivery.receivedPickupPodFiles || null,
          deliverySignatureName: delivery.deliverySignatureName || null,
          pickupSignatureName: delivery.pickupSignatureName || null,
          deliveryState: delivery.deliveryState || null,
          pickupState: delivery.pickupState || null,
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
          
          // Events data
          events: JSON.stringify(events)
        };
      });
  }
}

// Export singleton instance
export const axylogAPI = new AxylogAPI();