import fs from 'fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importCsvToDatabase() {
  try {
    console.log('Starting CSV import to database...');
    
    // Read the CSV file
    const csvContent = fs.readFileSync('attached_assets/ConsignmentReport-2025-05-27 (1).csv', 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    console.log(`Found ${lines.length - 1} data rows with ${headers.length} columns`);
    
    let successCount = 0;
    let errorCount = 0;

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      try {
        // Parse CSV row (handle quoted fields)
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of lines[i]) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim()); // Last value
        
        // Map CSV data to database fields
        const consignmentData = {
          user_id: 1, // Demo user
          consignment_number: values[2] || `CSV-${Date.now()}-${i}`,
          customer_name: 'Imported Customer',
          delivery_address: values[1] || 'Unknown Address',
          pickup_address: 'Pickup Location',
          status: values[6] ? 'Delivered' : 'In Transit',
          estimated_delivery_date: values[5] || new Date().toISOString(),
          delivery_date: values[6] || null,
          date_delivered: values[6] || null,
          temperature_zone: values[15] && values[15].includes('Chiller') ? 'Chiller 0–4°C' : 'Dry',
          last_known_location: 'Processing Facility',
          delivery_run: values[7] || null,
          quantity: parseInt(values[8]) || 0,
          pallets: parseInt(values[9]) || 0,
          spaces: parseInt(values[10]) || 0,
          cubic_meters: values[11] || null,
          weight_kg: values[12] || null,
          events: JSON.stringify([{
            timestamp: new Date().toISOString(),
            description: 'Imported from CSV',
            location: 'Import Center',
            type: 'import'
          }])
        };

        // Insert into database
        const insertQuery = `
          INSERT INTO consignments (
            user_id, consignment_number, customer_name, delivery_address, pickup_address,
            status, estimated_delivery_date, delivery_date, date_delivered, temperature_zone,
            last_known_location, delivery_run, quantity, pallets, spaces, cubic_meters,
            weight_kg, events
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `;

        await pool.query(insertQuery, [
          consignmentData.user_id,
          consignmentData.consignment_number,
          consignmentData.customer_name,
          consignmentData.delivery_address,
          consignmentData.pickup_address,
          consignmentData.status,
          consignmentData.estimated_delivery_date,
          consignmentData.delivery_date,
          consignmentData.date_delivered,
          consignmentData.temperature_zone,
          consignmentData.last_known_location,
          consignmentData.delivery_run,
          consignmentData.quantity,
          consignmentData.pallets,
          consignmentData.spaces,
          consignmentData.cubic_meters,
          consignmentData.weight_kg,
          consignmentData.events
        ]);

        successCount++;
        if (successCount % 100 === 0) {
          console.log(`Imported ${successCount} records...`);
        }

      } catch (error) {
        console.error(`Error importing row ${i}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\nImport complete!`);
    console.log(`Successfully imported: ${successCount} records`);
    console.log(`Errors: ${errorCount} records`);

    await pool.end();

  } catch (error) {
    console.error('Import failed:', error);
    await pool.end();
  }
}

importCsvToDatabase();