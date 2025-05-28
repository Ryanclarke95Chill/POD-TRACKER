import XLSX from 'xlsx';

console.log('=== EXCEL DEBUG ===');
const workbook = XLSX.readFile('attached_assets/Delivery-view_13_59_47.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Total rows:', data.length);
const firstRow = data[0];
console.log('\nFirst row keys:');
Object.keys(firstRow).forEach((key, index) => {
  console.log(`${index + 1}. "${key}"`);
});

console.log('\nFirst row data sample:');
Object.entries(firstRow).slice(0, 15).forEach(([key, value]) => {
  if (value && value !== '') {
    console.log(`"${key}": "${value}"`);
  }
});

// Test mapping
const columnMapping = {
  'Trip number': 'trip_number',
  'Order number': 'order_number', 
  'Driver': 'driver',
  'Shipper': 'shipper'
};

console.log('\nTesting mapping:');
Object.entries(columnMapping).forEach(([excelCol, dbCol]) => {
  const value = firstRow[excelCol];
  console.log(`"${excelCol}" -> "${dbCol}": "${value}" (${value ? 'FOUND' : 'MISSING'})`);
});