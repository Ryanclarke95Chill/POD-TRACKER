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
    
    const { token, userId, companyId, contextOwnerId, fromDate, toDate } = req.body;

    if (!token || !userId || !companyId || !contextOwnerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing authentication credentials'
      });
    }

    // Use provided date range or default to today in AEST
    let dateFrom: string;
    let dateTo: string;
    
    if (fromDate && toDate) {
      dateFrom = `${fromDate}T00:00:00.000Z`;
      dateTo = `${toDate}T23:59:59.000Z`;
    } else if (fromDate) {
      dateFrom = `${fromDate}T00:00:00.000Z`;
      dateTo = `${fromDate}T23:59:59.000Z`;
    } else if (toDate) {
      dateFrom = `${toDate}T00:00:00.000Z`;
      dateTo = `${toDate}T23:59:59.000Z`;
    } else {
      // Default to today in AEST
      const todayAEST = new Date().toLocaleString("en-US", { timeZone: "Australia/Sydney" });
      const todayString = new Date(todayAEST).toISOString().split('T')[0];
      dateFrom = `${todayString}T00:00:00.000Z`;
      dateTo = `${todayString}T23:59:59.000Z`;
    }

    let allDeliveries = [];
    let pageNumber = 1;
    let hasMorePages = true;
    const pageSize = 500;

    console.log(`Starting pagination for date range: ${dateFrom} to ${dateTo}`);

    while (hasMorePages) {
      const requestBody = {
        pagination: {
          skip: (pageNumber - 1) * pageSize,
          pageSize: pageSize
        },
        filters: {
          type: "",
          pickUp_Delivery_From: dateFrom,
          pickUp_Delivery_To: dateTo
        }
      };

      console.log(`=== Fetching page ${pageNumber} ===`);

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

      if (response.data && response.data.itemList) {
        const deliveries = response.data.itemList;
        allDeliveries.push(...deliveries);
        console.log(`Page ${pageNumber}: Retrieved ${deliveries.length} deliveries`);
        
        // Check if we got fewer results than page size (indicates last page)
        if (deliveries.length < pageSize) {
          hasMorePages = false;
          console.log('Last page reached');
        } else {
          pageNumber++;
        }
      } else {
        hasMorePages = false;
        console.log('No more data available');
      }

      // Safety check to prevent infinite loops
      if (pageNumber > 10) {
        console.log('Maximum pages reached (10), stopping pagination');
        break;
      }
    }

    console.log(`=== PAGINATION COMPLETE ===`);
    console.log(`Total deliveries retrieved: ${allDeliveries.length}`);

    // Create response object with all deliveries
    const paginatedResponse = {
      itemList: allDeliveries,
      totalItems: allDeliveries.length,
      pagesRetrieved: pageNumber
    };

    console.log('=== AXYLOG DELIVERIES RESPONSE ===');
    console.log('Status: 200 (paginated)');
    console.log('Response keys:', Object.keys(paginatedResponse || {}));
    console.log('ItemList array length:', paginatedResponse?.itemList?.length);
    console.log(`Retrieved ${paginatedResponse?.itemList?.length || 0} deliveries from axylog via pagination`);

    // Save full response to file for detailed inspection
    fs.writeFileSync('/tmp/sample_delivery.json', JSON.stringify(paginatedResponse, null, 2));
    console.log('Full paginated Axylog response saved to /tmp/sample_delivery.json');

    // Log summary only for performance
    console.log(`Retrieved ${allDeliveries.length} deliveries from axylog`);
    
    // Log only first delivery for error checking
    if (allDeliveries.length > 0) {
      const firstDelivery = allDeliveries[0];
      console.log("Sample delivery:", {
        orderNumberRef: firstDelivery.orderNumberRef,
        shipFromCompanyName: firstDelivery.shipFromCompanyName,
        shipToCompanyName: firstDelivery.shipToCompanyName
      });
    }

    res.json({
      success: true,
      data: paginatedResponse
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