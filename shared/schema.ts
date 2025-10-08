import { pgTable, text, serial, integer, boolean, timestamp, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoles = [
  "admin",        // Full system access, user management
  "manager",      // All analytics, driver management, no user management
  "supervisor",   // Department analytics, limited driver access
  "driver",       // Own deliveries only, basic tracking
  "viewer"        // Read-only analytics access
] as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("viewer"),
  department: text("department"), // For depot/region-based access
  isActive: boolean("is_active").default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
  role: true,
  department: true,
});

export type UserRole = typeof userRoles[number];

// Custom Dashboard Schema
export const dashboards = pgTable("dashboards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  isPublic: boolean("is_public").default(false),
  layout: json("layout").notNull(), // Store dashboard configuration as JSON
  filters: json("filters"), // Store saved filters
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDashboardSchema = createInsertSchema(dashboards).pick({
  userId: true,
  name: true,
  description: true,
  isDefault: true,
  isPublic: true,
  layout: true,
  filters: true,
});

export type Dashboard = typeof dashboards.$inferSelect;
export type InsertDashboard = z.infer<typeof insertDashboardSchema>;

// Data Sync Management
export const dataSyncLog = pgTable("data_sync_log", {
  id: serial("id").primaryKey(),
  syncedByUserId: integer("synced_by_user_id").notNull(),
  syncDateTime: timestamp("sync_date_time").defaultNow(),
  recordCount: integer("record_count").notNull(),
  status: text("status").notNull(), // 'success', 'failed'
  errorMessage: text("error_message"),
});

export const insertDataSyncLogSchema = createInsertSchema(dataSyncLog).pick({
  syncedByUserId: true,
  recordCount: true,
  status: true,
  errorMessage: true,
});

export type DataSyncLog = typeof dataSyncLog.$inferSelect;
export type InsertDataSyncLog = z.infer<typeof insertDataSyncLogSchema>;

// Axylog Live Sync State - tracks cursor for incremental syncing
export const axylogSyncState = pgTable("axylog_sync_state", {
  id: serial("id").primaryKey(),
  lastSyncTimestamp: timestamp("last_sync_timestamp").notNull(),
  lastConsignmentId: text("last_consignment_id"), // Optional: track last synced consignment
  isPolling: boolean("is_polling").default(false), // Track if polling worker is active
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AxylogSyncState = typeof axylogSyncState.$inferSelect;

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
  // Core system fields
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  
  // Direct axylog field mapping - exactly as they come from the API
  contextOwnerVatNumber: text("context_owner_vat_number"),
  type: text("type"),
  year: integer("year"),
  code: integer("code"),
  prog: integer("prog"),
  consignmentNo: text("consignment_no"),
  departureDateTime: text("departure_date_time"),
  contextPlannedDepartureDateTime: text("context_planned_departure_date_time"),
  delivery_OutcomeDateTime: text("delivery_outcome_date_time"),
  deleted: boolean("deleted"),
  deleteDateTime: text("delete_date_time"),
  delivery_ArrivalDateTime: text("delivery_arrival_date_time"),
  appDeliveryArrivalDateTime: text("app_delivery_arrival_date_time"),
  geoArriveDeliveryLastPositionDateTime: text("geo_arrive_delivery_last_position_date_time"),
  delivery_GeoArriveDateTime: text("delivery_geo_arrive_date_time"),
  deliveryGeoLoadingArriveDateTime: text("delivery_geo_loading_arrive_date_time"),
  delivery_UnloadDateTime: text("delivery_unload_date_time"),
  pickUp_OutcomeDateTime: text("pick_up_outcome_date_time"),
  pickUp_ArrivalDateTime: text("pick_up_arrival_date_time"),
  appPickUpArrivalDateTime: text("app_pick_up_arrival_date_time"),
  pickUp_GeoArriveDateTime: text("pick_up_geo_arrive_date_time"),
  geoArrivePickUpLastPositionDateTime: text("geo_arrive_pick_up_last_position_date_time"),
  pickUp_LoadDateTime: text("pick_up_load_date_time"),
  delivery_AwaitedOutcome: boolean("delivery_awaited_outcome"),
  delivery_OutcomeEnum: text("delivery_outcome_enum"),
  delivery_Outcome: boolean("delivery_outcome_bool"),
  delivery_NotDeliverd: boolean("delivery_not_deliverd"),
  delivery_OutcomePODReasonContextCode: text("delivery_outcome_pod_reason_context_code"),
  delivery_OutcomePODReason: text("delivery_outcome_pod_reason"),
  delivery_OutcomePODReasonGroup: text("delivery_outcome_pod_reason_group"),
  delivery_OutcomeNote: text("delivery_outcome_note"),
  delivery_OutcomePosition: text("delivery_outcome_position"),
  secondsSpentInUnloadArea: integer("seconds_spent_in_unload_area"),
  pickUp_AwaitedOutcome: boolean("pick_up_awaited_outcome"),
  pickUp_OutcomeEnum: text("pick_up_outcome_enum"),
  pickUp_Outcome: boolean("pick_up_outcome"),
  pickUp_NotPickedup: boolean("pick_up_not_pickedup"),
  pickUp_OutcomePODReasonContextCode: text("pick_up_outcome_pod_reason_context_code"),
  pickUp_OutcomePODReason: text("pick_up_outcome_pod_reason"),
  pickUp_OutcomePODReasonGroup: text("pick_up_outcome_pod_reason_group"),
  pickUp_OutcomeNote: text("pick_up_outcome_note"),
  pickUp_OutcomePosition: text("pick_up_outcome_position"),
  secondsSpentInLoadArea: integer("seconds_spent_in_load_area"),
  documentNote: text("document_note"),
  maxScheduledDeliveryTime: text("max_scheduled_delivery_time"),
  minScheduledDeliveryTime: text("min_scheduled_delivery_time"),
  maxScheduledPickUpTime: text("max_scheduled_pick_up_time"),
  minScheduledPickUpTime: text("min_scheduled_pick_up_time"),
  shipFromCode: integer("ship_from_code"),
  shipFromMasterDataCode: text("ship_from_master_data_code"),
  shipFromCompanyName: text("ship_from_company_name"),
  shipFromZipCode: text("ship_from_zip_code"),
  shipFromCountry: text("ship_from_country"),
  shipFromCity: text("ship_from_city"),
  shipFromAddress: text("ship_from_address"),
  shipFromProvince: text("ship_from_province"),
  shipFromLatLon: text("ship_from_lat_lon"),
  shipFromLatLonPartialMatch: boolean("ship_from_lat_lon_partial_match"),
  shipFromCoordinatesLocked: boolean("ship_from_coordinates_locked"),
  shipperCode: integer("shipper_code"),
  shipperMasterDataCode: text("shipper_master_data_code"),
  shipperCompanyName: text("shipper_company_name"),
  documentPlantCode: text("document_plant_code"),
  warehouseCode: integer("warehouse_code"),
  warehouseMasterDataCode: text("warehouse_master_data_code"),
  warehouseCompanyName: text("warehouse_company_name"),
  shipToCode: integer("ship_to_code"),
  shipToMasterDataCode: text("ship_to_master_data_code"),
  shipToCompanyName: text("ship_to_company_name"),
  shipToZipCode: text("ship_to_zip_code"),
  shipToCountry: text("ship_to_country"),
  shipToCity: text("ship_to_city"),
  shipToAddress: text("ship_to_address"),
  shipToProvince: text("ship_to_province"),
  shipToLatLon: text("ship_to_lat_lon"),
  shipToLatLonPartialMatch: boolean("ship_to_lat_lon_partial_match"),
  shipToCoordinatesLocked: boolean("ship_to_coordinates_locked"),
  vehicleCode: integer("vehicle_code"),
  vehicleMasterDataCode: text("vehicle_master_data_code"),
  vehicleDescription: text("vehicle_description"),
  vehicleLatLon: text("vehicle_lat_lon"),
  vehicleLatLonPartialMatch: boolean("vehicle_lat_lon_partial_match"),
  vehicleCoordinatesLocked: boolean("vehicle_coordinates_locked"),
  vehicleLatLonDateTime: text("vehicle_lat_lon_date_time"),
  driverCode: integer("driver_code"),
  driverMasterDataCode: text("driver_master_data_code"),
  driverDescription: text("driver_description"),
  driverName: text("driver_name"),
  driverPhoneNumber: text("driver_phone_number"),
  quantity: integer("quantity"),
  pallets: integer("pallets"),
  spaces: integer("spaces"),
  qty1: text("qty1"),
  um1: text("um1"),
  qty2: text("qty2"),
  um2: text("um2"),
  volumeM3: text("volume_m3"),
  weightKg: text("weight_kg"),
  volumeInM3: text("volume_in_m3"),
  totalWeightInKg: text("total_weight_in_kg"),
  linearMetersM: text("linear_meters_m"),
  groundBases: integer("ground_bases"),
  deliveryLiveTrackLink: text("delivery_live_track_link"),
  pickupLiveTrackLink: text("pickup_live_track_link"),
  delivery_EtaCalculated: text("delivery_eta_calculated"),
  pickUp_EtaCalculated: text("pick_up_eta_calculated"),
  delivery_PlannedETA: text("delivery_planned_eta"),
  pickUp_PlannedETA: text("pickup_planned_eta"),
  deliveryLiveDistanceKm: text("delivery_live_distance_km"),
  pickupLiveDistanceKm: text("pickup_live_distance_km"),
  deliveryDistanceKm: text("delivery_distance_km"),
  pickupDistanceKm: text("pickup_distance_km"),
  deliveryTimeWindow: text("delivery_time_window"),
  pickupTimeWindow: text("pickup_time_window"),
  deliveryPlannedServiceTime: integer("delivery_planned_service_time"),
  pickupPlannedServiceTime: integer("pickup_planned_service_time"),
  orderCarrierEmail: text("order_carrier_email"),
  orderCarrierTelephoneNumber: text("order_carrier_telephone_number"),
  orderCarrierMobileTelephoneNumber: text("order_carrier_mobile_telephone_number"),
  orderDeliveryEmail: text("order_delivery_email"),
  orderDeliveryTelephoneNumber: text("order_delivery_telephone_number"),
  orderDeliveryMobileTelephoneNumber: text("order_delivery_mobile_telephone_number"),
  orderPickupEmail: text("order_pickup_email"),
  orderPickupTelephoneNumber: text("order_pickup_telephone_number"),
  orderPickupMobileTelephoneNumber: text("order_pickup_mobile_telephone_number"),
  orderShipperEmail: text("order_shipper_email"),
  orderShipperTelephoneNumber: text("order_shipper_telephone_number"),
  orderShipperMobileTelephoneNumber: text("order_shipper_mobile_telephone_number"),
  orderDate: text("order_date"),
  orderType: text("order_type"),
  orderSeries: text("order_series"),
  orderNumberRef: text("order_number_ref"),
  shipperOrderReferenceNumber: text("shipper_order_reference_number"),
  externalReference: text("external_reference"),
  expectedPaymentMethod: text("expected_payment_method"),
  expectedPaymentMethodCode: text("expected_payment_method_code"),
  expectedPaymentNotes: text("expected_payment_notes"),
  expectedTemperature: text("expected_temperature"),
  // Actual payment and temperature data from Axylog
  paymentMethod: text("payment_method"), // Contains actual recorded temperature
  amountToCollect: text("amount_to_collect"), // Temperature 1 (can be decimal)
  amountCollected: text("amount_collected"), // Temperature 2 (can be decimal)
  documentCashNotes: text("document_cash_notes"),
  requiredTags: text("required_tags"),
  forbiddenTags: text("forbidden_tags"),
  requiredTagsDescription: text("required_tags_description"),
  forbiddenTagsDescription: text("forbidden_tags_description"),
  deliveryPodFiles: text("delivery_pod_files"),
  pickupPodFiles: text("pickup_pod_files"),
  receivedDeliveryPodFiles: text("received_delivery_pod_files"),
  receivedPickupPodFiles: text("received_pickup_pod_files"),
  // File count fields from Axylog API  
  deliveryExpectedFileCount: integer("delivery_expected_file_count"),
  deliveryReceivedFileCount: integer("delivery_received_file_count"),
  pickupExpectedFileCount: integer("pickup_expected_file_count"),
  pickupReceivedFileCount: integer("pickup_received_file_count"),
  deliverySignatureName: text("delivery_signature_name"),
  pickupSignatureName: text("pickup_signature_name"),
  deliveryState: text("delivery_state"),
  pickupState: text("pickup_state"),
  delivery_StateId: integer("delivery_state_id"),
  delivery_StateLabel: text("delivery_state_label"),
  pickUp_StateId: integer("pickup_state_id"),
  pickUp_StateLabel: text("pickup_state_label"),
  deliveryOutcome: text("delivery_outcome"),
  pickupOutcome: text("pickup_outcome"),
  deliveryPunctuality: text("delivery_punctuality"),
  pickupPunctuality: text("pickup_punctuality"),
  destinationCoordinates: text("destination_coordinates"),
  departureCoordinates: text("departure_coordinates"),
  deliveryLastPosition: text("delivery_last_position"),
  pickupLastPosition: text("pickup_last_position"),
  deliveryLastPositionDate: text("delivery_last_position_date"),
  pickupLastPositionDate: text("pickup_last_position_date"),
  documentString1: text("document_string1"),
  documentString2: text("document_string2"),
  documentString3: text("document_string3"),
  documentDate1: text("document_date1"),
  documentDate2: text("document_date2"),
  documentDate3: text("document_date3"),
  deliveryMinimumDate: text("delivery_minimum_date"),
  deliveryMaximumDate: text("delivery_maximum_date"),
  pickupMinimumDate: text("pickup_minimum_date"),
  pickupMaximumDate: text("pickup_maximum_date"),
  departureDateInitiallyPlannedByTheContext: text("departure_date_initially_planned_by_the_context"),
  errorDescription: text("error_description"),
  carrierCode: integer("carrier_code"),
  carrierMasterDataCode: text("carrier_master_data_code"),
  subCarrierCode: integer("sub_carrier_code"),
  subCarrierMasterDataCode: text("sub_carrier_master_data_code"),
  distributionType: text("distribution_type"),
  driverId: text("driver_id"),
  pickupDeliveryKey: text("pickup_delivery_key"),
  taskId: text("task_id"),
  idCreationImport: text("id_creation_import"),
  vehicleRequirementsMustCodes: text("vehicle_requirements_must_codes"),
  vehicleRequirementsMustNotCodes: text("vehicle_requirements_must_not_codes"),
  vehicleRequirementsMust: text("vehicle_requirements_must"),
  vehicleRequirementsMustNot: text("vehicle_requirements_must_not"),
  deliveryExternalStateCode: text("delivery_external_state_code"),
  deliveryExternalStateDescription: text("delivery_external_state_description"),
  deliveryExternalStateReceptionDateTime: text("delivery_external_state_reception_date_time"),
  deliveryExternalStateDateTime: text("delivery_external_state_date_time"),
  deliveryExternalStateNote: text("delivery_external_state_note"),
  pickupExternalStateCode: text("pickup_external_state_code"),
  pickupExternalStateDescription: text("pickup_external_state_description"),
  pickupExternalStateReceptionDateTime: text("pickup_external_state_reception_date_time"),
  pickupExternalStateDateTime: text("pickup_external_state_date_time"),
  pickupExternalStateNote: text("pickup_external_state_note"),
  
  // Location tracking fields
  lastPositionLatLon: text("last_position_lat_lon"),
  lastPositionDateTime: text("last_position_date_time"),
  delivery_LastPositionLatLon: text("delivery_last_position_lat_lon"),
  delivery_LastPositionType: text("delivery_last_position_type"),
  delivery_LastPositionDateTime: text("delivery_last_position_date_time"),
  pickUp_LastPositionLatLon: text("pickup_last_position_lat_lon"),
  pickUp_LastPositionType: text("pickup_last_position_type"),
  pickUp_LastPositionDateTime: text("pickup_last_position_date_time"),
  
  // Events data
  events: text("events").default('[]'),
}, (table) => ({
  // Add indexes for frequently queried columns to improve performance
  userIdIdx: index("consignments_user_id_idx").on(table.userId),
  consignmentNoIdx: index("consignments_consignment_no_idx").on(table.consignmentNo),
  driverNameIdx: index("consignments_driver_name_idx").on(table.driverName),
  vehicleCodeIdx: index("consignments_vehicle_code_idx").on(table.vehicleCode),
  shipFromCityIdx: index("consignments_ship_from_city_idx").on(table.shipFromCity),
  shipToCityIdx: index("consignments_ship_to_city_idx").on(table.shipToCity),
  deliveryStateIdx: index("consignments_delivery_state_idx").on(table.deliveryState),
  pickupStateIdx: index("consignments_pickup_state_idx").on(table.pickupState),
  expectedTemperatureIdx: index("consignments_expected_temperature_idx").on(table.expectedTemperature),
  departureDateTimeIdx: index("consignments_departure_date_time_idx").on(table.departureDateTime),
  deliveryOutcomeDateTimeIdx: index("consignments_delivery_outcome_date_time_idx").on(table.delivery_OutcomeDateTime),
  // Composite indexes for common query patterns
  userDriverIdx: index("consignments_user_driver_idx").on(table.userId, table.driverName),
  userCityIdx: index("consignments_user_city_idx").on(table.userId, table.shipFromCity),
  userStateIdx: index("consignments_user_state_idx").on(table.userId, table.deliveryState),
}));

export const insertConsignmentSchema = createInsertSchema(consignments);

export type ConsignmentEvent = {
  timestamp: string;
  description: string;
  location: string;
  type: string;
};

// PhotoAsset for background photo ingestion and SWR caching
export const photoAssets = pgTable("photo_assets", {
  id: serial("id").primaryKey(),
  token: text("token").notNull(), // Axylog tracking token
  url: text("url").notNull(), // Photo URL
  kind: text("kind").notNull(), // 'photo' | 'signature'
  width: integer("width"), // Image width (optional metadata)
  height: integer("height"), // Image height (optional metadata)
  hash: text("hash"), // Content hash for deduplication
  status: text("status").notNull().default('pending'), // 'pending' | 'available' | 'failed'
  fetchedAt: timestamp("fetched_at").defaultNow(),
  errorMessage: text("error_message"), // If status is 'failed'
}, (table) => ({
  // Indexes for efficient lookups
  tokenIdx: index("photo_assets_token_idx").on(table.token),
  statusIdx: index("photo_assets_status_idx").on(table.status),
  tokenKindIdx: index("photo_assets_token_kind_idx").on(table.token, table.kind),
  hashIdx: index("photo_assets_hash_idx").on(table.hash),
}));

export const insertPhotoAssetSchema = createInsertSchema(photoAssets).pick({
  token: true,
  url: true,
  kind: true,
  width: true,
  height: true,
  hash: true,
  status: true,
  errorMessage: true,
});

export type PhotoAsset = typeof photoAssets.$inferSelect;
export type InsertPhotoAsset = z.infer<typeof insertPhotoAssetSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertConsignment = z.infer<typeof insertConsignmentSchema>;
export type Consignment = typeof consignments.$inferSelect;

// POD Quality Analysis Types
export interface ScoreBreakdown {
  photos: { points: number; reason: string; status: 'pass' | 'fail' | 'partial' };
  signature: { points: number; reason: string; status: 'pass' | 'fail' };
  receiverName: { points: number; reason: string; status: 'pass' | 'fail' };
  temperature: { points: number; reason: string; status: 'pass' | 'fail' };
  clearPhotos: { points: number; reason: string; status: 'pass' | 'fail' | 'partial' | 'pending' };
  total: number;
}

export interface PODMetrics {
  photoCount: number;
  hasSignature: boolean;
  temperatureCompliant: boolean;
  hasTrackingLink: boolean;
  deliveryTime?: string;
  qualityScore: number;
  hasReceiverName: boolean;
  scoreBreakdown?: ScoreBreakdown;
}