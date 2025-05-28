import { users, type User, type InsertUser, consignments, type Consignment, type InsertConsignment, type ConsignmentEvent, statusTypes, temperatureZones } from "@shared/schema";
import { format, addDays, subDays } from "date-fns";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getConsignmentsByUserId(userId: number): Promise<Consignment[]>;
  getConsignmentById(id: number): Promise<Consignment | undefined>;
  getConsignmentByNumber(consignmentNumber: string): Promise<Consignment | undefined>;
  createConsignment(consignment: Omit<Consignment, "id">): Promise<Consignment>;
  updateConsignment(consignment: Consignment): Promise<Consignment>;
  seedDemoConsignments(userId: number): Promise<void>;
  clearAllConsignments(): Promise<void>;
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

  async getConsignmentsByUserId(userId: number): Promise<Consignment[]> {
    return await db.select().from(consignments).where(eq(consignments.userId, userId));
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
    // Clear existing consignments for this user first
    await db.delete(consignments).where(eq(consignments.userId, userId));

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
}

export const storage = new DatabaseStorage();