// Direct database import to bypass all cached data
import { pool } from './server/db.js';

async function directImport() {
  try {
    console.log('Starting direct database import...');
    
    // First, clear any existing data
    await pool.query('DELETE FROM consignments');
    console.log('Cleared existing data');
    
    // Sample data to test the direct import (replace with your actual CSV data)
    const sampleData = [
      {
        user_id: 1,
        consignment_number: 'DIRECT-001',
        customer_name: 'Test Customer',
        delivery_address: 'Brisbane, QLD',
        pickup_address: 'Sydney, NSW',
        status: 'In Transit',
        estimated_delivery_date: new Date().toISOString(),
        temperature_zone: 'Chiller 0–4°C',
        last_known_location: 'Processing Center',
        quantity: 10,
        pallets: 2,
        events: JSON.stringify([{
          timestamp: new Date().toISOString(),
          description: 'Direct import test',
          location: 'Import Center',
          type: 'import'
        }])
      }
    ];
    
    // Insert directly into database
    for (const record of sampleData) {
      const query = `
        INSERT INTO consignments (
          user_id, consignment_number, customer_name, delivery_address, pickup_address,
          status, estimated_delivery_date, temperature_zone, last_known_location,
          quantity, pallets, events
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      
      await pool.query(query, [
        record.user_id, record.consignment_number, record.customer_name,
        record.delivery_address, record.pickup_address, record.status,
        record.estimated_delivery_date, record.temperature_zone,
        record.last_known_location, record.quantity, record.pallets, record.events
      ]);
    }
    
    console.log('Direct import completed successfully!');
    
    // Verify the import
    const result = await pool.query('SELECT COUNT(*) FROM consignments');
    console.log(`Database now contains ${result.rows[0].count} records`);
    
    await pool.end();
    
  } catch (error) {
    console.error('Direct import failed:', error);
    await pool.end();
  }
}

directImport();