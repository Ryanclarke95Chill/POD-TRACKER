/**
 * Axylog Integration Module
 * 
 * This module provides complete integration with the Axylog logistics API.
 * It handles authentication, data fetching, mapping, and filtering.
 * 
 * REQUIREMENTS:
 * - Node.js environment
 * - axios package: npm install axios
 * - Environment variables: AXYLOG_USERNAME and AXYLOG_PASSWORD
 * 
 * USAGE:
 * 
 * ```javascript
 * const { AxylogAPI } = require('./axylog-integration');
 * 
 * const axylogAPI = new AxylogAPI();
 * 
 * // Authenticate
 * const authSuccess = await axylogAPI.authenticate();
 * if (!authSuccess) {
 *   console.error('Authentication failed');
 *   return;
 * }
 * 
 * // Get today's deliveries
 * const deliveries = await axylogAPI.getDeliveries('user@example.com');
 * console.log(`Retrieved ${deliveries.length} deliveries`);
 * 
 * // Get deliveries with custom date range
 * const customDeliveries = await axylogAPI.getConsignmentsWithFilters({
 *   pickupDateFrom: '2024-01-01',
 *   pickupDateTo: '2024-01-31'
 * });
 * 
 * // Extract photos for a specific consignment
 * const photos = await axylogAPI.extractPODPhotos('trackingToken123');
 * ```
 * 
 * ENVIRONMENT VARIABLES:
 * Set these in your .env file or Replit Secrets:
 * - AXYLOG_USERNAME=your_axylog_username
 * - AXYLOG_PASSWORD=your_axylog_password
 */

const axios = require('axios');

// Axylog API URLs
const BASE_URL = "https://api.axylog.com";
const AUTH_URL = `${BASE_URL}/authentication/service`;
const DELIVERIES_URL = `${BASE_URL}/Deliveries?v=2`;

/**
 * Axylog API Integration Class
 * Handles all interactions with the Axylog logistics platform
 */
class AxylogAPI {
  constructor() {
    this.credentials = null;
    this.username = process.env.AXYLOG_USERNAME || "";
    this.password = process.env.AXYLOG_PASSWORD || "";
    
    if (!this.username || !this.password) {
      console.warn("Axylog credentials not found in environment variables");
    }
  }

  /**
   * Authenticate with Axylog API
   * @returns {Promise<boolean>} Success status
   */
  async authenticate() {
    try {
      if (this.credentials) {
        return true;
      }

      if (!this.username || !this.password) {
        console.error("Missing Axylog credentials");
        return false;
      }

      const response = await axios.post(AUTH_URL, {
        username: this.username,
        password: this.password
      }, {
        headers: {
          "Content-Type": "application/json"
        }
      });

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

  /**
   * Get today's deliveries for a specific user
   * @param {string} userEmail - User email (optional, for future filtering)
   * @returns {Promise<Array>} Array of consignment objects
   */
  async getDeliveries(userEmail = '') {
    try {
      const todayAEST = new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney" });
      const todayDate = new Date(todayAEST);
      const todayString = todayDate.toISOString().split('T')[0];

      const filters = {
        pickupDateFrom: todayString,
        pickupDateTo: todayString
      };

      console.log("Using today's date filters (AEST):", filters);
      return this.getConsignmentsWithFilters(filters);
    } catch (error) {
      console.error("Failed to get deliveries from Axylog API:", error);
      return [];
    }
  }

  /**
   * Get consignments with custom filters
   * @param {Object} filters - Filter options
   * @param {string} filters.pickupDateFrom - Start date (YYYY-MM-DD)
   * @param {string} filters.pickupDateTo - End date (YYYY-MM-DD)
   * @param {string} [filters.customerName] - Filter by customer name
   * @param {string} [filters.warehouseCompanyName] - Filter by warehouse
   * @returns {Promise<Array>} Array of consignment objects
   */
  async getConsignmentsWithFilters(filters) {
    try {
      if (!this.credentials && !(await this.authenticate())) {
        console.error("Authentication failed, cannot get deliveries");
        return [];
      }

      console.log("Fetching consignments from Axylog with filters:", filters);

      const pickupFromDate = `${filters.pickupDateFrom}T00:00:00.000Z`;
      const pickupToDate = `${filters.pickupDateTo}T23:59:59.000Z`;
      
      console.log(`Requesting data from ${pickupFromDate} to ${pickupToDate}`);

      // Fetch all deliveries using pagination
      let allDeliveries = [];
      let skip = 0;
      const pageSize = 500;
      let hasMoreData = true;
      let pageNumber = 1;

      while (hasMoreData) {
        console.log(`Fetching page ${pageNumber} (skip: ${skip}, pageSize: ${pageSize})`);
        
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
            "Authorization": `Bearer ${this.credentials.token}`,
            "ContextOwner": this.credentials.contextOwnerId,
            "User": this.credentials.userId,
            "Company": this.credentials.companyId,
            "SourceDeviceType": "3",
            "Content-Type": "application/json"
          }
        });

        if (!response.data || !response.data.itemList) {
          console.warn("No deliveries found in Axylog response");
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

        if (pageNumber > 100) {
          console.log("Reached maximum safety limit of 100 pages");
          break;
        }
      }

      console.log(`Total deliveries retrieved: ${allDeliveries.length}`);

      // Apply additional filters
      let deliveries = allDeliveries;
      
      if (filters.customerName) {
        deliveries = deliveries.filter(delivery => 
          delivery.receiverCompanyName?.toLowerCase().includes(filters.customerName?.toLowerCase() || '')
        );
        console.log(`Filtered to ${deliveries.length} deliveries by customer name`);
      }
      
      if (filters.warehouseCompanyName) {
        deliveries = deliveries.filter(delivery => 
          delivery.warehouseCompanyName?.toLowerCase().includes(filters.warehouseCompanyName?.toLowerCase() || '')
        );
        console.log(`Filtered to ${deliveries.length} deliveries by warehouse`);
      }

      // Filter out depot transfers
      const initialCount = deliveries.length;
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

      deliveries = deliveries.filter(delivery => {
        const from = delivery.shipFromMasterDataCode;
        const to = delivery.shipToMasterDataCode;
        
        const isDepotTransfer = depotTransferPatterns.some(pattern => 
          pattern.from === from && pattern.to === to
        );
        
        return !isDepotTransfer;
      });

      const filteredCount = deliveries.length;
      console.log(`Filtered out ${initialCount - filteredCount} depot transfers`);

      return this.convertDeliveries(deliveries);
    } catch (error) {
      console.error("Failed to get deliveries from Axylog API:", error);
      return [];
    }
  }

  /**
   * Convert Axylog deliveries to a standardized format
   * @param {Array} deliveries - Raw Axylog delivery objects
   * @returns {Array} Converted consignment objects
   */
  convertDeliveries(deliveries) {
    if (!deliveries || !Array.isArray(deliveries)) {
      return [];
    }

    console.log(`Converting ${deliveries.length} deliveries from Axylog format`);

    return deliveries.map((delivery, index) => {
      // Map temperature zones
      const tempZoneMap = {
        "AMB": "Dry",
        "CHI": "Chiller (0–4°C)",
        "FRE": "Freezer (-20°C)",
        "WIN": "Wine (14°C)",
        "CON": "Confectionery (15–20°C)",
        "PHA": "Pharma (2–8°C)"
      };

      // Map delivery status
      const statusMap = {
        "In Transit": "In Transit",
        "Delivered": "Delivered", 
        "Created": "Awaiting Pickup",
        "Picked Up": "In Transit",
        "Back to depot": "Delivered"
      };

      // Extract tracking token from live track links
      const extractTrackingToken = (trackingLink) => {
        if (!trackingLink) return null;
        const match = trackingLink.match(/live\.axylog\.com\/(.+)$/);
        return match ? match[1] : null;
      };

      // Generate consignment reference using best available field
      const consignmentRef = delivery.consignmentNo || 
                           delivery.documentReference || 
                           delivery.orderNumberRef || 
                           delivery.shipperOrderReferenceNumber || 
                           delivery.externalReference ||
                           delivery.documentNumber ||
                           `${delivery.year}-${delivery.code}-${delivery.prog}` || 
                           `REF-${delivery.id || Math.random().toString(36).substr(2, 9)}`;

      return {
        // Core identifiers
        id: index + 1,
        consignmentNo: consignmentRef,
        orderNumberRef: delivery.orderNumberRef,
        
        // Company information
        shipToCompanyName: delivery.shipToCompanyName,
        shipFromCompanyName: delivery.shipFromCompanyName,
        shipperCompanyName: delivery.shipperCompanyName,
        warehouseCompanyName: delivery.warehouseCompanyName,
        
        // Locations
        shipFromAddress: delivery.shipFromAddress,
        shipFromCity: delivery.shipFromCity,
        shipFromCountry: delivery.shipFromCountry,
        shipFromZipCode: delivery.shipFromZipCode,
        shipToAddress: delivery.shipToAddress,
        shipToCity: delivery.shipToCity,
        shipToCountry: delivery.shipToCountry,
        shipToZipCode: delivery.shipToZipCode,
        
        // Master data codes (for filtering)
        shipFromMasterDataCode: delivery.shipFromMasterDataCode,
        shipToMasterDataCode: delivery.shipToMasterDataCode,
        
        // Vehicle and driver
        vehicleDescription: delivery.vehicleDescription,
        driverName: delivery.driverName,
        driverCode: delivery.driverCode,
        driverPhoneNumber: delivery.driverPhoneNumber,
        
        // Cargo details
        quantity: delivery.quantity,
        pallets: delivery.pallets,
        totalWeightInKg: delivery.totalWeightInKg,
        volumeInM3: delivery.volumeInM3,
        
        // Status and timing
        status: statusMap[delivery.deliveryState] || delivery.deliveryState || "Unknown",
        deliveryState: delivery.deliveryState,
        pickupState: delivery.pickupState,
        
        // Timestamps
        departureDateTime: delivery.departureDateTime,
        delivery_OutcomeDateTime: delivery.delivery_OutcomeDateTime,
        pickUp_OutcomeDateTime: delivery.pickUp_OutcomeDateTime,
        delivery_ArrivalDateTime: delivery.delivery_ArrivalDateTime,
        pickUp_ArrivalDateTime: delivery.pickUp_ArrivalDateTime,
        
        // Temperature (stored in unconventional fields)
        expectedTemperature: delivery.expectedTemperature,
        actualTemperature: delivery.paymentMethod, // Temperature data is in paymentMethod field
        temperatureReading1: delivery.amountToCollect,
        temperatureReading2: delivery.amountCollected,
        temperatureZone: tempZoneMap[delivery.expectedTemperature] || delivery.expectedTemperature || "Standard",
        
        // POD and tracking
        deliveryLiveTrackLink: delivery.deliveryLiveTrackLink,
        pickupLiveTrackLink: delivery.pickupLiveTrackLink,
        trackingToken: extractTrackingToken(delivery.deliveryLiveTrackLink),
        
        // File counts for POD photos
        deliveryExpectedFileCount: delivery.deliveryExpectedFileCount,
        deliveryReceivedFileCount: delivery.deliveryReceivedFileCount,
        pickupExpectedFileCount: delivery.pickupExpectedFileCount,
        pickupReceivedFileCount: delivery.pickupReceivedFileCount,
        
        // Signatures
        deliverySignatureName: delivery.deliverySignatureName,
        pickupSignatureName: delivery.pickupSignatureName,
        
        // Outcome information
        delivery_Outcome: delivery.delivery_Outcome,
        delivery_OutcomeNote: delivery.delivery_OutcomeNote,
        pickUp_Outcome: delivery.pickUp_Outcome,
        pickUp_OutcomeNote: delivery.pickUp_OutcomeNote,
        
        // Contact information
        orderDeliveryEmail: delivery.orderDeliveryEmail,
        orderDeliveryTelephoneNumber: delivery.orderDeliveryTelephoneNumber,
        orderPickupEmail: delivery.orderPickupEmail,
        orderPickupTelephoneNumber: delivery.orderPickupTelephoneNumber,
        
        // Notes and references
        documentNote: delivery.documentNote,
        externalReference: delivery.externalReference,
        shipperOrderReferenceNumber: delivery.shipperOrderReferenceNumber,
        
        // Raw delivery object (for debugging or custom processing)
        _rawDelivery: delivery
      };
    });
  }

  /**
   * Extract POD (Proof of Delivery) photos for a specific tracking token
   * @param {string} trackingToken - The tracking token from delivery link
   * @returns {Promise<Object>} Object containing photo URLs and metadata
   */
  async extractPODPhotos(trackingToken) {
    try {
      const trackingUrl = `https://live.axylog.com/${trackingToken}`;
      console.log(`Extracting photos for tracking token: ${trackingToken}`);
      console.log(`Tracking URL: ${trackingUrl}`);

      // You would need to implement web scraping here using puppeteer or similar
      // This is a placeholder for the photo extraction logic
      
      return {
        success: true,
        trackingToken: trackingToken,
        trackingUrl: trackingUrl,
        photos: [], // Array of photo URLs
        signaturePhotos: [], // Array of signature photo URLs
        regularPhotos: [], // Array of non-signature photo URLs
        totalPhotos: 0
      };
    } catch (error) {
      console.error(`Failed to extract photos for token ${trackingToken}:`, error);
      return {
        success: false,
        trackingToken: trackingToken,
        error: error.message,
        photos: [],
        signaturePhotos: [],
        regularPhotos: [],
        totalPhotos: 0
      };
    }
  }

  /**
   * Get temperature zone classification
   * @param {Object} consignment - Consignment object
   * @returns {string} Temperature zone classification
   */
  getTemperatureZone(consignment) {
    // Check if it's an internal transfer first
    if (consignment.shipFromMasterDataCode && consignment.shipToMasterDataCode) {
      const from = consignment.shipFromMasterDataCode;
      const to = consignment.shipToMasterDataCode;
      
      // Internal transfer patterns
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
      
      const isInternalTransfer = depotTransferPatterns.some(pattern => 
        pattern.from === from && pattern.to === to
      );
      
      if (isInternalTransfer) {
        return 'Internal Transfer';
      }
    }
    
    // Standard temperature zone mapping
    const expectedTemp = consignment.expectedTemperature;
    const tempZone = consignment.temperatureZone;
    
    if (tempZone && tempZone !== 'Standard') {
      return tempZone;
    }
    
    // Map based on expected temperature codes
    const tempMap = {
      "AMB": "Dry",
      "CHI": "Chiller (0–4°C)", 
      "FRE": "Freezer (-20°C)",
      "WIN": "Wine (14°C)",
      "CON": "Confectionery (15–20°C)",
      "PHA": "Pharma (2–8°C)"
    };
    
    return tempMap[expectedTemp] || "Dry";
  }

  /**
   * Check if a consignment is a return shipment
   * @param {Object} consignment - Consignment object
   * @returns {boolean} True if it's a return shipment
   */
  isReturn(consignment) {
    const orderType = consignment.orderType?.toLowerCase() || '';
    const documentNote = consignment.documentNote?.toLowerCase() || '';
    const outcome = consignment.delivery_Outcome?.toLowerCase() || '';
    
    const returnIndicators = [
      'return', 'ret', 'rts', 'return to sender',
      'refused', 'rejection', 'back to depot'
    ];
    
    return returnIndicators.some(indicator => 
      orderType.includes(indicator) || 
      documentNote.includes(indicator) ||
      outcome.includes(indicator)
    );
  }

  /**
   * Check if consignment is an internal transfer
   * @param {Object} consignment - Consignment object  
   * @returns {boolean} True if it's an internal transfer
   */
  isInternalTransfer(consignment) {
    return this.getTemperatureZone(consignment) === 'Internal Transfer';
  }
}

// Helper functions for data analysis

/**
 * Analyze POD quality for a consignment
 * @param {Object} consignment - Consignment object
 * @returns {Object} POD quality analysis
 */
function analyzePODQuality(consignment) {
  const analysis = {
    photoCount: consignment.deliveryReceivedFileCount || 0,
    hasSignature: !!consignment.deliverySignatureName,
    hasReceiverName: !!consignment.deliverySignatureName,
    temperatureCompliant: true, // Would need temperature range checking
    hasTrackingLink: !!consignment.deliveryLiveTrackLink,
    deliveryTime: consignment.delivery_OutcomeDateTime,
    qualityScore: 0
  };

  // Calculate quality score (simplified version)
  let score = 0;
  
  // Photos (40 points max)
  if (analysis.photoCount >= 3) {
    score += 30; // Base points
    score += Math.min(10, (analysis.photoCount - 3) * 2.5); // Bonus points
  } else if (analysis.photoCount > 0) {
    score += analysis.photoCount * 10; // Partial points
  }
  
  // Signature (20 points)
  if (analysis.hasSignature) {
    score += 20;
  }
  
  // Receiver name (15 points)  
  if (analysis.hasReceiverName) {
    score += 15;
  }
  
  // Temperature compliance (25 points)
  if (analysis.temperatureCompliant) {
    score += 25;
  }
  
  analysis.qualityScore = Math.min(100, score);
  
  return analysis;
}

/**
 * Extract driver performance metrics
 * @param {Array} consignments - Array of consignments
 * @returns {Object} Driver performance analysis
 */
function analyzeDriverPerformance(consignments) {
  const driverStats = {};
  
  consignments.forEach(consignment => {
    const driverName = consignment.driverName;
    if (!driverName) return;
    
    if (!driverStats[driverName]) {
      driverStats[driverName] = {
        name: driverName,
        totalDeliveries: 0,
        completedDeliveries: 0,
        totalScore: 0,
        avgScore: 0
      };
    }
    
    driverStats[driverName].totalDeliveries++;
    
    if (consignment.status === 'Delivered') {
      driverStats[driverName].completedDeliveries++;
      
      const podQuality = analyzePODQuality(consignment);
      driverStats[driverName].totalScore += podQuality.qualityScore;
    }
  });
  
  // Calculate averages
  Object.values(driverStats).forEach(driver => {
    if (driver.completedDeliveries > 0) {
      driver.avgScore = driver.totalScore / driver.completedDeliveries;
    }
  });
  
  return driverStats;
}

// Export the main class and helper functions
module.exports = {
  AxylogAPI,
  analyzePODQuality,
  analyzeDriverPerformance
};

/*
USAGE EXAMPLES:

1. Basic usage:
```javascript
const { AxylogAPI } = require('./axylog-integration');

async function syncData() {
  const api = new AxylogAPI();
  
  if (await api.authenticate()) {
    const deliveries = await api.getDeliveries();
    console.log(`Synced ${deliveries.length} deliveries`);
  }
}
```

2. Date range sync:
```javascript
const deliveries = await api.getConsignmentsWithFilters({
  pickupDateFrom: '2024-01-01',
  pickupDateTo: '2024-01-31',
  customerName: 'ACME Corp'
});
```

3. POD Quality Analysis:
```javascript
const { analyzePODQuality } = require('./axylog-integration');

deliveries.forEach(delivery => {
  const quality = analyzePODQuality(delivery);
  console.log(`${delivery.consignmentNo}: ${quality.qualityScore}/100`);
});
```

ENVIRONMENT SETUP:
Add to your .env file:
AXYLOG_USERNAME=your_username_here
AXYLOG_PASSWORD=your_password_here

DEPENDENCIES:
npm install axios
```
*/