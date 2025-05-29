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
    
    // Get credentials from headers or body
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    const userId = req.headers.user || req.body.userId;
    const companyId = req.headers.company || req.body.companyId;
    const contextOwnerId = req.headers.contextowner || req.body.contextOwnerId;

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
        documentDate_From: "2024-01-01",
        documentDate_To: "2025-12-31",
        gridHeaderFilters: {
          shipFromMasterDataCode: "NSW_5"
        }
      }
    };

    console.log("=== Sent request payload ===");
    console.dir(requestBody, { depth: null });

    const response = await axios.post('https://api.axylog.com/Deliveries?v=2', requestBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User': userId,
        'Company': companyId,
        'ContextOwner': contextOwnerId,
        'SourceDeviceType': '2',
        'LanguageCode': 'EN',
        'Content-Type': 'application/json'
      }
    });

    console.log('=== AXYLOG DELIVERIES RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Response keys:', Object.keys(response.data || {}));
    console.log('ItemList array length:', response.data?.itemList?.length);
    console.log(`Retrieved ${response.data?.itemList?.length || 0} deliveries from axylog`);

    // Log specific delivery fields for debugging
    if (response.data && response.data.itemList && response.data.itemList.length > 0) {
      console.log('\n=== DELIVERY FIELDS INSPECTION ===');
      
      response.data.itemList.slice(0, 3).forEach((delivery: any, index: number) => {
        console.log(`\nDelivery ${index + 1}:`);
        console.log(`  orderNumberRef: ${delivery.orderNumberRef}`);
        console.log(`  shipperOrderReferenceNumber: ${delivery.shipperOrderReferenceNumber}`);
        console.log(`  documentReference: ${delivery.documentReference}`);
        console.log(`  qty1: ${delivery.qty1}, um1: ${delivery.um1}`);
        console.log(`  qty2: ${delivery.qty2}, um2: ${delivery.um2}`);
        console.log(`  volumeInM3: ${delivery.volumeInM3}`);
        console.log(`  delivery_PlannedETA: ${delivery.delivery_PlannedETA}`);
        console.log(`  delivery_EtaCalculated: ${delivery.delivery_EtaCalculated}`);
      });
    }

    // Save first delivery to file for debugging purposes
    const firstDelivery = response.data.itemList?.[0];
    if (firstDelivery) {
      fs.writeFileSync('/tmp/sample_delivery.json', JSON.stringify(firstDelivery, null, 2));
      console.log('\nFirst delivery saved to /tmp/sample_delivery.json for debugging');
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