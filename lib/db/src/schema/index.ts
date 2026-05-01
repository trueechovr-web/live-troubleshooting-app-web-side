import { pgTable, text, integer, timestamp, pgEnum, jsonb, doublePrecision, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type PointToChild = { label: string };
export type PointToItem = { label: string; children?: PointToChild[] };
export type PointToObjects = PointToItem[];

export const DEFAULT_POINT_TO_OBJECTS: PointToObjects = [
  { label: "Fire Extinguisher" },
  { label: "Control Panel" },
  { label: "Emergency Exit" },
  { label: "Junction Box" },
  { label: "Safety Valve" },
  { label: "Power Switch" },
  { label: "Circuit Breaker" },
  { label: "Warning Label" },
];

export const customerStatusEnum = pgEnum("customer_status", ["active", "inactive", "trial"]);
export const headsetStatusEnum = pgEnum("headset_status", ["online", "offline", "busy"]);
export const sessionStatusEnum = pgEnum("session_status", ["waiting", "active", "ended"]);
export const senderRoleEnum = pgEnum("sender_role", ["admin", "tech"]);

export const customersTable = pgTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contactEmail: text("contact_email").notNull(),
  programVersion: text("program_version").notNull().default("1.0.0"),
  headsetCount: integer("headset_count").notNull().default(0),
  activeHeadsets: integer("active_headsets").notNull().default(0),
  status: customerStatusEnum("status").notNull().default("active"),
  pointToObjects: jsonb("point_to_objects").$type<PointToObjects>().notNull().default(DEFAULT_POINT_TO_OBJECTS),
  sessionHistoryEnabled: boolean("session_history_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;

export const headsetsTable = pgTable("headsets", {
  id: text("id").primaryKey(),
  serialNumber: text("serial_number").notNull(),
  label: text("label").notNull(),
  customerId: text("customer_id").notNull().references(() => customersTable.id),
  status: headsetStatusEnum("status").notNull().default("offline"),
  batteryLevel: integer("battery_level").notNull().default(100),
  firmwareVersion: text("firmware_version").notNull().default("1.0.0"),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
});

export const insertHeadsetSchema = createInsertSchema(headsetsTable);
export type InsertHeadset = z.infer<typeof insertHeadsetSchema>;
export type Headset = typeof headsetsTable.$inferSelect;

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  headsetId: text("headset_id").notNull().references(() => headsetsTable.id),
  adminRole: text("admin_role"),
  techRole: text("tech_role"),
  status: sessionStatusEnum("status").notNull().default("waiting"),
  roomCode: text("room_code").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  transcript: text("transcript"),
  summary: text("summary"),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ startedAt: true, endedAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessionsTable.id),
  senderRole: senderRoleEnum("sender_role").notNull(),
  content: text("content").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ sentAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

/* ── Locations ── */
export const locationsTable = pgTable("locations", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => customersTable.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLocationSchema = createInsertSchema(locationsTable).omit({ createdAt: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locationsTable.$inferSelect;

/* ── QR Codes (spatial calibration per location) ── */
export const qrCodesTable = pgTable("qr_codes", {
  id: text("id").primaryKey(),
  locationId: text("location_id").notNull().references(() => locationsTable.id),
  qrValue: text("qr_value").notNull(),
  posX: doublePrecision("pos_x").notNull(),
  posY: doublePrecision("pos_y").notNull(),
  posZ: doublePrecision("pos_z").notNull(),
  rotX: doublePrecision("rot_x").notNull(),
  rotY: doublePrecision("rot_y").notNull(),
  rotZ: doublePrecision("rot_z").notNull(),
  rotW: doublePrecision("rot_w").notNull(),
  calibratedAt: timestamp("calibrated_at").notNull().defaultNow(),
  headsetId: text("headset_id"),
});

export const insertQrCodeSchema = createInsertSchema(qrCodesTable).omit({ calibratedAt: true });
export type InsertQrCode = z.infer<typeof insertQrCodeSchema>;
export type QrCode = typeof qrCodesTable.$inferSelect;

/* ── QR Dictionary (company-wide name mapping) ── */
export const qrDictionaryTable = pgTable(
  "qr_dictionary",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").notNull().references(() => customersTable.id),
    qrValue: text("qr_value").notNull(),
    name: text("name").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("qr_dictionary_customer_qrvalue_idx").on(t.customerId, t.qrValue)],
);

export const insertQrDictionarySchema = createInsertSchema(qrDictionaryTable).omit({ updatedAt: true });
export type InsertQrDictionary = z.infer<typeof insertQrDictionarySchema>;
export type QrDictionaryEntry = typeof qrDictionaryTable.$inferSelect;

/* ── Point-to Events (persisted during live sessions) ── */
export const pointToEventsTable = pgTable("point_to_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessionsTable.id),
  objectName: text("object_name").notNull(),
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
});

export const insertPointToEventSchema = createInsertSchema(pointToEventsTable).omit({ triggeredAt: true });
export type InsertPointToEvent = z.infer<typeof insertPointToEventSchema>;
export type PointToEvent = typeof pointToEventsTable.$inferSelect;
