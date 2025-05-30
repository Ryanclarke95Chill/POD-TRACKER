import express, { Request, Response } from "express";
import axios from "axios";
import * as fs from "fs";

const router = express.Router();

// Authentication endpoint
router.post("/auth", async (req: Request, res: Response) => {
  try {
    console.log("=== AXYLOG PROXY AUTH ===");

    const response = await axios.post(
      "https://api.axylog.com/authentication/service",
      {
        username: process.env.AXYLOG_USERNAME || "api.chill@axylog.com",
        password: process.env.AXYLOG_PASSWORD || "5#j{M):H){yD",
      },
    );

    const { token, userTree } = response.data;
    const userId = userTree.userId;
    const companyId = userTree.companiesOwners[0].company;
    const contextOwnerId =
      userTree.companiesOwners[0].contextOwners[0].contextOwner;

    console.log("Axylog authentication successful");

    res.json({
      success: true,
      token,
      userId,
      companyId,
      contextOwnerId,
    });
  } catch (error) {
    console.error("Axylog auth error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
});

// Deliveries endpoint
router.post("/deliveries", async (req: Request, res: Response) => {
  try {
    console.log("=== AXYLOG PROXY DELIVERIES ===");

    const { token, userId, companyId, contextOwnerId, fromDate, toDate } =
      req.body;

    if (!token || !userId || !companyId || !contextOwnerId) {
      return res.status(400).json({
        success: false,
        error: "Missing authentication credentials",
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
      const todayAEST = new Date().toLocaleString("en-US", {
        timeZone: "Australia/Sydney",
      });
      const todayString = new Date(todayAEST).toISOString().split("T")[0];
      dateFrom = `${todayString}T00:00:00.000Z`;
      dateTo = `${todayString}T23:59:59.000Z`;
    }

    let allDeliveries = [];
    let pageNumber = 1;
    let hasMorePages = true;
    const pageSize = 500;

    console.log(`Starting pagination for date range: ${dateFrom} to ${dateTo}`);
    console.log(`=== DATE RANGE DEBUG ===`);
    console.log(`From Date: ${dateFrom}`);
    console.log(`To Date: ${dateTo}`);
    console.log(`=== END DATE RANGE DEBUG ===`);

    while (hasMorePages) {
      const requestBody = {
        pagination: {
          skip: (pageNumber - 1) * pageSize,
          pageSize: pageSize,
        },
        filters: {
          type: "",
          pickUp_Delivery_From: dateFrom,
          pickUp_Delivery_To: dateTo,
        },
      };

      console.log(`=== Fetching page ${pageNumber} ===`);

      const response = await axios.post(
        "https://api.axylog.com/Deliveries?v=2",
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            User: userId,
            Company: companyId,
            ContextOwner: contextOwnerId,
            SourceDeviceType: "3",
            LanguageCode: "EN",
          },
        },
      );

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
        console.log("Maximum pages reached (10), stopping pagination");
        break;
      }
    }

    // Filter out depot transfers using master data codes
    const initialCount = allDeliveries.length;
    const filteredDeliveries = allDeliveries.filter((delivery: any) => {
      const shipFromCode = delivery.shipFromMasterDataCode || "";
      const shipToCode = delivery.shipToMasterDataCode || "";

      // Check for Chill depot-to-depot transfers using master data codes
      const isChillDepotTransfer =
        // WA depot transfers
        (shipFromCode === "WA_8" && shipToCode === "WA_8D") ||
        (shipFromCode === "WA_8D" && shipToCode === "WA_8") ||
        // NSW depot transfers
        (shipFromCode === "NSW_5" && shipToCode === "NSW_5D") ||
        (shipFromCode === "NSW_5D" && shipToCode === "NSW_5") ||
        // VIC depot transfers
        (shipFromCode === "VIC_29963" && shipToCode === "VIC_29963D") ||
        (shipFromCode === "VIC_29963D" && shipToCode === "VIC_29963") ||
        // QLD depot transfers
        (shipFromCode === "QLD_829" && shipToCode === "QLD_829D") ||
        (shipFromCode === "QLD_829D" && shipToCode === "QLD_829");

      return !isChillDepotTransfer;
    });

    console.log(
      `Retrieved ${allDeliveries.length} deliveries, filtered to ${filteredDeliveries.length} (removed ${initialCount - filteredDeliveries.length} depot transfers)`,
    );

    // Debug: Show first delivery record with shipper info
    if (allDeliveries.length > 0) {
      console.log("Sample delivery processed:", {
        orderNumberRef: allDeliveries[0].orderNumberRef,
        shipperCompanyName: allDeliveries[0].shipperCompanyName,
        shipFromCompanyName: allDeliveries[0].shipFromCompanyName,
        shipToCompanyName: allDeliveries[0].shipToCompanyName,
        qty1: allDeliveries[0].qty1,
        um1: allDeliveries[0].um1,
      });
    }

    // Create response object with filtered deliveries
    const paginatedResponse = {
      itemList: filteredDeliveries,
      totalItems: filteredDeliveries.length,
      pagesRetrieved: pageNumber,
    };

    res.json({
      success: true,
      data: paginatedResponse,
    });
  } catch (error) {
    console.error("Axylog deliveries error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch deliveries",
    });
  }
});

export default router;
