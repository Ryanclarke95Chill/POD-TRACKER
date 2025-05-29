import axios from 'axios';
import { Pool } from 'pg';

async function debugAxylogRealData() {
  console.log('🔍 Debugging axylog API to find your real Chill Transport data...');
  
  try {
    // Authenticate first
    console.log('🔐 Authenticating with axylog...');
    const authResponse = await axios.post('https://axylog.azurewebsites.net/auth/v2/login', {
      email: 'api.chill@axylog.com',
      password: process.env.AXYLOG_PASSWORD
    });

    const { token, userTree } = authResponse.data;
    const companyId = userTree.companiesOwners[0].company;
    const contextOwnerId = userTree.companiesOwners[0].contextOwners[0].contextOwner;
    
    console.log('✅ Authentication successful!');
    console.log(`📋 Company: ${companyId}, User: ${userTree.userId}, Context: ${contextOwnerId}`);

    // Try different date ranges to find your actual data
    const queries = [
      {
        name: "Last 3 days",
        filters: {
          pickUp_Delivery_From: "2025-05-26",
          pickUp_Delivery_To: "2025-05-29"
        }
      },
      {
        name: "Last week", 
        filters: {
          pickUp_Delivery_From: "2025-05-22",
          pickUp_Delivery_To: "2025-05-29"
        }
      },
      {
        name: "Last month",
        filters: {
          pickUp_Delivery_From: "2025-04-29",
          pickUp_Delivery_To: "2025-05-29"
        }
      },
      {
        name: "No date filter",
        filters: {}
      }
    ];

    const headers = {
      Authorization: `Bearer ${token}`,
      ContextOwner: contextOwnerId,
      User: userTree.userId,
      Company: companyId,
      SourceDeviceType: '3',
      'Content-Type': 'application/json'
    };

    for (const query of queries) {
      console.log(`\n📦 Testing: ${query.name}`);
      console.log(`   Filters: ${JSON.stringify(query.filters)}`);
      
      try {
        const response = await axios.post('https://axylog.azurewebsites.net/deliveries?v=2', {
          pagination: { skip: 0, pageSize: 20 },
          filters: query.filters
        }, { headers });

        const deliveries = response.data.deliveries || [];
        console.log(`   Result: ${deliveries.length} deliveries found`);
        
        if (deliveries.length > 0) {
          console.log('   🎉 FOUND DATA! Sample deliveries:');
          deliveries.slice(0, 3).forEach((delivery, i) => {
            console.log(`      ${i+1}. ${delivery.consignmentNo || 'No Number'} - ${delivery.shipToCompanyName || 'Unknown Customer'}`);
            console.log(`         From: ${delivery.shipFromCity || 'Unknown'} To: ${delivery.shipToCity || 'Unknown'}`);
            console.log(`         Vehicle: ${delivery.vehicleDescription || 'Not specified'}`);
          });
          
          // If we found data, import it
          console.log('\n💾 Importing this real data...');
          const pool = new Pool({ connectionString: process.env.DATABASE_URL });
          
          await pool.query('DELETE FROM consignments');
          console.log('🗑️ Cleared existing data');
          
          let imported = 0;
          for (const delivery of deliveries.slice(0, 10)) { // Import first 10
            try {
              await pool.query(`
                INSERT INTO consignments (
                  user_id, consignment_no, ship_to_company_name, ship_from_company_name,
                  ship_to_city, ship_from_city, ship_to_address, ship_from_address,
                  vehicle_description, delivery_outcome, pick_up_outcome,
                  max_scheduled_delivery_time, departure_date_time,
                  delivery_outcome_date_time, pick_up_outcome_date_time,
                  quantity, pallets, spaces, document_note, events
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                  $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
                )
              `, [
                1,
                delivery.consignmentNo || `UNKNOWN-${Date.now()}`,
                delivery.shipToCompanyName || 'Unknown Customer',
                delivery.shipFromCompanyName || 'Unknown Shipper',
                delivery.shipToCity || 'Unknown',
                delivery.shipFromCity || 'Unknown',
                delivery.shipToAddress || '',
                delivery.shipFromAddress || '',
                delivery.vehicleDescription || '',
                delivery.delivery_Outcome || false,
                delivery.pickUp_Outcome || false,
                delivery.maxScheduledDeliveryTime || null,
                delivery.departureDateTime || null,
                delivery.delivery_OutcomeDateTime || null,
                delivery.pickUp_OutcomeDateTime || null,
                delivery.quantity || 0,
                delivery.pallets || 0,
                delivery.spaces || 0,
                delivery.documentNote || '',
                '[]'
              ]);
              imported++;
            } catch (insertError) {
              console.log(`   ❌ Failed to insert ${delivery.consignmentNo}: ${insertError.message}`);
            }
          }
          
          await pool.end();
          console.log(`🎉 Successfully imported ${imported} real consignments from axylog!`);
          return;
        }
        
      } catch (queryError) {
        console.log(`   ❌ Query failed: ${queryError.message}`);
      }
    }
    
    console.log('\n❌ No data found with any of the query attempts');
    console.log('💡 This might mean:');
    console.log('   - Your account has no recent deliveries');
    console.log('   - Different query parameters are needed');
    console.log('   - Account permissions might be limited');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugAxylogRealData();