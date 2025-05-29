import axios from 'axios';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function loadRealChillData() {
  try {
    console.log('🚀 Loading your real Chill Transport Company data...\n');

    // Authenticate
    const authResponse = await axios.post('https://api.axylog.com/authentication/service', {
      username: 'api.chill@axylog.com',
      password: '5#j{M):H){yD'
    });

    const { token, userTree } = authResponse.data;
    const userId = userTree.userId;
    const companyId = userTree.companiesOwners[0].company;
    const contextOwnerId = userTree.companiesOwners[0].contextOwners[0].contextOwner;

    console.log(`✅ Authenticated - Company: ${companyId}, User: ${userId}`);

    // Get deliveries with correct structure
    const response = await axios.post('https://api.axylog.com/Deliveries?v=2', {
      pagination: { skip: 0, pageSize: 50 },
      filters: {
        type: "",
        tripNumber: [],
        plateNumber: [],
        documentNumber: [],
        pickUp_Delivery_From: "2020-01-01T00:00:00.000Z",
        pickUp_Delivery_To: "2030-12-31T23:59:59.000Z",
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

    // Extract deliveries from correct location in response
    const deliveries = response.data.itemList || [];
    console.log(`📦 Found ${deliveries.length} real Chill Transport deliveries!`);

    if (deliveries.length === 0) {
      console.log('No deliveries found');
      return;
    }

    // Load into database
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
      // Clear existing data
      await pool.query('DELETE FROM consignments WHERE user_id = $1', [1]);
      console.log('🗑️ Cleared existing data');

      let inserted = 0;
      for (const delivery of deliveries) {
        try {
          // Extract temperature zone from notes
          let tempZone = 'Standard';
          if (delivery.documentNote) {
            if (delivery.documentNote.includes('Frozen') || delivery.documentNote.includes('-18C')) {
              tempZone = 'Frozen (-18°C to -20°C)';
            } else if (delivery.documentNote.includes('Chiller') || delivery.documentNote.includes('0C to +4C')) {
              tempZone = 'Chilled (0°C to +4°C)';
            }
          }

          // Determine status
          let status = 'In Transit';
          if (delivery.delivery_OutcomeEnum === 'Positive') {
            status = 'Delivered';
          } else if (delivery.pickUp_OutcomeEnum === 'Positive' && !delivery.delivery_OutcomeEnum) {
            status = 'Picked Up';
          }

          const query = `
            INSERT INTO consignments (
              user_id, consignment_number, customer_name, consignment_reference,
              tracking_link, pickup_address, delivery_address, status,
              estimated_delivery_date, temperature_zone, last_known_location, events
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `;

          const values = [
            1, // user_id
            `${delivery.year}-${delivery.code}-${delivery.prog}`,
            delivery.shipToCompanyName || delivery.shipperCompanyName || delivery.shipFromCompanyName || 'Chill Transport Customer',
            delivery.documentReference || null,
            delivery.deliveryLiveTrackLink || delivery.pickupLiveTrackLink || null,
            `${delivery.shipFromAddress || ''}, ${delivery.shipFromCity || 'Melbourne'}, ${delivery.shipFromCountry || 'AU'}`.replace(/^, /, ''),
            `${delivery.shipToAddress || ''}, ${delivery.shipToCity || 'Sydney'}, ${delivery.shipToCountry || 'AU'}`.replace(/^, /, ''),
            status,
            delivery.maxScheduledDeliveryTime || delivery.maxScheduledPickUpTime || new Date().toISOString(),
            tempZone,
            delivery.shipToCity || delivery.shipFromCity || 'En route',
            JSON.stringify([
              {
                timestamp: delivery.delivery_OutcomeDateTime || delivery.pickUp_OutcomeDateTime || new Date().toISOString(),
                description: delivery.delivery_OutcomePODReason || delivery.pickUp_OutcomePODReason || 'Status update',
                location: delivery.shipToCity || delivery.shipFromCity || 'Unknown',
                type: delivery.delivery_OutcomeEnum ? 'delivery' : 'pickup'
              }
            ])
          ];

          await pool.query(query, values);
          inserted++;
          
          const customerName = delivery.shipToCompanyName || delivery.shipperCompanyName || delivery.shipFromCompanyName || 'Customer';
          console.log(`   ✅ ${delivery.year}-${delivery.code}-${delivery.prog} - ${customerName}`);
          
        } catch (insertError) {
          console.error(`   ❌ Failed to insert delivery:`, insertError.message);
        }
      }

      console.log(`\n🎉 Successfully loaded ${inserted} real Chill Transport consignments!`);
      console.log('📊 Your authentic delivery data is now in the dashboard.');

    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('❌ Load failed:', error.response?.data || error.message);
  }
}

loadRealChillData();