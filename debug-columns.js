import XLSX from 'xlsx';

console.log('=== EXCEL COLUMN ANALYSIS ===');

// Read the Excel file that was uploaded
const workbook = XLSX.readFile('./attached_assets/Delivery-view_13_59_47.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON to get headers
const jsonData = XLSX.utils.sheet_to_json(worksheet);

if (jsonData.length > 0) {
  const allHeaders = Object.keys(jsonData[0]);
  
  console.log(`📊 Total Excel Headers Found: ${allHeaders.length}`);
  console.log('\n📋 COMPLETE LIST OF EXCEL HEADERS:');
  
  allHeaders.forEach((header, index) => {
    console.log(`  ${index + 1}. "${header}"`);
  });
  
  console.log(`\n🎯 Sample Data from First Row:`);
  const firstRow = jsonData[0];
  Object.entries(firstRow).slice(0, 10).forEach(([key, value]) => {
    console.log(`  "${key}": "${value}"`);
  });
  
  console.log(`\n💡 Key Insights:`);
  console.log(`  • We should be capturing ${allHeaders.length} columns`);
  console.log(`  • Currently only capturing ~40 columns`);
  console.log(`  • Missing ${allHeaders.length - 40}+ valuable data fields`);
  
} else {
  console.log('❌ No data found in Excel file');
}