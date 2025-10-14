import axios from 'axios';
import fs from 'fs';
import { format, subDays } from 'date-fns';

// Axylog API configuration
const AUTH_URL = 'https://api.axylog.com/authentication/service';
const DELIVERIES_URL = 'https://api.axylog.com/Deliveries';

// Use existing environment variables or default values
const AXYLOG_USERNAME = process.env.AXYLOG_USERNAME || 'api.chill@axylog.com';
const AXYLOG_PASSWORD = process.env.AXYLOG_PASSWORD || '5#j{M):H){yD';

interface AxylogCredentials {
  token: string;
  userId: string;
  companyId: string;
  contextOwnerId: string;
}

interface Delivery {
  year: number;
  code: number;
  prog: number;
  [key: string]: any;
}

async function authenticate(): Promise<AxylogCredentials> {
  console.log('Authenticating with Axylog API...');
  
  const response = await axios.post(AUTH_URL, {
    username: AXYLOG_USERNAME,
    password: AXYLOG_PASSWORD
  });

  const { token, userTree } = response.data;
  const credentials = {
    token,
    userId: userTree.userId,
    companyId: userTree.companiesOwners[0].company,
    contextOwnerId: userTree.companiesOwners[0].contextOwners[0].contextOwner
  };
  
  console.log('Authentication successful');
  return credentials;
}

async function fetchYesterdayDeliveries(credentials: AxylogCredentials): Promise<Delivery[]> {
  // Calculate yesterday's date
  const yesterday = subDays(new Date(), 1);
  const fromDate = format(yesterday, "yyyy-MM-dd'T00:00:00.000Z'");
  const toDate = format(yesterday, "yyyy-MM-dd'T23:59:59.999Z'");
  
  console.log(`\nFetching deliveries created on ${format(yesterday, 'yyyy-MM-dd')}...`);
  
  const deliveries: Delivery[] = [];
  let page = 1;
  let hasMore = true;
  const pageSize = 500;
  
  while (hasMore) {
    const skip = (page - 1) * pageSize;
    console.log(`Fetching page ${page} (skip: ${skip})...`);
    
    // Use POST request with proper headers and body structure
    const response = await axios.post(`${DELIVERIES_URL}?v=2`, {
      pagination: {
        skip: skip,
        pageSize: pageSize
      },
      filters: {
        type: "",
        tripNumber: [],
        plateNumber: [],
        documentNumber: [],
        pickUp_Delivery_From: fromDate,
        pickUp_Delivery_To: toDate,
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
        'Authorization': `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
        'User': credentials.userId,
        'Company': credentials.companyId,
        'ContextOwner': credentials.contextOwnerId,
        'SourceDeviceType': '3',
        'LanguageCode': 'EN'
      }
    });
    
    const pageDeliveries = response.data.itemList || [];
    deliveries.push(...pageDeliveries);
    
    console.log(`Received ${pageDeliveries.length} deliveries on page ${page}`);
    
    if (pageDeliveries.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }
  
  console.log(`\nTotal deliveries found: ${deliveries.length}`);
  return deliveries;
}

async function fetchFilesForDelivery(
  credentials: AxylogCredentials,
  delivery: Delivery
): Promise<any> {
  const { year, code, prog } = delivery;
  const filesUrl = `https://api.axylog.com/deliveries/${year}/${code}/${prog}/files`;
  
  try {
    const response = await axios.get(filesUrl, {
      headers: {
        'Authorization': `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
        'User': credentials.userId,
        'Company': credentials.companyId,
        'ContextOwner': credentials.contextOwnerId,
        'SourceDeviceType': '3',
        'LanguageCode': 'EN'
      }
    });
    
    return {
      delivery: { year, code, prog },
      files: response.data
    };
  } catch (error: any) {
    console.error(`Error fetching files for ${year}/${code}/${prog}:`, error.message);
    return {
      delivery: { year, code, prog },
      files: null,
      error: error.message
    };
  }
}

async function main() {
  try {
    // Step 1: Authenticate
    const credentials = await authenticate();
    
    // Step 2: Fetch yesterday's deliveries
    const deliveries = await fetchYesterdayDeliveries(credentials);
    
    if (deliveries.length === 0) {
      console.log('No deliveries found for yesterday');
      return;
    }
    
    // Step 3: Extract year, code, prog and fetch files for each delivery
    console.log('\nFetching files metadata for each delivery...');
    const allFilesData = [];
    
    for (let i = 0; i < deliveries.length; i++) {
      const delivery = deliveries[i];
      
      if (i % 10 === 0) {
        console.log(`Processing ${i + 1}/${deliveries.length}...`);
      }
      
      const filesData = await fetchFilesForDelivery(credentials, delivery);
      allFilesData.push(filesData);
      
      // Add a small delay to avoid rate limiting
      if (i < deliveries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Step 4: Save to JSON file
    const outputPath = './axylog_files_yesterday.json';
    fs.writeFileSync(outputPath, JSON.stringify(allFilesData, null, 2));
    
    console.log('\n✅ Success!');
    console.log(`Files metadata saved to: ${outputPath}`);
    console.log(`Total deliveries processed: ${allFilesData.length}`);
    console.log(`\nYou can download the file from: ${process.cwd()}/${outputPath}`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main();