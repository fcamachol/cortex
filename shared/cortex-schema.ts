import { pgTable, pgSchema, text, boolean, timestamp, uuid, integer, jsonb, bigint, varchar, serial, numeric, index, primaryKey, uniqueIndex, pgEnum, unique, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =====================================================
// CORTEX PERSONAL SECOND BRAIN SYSTEM
// Phase 1: New Schema Creation (Non-Destructive)
// =====================================================

// Create new cortex schema
export const cortexSchema = pgSchema("cortex");

// =====================================================
// CORE ENTITY ENUMS
// =====================================================

export const entityTypeEnum = cortexSchema.enum("entity_type", [
  "cp", // Persons (contacts, people)
  "cc", // Companies (businesses, organizations, banks)
  "cg", // Groups (teams, families, categories)
  "co", // Objects (physical items, assets)
  "ca", // Financial Accounts (bank accounts, credit cards)
  "cv", // Vendors (suppliers, service providers)
  "cj", // Projects (work projects, personal goals)
  "ce", // Events (meetings, appointments, deadlines)
  "cs"  // Spaces (folders, workspaces)
]);

export const contentTypeEnum = cortexSchema.enum("content_type", [
  "task", "note", "document", "bill", "receivable", "transaction"
]);

export const relationshipTypeEnum = cortexSchema.enum("relationship_type", [
  // Universal relationships
  "related_to", "belongs_to", "contains", "depends_on", "blocks",
  // Person relationships
  "married_to", "parent_of", "child_of", "sibling_of", "friend_of", "colleague_of",
  "manager_of", "reports_to", "works_for", "founder_of", "consultant_for",
  // Business relationships
  "subsidiary_of", "owns", "client_of", "vendor_of", "partner_with",
  // Project relationships
  "manages", "sponsors", "assigned_to", "predecessor_of", "successor_of",
  // Content relationships
  "created_by", "mentions", "about", "taken_during", "references", "summary_of"
]);

export const spaceRoleEnum = cortexSchema.enum("space_role", [
  "owner", "editor", "commenter", "viewer"
]);

export const shareLinkTypeEnum = cortexSchema.enum("share_link_type", [
  "view_only", "comment", "edit"
]);

// =====================================================
// CORE ENTITY TABLES
// =====================================================

// Universal entity table for all core entities
export const cortexEntities = cortexSchema.table("entities", {
  id: varchar("id", { length: 50 }).primaryKey(), // cp_, cc_, cg_, co_, ca_, cv_, cj_, ce_, cs_ prefixed UUIDs
  entityType: entityTypeEnum("entity_type").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  tags: jsonb("tags").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdBy: uuid("created_by").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  entityTypeIdx: index("entities_entity_type_idx").on(table.entityType),
  nameIdx: index("entities_name_idx").on(table.name),
  createdByIdx: index("entities_created_by_idx").on(table.createdBy),
  activeIdx: index("entities_active_idx").on(table.isActive),
}));

// =====================================================
// SPACES SYSTEM (Google Drive-like)
// =====================================================

export const cortexSpaces = cortexSchema.table("spaces", {
  id: varchar("id", { length: 50 }).primaryKey(), // cs_ prefixed UUID
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  path: text("path").notNull(), // Hierarchical path like /work/projects/website
  level: integer("level").default(0).notNull(), // Depth in hierarchy
  parentSpaceId: varchar("parent_space_id", { length: 50 }), // Self-referencing FK
  color: varchar("color", { length: 20 }), // UI customization
  icon: varchar("icon", { length: 50 }), // Icon identifier
  isShared: boolean("is_shared").default(false).notNull(),
  isStarred: boolean("is_starred").default(false).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: uuid("created_by").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pathIdx: index("spaces_path_idx").on(table.path),
  parentIdx: index("spaces_parent_idx").on(table.parentSpaceId),
  levelIdx: index("spaces_level_idx").on(table.level),
  createdByIdx: index("spaces_created_by_idx").on(table.createdBy),
  sortOrderIdx: index("spaces_sort_order_idx").on(table.sortOrder),
}));

// Space contents - items within spaces
export const cortexSpaceItems = cortexSchema.table("space_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: varchar("space_id", { length: 50 }).notNull(), // FK to spaces
  itemType: contentTypeEnum("item_type").notNull(), // task, note, document, etc.
  itemId: uuid("item_id").notNull(), // FK to respective content table
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isStarred: boolean("is_starred").default(false).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  spaceItemIdx: index("space_items_space_idx").on(table.spaceId),
  itemTypeIdx: index("space_items_type_idx").on(table.itemType),
  itemIdIdx: index("space_items_item_id_idx").on(table.itemId),
  sortOrderIdx: index("space_items_sort_order_idx").on(table.sortOrder),
  pk: primaryKey({ columns: [table.spaceId, table.itemId] }),
}));

// Space members and permissions
export const cortexSpaceMembers = cortexSchema.table("space_members", {
  spaceId: varchar("space_id", { length: 50 }).notNull(), // FK to spaces
  userId: uuid("user_id").notNull(), // FK to app.users
  role: spaceRoleEnum("role").notNull(),
  permissions: jsonb("permissions").$type<{
    canRead: boolean;
    canWrite: boolean;
    canShare: boolean;
    canDelete: boolean;
  }>().default({
    canRead: true,
    canWrite: false,
    canShare: false,
    canDelete: false
  }),
  invitedBy: uuid("invited_by"), // FK to app.users
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.spaceId, table.userId] }),
  spaceIdx: index("space_members_space_idx").on(table.spaceId),
  userIdx: index("space_members_user_idx").on(table.userId),
}));

// Public/private sharing links
export const cortexSpaceShareLinks = cortexSchema.table("space_share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: varchar("space_id", { length: 50 }).notNull(), // FK to spaces
  linkType: shareLinkTypeEnum("link_type").notNull(),
  token: varchar("token", { length: 255 }).unique().notNull(), // Secure random token
  isActive: boolean("is_active").default(true).notNull(),
  requiresPassword: boolean("requires_password").default(false).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }), // Optional password protection
  expiresAt: timestamp("expires_at", { withTimezone: true }), // Optional expiration
  allowedDomains: jsonb("allowed_domains").$type<string[]>(), // Domain restrictions
  maxUses: integer("max_uses"), // Usage limits
  currentUses: integer("current_uses").default(0).notNull(),
  createdBy: uuid("created_by").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}, (table) => ({
  spaceIdx: index("space_share_links_space_idx").on(table.spaceId),
  tokenIdx: index("space_share_links_token_idx").on(table.token),
  activeIdx: index("space_share_links_active_idx").on(table.isActive),
}));

// Space activity log
export const cortexSpaceActivity = cortexSchema.table("space_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: varchar("space_id", { length: 50 }).notNull(), // FK to spaces
  userId: uuid("user_id").notNull(), // FK to app.users
  action: varchar("action", { length: 100 }).notNull(), // created, updated, deleted, shared, etc.
  targetType: varchar("target_type", { length: 50 }), // space, item, member
  targetId: varchar("target_id", { length: 50 }), // ID of affected item
  details: jsonb("details").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  spaceIdx: index("space_activity_space_idx").on(table.spaceId),
  userIdx: index("space_activity_user_idx").on(table.userId),
  actionIdx: index("space_activity_action_idx").on(table.action),
  createdAtIdx: index("space_activity_created_at_idx").on(table.createdAt),
}));

// =====================================================
// UNIVERSAL LINKING SYSTEM
// =====================================================

// Universal entity-to-entity relationships
export const cortexEntityRelationships = cortexSchema.table("entity_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromEntityId: varchar("from_entity_id", { length: 50 }).notNull(), // Source entity
  toEntityId: varchar("to_entity_id", { length: 50 }).notNull(), // Target entity
  relationshipType: relationshipTypeEnum("relationship_type").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  strength: integer("strength").default(1), // Relationship importance (1-10)
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: uuid("created_by").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  fromEntityIdx: index("entity_relationships_from_idx").on(table.fromEntityId),
  toEntityIdx: index("entity_relationships_to_idx").on(table.toEntityId),
  relationshipTypeIdx: index("entity_relationships_type_idx").on(table.relationshipType),
  activeIdx: index("entity_relationships_active_idx").on(table.isActive),
  pk: primaryKey({ columns: [table.fromEntityId, table.toEntityId, table.relationshipType] }),
}));

// Universal content-to-entity links
export const cortexEntityLinks = cortexSchema.table("entity_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentType: contentTypeEnum("content_type").notNull(),
  contentId: uuid("content_id").notNull(), // FK to respective content table
  entityId: varchar("entity_id", { length: 50 }).notNull(), // FK to entities
  relationshipType: relationshipTypeEnum("relationship_type").notNull(),
  strength: integer("strength").default(1), // Link importance (1-10)
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: uuid("created_by").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  contentIdx: index("entity_links_content_idx").on(table.contentType, table.contentId),
  entityIdx: index("entity_links_entity_idx").on(table.entityId),
  relationshipTypeIdx: index("entity_links_relationship_type_idx").on(table.relationshipType),
  pk: primaryKey({ columns: [table.contentType, table.contentId, table.entityId, table.relationshipType] }),
}));

// =====================================================
// CONTENT ENTITIES (High-volume data)
// =====================================================

// Enhanced tasks with hierarchical structure
export const cortexTasks = cortexSchema.table("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  parentTaskId: uuid("parent_task_id"), // Self-referencing for subtasks
  estimatedHours: numeric("estimated_hours", { precision: 10, scale: 2 }),
  actualHours: numeric("actual_hours", { precision: 10, scale: 2 }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  tags: jsonb("tags").$type<string[]>().default([]),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: uuid("created_by").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("cortex_tasks_status_idx").on(table.status),
  priorityIdx: index("cortex_tasks_priority_idx").on(table.priority),
  parentIdx: index("cortex_tasks_parent_idx").on(table.parentTaskId),
  dueDateIdx: index("cortex_tasks_due_date_idx").on(table.dueDate),
  createdByIdx: index("cortex_tasks_created_by_idx").on(table.createdBy),
}));

// Enhanced notes with full-text search
export const cortexNotes = cortexSchema.table("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  format: varchar("format", { length: 20 }).default("markdown").notNull(), // markdown, html, plaintext
  contentVector: text("content_vector"), // For full-text search (tsvector)
  isTemplate: boolean("is_template").default(false).notNull(),
  templateVariables: jsonb("template_variables").$type<Record<string, any>>(),
  tags: jsonb("tags").$type<string[]>().default([]),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: uuid("created_by").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  titleIdx: index("cortex_notes_title_idx").on(table.title),
  formatIdx: index("cortex_notes_format_idx").on(table.format),
  templateIdx: index("cortex_notes_template_idx").on(table.isTemplate),
  createdByIdx: index("cortex_notes_created_by_idx").on(table.createdBy),
}));

// Enhanced documents with version control
export const cortexDocuments = cortexSchema.table("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: varchar("filename", { length: 500 }).notNull(),
  originalName: varchar("original_name", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  filePath: text("file_path").notNull(),
  version: integer("version").default(1).notNull(),
  parentDocumentId: uuid("parent_document_id"), // For version history
  checksum: varchar("checksum", { length: 255 }), // File integrity check
  isCurrentVersion: boolean("is_current_version").default(true).notNull(),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>().default([]),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: uuid("created_by").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  filenameIdx: index("cortex_documents_filename_idx").on(table.filename),
  mimeTypeIdx: index("cortex_documents_mime_type_idx").on(table.mimeType),
  versionIdx: index("cortex_documents_version_idx").on(table.version),
  parentIdx: index("cortex_documents_parent_idx").on(table.parentDocumentId),
  currentIdx: index("cortex_documents_current_idx").on(table.isCurrentVersion),
  createdByIdx: index("cortex_documents_created_by_idx").on(table.createdBy),
}));

// Financial bills (payables)
export const cortexBills = cortexSchema.table("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  billNumber: varchar("bill_number", { length: 100 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  dueDate: date("due_date"),
  paidDate: date("paid_date"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  category: varchar("category", { length: 100 }),
  paymentMethod: varchar("payment_method", { length: 100 }),
  reference: varchar("reference", { length: 255 }),
  tags: jsonb("tags").$type<string[]>().default([]),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: uuid("created_by").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  billNumberIdx: index("cortex_bills_bill_number_idx").on(table.billNumber),
  statusIdx: index("cortex_bills_status_idx").on(table.status),
  dueDateIdx: index("cortex_bills_due_date_idx").on(table.dueDate),
  categoryIdx: index("cortex_bills_category_idx").on(table.category),
  createdByIdx: index("cortex_bills_created_by_idx").on(table.createdBy),
}));

// =====================================================
// ACTIVITY LOGGING SYSTEM
// =====================================================

export const cortexActivityLog = cortexSchema.table("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: varchar("entity_id", { length: 50 }), // Optional: related entity
  contentType: contentTypeEnum("content_type"), // Optional: related content
  contentId: uuid("content_id"), // Optional: related content
  action: varchar("action", { length: 100 }).notNull(),
  description: text("description"),
  changes: jsonb("changes").$type<Record<string, any>>(), // What changed
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userId: uuid("user_id").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  entityIdx: index("activity_log_entity_idx").on(table.entityId),
  contentIdx: index("activity_log_content_idx").on(table.contentType, table.contentId),
  actionIdx: index("activity_log_action_idx").on(table.action),
  userIdx: index("activity_log_user_idx").on(table.userId),
  createdAtIdx: index("activity_log_created_at_idx").on(table.createdAt),
}));

// =====================================================
// UNIVERSAL TAGGING SYSTEM
// =====================================================

export const cortexTags = cortexSchema.table("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }), // Hex color or predefined color name
  icon: varchar("icon", { length: 50 }), // Icon identifier
  category: varchar("category", { length: 100 }), // Tag grouping
  usageCount: integer("usage_count").default(0).notNull(),
  isSystem: boolean("is_system").default(false).notNull(), // System vs user tags
  createdBy: uuid("created_by").notNull(), // FK to app.users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  nameIdx: unique("cortex_tags_name_unique").on(table.name),
  categoryIdx: index("cortex_tags_category_idx").on(table.category),
  usageIdx: index("cortex_tags_usage_idx").on(table.usageCount),
  systemIdx: index("cortex_tags_system_idx").on(table.isSystem),
}));

// =====================================================
// INSERT SCHEMAS (Zod validation)
// =====================================================

export const insertCortexEntitySchema = createInsertSchema(cortexEntities).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCortexSpaceSchema = createInsertSchema(cortexSpaces).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCortexSpaceItemSchema = createInsertSchema(cortexSpaceItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCortexTaskSchema = createInsertSchema(cortexTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCortexNoteSchema = createInsertSchema(cortexNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCortexDocumentSchema = createInsertSchema(cortexDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCortexBillSchema = createInsertSchema(cortexBills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCortexTransactionSchema = createInsertSchema(cortexTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCortexAccountSchema = createInsertSchema(cortexAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type CortexEntity = typeof cortexEntities.$inferSelect;
export type InsertCortexEntity = z.infer<typeof insertCortexEntitySchema>;

export type CortexSpace = typeof cortexSpaces.$inferSelect;
export type InsertCortexSpace = z.infer<typeof insertCortexSpaceSchema>;

export type CortexTask = typeof cortexTasks.$inferSelect;
export type InsertCortexTask = z.infer<typeof insertCortexTaskSchema>;

export type CortexNote = typeof cortexNotes.$inferSelect;
export type InsertCortexNote = z.infer<typeof insertCortexNoteSchema>;

export type CortexDocument = typeof cortexDocuments.$inferSelect;
export type InsertCortexDocument = z.infer<typeof insertCortexDocumentSchema>;

export type CortexBill = typeof cortexBills.$inferSelect;
export type InsertCortexBill = z.infer<typeof insertCortexBillSchema>;

export type CortexTransaction = typeof cortexTransactions.$inferSelect;
export type InsertCortexTransaction = z.infer<typeof insertCortexTransactionSchema>;

export type CortexAccount = typeof cortexAccounts.$inferSelect;
export type InsertCortexAccount = z.infer<typeof insertCortexAccountSchema>;