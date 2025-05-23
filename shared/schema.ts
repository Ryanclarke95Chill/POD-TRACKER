import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
});

// Define temperature zones
export const temperatureZones = [
  "Dry",
  "Chiller (0–4°C)",
  "Freezer (-20°C)",
  "Wine (14°C)",
  "Confectionery (15–20°C)",
  "Pharma (2–8°C)",
] as const;

// Define status types
export const statusTypes = [
  "In Transit",
  "Delivered",
  "Awaiting Pickup",
] as const;

export const consignments = pgTable("consignments", {
  id: serial("id").primaryKey(),
  consignmentNumber: text("consignment_number").notNull().unique(),
  userId: integer("user_id").notNull(),
  customerName: text("customer_name").notNull(),
  pickupAddress: text("pickup_address").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  status: text("status").notNull(),
  estimatedDeliveryDate: text("estimated_delivery_date").notNull(),
  temperatureZone: text("temperature_zone").notNull(),
  lastKnownLocation: text("last_known_location").notNull(),
  events: json("events").notNull().$type<ConsignmentEvent[]>(),
});

export const insertConsignmentSchema = createInsertSchema(consignments).pick({
  consignmentNumber: true,
  userId: true,
  customerName: true,
  pickupAddress: true,
  deliveryAddress: true,
  status: true,
  estimatedDeliveryDate: true,
  temperatureZone: true,
  lastKnownLocation: true,
  events: true,
});

export type ConsignmentEvent = {
  timestamp: string;
  description: string;
  location: string;
  type: string;
};

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertConsignment = z.infer<typeof insertConsignmentSchema>;
export type Consignment = typeof consignments.$inferSelect;
