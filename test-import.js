const XLSX = require('xlsx');
const axios = require('axios');

async function testImport() {
  console.log('Loading Excel file...');
  const workbook = XLSX.readFile('attached_assets/Delivery-view_13_59_47.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log('Excel loaded, found', data.length, 'rows');
  
  // Get auth token
  const loginResponse = await axios.post('http://localhost:5000/api/login', {
    email: 'demo@chill.com.au',
    password: 'demo123'
  });
  const token = loginResponse.data.token;

  // Test with just first 10 rows
  const testData = data.slice(0, 10);
  console.log('Testing import with first 10 rows...');
  console.log('Sample row:', testData[0]);

  const importResponse = await axios.post('http://localhost:5000/api/admin/import-direct', {
    importRows: testData
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log('Import result:', importResponse.data);
}

testImport().catch(console.error);