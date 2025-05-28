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

// Test the exact logic from the import code
const columnMapping = {
  'Delivery ETA deviation': 'delivery_eta_deviation',
  'Trip number': 'trip_number',
  'Order number': 'order_number',
  'From': 'from',
  'To': 'to',
  'Carrier': 'carrier',
  'Driver': 'driver',
  'document_string2': 'document_string2',
  'Customer order number': 'customer_order_number',
  'Shipper': 'shipper'
};

console.log('\nTesting mapping exactly like import code:');
let foundColumns = 0;
Object.entries(columnMapping).forEach(([excelCol, dbCol]) => {
  const value = firstRow[excelCol];
  const hasValue = value !== undefined && value !== null && value !== '';
  if (hasValue) {
    foundColumns++;
    console.log(`✓ "${excelCol}" -> "${dbCol}": "${value}"`);
  } else {
    console.log(`✗ "${excelCol}" -> "${dbCol}": EMPTY/NULL`);
  }
});

console.log(`\nTotal columns that should be imported: ${foundColumns}`);