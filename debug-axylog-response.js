import axios from 'axios';

async function testAxylogData() {
  try {
    console.log('🔐 Testing axylog authentication...');
    
    // Step 1: Authenticate
    const authResponse = await axios.post('https://api.axylog.com/authentication/service', {
      username: process.env.AXYLOG_USERNAME || 'api.chill@axylog.com',
      password: process.env.AXYLOG_PASSWORD || '5#j{M):H){yD'
    });

    const { token, userTree } = authResponse.data;
    const userId = userTree.userId;
    const companyId = userTree.companiesOwners[0].company;
    const contextOwnerId = userTree.companiesOwners[0].contextOwners[0].contextOwner;

    console.log(`✅ Auth successful - Company: ${companyId}, User: ${userId}`);

    // Step 2: Test deliveries with different date ranges
    console.log('\n📦 Testing deliveries API with recent date range...');
    
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
    console.log(`📊 Found ${deliveries.length} deliveries`);
    
    if (deliveries.length > 0) {
      console.log('\n📋 First 3 deliveries:');
      deliveries.slice(0, 3).forEach((delivery, index) => {
        console.log(`\n${index + 1}. Consignment: ${delivery.consignmentNo || 'N/A'}`);
        console.log(`   Customer: ${delivery.receiverCompanyName || 'N/A'}`);
        console.log(`   Status: ${delivery.status || 'N/A'}`);
        console.log(`   Pickup: ${delivery.pickUpAddress?.city || 'N/A'}, ${delivery.pickUpAddress?.country || 'N/A'}`);
        console.log(`   Delivery: ${delivery.deliveryAddress?.city || 'N/A'}, ${delivery.deliveryAddress?.country || 'N/A'}`);
        console.log(`   Temperature: ${delivery.temperatureZone || 'N/A'}`);
      });
    } else {
      console.log('❌ No deliveries found in the specified date range');
      console.log('🔍 Raw API response:', JSON.stringify(deliveriesResponse.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAxylogData();