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
  pickUpAddress: {
    city: string;
    country: string;
  };
  deliveryAddress: {
    city: string;
    country: string;
    email: string;
  };
  receiverCompanyName: string;
  consignmentNo: string;
  status: string;
  estimatedDeliveryDate: string;
  lastKnownLocation: string;
  temperatureZone: string;
  events: Array<{
    timestamp: string;
    description: string;
    location: string;
    type: string;
  }>;
  // Add more fields as needed
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

      // Make request to get deliveries
      const response = await axios.post(DELIVERIES_URL, {
        pagination: {
          skip: 0,
          pageSize: 100
        },
        filters: {
          pickUp_Delivery_From: filters.pickupDateFrom,
          pickUp_Delivery_To: filters.pickupDateTo,
          // Add any other Axylog specific filters here
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

    // Filter by delivery email matching user email
    return deliveries
      .filter(delivery => delivery.deliveryAddress.email.toLowerCase() === userEmail.toLowerCase())
      .map((delivery, index) => {
        // Map status from Axylog to our status types
        const statusMap: Record<string, string> = {
          "In Transit": "In Transit",
          "Delivered": "Delivered",
          "Created": "Awaiting Pickup",
          "Picked Up": "In Transit",
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

        // Convert to our Consignment format
        return {
          id: index + 1,
          consignmentNumber: delivery.consignmentNo,
          userId: 1, // This will be replaced with the actual user ID
          customerName: delivery.receiverCompanyName,
          pickupAddress: delivery.pickUpAddress.city,
          deliveryAddress: delivery.deliveryAddress.city,
          status: statusMap[delivery.status] || "In Transit",
          estimatedDeliveryDate: new Date(delivery.estimatedDeliveryDate).toLocaleDateString('en-AU', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          temperatureZone: tempZoneMap[delivery.temperatureZone] || "Dry",
          lastKnownLocation: delivery.lastKnownLocation,
          events: events
        };
      });
  }
}

// Export singleton instance
export const axylogAPI = new AxylogAPI();