import axios from 'axios';

async function inspectAxylogData() {
  try {
    console.log('🔍 Inspecting axylog API response data...\n');

    // Step 1: Authentication
    console.log('1. Authentication Request:');
    const authResponse = await axios.post('https://api.axylog.com/authentication/service', {
      username: 'api.chill@axylog.com',
      password: '5#j{M):H){yD'
    });

    console.log('✅ Authentication Response:');
    console.log(JSON.stringify(authResponse.data, null, 2));

    const { token, userTree } = authResponse.data;
    const userId = userTree.userId;
    const companyId = userTree.companiesOwners[0].company;
    const contextOwnerId = userTree.companiesOwners[0].contextOwners[0].contextOwner;

    // Step 2: Deliveries API
    console.log('\n\n2. Deliveries API Request:');
    console.log(`Using: Company ${companyId}, User ${userId}, Context ${contextOwnerId}`);

    const deliveriesResponse = await axios.post('https://api.axylog.com/Deliveries?v=2', {
      pagination: {
        skip: 0,
        pageSize: 20
      },
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

    console.log('\n✅ Full Deliveries API Response:');
    console.log(JSON.stringify(deliveriesResponse.data, null, 2));

    // Step 3: Check if there are any other endpoints or data
    console.log('\n\n3. Response Analysis:');
    console.log(`Status Code: ${deliveriesResponse.status}`);
    console.log(`Response Size: ${JSON.stringify(deliveriesResponse.data).length} characters`);
    console.log(`Deliveries Array Length: ${deliveriesResponse.data.deliveries ? deliveriesResponse.data.deliveries.length : 'null/undefined'}`);
    
    if (deliveriesResponse.data.deliveries && deliveriesResponse.data.deliveries.length > 0) {
      console.log('\n📦 Sample Delivery Object Structure:');
      console.log(JSON.stringify(deliveriesResponse.data.deliveries[0], null, 2));
    }

    // Check for other properties in the response
    console.log('\n4. All Response Properties:');
    Object.keys(deliveriesResponse.data).forEach(key => {
      console.log(`- ${key}: ${typeof deliveriesResponse.data[key]} (${Array.isArray(deliveriesResponse.data[key]) ? 'array' : typeof deliveriesResponse.data[key]})`);
    });

  } catch (error) {
    console.error('❌ Error inspecting axylog data:');
    console.error('Status:', error.response?.status);
    console.error('Headers:', error.response?.headers);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

inspectAxylogData();