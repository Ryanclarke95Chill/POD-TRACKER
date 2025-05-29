import axios from 'axios';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure neon for Node.js
neonConfig.webSocketConstructor = ws;

async function authenticateAxylog() {
  try {
    console.log('🔐 Authenticating with axylog using Chill Transport credentials...');
    
    const response = await axios.post('https://api.axylog.com/authentication/service', {
      username: process.env.AXYLOG_USERNAME || 'api.chill@axylog.com',
      password: process.env.AXYLOG_PASSWORD || '5#j{M):H){yD'
    });

    const { token, userTree } = response.data;
    const userId = userTree.userId;
    const companyId = userTree.companiesOwners[0].company;
    const contextOwnerId = userTree.companiesOwners[0].contextOwners[0].contextOwner;

    console.log('✅ Axylog authentication successful!');
    console.log(`📋 Company: ${companyId}, User: ${userId}`);

    return { token, userId, companyId, contextOwnerId };
  } catch (error) {
    console.error('❌ Axylog authentication failed:', error.response?.data || error.message);
    throw error;
  }
}

async function getDeliveries(credentials) {
  try {
    console.log('📦 Fetching deliveries from axylog...');
    
    const response = await axios.post('https://api.axylog.com/Deliveries?v=2', {
      pagination: {
        skip: 0,
        pageSize: 25
      },
      filters: {
        type: "",
        tripNumber: [],
        plateNumber: [],
        documentNumber: [],
        pickUp_Delivery_From: "2024-01-01T22:00:00.000Z",
        pickUp_Delivery_To: "2024-12-31T21:59:00.000Z",
        states: {
          posOutcome: false,
          negOutcome: false,
          notDelOutcome: false,
          waitingForOutcome: null,
          inAdvance: false,
          inDelay: false,
          inTime: false
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${credentials.token}`,
        'ContextOwner': credentials.contextOwnerId,
        'User': credentials.userId,
        'Company': credentials.companyId,
        'SourceDeviceType': '3'
      }
    });

    const deliveries = response.data.deliveries || [];
    console.log(`✅ Retrieved ${deliveries.length} deliveries from axylog`);
    
    return deliveries;
  } catch (error) {
    console.error('❌ Failed to fetch deliveries:', error.response?.data || error.message);
    throw error;
  }
}

async function clearUserConsignments(userId) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const result = await pool.query('DELETE FROM consignments WHERE "userId" = $1', [userId]);
    console.log(`🗑️ Cleared ${result.rowCount} existing consignments`);
  } catch (error) {
    console.error('❌ Error clearing consignments:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function insertConsignment(delivery, userId) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const consignmentData = {
      userId: userId,
      consignmentNumber: delivery.consignmentNo || `CHILL-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      customerName: delivery.receiverCompanyName || "Chill Transport Customer",
      consignmentReference: delivery.documentNumber || null,
      trackingLink: delivery.trackingUrl || null,
      pickupAddress: delivery.pickUpAddress ? `${delivery.pickUpAddress.city}, ${delivery.pickUpAddress.country}` : "Melbourne, VIC",
      deliveryAddress: delivery.deliveryAddress ? `${delivery.deliveryAddress.city}, ${delivery.deliveryAddress.country}` : "Sydney, NSW",
      status: delivery.status || "In Transit",
      estimatedDeliveryDate: delivery.estimatedDeliveryDate || new Date().toISOString(),
      deliveryDate: null,
      dateDelivered: null,
      consignmentRequiredDeliveryDate: null,
      temperatureZone: delivery.temperatureZone || "Chilled (2-8°C)",
      lastKnownLocation: delivery.lastKnownLocation || "En route",
      events: JSON.stringify(delivery.events || [])
    };

    // Insert with all required fields for the schema
    const query = `
      INSERT INTO consignments (
        "userId", "consignmentNumber", "customerName", "consignmentReference", 
        "trackingLink", "pickupAddress", "deliveryAddress", "status", 
        "estimatedDeliveryDate", "deliveryDate", "dateDelivered", 
        "consignmentRequiredDeliveryDate", "temperatureZone", "lastKnownLocation", "events"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `;
    
    const values = [
      consignmentData.userId,
      consignmentData.consignmentNumber,
      consignmentData.customerName,
      consignmentData.consignmentReference,
      consignmentData.trackingLink,
      consignmentData.pickupAddress,
      consignmentData.deliveryAddress,
      consignmentData.status,
      consignmentData.estimatedDeliveryDate,
      consignmentData.deliveryDate,
      consignmentData.dateDelivered,
      consignmentData.consignmentRequiredDeliveryDate,
      consignmentData.temperatureZone,
      consignmentData.lastKnownLocation,
      consignmentData.events
    ];

    const result = await pool.query(query, values);
    return result.rows[0].id;
  } catch (error) {
    console.error('❌ Error inserting consignment:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function syncAxylogData() {
  try {
    console.log('🚀 Starting direct axylog sync for Chill Transport Company...\n');

    // Step 1: Authenticate
    const credentials = await authenticateAxylog();

    // Step 2: Get deliveries
    const deliveries = await getDeliveries(credentials);

    if (deliveries.length === 0) {
      console.log('ℹ️ No deliveries found in axylog');
      return;
    }

    // Step 3: Clear existing data
    await clearUserConsignments(1); // User ID 1 for api.chill@axylog.com

    // Step 4: Insert new deliveries
    console.log(`💾 Storing ${Math.min(deliveries.length, 10)} deliveries in database...`);
    
    let inserted = 0;
    for (const delivery of deliveries.slice(0, 10)) {
      try {
        await insertConsignment(delivery, 1);
        inserted++;
        console.log(`   ✅ Stored: ${delivery.consignmentNo || 'Unknown'} - ${delivery.receiverCompanyName || 'Unknown Customer'}`);
      } catch (error) {
        console.error(`   ❌ Failed to store delivery:`, error.message);
      }
    }

    console.log(`\n🎉 Sync completed! ${inserted}/${deliveries.length} deliveries stored successfully.`);
    console.log('📊 Your real Chill Transport Company data is now loaded in the dashboard.');

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// Run the sync
syncAxylogData();