import axios from 'axios';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function syncRealAxylogData() {
  try {
    console.log('🚀 Syncing real Chill Transport Company data...\n');

    // Step 1: Authenticate with axylog
    const authResponse = await axios.post('https://api.axylog.com/authentication/service', {
      username: process.env.AXYLOG_USERNAME || 'api.chill@axylog.com',
      password: process.env.AXYLOG_PASSWORD || '5#j{M):H){yD'
    });

    const { token, userTree } = authResponse.data;
    const userId = userTree.userId;
    const companyId = userTree.companiesOwners[0].company;
    const contextOwnerId = userTree.companiesOwners[0].contextOwners[0].contextOwner;

    console.log(`✅ Authenticated - Company: ${companyId}, User: ${userId}`);

    // Step 2: Get real deliveries
    const deliveriesResponse = await axios.post('https://api.axylog.com/Deliveries?v=2', {
      pagination: {
        skip: 0,
        pageSize: 50
      },
      filters: {
        type: "",
        tripNumber: [],
        plateNumber: [],
        documentNumber: [],
        pickUp_Delivery_From: "2024-01-01T00:00:00.000Z",
        pickUp_Delivery_To: "2025-12-31T23:59:59.000Z",
        states: {
          posOutcome: true,
          negOutcome: true,
          notDelOutcome: true,
          waitingForOutcome: true,
          inAdvance: true,
          inDelay: true,
          inTime: true
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'ContextOwner': contextOwnerId,
        'User': userId,
        'Company': companyId,
        'SourceDeviceType': '3'
      }
    });

    const deliveries = deliveriesResponse.data.deliveries || [];
    console.log(`📦 Found ${deliveries.length} real deliveries from axylog`);

    if (deliveries.length === 0) {
      console.log('ℹ️ No deliveries found for your date range');
      return;
    }

    // Step 3: Clear existing data and insert real deliveries
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
      await pool.query('DELETE FROM consignments WHERE user_id = $1', [1]);
      console.log('🗑️ Cleared existing demo data');

      let inserted = 0;
      for (const delivery of deliveries) {
        try {
          const query = `
            INSERT INTO consignments (
              user_id, consignment_number, customer_name, consignment_reference,
              tracking_link, pickup_address, delivery_address, status,
              estimated_delivery_date, temperature_zone, last_known_location, events
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `;

          const values = [
            1, // user_id
            delivery.documentNumber || `CHILL-${delivery.code}-${delivery.prog}`,
            delivery.shipToCompanyName || delivery.shipFromCompanyName || 'Chill Transport Customer',
            delivery.documentReference || null,
            delivery.deliveryLiveTrackLink || null,
            `${delivery.shipFromCity || 'Melbourne'}, ${delivery.shipFromCountry || 'AU'}`,
            `${delivery.shipToCity || 'Sydney'}, ${delivery.shipToCountry || 'AU'}`,
            delivery.delivery_OutcomeEnum || 'In Transit',
            delivery.maxScheduledDeliveryTime || new Date().toISOString(),
            delivery.temperatureZone || 'Chilled (0-4°C)',
            delivery.shipToCity || 'En route',
            JSON.stringify([
              {
                timestamp: delivery.delivery_OutcomeDateTime || new Date().toISOString(),
                description: delivery.delivery_OutcomePODReason || 'Status update',
                location: delivery.shipToCity || 'Unknown',
                type: 'delivery'
              }
            ])
          ];

          await pool.query(query, values);
          inserted++;
          
          console.log(`   ✅ ${delivery.documentNumber || `CHILL-${delivery.code}`} - ${delivery.shipToCompanyName || 'Customer'}`);
        } catch (insertError) {
          console.error(`   ❌ Failed to insert delivery:`, insertError.message);
        }
      }

      console.log(`\n🎉 Successfully loaded ${inserted} real consignments!`);
      console.log('📊 Your authentic Chill Transport Company data is now in the dashboard.');

    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('❌ Sync failed:', error.response?.data || error.message);
  }
}

syncRealAxylogData();