import { users, type User, type InsertUser, consignments, type Consignment, type InsertConsignment, type ConsignmentEvent, statusTypes, temperatureZones, dashboards, type Dashboard, type InsertDashboard, dataSyncLog, type DataSyncLog, type InsertDataSyncLog, photoAssets, type PhotoAsset, type InsertPhotoAsset } from "@shared/schema";
import { format, addDays, subDays } from "date-fns";
import { db, executeWithRetry, safeQuery } from "./db";
import { eq, sql, inArray, and, or, like } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getConsignmentsByUserId(userId: number): Promise<Consignment[]>;
  getConsignmentsByDepartment(department: string): Promise<Consignment[]>;
  getAllConsignments(): Promise<Consignment[]>;
  getAllConsignmentsPaginated(limit: number, offset: number): Promise<{
    consignments: Consignment[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  getConsignmentById(id: number): Promise<Consignment | undefined>;
  getConsignmentByNumber(consignmentNumber: string): Promise<Consignment | undefined>;
  createConsignment(consignment: Omit<Consignment, "id">): Promise<Consignment>;
  createConsignmentsBatch(consignments: Omit<Consignment, "id">[]): Promise<Consignment[]>;
  updateConsignment(consignment: Consignment): Promise<Consignment>;
  seedDemoConsignments(userId: number): Promise<void>;
  clearAllConsignments(): Promise<void>;
  clearUserConsignments(userId: number): Promise<void>;
  // Dashboard operations
  getDashboardsByUserId(userId: number): Promise<Dashboard[]>;
  getDashboardById(id: number): Promise<Dashboard | undefined>;
  createDashboard(dashboard: Omit<Dashboard, "id" | "createdAt" | "updatedAt">): Promise<Dashboard>;
  updateDashboard(id: number, updates: Partial<Dashboard>): Promise<Dashboard>;
  deleteDashboard(id: number): Promise<void>;
  getPublicDashboards(): Promise<Dashboard[]>;
  // Data sync management
  logDataSync(syncLog: Omit<DataSyncLog, "id" | "syncDateTime">): Promise<DataSyncLog>;
  getLastSuccessfulSync(): Promise<DataSyncLog | undefined>;
  copyConsignmentsForNonAdminUsers(): Promise<void>;
  // PhotoAsset operations for background photo ingestion
  getPhotoAssetsByToken(token: string): Promise<PhotoAsset[]>;
  getPhotoAssetsByTokenAndKind(token: string, kind: string): Promise<PhotoAsset[]>;
  createPhotoAsset(asset: Omit<PhotoAsset, "id" | "fetchedAt">): Promise<PhotoAsset>;
  createPhotoAssetsBatch(assets: Omit<PhotoAsset, "id" | "fetchedAt">[]): Promise<PhotoAsset[]>;
  updatePhotoAssetStatus(id: number, status: string, errorMessage?: string): Promise<PhotoAsset>;
  getPhotoAssetsByStatus(status: string): Promise<PhotoAsset[]>;
  deletePhotoAssetsByToken(token: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await safeQuery(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    });
    return result;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await safeQuery(async () => {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user || undefined;
    });
    return result;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const result = await safeQuery(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    });
    return result;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await safeQuery(async () => {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user || undefined;
    });
    return result;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return await executeWithRetry(async () => {
      const [user] = await db
        .insert(users)
        .values(insertUser)
        .returning();
      return user;
    });
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    return await executeWithRetry(async () => {
      const [user] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();
      return user;
    });
  }

  async getAllUsers(): Promise<User[]> {
    const result = await safeQuery(async () => {
      return await db.select().from(users).where(eq(users.isActive, true));
    }, []);
    return result || [];
  }

  async getConsignmentsByUserId(userId: number): Promise<Consignment[]> {
    const result = await safeQuery(async () => {
      return await db.select().from(consignments).where(eq(consignments.userId, userId));
    }, []);
    return result || [];
  }

  async getAllConsignments(limit?: number): Promise<Consignment[]> {
    const result = await safeQuery(async () => {
      // Optimized query with configurable limit to prevent memory issues
      const query = db.select().from(consignments);
      
      const results = limit ? await query.limit(limit) : await query.limit(20000);
      
      // Filter out internal depot transfers
      return results.filter(consignment => {
        const from = consignment.shipFromMasterDataCode;
        const to = consignment.shipToMasterDataCode;
        
        // Filter out depot transfer patterns
        const depotTransferPatterns = [
          { from: 'WA_8', to: 'WA_8D' },
          { from: 'WA_8D', to: 'WA_8' },
          { from: 'NSW_5', to: 'NSW_5D' },
          { from: 'NSW_5D', to: 'NSW_5' },
          { from: 'VIC_29963', to: 'VIC_29963D' },
          { from: 'VIC_29963D', to: 'VIC_29963' },
          { from: 'QLD_829', to: 'QLD_829D' },
          { from: 'QLD_829D', to: 'QLD_829' }
        ];
        
        const isDepotTransfer = depotTransferPatterns.some(pattern => 
          pattern.from === from && pattern.to === to
        );
        
        return !isDepotTransfer;
      });
    }, []);
    return result || [];
  }

  async getAllConsignmentsPaginated(limit: number, offset: number): Promise<{
    consignments: Consignment[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await safeQuery(async () => {
      // Get all consignments to filter depot transfers (this is needed for accurate count)
      const allConsignmentRecords: Consignment[] = await db.select().from(consignments);
      
      // Filter out internal depot transfers
      const filteredConsignmentRecords = allConsignmentRecords.filter((consignment: Consignment) => {
        const from = consignment.shipFromMasterDataCode;
        const to = consignment.shipToMasterDataCode;
        
        // Filter out depot transfer patterns
        const depotTransferPatterns = [
          { from: 'WA_8', to: 'WA_8D' },
          { from: 'WA_8D', to: 'WA_8' },
          { from: 'NSW_5', to: 'NSW_5D' },
          { from: 'NSW_5D', to: 'NSW_5' },
          { from: 'VIC_29963', to: 'VIC_29963D' },
          { from: 'VIC_29963D', to: 'VIC_29963' },
          { from: 'QLD_829', to: 'QLD_829D' },
          { from: 'QLD_829D', to: 'QLD_829' }
        ];
        
        const isDepotTransfer = depotTransferPatterns.some(pattern => 
          pattern.from === from && pattern.to === to
        );
        
        return !isDepotTransfer;
      });
      
      const totalCount = filteredConsignmentRecords.length;
      const totalPages = Math.ceil(totalCount / limit);
      const page = Math.floor(offset / limit) + 1;
      
      // Apply pagination to filtered results
      const paginatedConsignments = filteredConsignmentRecords.slice(offset, offset + limit);
      
      return {
        consignments: paginatedConsignments,
        totalCount,
        page,
        limit,
        totalPages
      };
    }, { consignments: [], totalCount: 0, page: 1, limit, totalPages: 0 });
    
    return result || { consignments: [], totalCount: 0, page: 1, limit, totalPages: 0 };
  }

  async getDashboardStats(): Promise<{
    total: number;
    inTransit: number;
    delivered: number;
    pending: number;
  }> {
    const result = await safeQuery(async () => {
      // Fast aggregation query for dashboard statistics
      const results = await db.select({
        total: sql<number>`COUNT(*)`,
        inTransit: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} IN ('In Transit', 'Traveling', 'Out for delivery') THEN 1 END)`,
        delivered: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} IN ('Delivered', 'Complete', 'POD') THEN 1 END)`,
        pending: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} NOT IN ('In Transit', 'Traveling', 'Out for delivery', 'Delivered', 'Complete', 'POD') THEN 1 END)`
      }).from(consignments);
      
      return results[0] || { total: 0, inTransit: 0, delivered: 0, pending: 0 };
    }, { total: 0, inTransit: 0, delivered: 0, pending: 0 });
    
    return result || { total: 0, inTransit: 0, delivered: 0, pending: 0 };
  }

  async getDashboardStatsByDepartment(department: string): Promise<{
    total: number;
    inTransit: number;
    delivered: number;
    pending: number;
  }> {
    return await safeQuery(async () => {
      // For department filtering, we'll filter similar to getConsignmentsByDepartment
      const adminUser = await this.getUserByUsername('admin');
      if (!adminUser) return { total: 0, inTransit: 0, delivered: 0, pending: 0 };
      
      const results = await db.select({
        total: sql<number>`COUNT(*)`,
        inTransit: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} IN ('In Transit', 'Traveling', 'Out for delivery') THEN 1 END)`,
        delivered: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} IN ('Delivered', 'Complete', 'POD') THEN 1 END)`,
        pending: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} NOT IN ('In Transit', 'Traveling', 'Out for delivery', 'Delivered', 'Complete', 'POD') THEN 1 END)`
      }).from(consignments).where(eq(consignments.userId, adminUser.id));
      
      return results[0] || { total: 0, inTransit: 0, delivered: 0, pending: 0 };
    }, { total: 0, inTransit: 0, delivered: 0, pending: 0 }) || { total: 0, inTransit: 0, delivered: 0, pending: 0 };
  }

  async getDashboardStatsByShipper(shipperEmail: string): Promise<{
    total: number;
    inTransit: number;
    delivered: number;
    pending: number;
  }> {
    return await safeQuery(async () => {
      const adminUser = await this.getUserByUsername('admin');
      if (!adminUser) return { total: 0, inTransit: 0, delivered: 0, pending: 0 };
      
      const results = await db.select({
        total: sql<number>`COUNT(*)`,
        inTransit: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} IN ('In Transit', 'Traveling', 'Out for delivery') THEN 1 END)`,
        delivered: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} IN ('Delivered', 'Complete', 'POD') THEN 1 END)`,
        pending: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} NOT IN ('In Transit', 'Traveling', 'Out for delivery', 'Delivered', 'Complete', 'POD') THEN 1 END)`
      }).from(consignments).where(
        and(
          eq(consignments.userId, adminUser.id),
          eq(consignments.shipperCompanyName, 'GREENCROSS')
        )
      );
      
      return results[0] || { total: 0, inTransit: 0, delivered: 0, pending: 0 };
    }, { total: 0, inTransit: 0, delivered: 0, pending: 0 }) || { total: 0, inTransit: 0, delivered: 0, pending: 0 };
  }

  async getDashboardStatsByDriver(driverEmail: string): Promise<{
    total: number;
    inTransit: number;
    delivered: number;
    pending: number;
  }> {
    return await safeQuery(async () => {
      const adminUser = await this.getUserByUsername('admin');
      if (!adminUser) return { total: 0, inTransit: 0, delivered: 0, pending: 0 };
      
      const driverName = driverEmail.split('@')[0];
      
      const results = await db.select({
        total: sql<number>`COUNT(*)`,
        inTransit: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} IN ('In Transit', 'Traveling', 'Out for delivery') THEN 1 END)`,
        delivered: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} IN ('Delivered', 'Complete', 'POD') THEN 1 END)`,
        pending: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} NOT IN ('In Transit', 'Traveling', 'Out for delivery', 'Delivered', 'Complete', 'POD') THEN 1 END)`
      }).from(consignments).where(
        and(
          eq(consignments.userId, adminUser.id),
          or(
            like(consignments.driverName, `%${driverName}%`),
            like(consignments.driverDescription, `%${driverName}%`)
          )
        )
      );
      
      return results[0] || { total: 0, inTransit: 0, delivered: 0, pending: 0 };
    }, { total: 0, inTransit: 0, delivered: 0, pending: 0 }) || { total: 0, inTransit: 0, delivered: 0, pending: 0 };
  }

  async getDashboardStatsByUserId(userId: number): Promise<{
    total: number;
    inTransit: number;
    delivered: number;
    pending: number;
  }> {
    return await safeQuery(async () => {
      const results = await db.select({
        total: sql<number>`COUNT(*)`,
        inTransit: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} IN ('In Transit', 'Traveling', 'Out for delivery') THEN 1 END)`,
        delivered: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} IN ('Delivered', 'Complete', 'POD') THEN 1 END)`,
        pending: sql<number>`COUNT(CASE WHEN ${consignments.deliveryState} NOT IN ('In Transit', 'Traveling', 'Out for delivery', 'Delivered', 'Complete', 'POD') THEN 1 END)`
      }).from(consignments).where(eq(consignments.userId, userId));
      
      return results[0] || { total: 0, inTransit: 0, delivered: 0, pending: 0 };
    }, { total: 0, inTransit: 0, delivered: 0, pending: 0 }) || { total: 0, inTransit: 0, delivered: 0, pending: 0 };
  }


  async getConsignmentsByDepartment(department: string): Promise<Consignment[]> {
    const result = await safeQuery(async () => {
      // Get admin's consignments and filter by department
      const adminUser = await this.getUserByUsername('admin');
      if (!adminUser) return [];
      
      const allConsignments = await db.select().from(consignments).where(eq(consignments.userId, adminUser.id));
      
      // For testing: if department is "Sydney Depot", show NSW deliveries
      if (department.toLowerCase().includes('sydney')) {
        return allConsignments.filter(consignment => {
          const shipFromCity = (consignment.shipFromCity || '').toString();
          const shipToCity = (consignment.shipToCity || '').toString();
          const shipFromCompany = (consignment.shipFromCompanyName || '').toString();
          const shipToCompany = (consignment.shipToCompanyName || '').toString();
          return shipFromCity.toLowerCase().includes('nsw') ||
                 shipToCity.toLowerCase().includes('nsw') ||
                 shipFromCompany.toLowerCase().includes('nsw') ||
                 shipToCompany.toLowerCase().includes('nsw');
        });
      }
      
      // Default department filtering
      return allConsignments.filter(consignment => {
        const shipFromCity = (consignment.shipFromCity || '').toString();
        const shipToCity = (consignment.shipToCity || '').toString();
        return shipFromCity.toLowerCase().includes(department.toLowerCase()) ||
               shipToCity.toLowerCase().includes(department.toLowerCase());
      });
    }, []);
    return result || [];
  }

  async getConsignmentsByDriver(driverEmail: string): Promise<Consignment[]> {
    const result = await safeQuery(async () => {
      // Get admin's consignments and filter by driver
      const adminUser = await this.getUserByUsername('admin');
      if (!adminUser) return [];
      
      const allConsignments = await db.select().from(consignments).where(eq(consignments.userId, adminUser.id));
      
      // For testing: driver sees deliveries assigned to them (matching driver name/email prefix)
      const driverName = driverEmail.split('@')[0]; // 'driver' from 'driver@chilltrack.com'
      
      return allConsignments.filter(consignment => {
        const assignedDriver = (consignment.driverName || '').toString();
        const vehicleCode = (consignment.vehicleCode || 0).toString();
        const driverDescription = (consignment.driverDescription || '').toString();
        
        return assignedDriver.toLowerCase().includes(driverName.toLowerCase()) ||
               vehicleCode.includes(driverName) ||
               driverDescription.toLowerCase().includes(driverName.toLowerCase()) ||
               assignedDriver.toLowerCase().includes('john'); // Sample driver name
      });
    }, []);
    return result || [];
  }

  async getConsignmentsByShipper(shipperEmail: string): Promise<Consignment[]> {
    const result = await safeQuery(async () => {
      // Get admin's consignments and filter by shipper company
      const adminUser = await this.getUserByUsername('admin');
      if (!adminUser) return [];
      
      const allConsignments = await db.select().from(consignments).where(eq(consignments.userId, adminUser.id));
      
      // For shipper account, show only deliveries where they are the actual shipper
      if (shipperEmail.includes('shipper')) {
        return allConsignments.filter(consignment => {
          const shipperCompany = consignment.shipperCompanyName || '';
          return shipperCompany === 'GREENCROSS';
        });
      }
      
      return [];
    }, []);
    return result || [];
  }

  async getConsignmentById(id: number): Promise<Consignment | undefined> {
    const result = await safeQuery(async () => {
      const [consignment] = await db.select().from(consignments).where(eq(consignments.id, id));
      return consignment || undefined;
    });
    return result;
  }

  async getConsignmentByNumber(consignmentNumber: string): Promise<Consignment | undefined> {
    const result = await safeQuery(async () => {
      const [consignment] = await db.select().from(consignments).where(eq(consignments.consignmentNo, consignmentNumber));
      return consignment || undefined;
    });
    return result;
  }

  async createConsignment(consignment: Omit<Consignment, "id">): Promise<Consignment> {
    return await executeWithRetry(async () => {
      const [newConsignment] = await db
        .insert(consignments)
        .values(consignment)
        .returning();
      return newConsignment;
    });
  }

  async updateConsignment(consignment: Consignment): Promise<Consignment> {
    return await executeWithRetry(async () => {
      const [updatedConsignment] = await db
        .update(consignments)
        .set(consignment)
        .where(eq(consignments.id, consignment.id))
        .returning();
      return updatedConsignment;
    });
  }

  async seedDemoConsignments(userId: number): Promise<void> {
    // No more demo data - using real imported data only
    return;
  }

  async clearAllConsignments(): Promise<void> {
    await executeWithRetry(async () => {
      await db.delete(consignments);
    });
  }

  async clearUserConsignments(userId: number): Promise<void> {
    await executeWithRetry(async () => {
      await db.delete(consignments).where(eq(consignments.userId, userId));
    });
  }

  async createConsignmentsBatch(consignmentList: Omit<Consignment, "id">[]): Promise<Consignment[]> {
    return await executeWithRetry(async () => {
      if (consignmentList.length === 0) return [];
      
      // Process in chunks of 100 to avoid SQL parameter limits
      const chunkSize = 100;
      const results: Consignment[] = [];
      
      for (let i = 0; i < consignmentList.length; i += chunkSize) {
        const chunk = consignmentList.slice(i, i + chunkSize);
        const inserted = await db
          .insert(consignments)
          .values(chunk)
          .returning();
        results.push(...inserted);
      }
      
      return results;
    });
  }

  // Dashboard operations
  async getDashboardsByUserId(userId: number): Promise<Dashboard[]> {
    const result = await safeQuery(async () => {
      return await db.select().from(dashboards).where(eq(dashboards.userId, userId));
    }, []);
    return result || [];
  }

  async getDashboardById(id: number): Promise<Dashboard | undefined> {
    const result = await safeQuery(async () => {
      const [dashboard] = await db.select().from(dashboards).where(eq(dashboards.id, id));
      return dashboard || undefined;
    });
    return result;
  }

  async createDashboard(dashboard: Omit<Dashboard, "id" | "createdAt" | "updatedAt">): Promise<Dashboard> {
    return await executeWithRetry(async () => {
      const [newDashboard] = await db
        .insert(dashboards)
        .values({
          ...dashboard,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return newDashboard;
    });
  }

  async updateDashboard(id: number, updates: Partial<Dashboard>): Promise<Dashboard> {
    return await executeWithRetry(async () => {
      const [updatedDashboard] = await db
        .update(dashboards)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(dashboards.id, id))
        .returning();
      return updatedDashboard;
    });
  }

  async deleteDashboard(id: number): Promise<void> {
    await executeWithRetry(async () => {
      await db.delete(dashboards).where(eq(dashboards.id, id));
    });
  }

  async getPublicDashboards(): Promise<Dashboard[]> {
    const result = await safeQuery(async () => {
      return await db.select().from(dashboards).where(eq(dashboards.isPublic, true));
    }, []);
    return result || [];
  }

  // Data sync management
  async logDataSync(syncLog: Omit<DataSyncLog, "id" | "syncDateTime">): Promise<DataSyncLog> {
    return await executeWithRetry(async () => {
      const [log] = await db
        .insert(dataSyncLog)
        .values({
          ...syncLog,
          syncDateTime: new Date(),
        })
        .returning();
      return log;
    });
  }

  async getLastSuccessfulSync(): Promise<DataSyncLog | undefined> {
    const result = await safeQuery(async () => {
      const [lastSync] = await db
        .select()
        .from(dataSyncLog)
        .where(eq(dataSyncLog.status, 'success'))
        .orderBy(sql`${dataSyncLog.syncDateTime} DESC`)
        .limit(1);
      return lastSync || undefined;
    });
    return result;
  }

  async copyConsignmentsForNonAdminUsers(): Promise<void> {
    await executeWithRetry(async () => {
      // Get the admin user ID (user who performed the sync)
      const adminUser = await this.getUserByUsername('admin');
      if (!adminUser) return;

      // Get all consignments from admin
      const adminConsignments = await this.getConsignmentsByUserId(adminUser.id);
      if (adminConsignments.length === 0) return;

      // Get all non-admin users
      const allUsers = await this.getAllUsers();
      const nonAdminUsers = allUsers.filter(user => user.role !== 'admin');

      // Copy consignments to each non-admin user
      for (const user of nonAdminUsers) {
        // Clear existing consignments for this user
        await this.clearUserConsignments(user.id);

        // Create copies of admin's consignments for this user, excluding ID field
        const consignmentsCopy = adminConsignments.map(consignment => {
          const { id, ...rest } = consignment;
          return {
            ...rest,
            userId: user.id, // Override userId for the new user
          };
        });

        if (consignmentsCopy.length > 0) {
          // Use direct database insertion to avoid ID conflicts
          const chunkSize = 50;
          for (let i = 0; i < consignmentsCopy.length; i += chunkSize) {
            const chunk = consignmentsCopy.slice(i, i + chunkSize);
            await db.insert(consignments).values(chunk);
          }
          console.log(`Copied ${consignmentsCopy.length} consignments to user ${user.id}`);
        }
      }
    });
  }

  // PhotoAsset storage methods for background photo ingestion
  async getPhotoAssetsByToken(token: string): Promise<PhotoAsset[]> {
    const result = await safeQuery(async () => {
      return await db.select().from(photoAssets).where(eq(photoAssets.token, token));
    });
    return result || [];
  }

  async getPhotoAssetsByTokenAndKind(token: string, kind: string): Promise<PhotoAsset[]> {
    const result = await safeQuery(async () => {
      return await db.select().from(photoAssets).where(
        and(eq(photoAssets.token, token), eq(photoAssets.kind, kind))
      );
    });
    return result || [];
  }

  async createPhotoAsset(asset: Omit<PhotoAsset, "id" | "fetchedAt">): Promise<PhotoAsset> {
    return await executeWithRetry(async () => {
      const [photoAsset] = await db
        .insert(photoAssets)
        .values(asset)
        .returning();
      return photoAsset;
    });
  }

  async createPhotoAssetsBatch(assets: Omit<PhotoAsset, "id" | "fetchedAt">[]): Promise<PhotoAsset[]> {
    return await executeWithRetry(async () => {
      if (assets.length === 0) return [];
      
      const result = await db
        .insert(photoAssets)
        .values(assets)
        .returning();
      return result;
    });
  }

  async updatePhotoAssetStatus(id: number, status: string, errorMessage?: string): Promise<PhotoAsset> {
    return await executeWithRetry(async () => {
      const updates: Partial<PhotoAsset> = { 
        status,
        fetchedAt: status === 'available' || status === 'failed' ? new Date() : undefined 
      };
      if (errorMessage !== undefined) {
        updates.errorMessage = errorMessage;
      }
      
      const [updated] = await db
        .update(photoAssets)
        .set(updates)
        .where(eq(photoAssets.id, id))
        .returning();
      
      if (!updated) {
        throw new Error(`PhotoAsset with id ${id} not found`);
      }
      return updated;
    });
  }

  async getPhotoAssetsByStatus(status: string): Promise<PhotoAsset[]> {
    const result = await safeQuery(async () => {
      return await db.select().from(photoAssets).where(eq(photoAssets.status, status));
    });
    return result || [];
  }

  async deletePhotoAssetsByToken(token: string): Promise<void> {
    await executeWithRetry(async () => {
      await db.delete(photoAssets).where(eq(photoAssets.token, token));
    });
  }

  async createAdminUser(): Promise<User> {
    return await executeWithRetry(async () => {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      // Check if admin already exists
      const existingAdmin = await this.getUserByUsername('admin');
      if (existingAdmin) {
        return existingAdmin;
      }

      const [adminUser] = await db
        .insert(users)
        .values({
          username: 'admin',
          password: hashedPassword,
          email: 'admin@chilltrack.com',
          name: 'System Administrator',
          role: 'admin',
          department: 'Management',
          isActive: true,
        })
        .returning();
      
      return adminUser;
    });
  }

  async createSampleUsers(): Promise<void> {
    await executeWithRetry(async () => {
      const roles = [
        { username: 'manager', password: 'manager123', name: 'Fleet Manager', role: 'manager', department: 'Operations' },
        { username: 'supervisor', password: 'super123', name: 'Depot Supervisor', role: 'supervisor', department: 'Sydney Depot' },
        { username: 'driver', password: 'driver123', name: 'John Driver', role: 'driver', department: 'Sydney Depot' },
        { username: 'shipper', password: 'shipper123', name: 'Greencross Shipper', role: 'viewer', department: 'Shipper' },
        { username: 'viewer', password: 'viewer123', name: 'Analytics Viewer', role: 'viewer', department: 'Management' }
      ];

      for (const roleData of roles) {
        const existingUser = await this.getUserByUsername(roleData.username);
        if (!existingUser) {
          const hashedPassword = await bcrypt.hash(roleData.password, 10);
          await db.insert(users).values({
            username: roleData.username,
            password: hashedPassword,
            email: `${roleData.username}@chilltrack.com`,
            name: roleData.name,
            role: roleData.role,
            department: roleData.department,
            isActive: true,
          });
        }
      }
    });
  }
}

export const storage = new DatabaseStorage();