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
  userId: integer("user_id").notNull(),
  consignmentNumber: text("consignment_number"),
  customerName: text("customer_name"),
  consignmentReference: text("consignment_reference"),
  trackingLink: text("tracking_link"),
  pickupAddress: text("pickup_address"),
  deliveryAddress: text("delivery_address"),
  status: text("status"),
  estimatedDeliveryDate: text("estimated_delivery_date"),
  deliveryDate: text("delivery_date"),
  dateDelivered: text("date_delivered"),
  consignmentRequiredDeliveryDate: text("consignment_required_delivery_date"),
  temperatureZone: text("temperature_zone"),
  lastKnownLocation: text("last_known_location"),
  deliveryRun: text("delivery_run"),
  quantity: integer("quantity"),
  pallets: integer("pallets"),
  spaces: integer("spaces"),
  cubicMeters: text("cubic_meters"),
  weightKg: text("weight_kg"),
  shipper: text("shipper"),
  receiver: text("receiver"),
  pickupCompany: text("pickup_company"),
  deliveryCompany: text("delivery_company"),
  pickupContactName: text("pickup_contact_name"),
  deliveryContactName: text("delivery_contact_name"),
  pickupContactPhone: text("pickup_contact_phone"),
  deliveryContactPhone: text("delivery_contact_phone"),
  specialInstructions: text("special_instructions"),
  productDescription: text("product_description"),
  deliveryInstructions: text("delivery_instructions"),
  pickupInstructions: text("pickup_instructions"),
  deliveryLivetrackLink: text("delivery_livetrack_link"),
  customerOrderNumber: text("customer_order_number"),
  documentString2: text("document_string2"),
  fromLocation: text("from_location"),
  toLocation: text("to_location"),
  groupCausalDeliveryOutcome: text("group_causal_delivery_outcome"),
  deliveryPlannedEta: text("delivery_planned_eta"),
  recordedTemperature: text("recorded_temperature"),
  quantityUnitOfMeasurement: text("quantity_unit_of_measurement"),
  quantityUnitOfMeasurement1: text("quantity_unit_of_measurement1"),
  quantityUnitOfMeasurement2: text("quantity_unit_of_measurement2"),
  route: text("route"),
  driver: text("driver"),
  vehicle: text("vehicle"),
  deliveryTime: text("delivery_time"),
  pickupTime: text("pickup_time"),
  consignmentType: text("consignment_type"),
  priority: text("priority"),
  deliveryZone: text("delivery_zone"),
  pickupZone: text("pickup_zone"),
  notes: text("notes"),
  customerReference: text("customer_reference"),
  invoiceNumber: text("invoice_number"),
  podSignature: text("pod_signature"),
  deliveryProof: text("delivery_proof"),
  // Additional columns from your Excel file
  vehicleCode: text("vehicle_code"),
  deliveryEtaDeviation: text("delivery_eta_deviation"), 
  receivedDeliveryPodFiles: text("received_delivery_pod_files"),
  tripNumber: text("trip_number"),
  from: text("from"),
  to: text("to"),
  carrier: text("carrier"),
  requiredTags: text("required_tags"),
  orderCarrierEmail: text("order_carrier_email"),
  orderNumber: text("order_number"),
  events: text("events").default('[]'),
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
