#!/usr/bin/env node
// Test script to verify photo scraping API with proper authentication
import jwt from 'jsonwebtoken';
import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
const SECRET_KEY = 'chilltrack-secret-key';

// Generate auth token like the production system
function generateAuthToken() {
  return jwt.sign(
    { id: 1, email: 'admin@chilltrack.com', role: 'admin' },
    SECRET_KEY,
    { expiresIn: '24h' }
  );
}

// Test tracking tokens that worked in debug script
const TEST_TOKENS = [
  '5UxuxKWlsEGalB7Gm0',  // Known good token
  'i4lTOEkio3WfaS0kbg',  // Known good token
  'SiKxrrUjRUD4SCnLAX'   // Token that worked in debug (found 9 photos)
];

async function testPhotoAPI(token) {
  console.log(`\n🧪 [API TEST] Testing token: ${token}`);
  
  const authToken = generateAuthToken();
  const startTime = Date.now();
  
  try {
    const url = `${BASE_URL}/api/pod-photos?trackingToken=${encodeURIComponent(token)}&priority=high`;
    console.log(`📡 Making request to: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const data = response.data;
    
    console.log(`✅ Response received in ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`🎯 Success: ${response.status >= 200 && response.status < 300}`);
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`📸 Photos found: ${data.photos?.length || 0} regular, ${data.signaturePhotos?.length || 0} signature`);
      console.log(`🔄 Preparing: ${data.preparing || false}`);
      
      if (data.photos && data.photos.length > 0) {
        console.log(`📋 First few photo URLs:`);
        data.photos.slice(0, 3).forEach((url, index) => {
          console.log(`  ${index + 1}. ${url.substring(0, 80)}...`);
        });
      }
      
      if (data.signaturePhotos && data.signaturePhotos.length > 0) {
        console.log(`✍️ Signature photos:`);
        data.signaturePhotos.slice(0, 2).forEach((url, index) => {
          console.log(`  ${index + 1}. ${url.substring(0, 50)}...`);
        });
      }
    } else {
      console.log(`❌ Error response:`, data);
    }
    
    return {
      token,
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      responseTime,
      data,
      photoCount: data.photos?.length || 0,
      signatureCount: data.signaturePhotos?.length || 0
    };
    
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.error(`❌ Request failed:`, error.message);
    return {
      token,
      success: false,
      status: 'ERROR',
      responseTime,
      error: error.message,
      photoCount: 0,
      signatureCount: 0
    };
  }
}

async function runTests() {
  console.log('🚀 [PHOTO API TEST] Starting production API tests...');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const token of TEST_TOKENS) {
    const result = await testPhotoAPI(token);
    results.push(result);
    
    // Wait between requests to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n📊 [SUMMARY] Test Results`);
  console.log('=' .repeat(60));
  
  let successCount = 0;
  let totalPhotos = 0;
  let totalSignatures = 0;
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} Token ${index + 1}: ${result.token} - ${result.photoCount + result.signatureCount} photos (${result.responseTime}ms)`);
    
    if (result.success) {
      successCount++;
      totalPhotos += result.photoCount;
      totalSignatures += result.signatureCount;
    }
  });
  
  console.log(`\n🎯 Overall Results:`);
  console.log(`   Success Rate: ${successCount}/${results.length} (${Math.round(successCount/results.length*100)}%)`);
  console.log(`   Total Photos Found: ${totalPhotos} regular + ${totalSignatures} signatures = ${totalPhotos + totalSignatures} total`);
  
  if (totalPhotos > 0 || totalSignatures > 0) {
    console.log(`\n🎉 SUCCESS! Photo scraping is now working correctly!`);
  } else {
    console.log(`\n⚠️  Issue persists - no photos found with any tokens`);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});