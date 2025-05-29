import express, { Request, Response } from 'express';
import axios from 'axios';

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

    const response = await axios.post('https://api.axylog.com/Deliveries?v=2', {
      pagination: {
        skip: 0,
        pageSize: 25
      },
      filters: {
        type: "",
        tripNumber: [],
        plateNumber: [],
        documentNumber: [],
        pickUp_Delivery_From: "2024-01-01T22:00:00.000Z",
        pickUp_Delivery_To: "2024-06-30T21:59:00.000Z",
        states: {
          posOutcome: false,
          negOutcome: false,
          notDelOutcome: false,
          waitingForOutcome: null,
          inAdvance: false,
          ot: false,
          notOt: false,
          deliveryLoading: false,
          deliveryUnloading_PickupLoading: false,
          travel: false,
          delivery_Pickup_Complete: false,
          unknown: false
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'ContextOwner': contextOwnerId,
        'User': userId,
        'Company': companyId,
        'SourceDeviceType': '3'
      }
    });

    console.log('=== AXYLOG DELIVERIES RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Response keys:', Object.keys(response.data || {}));
    console.log('ItemList array length:', response.data?.itemList?.length);
    console.log(`Retrieved ${response.data?.itemList?.length || 0} deliveries from axylog`);

    // Debug cargo data structure
    console.log(`\n=== CARGO DATA INSPECTION ===`);
    console.log(`Total deliveries returned: ${response.data.itemList?.length}`);

    response.data.itemList?.forEach((delivery: any, index: number) => {
      const cargo = delivery.cargoList?.[0];
      if (cargo) {
        console.log(`\n📦 Delivery #${index + 1} (${delivery.consignmentNo})`);
        console.dir(cargo, { depth: null });
      } else {
        console.log(`\n🚫 Delivery #${index + 1} (${delivery.consignmentNo}) has no cargo data`);
      }
    });

    // Save first delivery with cargo to file for inspection
    const fs = require('fs');
    const firstWithCargo = response.data.itemList.find((d: any) => d.cargoList?.length > 0);
    if (firstWithCargo) {
      fs.writeFileSync('/tmp/sample_cargo_delivery.json', JSON.stringify(firstWithCargo, null, 2));
      console.log('\n💾 Sample delivery with cargo saved to /tmp/sample_cargo_delivery.json');
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