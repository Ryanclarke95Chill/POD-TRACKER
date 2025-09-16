#!/usr/bin/env node

// Concurrent Load Testing for Photo Loading System
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBjaGlsbHRyYWNrLmNvbSIsImlhdCI6MTc1Nzk4NTA1MSwiZXhwIjoxNzU4MDcxNDUxfQ.Kf9zAM0J3GNkyqOo2ANcjcH-oBNXuPpKfi3NfWBztGY';
const BASE_URL = 'http://localhost:5000';

// Test tracking tokens for concurrent testing
const TOKENS = [
  'i4lTOEkio3WfaS0kbg',  // Fresh tokens for cache miss testing
  'dwmbFZPnw3E44Ncure',
  'SiKxrrUjRUD4SCnLAX',
  'di0dX115JiBEabpk0S',
  'ShhuCrE2tkV0ZsLann',
  'lqBdiKguWSspQCtKDo'
];

async function makeRequest(token, testName) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}/api/pod-photos?trackingToken=${encodeURIComponent(token)}&priority=high`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const data = await response.json();
    
    return {
      testName,
      token,
      success: response.ok,
      status: response.status,
      responseTime,
      preparing: data.preparing || false,
      data
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      testName,
      token,
      success: false,
      status: 'ERROR',
      responseTime: endTime - startTime,
      error: error.message
    };
  }
}

async function testConcurrentLoad() {
  console.log('\n🚀 CONCURRENT LOAD TESTING');
  console.log('============================');
  console.log(`Testing ${TOKENS.length} simultaneous requests to verify page pooling\n`);
  
  const startTime = Date.now();
  console.log('Starting concurrent requests...');
  
  // Make all requests simultaneously
  const promises = TOKENS.map((token, index) => 
    makeRequest(token, `Request-${index + 1}`)
  );
  
  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;
  
  console.log(`\n📊 CONCURRENT RESULTS (Total: ${totalTime}ms):`);
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const preparing = result.preparing ? ' (PREPARING)' : '';
    console.log(`   ${result.testName}: ${result.responseTime}ms ${status}${preparing}`);
  });
  
  const avgResponse = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const maxResponse = Math.max(...results.map(r => r.responseTime));
  const successCount = results.filter(r => r.success).length;
  
  console.log(`\n📈 Summary:`);
  console.log(`   Success rate: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(1)}%)`);
  console.log(`   Average response: ${avgResponse.toFixed(1)}ms`);
  console.log(`   Max response: ${maxResponse}ms`);
  console.log(`   Total concurrent time: ${totalTime}ms`);
  console.log(`   Target <100ms each: ${maxResponse < 100 ? '✅ PASS' : '❌ FAIL'}`);
  
  return { avgResponse, maxResponse, totalTime, successCount };
}

async function testCacheHits() {
  console.log('\n💨 CACHE HIT TESTING');
  console.log('=====================');
  console.log('Testing repeated requests to same token for cache performance\n');
  
  const testToken = TOKENS[0]; // Use first token, likely already processed
  
  // Wait a moment, then test cache hits
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const results = [];
  for (let i = 0; i < 3; i++) {
    const result = await makeRequest(testToken, `CacheHit-${i + 1}`);
    results.push(result);
    console.log(`   ${result.testName}: ${result.responseTime}ms ${result.success ? '✅' : '❌'}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const avgCacheHit = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const maxCacheHit = Math.max(...results.map(r => r.responseTime));
  
  console.log(`\n📈 Cache Hit Summary:`);
  console.log(`   Average: ${avgCacheHit.toFixed(1)}ms`);
  console.log(`   Max: ${maxCacheHit}ms`);
  console.log(`   Target <50ms: ${maxCacheHit < 50 ? '✅ PASS' : '❌ FAIL'}`);
  
  return { avgCacheHit, maxCacheHit };
}

async function runCompleteTest() {
  console.log('🎯 PHOTO LOADING PERFORMANCE VERIFICATION');
  console.log('==========================================');
  console.log('Testing concurrent load and cache performance\n');
  
  try {
    const concurrentResults = await testConcurrentLoad();
    const cacheResults = await testCacheHits();
    
    console.log('\n🏆 FINAL PERFORMANCE SUMMARY');
    console.log('==============================');
    console.log(`Concurrent Load:`);
    console.log(`  - Max response: ${concurrentResults.maxResponse}ms (target: <100ms) ${concurrentResults.maxResponse < 100 ? '✅' : '❌'}`);
    console.log(`  - Success rate: ${concurrentResults.successCount}/${TOKENS.length} ${concurrentResults.successCount === TOKENS.length ? '✅' : '❌'}`);
    console.log(`Cache Hit Performance:`);
    console.log(`  - Max response: ${cacheResults.maxCacheHit}ms (target: <50ms) ${cacheResults.maxCacheHit < 50 ? '✅' : '❌'}`);
    
    const allTestsPassed = 
      concurrentResults.maxResponse < 100 &&
      concurrentResults.successCount === TOKENS.length &&
      cacheResults.maxCacheHit < 50;
    
    console.log(`\n🎯 OVERALL: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allTestsPassed) {
      console.log('\n🚀 Performance optimization successfully verified!');
      console.log('   • Cache misses: Fast "preparing" responses (<100ms)');
      console.log('   • Cache hits: Ultra-fast responses (<50ms)');
      console.log('   • Concurrent handling: Page pooling working correctly');
      console.log('   • All responses well under 3-second target!');
    }
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
  }
}

runCompleteTest();