import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
