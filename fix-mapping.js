// Quick script to check exact Excel column names and create proper mapping
const fs = require('fs');
const xlsx = require('xlsx');

// Read the Excel file to see exact column names
const workbook = xlsx.readFile('./attached_assets/Delivery-view_13_59_47.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(worksheet);

if (data.length > 0) {
  console.log("Excel columns found:");
  Object.keys(data[0]).forEach((col, index) => {
    console.log(`${index + 1}. "${col}"`);
  });
  
  console.log("\nSample data from first row:");
  console.log("Customer order number:", data[0]['Customer order number']);
  console.log("Shipper:", data[0]['Shipper']);
  console.log("Delivery Livetrack link:", data[0]['Delivery Livetrack link']);
  console.log("Pickup planned ETA:", data[0]['Pickup planned ETA']);
}