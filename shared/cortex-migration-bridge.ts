import { pgTable, varchar, integer, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { crmSchema } from "./schema";

/**
 * CORTEX MIGRATION BRIDGE TABLES
 * These tables link existing CRM data to new Cortex entities during migration
 * Once migration is complete, these can be removed
 */

// Bridge CRM contacts to Cortex entities.persons
export const crmToPersonBridge = crmSchema.table("crm_to_person_bridge", {
  crmContactId: integer("crm_contact_id").notNull(), // Old CRM contact ID
  cortexPersonId: varchar("cortex_person_id", { length: 50 }).notNull(), // New cp_ prefixed UUID
  migrationStatus: varchar("migration_status", { length: 20 }).default("pending"), // pending, completed, failed
  migratedAt: timestamp("migrated_at"),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bridge CRM companies to Cortex entities.companies  
export const crmToCompanyBridge = crmSchema.table("crm_to_company_bridge", {
  crmCompanyId: integer("crm_company_id").notNull(), // Old CRM company ID
  cortexCompanyId: varchar("cortex_company_id", { length: 50 }).notNull(), // New cc_ prefixed UUID
  migrationStatus: varchar("migration_status", { length: 20 }).default("pending"),
  migratedAt: timestamp("migrated_at"),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bridge CRM groups to Cortex entities.groups
export const crmToGroupBridge = crmSchema.table("crm_to_group_bridge", {
  crmGroupId: uuid("crm_group_id").notNull(), // Old CRM group ID  
  cortexGroupId: varchar("cortex_group_id", { length: 50 }).notNull(), // New cg_ prefixed UUID
  migrationStatus: varchar("migration_status", { length: 20 }).default("pending"),
  migratedAt: timestamp("migrated_at"),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bridge CRM tasks to Cortex projects.tasks
export const crmToTaskBridge = crmSchema.table("crm_to_task_bridge", {
  crmTaskId: varchar("crm_task_id", { length: 50 }).notNull(), // Old CRM task ID
  cortexTaskId: varchar("cortex_task_id", { length: 50 }).notNull(), // New task ID in cortex_projects
  migrationStatus: varchar("migration_status", { length: 20 }).default("pending"),
  migratedAt: timestamp("migrated_at"),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bridge CRM projects to Cortex projects.projects
export const crmToProjectBridge = crmSchema.table("crm_to_project_bridge", {
  crmProjectId: varchar("crm_project_id", { length: 50 }).notNull(), // Old CRM project ID
  cortexProjectId: varchar("cortex_project_id", { length: 50 }).notNull(), // New cj_ prefixed UUID
  migrationStatus: varchar("migration_status", { length: 20 }).default("pending"),
  migratedAt: timestamp("migrated_at"),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bridge CRM events to Cortex scheduling.events
export const crmToEventBridge = crmSchema.table("crm_to_event_bridge", {
  crmEventId: integer("crm_event_id").notNull(), // Old CRM event ID
  cortexEventId: varchar("cortex_event_id", { length: 50 }).notNull(), // New event ID in cortex_scheduling
  migrationStatus: varchar("migration_status", { length: 20 }).default("pending"),
  migratedAt: timestamp("migrated_at"),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bridge CRM notes to Cortex knowledge.notes
export const crmToNoteBridge = crmSchema.table("crm_to_note_bridge", {
  crmNoteId: integer("crm_note_id").notNull(), // Old CRM note ID
  cortexNoteId: varchar("cortex_note_id", { length: 50 }).notNull(), // New note ID in cortex_knowledge
  migrationStatus: varchar("migration_status", { length: 20 }).default("pending"),
  migratedAt: timestamp("migrated_at"),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bridge CRM documents to Cortex knowledge.documents
export const crmToDocumentBridge = crmSchema.table("crm_to_document_bridge", {
  crmDocumentId: varchar("crm_document_id", { length: 36 }).notNull(), // Old CRM document ID
  cortexDocumentId: varchar("cortex_document_id", { length: 50 }).notNull(), // New document ID in cortex_knowledge
  migrationStatus: varchar("migration_status", { length: 20 }).default("pending"),
  migratedAt: timestamp("migrated_at"),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CrmToPersonBridge = typeof crmToPersonBridge.$inferSelect;
export type CrmToCompanyBridge = typeof crmToCompanyBridge.$inferSelect;
export type CrmToGroupBridge = typeof crmToGroupBridge.$inferSelect;
export type CrmToTaskBridge = typeof crmToTaskBridge.$inferSelect;
export type CrmToProjectBridge = typeof crmToProjectBridge.$inferSelect;
export type CrmToEventBridge = typeof crmToEventBridge.$inferSelect;
export type CrmToNoteBridge = typeof crmToNoteBridge.$inferSelect;
export type CrmToDocumentBridge = typeof crmToDocumentBridge.$inferSelect;