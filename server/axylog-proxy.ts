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
          skip: 0,
          pageSize: 200
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

    // Debug cargo data structure
    console.log(`\n=== CARGO DATA INSPECTION ===`);
    console.log(`Total deliveries returned: ${allDeliveries.length}`);
    
    if (allDeliveries && allDeliveries.length > 0) {
      let recordsWithCargo = 0;
      let recordsWithoutCargo = 0;
      
      allDeliveries.forEach((delivery: any, index: number) => {
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

    allDeliveries.slice(0, 5).forEach((delivery: any, index: number) => {
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
    const firstDelivery = allDeliveries?.[0];
    if (firstDelivery) {
      fs.writeFileSync('/tmp/sample_delivery.json', JSON.stringify(firstDelivery, null, 2));
      console.log('\n💾 Sample delivery saved to /tmp/sample_delivery.json');
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