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
          pickUp_Delivery_To: dateTo,
          gridHeaderFilters: {
            shipperMasterDataCode: "",
            shipperCompanyName: "",
            shipFromMasterDataCode: "",
            shipFromCompanyName: "",
            shipToMasterDataCode: "",
            shipToCompanyName: ""
          }
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
        
        // Check if we got fewer results than page size (indicates last page)
        if (deliveries.length < pageSize) {
          hasMorePages = false;
        } else {
          pageNumber++;
        }
      } else {
        hasMorePages = false;
      }

      // Safety check to prevent infinite loops
      if (pageNumber > 10) {
        console.log('Maximum pages reached (10), stopping pagination');
        break;
      }
    }

    // TEMPORARILY DISABLED: Filter out depot transfers to test shipper data
    const filteredDeliveries = allDeliveries;
    
    console.log(`Retrieved ${allDeliveries.length} deliveries (depot filtering disabled for shipper data testing)`);

    // Debug: Show first delivery record with shipper info
    if (allDeliveries.length > 0) {
      console.log('Sample delivery processed:', {
        orderNumberRef: allDeliveries[0].orderNumberRef,
        shipperCompanyName: allDeliveries[0].shipperCompanyName,
        shipFromCompanyName: allDeliveries[0].shipFromCompanyName,
        shipToCompanyName: allDeliveries[0].shipToCompanyName,
        qty1: allDeliveries[0].qty1,
        um1: allDeliveries[0].um1
      });
    }

    // Create response object with filtered deliveries
    const paginatedResponse = {
      itemList: filteredDeliveries,
      totalItems: filteredDeliveries.length,
      pagesRetrieved: pageNumber
    };

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