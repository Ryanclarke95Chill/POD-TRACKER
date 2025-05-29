// Direct axylog sync script to bypass routing issues
import axios from 'axios';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure neon for WebSocket
neonConfig.webSocketConstructor = ws;

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Axylog credentials
const AXYLOG_USERNAME = process.env.AXYLOG_USERNAME;
const AXYLOG_PASSWORD = process.env.AXYLOG_PASSWORD;

async function authenticateAxylog() {
  try {
    console.log('Authenticating with axylog...');
    const response = await axios.post('https://api.axylog.com/authentication/service', {
      username: AXYLOG_USERNAME,
      password: AXYLOG_PASSWORD
    });

    const { token, userTree } = response.data;
    const userId = userTree.userId;
    const companyId = userTree.companiesOwners[0].company;
    const contextOwnerId = userTree.companiesOwners[0].contextOwners[0].contextOwner;

    console.log('Authentication successful!');
    return { token, userId, companyId, contextOwnerId };
  } catch (error) {
    console.error('Authentication failed:', error.message);
    return null;
  }
}

async function getDeliveries(credentials) {
  try {
    console.log('Fetching deliveries from axylog...');
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

    console.log(`Retrieved ${response.data.deliveries?.length || 0} deliveries`);
    return response.data.deliveries || [];
  } catch (error) {
    console.error('Failed to fetch deliveries:', error.message);
    return [];
  }
}

async function clearUserConsignments(userId) {
  try {
    await pool.query('DELETE FROM consignments WHERE "userId" = $1', [userId]);
    console.log('Cleared existing consignments');
  } catch (error) {
    console.error('Error clearing consignments:', error.message);
  }
}

async function insertConsignment(delivery, userId) {
  try {
    const insertQuery = `
      INSERT INTO consignments (
        "userId", "consignmentNumber", "customerName", "pickupAddress", 
        "deliveryAddress", "status", "estimatedDeliveryDate", "temperatureZone",
        "lastKnownLocation", "events"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    
    const values = [
      userId,
      delivery.consignmentNo || null,
      delivery.receiverCompanyName || null,
      delivery.pickUpAddress ? `${delivery.pickUpAddress.city}, ${delivery.pickUpAddress.country}` : null,
      delivery.deliveryAddress ? `${delivery.deliveryAddress.city}, ${delivery.deliveryAddress.country}` : null,
      delivery.status || null,
      delivery.estimatedDeliveryDate || null,
      delivery.temperatureZone || null,
      delivery.lastKnownLocation || null,
      JSON.stringify(delivery.events || [])
    ];

    const result = await pool.query(insertQuery, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error inserting consignment:', error.message);
    return null;
  }
}

async function syncAxylogData() {
  console.log('=== DIRECT AXYLOG SYNC STARTED ===');
  
  // Authenticate with axylog
  const credentials = await authenticateAxylog();
  if (!credentials) {
    console.error('Failed to authenticate with axylog');
    return false;
  }

  // Get deliveries
  const deliveries = await getDeliveries(credentials);
  if (deliveries.length === 0) {
    console.log('No deliveries found');
    return true;
  }

  // Clear existing data for user 1 (demo user)
  await clearUserConsignments(1);

  // Insert new consignments
  let inserted = 0;
  for (const delivery of deliveries) {
    const result = await insertConsignment(delivery, 1);
    if (result) {
      inserted++;
    }
  }

  console.log(`Successfully synced ${inserted} consignments`);
  return true;
}

// Run the sync
syncAxylogData()
  .then(success => {
    if (success) {
      console.log('Sync completed successfully!');
    } else {
      console.log('Sync failed');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Sync error:', error);
    process.exit(1);
  });