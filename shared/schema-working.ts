import { pgTable, text, boolean, timestamp, uuid, integer, jsonb, varchar, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table in app schema
export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// WhatsApp instances - using public schema structure
export const whatsappInstances = pgTable("whatsapp_instances", {
  instanceId: varchar("instance_id", { length: 100 }).primaryKey(),
  userId: uuid("user_id").notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  instanceApiKey: varchar("instance_api_key", { length: 255 }),
  webhookUrl: varchar("webhook_url", { length: 255 }),
  qrCode: text("qr_code"),
  status: varchar("status", { length: 50 }).default("disconnected").notNull(),
  profileName: varchar("profile_name", { length: 255 }),
  profilePictureUrl: varchar("profile_picture_url", { length: 512 }),
  phoneNumber: varchar("phone_number", { length: 50 }),
  lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
  disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
  lastError: text("last_error"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// WhatsApp contacts
export const whatsappContacts = pgTable("whatsapp_contacts", {
  id: serial("id").primaryKey(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  jid: varchar("jid", { length: 100 }).notNull(),
  pushName: varchar("push_name", { length: 255 }),
  verifiedName: varchar("verified_name", { length: 255 }),
  profilePictureUrl: varchar("profile_picture_url", { length: 512 }),
  isMe: boolean("is_me").default(false).notNull(),
  isMyContact: boolean("is_my_contact").default(false).notNull(),
  isBlocked: boolean("is_blocked").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// WhatsApp conversations
export const whatsappConversations = pgTable("whatsapp_conversations", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  remoteJid: varchar("remote_jid", { length: 100 }).notNull(),
  chatType: varchar("chat_type", { length: 20 }).notNull(),
  chatName: varchar("chat_name", { length: 255 }),
  unreadCount: integer("unread_count").default(0).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  isMuted: boolean("is_muted").default(false).notNull(),
  muteUntil: timestamp("mute_until", { withTimezone: true }),
  lastMessageId: varchar("last_message_id", { length: 255 }),
  lastMessageTimestamp: timestamp("last_message_timestamp", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// WhatsApp messages
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  conversationId: integer("conversation_id"),
  fromJid: varchar("from_jid", { length: 100 }).notNull(),
  toJid: varchar("to_jid", { length: 100 }),
  fromMe: boolean("from_me").notNull(),
  messageType: varchar("message_type", { length: 50 }).notNull(),
  content: text("content"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  isForwarded: boolean("is_forwarded").default(false).notNull(),
  quotedMessageId: varchar("quoted_message_id", { length: 255 }),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Action rules
export const actionRules = pgTable("action_rules", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  ruleId: varchar("rule_id", { length: 100 }).notNull().unique(),
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  triggerConditions: jsonb("trigger_conditions").notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  actionConfig: jsonb("action_config").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Action executions
export const actionExecutions = pgTable("action_executions", {
  id: serial("id").primaryKey(),
  executionId: varchar("execution_id", { length: 100 }).notNull().unique(),
  ruleId: varchar("rule_id", { length: 100 }).notNull(),
  userId: uuid("user_id").notNull(),
  triggerContext: jsonb("trigger_context").notNull(),
  actionResult: jsonb("action_result"),
  status: varchar("status", { length: 50 }).notNull(),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull(),
});

// Action templates
export const actionTemplates = pgTable("action_templates", {
  id: serial("id").primaryKey(),
  templateId: varchar("template_id", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  defaultConfig: jsonb("default_config").notNull(),
  isBuiltIn: boolean("is_built_in").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  whatsappInstances: many(whatsappInstances),
  whatsappConversations: many(whatsappConversations),
  actionRules: many(actionRules),
  actionExecutions: many(actionExecutions),
}));

export const whatsappInstancesRelations = relations(whatsappInstances, ({ one, many }) => ({
  user: one(users, {
    fields: [whatsappInstances.userId],
    references: [users.userId],
  }),
  contacts: many(whatsappContacts),
  conversations: many(whatsappConversations),
  messages: many(whatsappMessages),
}));

export const whatsappConversationsRelations = relations(whatsappConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [whatsappConversations.userId],
    references: [users.userId],
  }),
  instance: one(whatsappInstances, {
    fields: [whatsappConversations.instanceId],
    references: [whatsappInstances.instanceId],
  }),
  messages: many(whatsappMessages),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  instance: one(whatsappInstances, {
    fields: [whatsappMessages.instanceId],
    references: [whatsappInstances.instanceId],
  }),
  conversation: one(whatsappConversations, {
    fields: [whatsappMessages.conversationId],
    references: [whatsappConversations.id],
  }),
}));

export const actionRulesRelations = relations(actionRules, ({ one, many }) => ({
  user: one(users, {
    fields: [actionRules.userId],
    references: [users.userId],
  }),
  executions: many(actionExecutions),
}));

export const actionExecutionsRelations = relations(actionExecutions, ({ one }) => ({
  user: one(users, {
    fields: [actionExecutions.userId],
    references: [users.userId],
  }),
  rule: one(actionRules, {
    fields: [actionExecutions.ruleId],
    references: [actionRules.ruleId],
  }),
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
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  createdAt: true,
});

export const insertActionRuleSchema = createInsertSchema(actionRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActionExecutionSchema = createInsertSchema(actionExecutions).omit({
  id: true,
  executedAt: true,
});

export const insertActionTemplateSchema = createInsertSchema(actionTemplates).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsappInstance = z.infer<typeof insertWhatsappInstanceSchema>;

export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;

export type WhatsappConversation = typeof whatsappConversations.$inferSelect;
export type InsertWhatsappConversation = z.infer<typeof insertWhatsappConversationSchema>;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type ActionRule = typeof actionRules.$inferSelect;
export type InsertActionRule = z.infer<typeof insertActionRuleSchema>;

export type ActionExecution = typeof actionExecutions.$inferSelect;
export type InsertActionExecution = z.infer<typeof insertActionExecutionSchema>;

export type ActionTemplate = typeof actionTemplates.$inferSelect;
export type InsertActionTemplate = z.infer<typeof insertActionTemplateSchema>;