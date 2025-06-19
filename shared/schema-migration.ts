import { pgTable, pgSchema, text, boolean, timestamp, uuid, integer, jsonb, varchar, serial, numeric, bigint } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Create schemas
export const appSchema = pgSchema("app");
export const whatsappSchema = pgSchema("whatsapp");
export const crmSchema = pgSchema("crm");
export const actionsSchema = pgSchema("actions");

// Enums for WhatsApp schema
export const chatTypeEnum = whatsappSchema.enum("chat_type", ["individual", "group"]);
export const messageTypeEnum = whatsappSchema.enum("message_type", [
  "text", "image", "video", "audio", "document", "sticker", "location",
  "contact_card", "contact_card_multi", "order", "revoked", "unsupported",
  "reaction", "call_log", "edited_message"
]);
export const messageStatusEnum = whatsappSchema.enum("message_status", [
  "error", "pending", "sent", "delivered", "read", "played"
]);
export const callOutcomeEnum = whatsappSchema.enum("call_outcome", [
  "answered", "missed", "declined"
]);

// Enums for CRM schema
export const taskStatusEnum = crmSchema.enum("task_status", [
  "pending", "in_progress", "completed", "cancelled"
]);
export const taskPriorityEnum = crmSchema.enum("task_priority", [
  "low", "medium", "high", "urgent"
]);

// Enums for Actions schema
export const triggerTypeEnum = actionsSchema.enum("trigger_type", [
  "message_received", "message_sent", "reaction_added", "hashtag_detected", "keyword_detected"
]);
export const actionTypeEnum = actionsSchema.enum("action_type", [
  "send_message", "create_task", "add_label", "send_notification", "create_calendar_event"
]);

// App Schema Tables
export const users = appSchema.table("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userPreferences = appSchema.table("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.userId),
  theme: varchar("theme", { length: 20 }).notNull().default("light"),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  timezone: varchar("timezone", { length: 50 }).notNull().default("UTC"),
  notifications: jsonb("notifications"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workspaces = appSchema.table("workspaces", {
  workspaceId: uuid("workspace_id").primaryKey().defaultRandom(),
  workspaceName: varchar("workspace_name", { length: 255 }).notNull(),
  ownerId: uuid("owner_id").notNull().references(() => users.userId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const spaces = appSchema.table("spaces", {
  spaceId: serial("space_id").primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.workspaceId),
  spaceName: varchar("space_name", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 100 }),
  color: varchar("color", { length: 20 }),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  creatorUserId: uuid("creator_user_id").notNull().references(() => users.userId),
});

// WhatsApp Schema Tables
export const whatsappInstances = whatsappSchema.table("instances", {
  instanceId: varchar("instance_id", { length: 100 }).primaryKey(),
  clientId: uuid("client_id").notNull().references(() => users.userId),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  ownerJid: varchar("owner_jid", { length: 100 }).unique(),
  apiKey: varchar("api_key", { length: 255 }),
  webhookUrl: varchar("webhook_url", { length: 255 }),
  isConnected: boolean("is_connected").default(false).notNull(),
  lastConnectionAt: timestamp("last_connection_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const whatsappContacts = whatsappSchema.table("contacts", {
  jid: varchar("jid", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull().references(() => whatsappInstances.instanceId),
  pushName: varchar("push_name", { length: 255 }),
  verifiedName: varchar("verified_name", { length: 255 }),
  profilePictureUrl: varchar("profile_picture_url", { length: 512 }),
  isBusiness: boolean("is_business").default(false).notNull(),
  isMe: boolean("is_me").default(false).notNull(),
  isBlocked: boolean("is_blocked").default(false).notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: {
    name: "contacts_pkey",
    columns: [table.jid, table.instanceId]
  }
}));

export const whatsappChats = whatsappSchema.table("chats", {
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull().references(() => whatsappInstances.instanceId),
  type: chatTypeEnum("type").notNull(),
  unreadCount: integer("unread_count").default(0).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isMuted: boolean("is_muted").default(false).notNull(),
  muteEndTimestamp: timestamp("mute_end_timestamp", { withTimezone: true }),
  lastMessageTimestamp: timestamp("last_message_timestamp", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: {
    name: "chats_pkey",
    columns: [table.chatId, table.instanceId]
  }
}));

export const whatsappMessages = whatsappSchema.table("messages", {
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull().references(() => whatsappInstances.instanceId),
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  senderJid: varchar("sender_jid", { length: 100 }).notNull(),
  fromMe: boolean("from_me").notNull(),
  messageType: messageTypeEnum("message_type").notNull(),
  content: text("content"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  quotedMessageId: varchar("quoted_message_id", { length: 255 }),
  isForwarded: boolean("is_forwarded").default(false).notNull(),
  forwardingScore: integer("forwarding_score").default(0),
  isStarred: boolean("is_starred").default(false).notNull(),
  isEdited: boolean("is_edited").default(false).notNull(),
  lastEditedAt: timestamp("last_edited_at", { withTimezone: true }),
  sourcePlatform: varchar("source_platform", { length: 20 }),
  rawApiPayload: jsonb("raw_api_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: {
    name: "messages_pkey",
    columns: [table.messageId, table.instanceId]
  }
}));

export const whatsappGroups = whatsappSchema.table("groups", {
  groupJid: varchar("group_jid", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull().references(() => whatsappInstances.instanceId),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description"),
  ownerJid: varchar("owner_jid", { length: 100 }),
  creationTimestamp: timestamp("creation_timestamp", { withTimezone: true }),
  isLocked: boolean("is_locked").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: {
    name: "groups_pkey",
    columns: [table.groupJid, table.instanceId]
  }
}));

export const whatsappGroupParticipants = whatsappSchema.table("group_participants", {
  groupJid: varchar("group_jid", { length: 100 }).notNull(),
  participantJid: varchar("participant_jid", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull().references(() => whatsappInstances.instanceId),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
}, (table) => ({
  pk: {
    name: "group_participants_pkey",
    columns: [table.groupJid, table.participantJid, table.instanceId]
  }
}));

// CRM Schema Tables
export const tasks = crmSchema.table("tasks", {
  taskId: uuid("task_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.userId),
  workspaceId: uuid("workspace_id").references(() => workspaces.workspaceId),
  spaceId: integer("space_id").references(() => spaces.spaceId),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("pending").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  assignedTo: uuid("assigned_to").references(() => users.userId),
  tags: varchar("tags", { length: 100 }).array(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Actions Schema Tables
export const actionRules = actionsSchema.table("action_rules", {
  ruleId: uuid("rule_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.userId),
  workspaceId: uuid("workspace_id").references(() => workspaces.workspaceId),
  spaceId: integer("space_id").references(() => spaces.spaceId),
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  triggerType: triggerTypeEnum("trigger_type").notNull(),
  triggerConditions: jsonb("trigger_conditions").notNull(),
  actionType: actionTypeEnum("action_type").notNull(),
  actionConfig: jsonb("action_config").notNull(),
  instanceFilters: jsonb("instance_filters"),
  contactFilters: jsonb("contact_filters"),
  timeFilters: jsonb("time_filters"),
  cooldownMinutes: integer("cooldown_minutes"),
  maxExecutionsPerDay: integer("max_executions_per_day"),
  totalExecutions: integer("total_executions").default(0),
  lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  performerFilters: jsonb("performer_filters"),
});

export const actionExecutions = actionsSchema.table("action_executions", {
  executionId: uuid("execution_id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").notNull().references(() => actionRules.ruleId),
  triggeredBy: varchar("triggered_by", { length: 255 }).notNull(),
  triggerData: jsonb("trigger_data").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull(),
  processingTimeMs: integer("processing_time_ms"),
});

export const actionTemplates = actionsSchema.table("action_templates", {
  templateId: uuid("template_id").primaryKey().defaultRandom(),
  templateName: varchar("template_name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  triggerType: triggerTypeEnum("trigger_type").notNull(),
  actionType: actionTypeEnum("action_type").notNull(),
  defaultConfig: jsonb("default_config").notNull(),
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  rating: numeric("rating", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  userPreferences: one(userPreferences),
  ownedWorkspaces: many(workspaces),
  createdSpaces: many(spaces),
  tasks: many(tasks),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  actionRules: many(actionRules),
  whatsappInstances: many(whatsappInstances),
}));

export const whatsappInstancesRelations = relations(whatsappInstances, ({ one, many }) => ({
  owner: one(users, {
    fields: [whatsappInstances.clientId],
    references: [users.userId],
  }),
  contacts: many(whatsappContacts),
  chats: many(whatsappChats),
  messages: many(whatsappMessages),
  groups: many(whatsappGroups),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappInstanceSchema = createInsertSchema(whatsappInstances).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts).omit({
  firstSeenAt: true,
  lastUpdatedAt: true,
});

export const insertWhatsappChatSchema = createInsertSchema(whatsappChats).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  taskId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActionRuleSchema = createInsertSchema(actionRules).omit({
  ruleId: true,
  totalExecutions: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActionExecutionSchema = createInsertSchema(actionExecutions).omit({
  executionId: true,
  executedAt: true,
});

export const insertActionTemplateSchema = createInsertSchema(actionTemplates).omit({
  templateId: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsappInstance = z.infer<typeof insertWhatsappInstanceSchema>;

export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;

export type WhatsappChat = typeof whatsappChats.$inferSelect;
export type InsertWhatsappChat = z.infer<typeof insertWhatsappChatSchema>;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type WhatsappGroup = typeof whatsappGroups.$inferSelect;
export type InsertWhatsappGroup = z.infer<typeof insertWhatsappGroupSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type ActionRule = typeof actionRules.$inferSelect;
export type InsertActionRule = z.infer<typeof insertActionRuleSchema>;

export type ActionExecution = typeof actionExecutions.$inferSelect;
export type InsertActionExecution = z.infer<typeof insertActionExecutionSchema>;

export type ActionTemplate = typeof actionTemplates.$inferSelect;
export type InsertActionTemplate = z.infer<typeof insertActionTemplateSchema>;

// Schema exports for drizzle-kit
export const insertWhatsappGroupSchema = createInsertSchema(whatsappGroups).omit({
  updatedAt: true,
});

export const insertWhatsappGroupParticipantSchema = createInsertSchema(whatsappGroupParticipants);

export type WhatsappGroupParticipant = typeof whatsappGroupParticipants.$inferSelect;
export type InsertWhatsappGroupParticipant = z.infer<typeof insertWhatsappGroupParticipantSchema>;