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
        pickUp_Delivery_To: "2024-12-31T21:59:00.000Z",
        states: {
          posOutcome: false,
          negOutcome: false,
          notDelOutcome: false,
          waitingForOutcome: null,
          inAdvance: false,
          inDelay: false,
          inTime: false
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

    console.log(`Retrieved ${response.data.deliveries?.length || 0} deliveries from axylog`);

    res.json({
      success: true,
      deliveries: response.data.deliveries || []
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