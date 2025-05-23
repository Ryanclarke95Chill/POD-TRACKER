import { users, type User, type InsertUser, consignments, type Consignment, type InsertConsignment, type ConsignmentEvent, statusTypes, temperatureZones } from "@shared/schema";
import { format, addDays, subDays } from "date-fns";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private consignments: Map<number, Consignment>;
  private userIdCounter: number;
  private consignmentIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.consignments = new Map();
    this.userIdCounter = 1;
    this.consignmentIdCounter = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getConsignmentsByUserId(userId: number): Promise<Consignment[]> {
    return Array.from(this.consignments.values()).filter(
      (consignment) => consignment.userId === userId,
    );
  }

  async getConsignmentById(id: number): Promise<Consignment | undefined> {
    return this.consignments.get(id);
  }

  async getConsignmentByNumber(consignmentNumber: string): Promise<Consignment | undefined> {
    return Array.from(this.consignments.values()).find(
      (consignment) => consignment.consignmentNumber === consignmentNumber,
    );
  }

  async createConsignment(consignment: Omit<Consignment, "id">): Promise<Consignment> {
    const id = this.consignmentIdCounter++;
    const newConsignment: Consignment = { ...consignment, id } as Consignment;
    this.consignments.set(id, newConsignment);
    return newConsignment;
  }

  async updateConsignment(consignment: Consignment): Promise<Consignment> {
    if (!this.consignments.has(consignment.id)) {
      throw new Error(`Consignment with ID ${consignment.id} not found`);
    }
    this.consignments.set(consignment.id, { ...consignment });
    return consignment;
  }

  async seedDemoConsignments(userId: number): Promise<void> {
    const today = new Date();
    
    // Demo consignment 1
    await this.createConsignment({
      consignmentNumber: "CON-10052478",
      userId,
      customerName: "Fresh Produce Co.",
      pickupAddress: "Brisbane",
      deliveryAddress: "Sydney",
      status: "In Transit",
      estimatedDeliveryDate: format(addDays(today, 2), "MMM dd, yyyy"),
      temperatureZone: "Chiller (0–4°C)",
      lastKnownLocation: "Truck #12 near Newcastle",
      events: [
        {
          timestamp: format(subDays(today, 0), "MMM dd, yyyy") + " 14:32 AEST",
          description: "Consignment scanned at Newcastle depot",
          location: "Newcastle",
          type: "scan"
        },
        {
          timestamp: format(subDays(today, 1), "MMM dd, yyyy") + " 22:15 AEST",
          description: "Linehaul departure from Brisbane depot",
          location: "Brisbane",
          type: "transport"
        },
        {
          timestamp: format(subDays(today, 1), "MMM dd, yyyy") + " 14:08 AEST",
          description: "Picked up from customer location",
          location: "Brisbane",
          type: "pickup"
        },
        {
          timestamp: format(subDays(today, 2), "MMM dd, yyyy") + " 09:23 AEST",
          description: "Consignment created",
          location: "Brisbane",
          type: "create"
        }
      ]
    });

    // Demo consignment 2
    await this.createConsignment({
      consignmentNumber: "CON-10052485",
      userId,
      customerName: "Frozen Foods Ltd",
      pickupAddress: "Melbourne",
      deliveryAddress: "Adelaide",
      status: "Delivered",
      estimatedDeliveryDate: format(subDays(today, 3), "MMM dd, yyyy"),
      temperatureZone: "Freezer (-20°C)",
      lastKnownLocation: "Customer Site - Adelaide",
      events: [
        {
          timestamp: format(subDays(today, 3), "MMM dd, yyyy") + " 15:40 AEST",
          description: "Delivered to customer",
          location: "Adelaide",
          type: "delivery"
        },
        {
          timestamp: format(subDays(today, 3), "MMM dd, yyyy") + " 09:12 AEST",
          description: "Out for delivery",
          location: "Adelaide",
          type: "transport"
        },
        {
          timestamp: format(subDays(today, 4), "MMM dd, yyyy") + " 18:05 AEST",
          description: "Arrived at Adelaide depot",
          location: "Adelaide",
          type: "scan"
        },
        {
          timestamp: format(subDays(today, 5), "MMM dd, yyyy") + " 07:30 AEST",
          description: "Linehaul departure from Melbourne",
          location: "Melbourne",
          type: "transport"
        },
        {
          timestamp: format(subDays(today, 6), "MMM dd, yyyy") + " 14:22 AEST",
          description: "Picked up from customer location",
          location: "Melbourne",
          type: "pickup"
        },
        {
          timestamp: format(subDays(today, 7), "MMM dd, yyyy") + " 10:15 AEST",
          description: "Consignment created",
          location: "Melbourne",
          type: "create"
        }
      ]
    });

    // Demo consignment 3
    await this.createConsignment({
      consignmentNumber: "CON-10052492",
      userId,
      customerName: "Premium Wines Australia",
      pickupAddress: "Adelaide",
      deliveryAddress: "Perth",
      status: "Awaiting Pickup",
      estimatedDeliveryDate: format(addDays(today, 1), "MMM dd, yyyy"),
      temperatureZone: "Wine (14°C)",
      lastKnownLocation: "Depot - Adelaide",
      events: [
        {
          timestamp: format(subDays(today, 1), "MMM dd, yyyy") + " 11:20 AEST",
          description: "Ready for pickup",
          location: "Adelaide",
          type: "create"
        },
        {
          timestamp: format(subDays(today, 2), "MMM dd, yyyy") + " 16:45 AEST",
          description: "Consignment created",
          location: "Adelaide",
          type: "create"
        }
      ]
    });

    // Demo consignment 4
    await this.createConsignment({
      consignmentNumber: "CON-10052503",
      userId,
      customerName: "MediPharm Solutions",
      pickupAddress: "Sydney",
      deliveryAddress: "Canberra",
      status: "In Transit",
      estimatedDeliveryDate: format(addDays(today, 0), "MMM dd, yyyy"),
      temperatureZone: "Pharma (2–8°C)",
      lastKnownLocation: "Truck #08 near Goulburn",
      events: [
        {
          timestamp: format(subDays(today, 0), "MMM dd, yyyy") + " 08:15 AEST",
          description: "In transit to destination",
          location: "Goulburn",
          type: "transport"
        },
        {
          timestamp: format(subDays(today, 1), "MMM dd, yyyy") + " 16:30 AEST",
          description: "Departed from Sydney depot",
          location: "Sydney",
          type: "transport"
        },
        {
          timestamp: format(subDays(today, 1), "MMM dd, yyyy") + " 10:50 AEST",
          description: "Picked up from customer location",
          location: "Sydney",
          type: "pickup"
        },
        {
          timestamp: format(subDays(today, 2), "MMM dd, yyyy") + " 14:05 AEST",
          description: "Consignment created",
          location: "Sydney",
          type: "create"
        }
      ]
    });

    // Demo consignment 5
    await this.createConsignment({
      consignmentNumber: "CON-10052515",
      userId,
      customerName: "Sweet Treats Co.",
      pickupAddress: "Brisbane",
      deliveryAddress: "Cairns",
      status: "In Transit",
      estimatedDeliveryDate: format(addDays(today, 4), "MMM dd, yyyy"),
      temperatureZone: "Confectionery (15–20°C)",
      lastKnownLocation: "Depot - Townsville",
      events: [
        {
          timestamp: format(subDays(today, 1), "MMM dd, yyyy") + " 19:20 AEST",
          description: "Arrived at Townsville depot",
          location: "Townsville",
          type: "scan"
        },
        {
          timestamp: format(subDays(today, 2), "MMM dd, yyyy") + " 06:45 AEST",
          description: "Linehaul departure from Brisbane",
          location: "Brisbane",
          type: "transport"
        },
        {
          timestamp: format(subDays(today, 3), "MMM dd, yyyy") + " 13:25 AEST",
          description: "Picked up from customer location",
          location: "Brisbane",
          type: "pickup"
        },
        {
          timestamp: format(subDays(today, 4), "MMM dd, yyyy") + " 09:10 AEST",
          description: "Consignment created",
          location: "Brisbane",
          type: "create"
        }
      ]
    });

    // Demo consignment 6
    await this.createConsignment({
      consignmentNumber: "CON-10052521",
      userId,
      customerName: "General Cargo Pty Ltd",
      pickupAddress: "Melbourne",
      deliveryAddress: "Hobart",
      status: "Awaiting Pickup",
      estimatedDeliveryDate: format(addDays(today, 2), "MMM dd, yyyy"),
      temperatureZone: "Dry",
      lastKnownLocation: "Depot - Melbourne",
      events: [
        {
          timestamp: format(subDays(today, 0), "MMM dd, yyyy") + " 15:00 AEST",
          description: "Ready for pickup",
          location: "Melbourne",
          type: "create"
        },
        {
          timestamp: format(subDays(today, 1), "MMM dd, yyyy") + " 11:35 AEST",
          description: "Consignment created",
          location: "Melbourne",
          type: "create"
        }
      ]
    });
  }
}

export const storage = new MemStorage();
