import express, { Request, Response } from 'express';
import axios from 'axios';
import * as fs from 'fs';

const router = express.Router();

// Authentication endpoint
router.post('/auth', async (req: Request, res: Response) => {
  try {
    console.log('=== AXYLOG PROXY AUTH ===');
    
    const response = await axios.post('https://api.axylog.com/authentication/service', {
      username: process.env.AXYLOG_USERNAME || 'api.chill@axylog.com',
      password: process.env.AXYLOG_PASSWORD || '5#j{M):H){yD'
    });

    const { token, userTree } = response.data;
    const userId = userTree.userId;
    const companyId = userTree.companiesOwners[0].company;
    const contextOwnerId = userTree.companiesOwners[0].contextOwners[0].contextOwner;

    console.log('Axylog authentication successful');

    res.json({
      success: true,
      token,
      userId,
      companyId,
      contextOwnerId
    });

  } catch (error) {
    console.error('Axylog auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

// Deliveries endpoint
router.post('/deliveries', async (req: Request, res: Response) => {
  try {
    console.log('=== AXYLOG PROXY DELIVERIES ===');
    
    const { token, userId, companyId, contextOwnerId } = req.body;

    if (!token || !userId || !companyId || !contextOwnerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing authentication credentials'
      });
    }

    const requestBody = {
      pagination: {
        pageSize: 100,
        pageNumber: 1
      },
      filters: {
        includeDeleted: false,
        distributionType: 3,
        documentDate_From: "2024-01-01",
        documentDate_To: "2025-12-31"
      },
      sortingField: "departureDateTime_desc"
    };

    console.log("=== Sent request payload ===");
    console.dir(requestBody, { depth: null });

    const response = await axios.post('https://api.axylog.com/Deliveries?v=2', requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User': userId,
        'Company': companyId,
        'ContextOwner': contextOwnerId,
        'SourceDeviceType': '2',
        'LanguageCode': 'EN'
      }
    });

    console.log('=== AXYLOG DELIVERIES RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Response keys:', Object.keys(response.data || {}));
    console.log('ItemList array length:', response.data?.itemList?.length);
    console.log(`Retrieved ${response.data?.itemList?.length || 0} deliveries from axylog`);

    // Save full response to file for detailed inspection
    fs.writeFileSync('/tmp/sample_delivery.json', JSON.stringify(response.data, null, 2));
    console.log('Full Axylog response saved to /tmp/sample_delivery.json');

    // Debug cargo data structure
    console.log(`\n=== CARGO DATA INSPECTION ===`);
    console.log(`Total deliveries returned: ${response.data.itemList?.length}`);
    
    if (response.data && response.data.itemList) {
      let recordsWithCargo = 0;
      let recordsWithoutCargo = 0;
      
      response.data.itemList.forEach((delivery: any, index: number) => {
        const hasCargo = delivery.qty1 !== null || delivery.qty2 !== null || 
                        delivery.um1 !== null || delivery.um2 !== null || 
                        delivery.volumeInM3 !== null || delivery.totalWeightInKg !== null;
        
        if (hasCargo) {
          recordsWithCargo++;
          console.log(`Record ${index}: HAS CARGO - qty1: ${delivery.qty1}, um1: ${delivery.um1}, qty2: ${delivery.qty2}, um2: ${delivery.um2}, volume: ${delivery.volumeInM3}, weight: ${delivery.totalWeightInKg}`);
        } else {
          recordsWithoutCargo++;
          if (recordsWithoutCargo <= 3) { // Only log first 3 to avoid spam
            console.log(`Record ${index}: NO CARGO - all cargo fields are null`);
          }
        }
      });
      
      console.log(`Summary: ${recordsWithCargo} records WITH cargo, ${recordsWithoutCargo} records WITHOUT cargo`);
    }

    response.data.itemList?.forEach((delivery: any, index: number) => {
      const {
        deliveryNumber,
        qty1,
        um1,
        qty2,
        um2,
        volumeInM3,
        totalWeightInKg
      } = delivery;

      console.log(`\n📦 Delivery #${index + 1}: ${deliveryNumber}`);
      console.log(`   Cartons (qty1): ${qty1} ${um1}`);
      console.log(`   Pallets (qty2): ${qty2} ${um2}`);
      console.log(`   Volume (m³): ${volumeInM3}`);
      console.log(`   Weight (kg): ${totalWeightInKg}`);
    });

    // Save first delivery to file for inspection
    const firstDelivery = response.data.itemList?.[0];
    if (firstDelivery) {
      fs.writeFileSync('/tmp/sample_delivery.json', JSON.stringify(firstDelivery, null, 2));
      console.log('\n💾 Sample delivery saved to /tmp/sample_delivery.json');
    }

    res.json({
      success: true,
      deliveries: response.data.itemList || []
    });

  } catch (error) {
    console.error('Axylog deliveries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deliveries'
    });
  }
});

export default router;