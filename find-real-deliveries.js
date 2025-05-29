import axios from 'axios';

async function findRealDeliveries() {
  try {
    console.log('🔍 Searching for your real delivery data...\n');

    // Authenticate with your credentials
    const authResponse = await axios.post('https://api.axylog.com/authentication/service', {
      username: 'api.chill@axylog.com',
      password: '5#j{M):H){yD'
    });

    const { token, userTree } = authResponse.data;
    const userId = userTree.userId;
    const companyId = userTree.companiesOwners[0].company;
    const contextOwnerId = userTree.companiesOwners[0].contextOwners[0].contextOwner;

    console.log(`✅ Authenticated - Company: ${companyId}, User: ${userId}`);

    // Try different date ranges to find your data
    const dateRanges = [
      { from: "2023-01-01T00:00:00.000Z", to: "2025-12-31T23:59:59.000Z", name: "All time" },
      { from: "2024-06-01T00:00:00.000Z", to: "2024-12-31T23:59:59.000Z", name: "June 2024 onwards" },
      { from: "2024-01-01T00:00:00.000Z", to: "2024-06-30T23:59:59.000Z", name: "First half 2024" }
    ];

    for (const range of dateRanges) {
      console.log(`\n📅 Searching ${range.name}...`);
      
      try {
        const response = await axios.post('https://api.axylog.com/Deliveries?v=2', {
          pagination: { skip: 0, pageSize: 100 },
          filters: {
            type: "",
            tripNumber: [],
            plateNumber: [],
            documentNumber: [],
            pickUp_Delivery_From: range.from,
            pickUp_Delivery_To: range.to,
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

        const deliveries = response.data.deliveries || [];
        console.log(`   Found: ${deliveries.length} deliveries`);
        
        if (deliveries.length > 0) {
          console.log('\n🎉 Found your real data! Sample deliveries:');
          deliveries.slice(0, 3).forEach((delivery, i) => {
            console.log(`\n${i + 1}. Code: ${delivery.code}-${delivery.prog}`);
            console.log(`   Customer: ${delivery.shipToCompanyName || delivery.shipFromCompanyName || 'N/A'}`);
            console.log(`   Route: ${delivery.shipFromCity || 'N/A'} → ${delivery.shipToCity || 'N/A'}`);
            console.log(`   Status: ${delivery.delivery_OutcomeEnum || 'N/A'}`);
            console.log(`   Date: ${delivery.maxScheduledDeliveryTime || 'N/A'}`);
            if (delivery.deliveryLiveTrackLink) {
              console.log(`   Tracking: ${delivery.deliveryLiveTrackLink}`);
            }
          });
          
          // Store this data
          console.log(`\n💾 Would you like me to load these ${deliveries.length} real deliveries into your dashboard?`);
          return deliveries;
        }
      } catch (error) {
        console.log(`   ❌ Error searching this range: ${error.message}`);
      }
    }

    console.log('\n🤔 No deliveries found in any date range.');
    console.log('This could mean:');
    console.log('- Your delivery data is in a different system/account');
    console.log('- Data might be under different company/context settings');
    console.log('- The API might need different parameters');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

findRealDeliveries();