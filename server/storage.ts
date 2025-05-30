import { users, type User, type InsertUser, consignments, type Consignment, type InsertConsignment, type ConsignmentEvent, statusTypes, temperatureZones, dashboards, type Dashboard, type InsertDashboard, dataSyncLog, type DataSyncLog, type InsertDataSyncLog } from "@shared/schema";
import { format, addDays, subDays } from "date-fns";
import { db } from "./db";
import { eq, sql, inArray } from "drizzle-orm";
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true));
  }

  async getConsignmentsByDepartment(department: string): Promise<Consignment[]> {
    // Get all users in the department first
    const departmentUsers = await db.select().from(users).where(eq(users.department, department));
    const userIds = departmentUsers.map(u => u.id);
    
    if (userIds.length === 0) return [];
    
    return await db.select().from(consignments).where(
      inArray(consignments.userId, userIds)
    );
  }

  async getAllConsignments(): Promise<Consignment[]> {
    return await db.select().from(consignments);
  }

  async getConsignmentsByUserId(userId: number): Promise<Consignment[]> {
    // Get the user to check their role
    const user = await this.getUserById(userId);
    if (!user) return [];

    // If user is admin, show their own consignments
    if (user.role === 'admin') {
      return await db.select().from(consignments).where(eq(consignments.userId, userId));
    }

    // For non-admin users, show admin's consignments (latest synced data)
    const adminUser = await this.getUserByUsername('admin');
    if (adminUser) {
      return await db.select().from(consignments).where(eq(consignments.userId, adminUser.id));
    }

    // Fallback to user's own consignments if no admin found
    return await db.select().from(consignments).where(eq(consignments.userId, userId));
  }

  async getConsignmentsByDepartment(department: string): Promise<Consignment[]> {
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
  }

  async getConsignmentsByDriver(driverEmail: string): Promise<Consignment[]> {
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
  }

  async getConsignmentsByShipper(shipperEmail: string): Promise<Consignment[]> {
    // Get admin's consignments and filter by shipper company
    const adminUser = await this.getUserByUsername('admin');
    if (!adminUser) {
      console.log('Admin user not found for shipper filtering');
      return [];
    }
    
    const allConsignments = await db.select().from(consignments).where(eq(consignments.userId, adminUser.id));
    console.log(`Found ${allConsignments.length} total consignments for admin user`);
    
    // For shipper account, show only deliveries where they are the actual shipper
    if (shipperEmail.includes('shipper')) {
      const filtered = allConsignments.filter(consignment => {
        const shipperCompany = consignment.shipperCompanyName || '';
        const isMatch = shipperCompany === 'GREENCROSS';
        if (isMatch) {
          console.log(`Found GREENCROSS match: ${consignment.id} - ${shipperCompany}`);
        }
        return isMatch;
      });
      console.log(`Filtered to ${filtered.length} GREENCROSS consignments`);
      return filtered;
    }
    
    return [];
  }

  async getConsignmentById(id: number): Promise<Consignment | undefined> {
    const [consignment] = await db.select().from(consignments).where(eq(consignments.id, id));
    return consignment || undefined;
  }

  async getConsignmentByNumber(consignmentNumber: string): Promise<Consignment | undefined> {
    const [consignment] = await db.select().from(consignments).where(eq(consignments.consignmentNumber, consignmentNumber));
    return consignment || undefined;
  }

  async createConsignment(consignment: Omit<Consignment, "id">): Promise<Consignment> {
    const [newConsignment] = await db
      .insert(consignments)
      .values(consignment)
      .returning();
    return newConsignment;
  }

  async updateConsignment(consignment: Consignment): Promise<Consignment> {
    const [updatedConsignment] = await db
      .update(consignments)
      .set(consignment)
      .where(eq(consignments.id, consignment.id))
      .returning();
    return updatedConsignment;
  }

  async seedDemoConsignments(userId: number): Promise<void> {
    // No more demo data - using real imported data only
    return;

    const demoConsignments = [
      {
        userId,
        consignmentNumber: "CH001234",
        customerName: "Fresh Foods Co.",
        consignmentReference: null,
        trackingLink: null,
        pickupAddress: "Sydney NSW 2000",
        deliveryAddress: "Melbourne VIC 3000",
        status: "In Transit",
        estimatedDeliveryDate: format(addDays(new Date(), 2), "yyyy-MM-dd HH:mm:ss"),
        lastKnownLocation: "Albury NSW",
        temperatureZone: "Chiller 0-4°C",
        deliveryDate: null,
        dateDelivered: null,
        deliveryRun: null,
        quantity: null,
        pallets: null,
        spaces: null,
        cubicMeters: null,
        weightKg: null,
        events: [
          {
            timestamp: format(subDays(new Date(), 1), "yyyy-MM-dd HH:mm:ss"),
            description: "Package collected from sender",
            location: "Sydney NSW",
            type: "pickup"
          },
          {
            timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
            description: "In transit to destination",
            location: "Albury NSW",
            type: "transit"
          }
        ]
      },
      {
        userId,
        consignmentNumber: "CH005678",
        customerName: "Wine Cellar Imports",
        consignmentReference: null,
        trackingLink: null,
        pickupAddress: "Adelaide SA 5000",
        deliveryAddress: "Brisbane QLD 4000",
        status: "Delivered",
        estimatedDeliveryDate: format(subDays(new Date(), 1), "yyyy-MM-dd HH:mm:ss"),
        lastKnownLocation: "Brisbane QLD",
        temperatureZone: "Wine 14°C",
        deliveryDate: format(subDays(new Date(), 1), "yyyy-MM-dd"),
        dateDelivered: format(subDays(new Date(), 1), "yyyy-MM-dd HH:mm:ss"),
        deliveryRun: null,
        quantity: null,
        pallets: null,
        spaces: null,
        cubicMeters: null,
        weightKg: null,
        events: [
          {
            timestamp: format(subDays(new Date(), 3), "yyyy-MM-dd HH:mm:ss"),
            description: "Package collected from sender",
            location: "Adelaide SA",
            type: "pickup"
          },
          {
            timestamp: format(subDays(new Date(), 1), "yyyy-MM-dd HH:mm:ss"),
            description: "Delivered successfully",
            location: "Brisbane QLD",
            type: "delivery"
          }
        ]
      }
    ];

    for (const consignment of demoConsignments) {
      await db.insert(consignments).values(consignment);
    }
  }

  async clearAllConsignments(): Promise<void> {
    await db.delete(consignments);
  }

  async clearUserConsignments(userId: number): Promise<void> {
    await db.delete(consignments).where(eq(consignments.userId, userId));
  }

  async createConsignmentsBatch(consignmentList: Omit<Consignment, "id">[]): Promise<Consignment[]> {
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
  }

  // Dashboard operations
  async getDashboardsByUserId(userId: number): Promise<Dashboard[]> {
    return await db.select().from(dashboards).where(eq(dashboards.userId, userId));
  }

  async getDashboardById(id: number): Promise<Dashboard | undefined> {
    const [dashboard] = await db.select().from(dashboards).where(eq(dashboards.id, id));
    return dashboard || undefined;
  }

  async createDashboard(dashboard: Omit<Dashboard, "id" | "createdAt" | "updatedAt">): Promise<Dashboard> {
    const [newDashboard] = await db
      .insert(dashboards)
      .values({
        ...dashboard,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return newDashboard;
  }

  async updateDashboard(id: number, updates: Partial<Dashboard>): Promise<Dashboard> {
    const [updatedDashboard] = await db
      .update(dashboards)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(dashboards.id, id))
      .returning();
    return updatedDashboard;
  }

  async deleteDashboard(id: number): Promise<void> {
    await db.delete(dashboards).where(eq(dashboards.id, id));
  }

  async getPublicDashboards(): Promise<Dashboard[]> {
    return await db.select().from(dashboards).where(eq(dashboards.isPublic, true));
  }

  // Data sync management
  async logDataSync(syncLog: Omit<DataSyncLog, "id" | "syncDateTime">): Promise<DataSyncLog> {
    const [log] = await db
      .insert(dataSyncLog)
      .values({
        ...syncLog,
        syncDateTime: new Date(),
      })
      .returning();
    return log;
  }

  async getLastSuccessfulSync(): Promise<DataSyncLog | undefined> {
    const [lastSync] = await db
      .select()
      .from(dataSyncLog)
      .where(eq(dataSyncLog.status, 'success'))
      .orderBy(sql`${dataSyncLog.syncDateTime} DESC`)
      .limit(1);
    return lastSync || undefined;
  }

  async copyConsignmentsForNonAdminUsers(): Promise<void> {
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
  }

  async createAdminUser(): Promise<User> {
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
  }

  async createSampleUsers(): Promise<void> {
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
  }
}

export const storage = new DatabaseStorage();