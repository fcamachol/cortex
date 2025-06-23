import { pgTable, pgSchema, text, boolean, timestamp, uuid, integer, jsonb, bigint, varchar, serial, numeric, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Create schemas
export const whatsappSchema = pgSchema("whatsapp");
export const crmSchema = pgSchema("crm");
export const appSchema = pgSchema("app");
export const actionsSchema = pgSchema("actions");
export const calendarSchema = pgSchema("calendar");
export const financeSchema = pgSchema("finance");

// Enums for App schema
export const workspaceRoleEnum = appSchema.enum("workspace_role", ["admin", "member", "viewer"]);
export const spaceRoleEnum = appSchema.enum("space_role", ["admin", "editor", "viewer"]);
export const channelTypeEnum = appSchema.enum("channel_type", ["whatsapp", "email", "slack", "sms"]);

// Enums for Calendar schema
export const providerTypeEnum = calendarSchema.enum("provider_type", ["google", "outlook", "apple"]);
export const syncStatusTypeEnum = calendarSchema.enum("sync_status_type", ["active", "revoked", "error", "pending"]);
export const attendeeResponseStatusEnum = calendarSchema.enum("attendee_response_status", ["needsAction", "declined", "tentative", "accepted"]);

// Enums for Finance schema
export const transactionTypeEnum = financeSchema.enum("transaction_type", ["income", "expense"]);
export const payableStatusEnum = financeSchema.enum("payable_status", ["unpaid", "partially_paid", "paid", "overdue"]);
export const loanStatusEnum = financeSchema.enum("loan_status", ["active", "paid_off", "in_arrears"]);
export const interestPeriodTypeEnum = financeSchema.enum("interest_period_type", ["daily", "weekly", "monthly", "annually"]);
export const accountTypeEnum = financeSchema.enum("account_type", [
  "checking", "savings", "credit_card", "investment", "loan", "mortgage", 
  "business", "cash", "crypto", "retirement", "other"
]);

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

// WhatsApp Schema Tables
export const whatsappInstances = whatsappSchema.table("instances", {
  instanceId: varchar("instance_id", { length: 100 }).primaryKey(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  ownerJid: varchar("owner_jid", { length: 100 }).unique(),
  clientId: uuid("client_id").notNull(), // FK to users table
  apiKey: varchar("api_key", { length: 255 }),
  webhookUrl: varchar("webhook_url", { length: 255 }),
  isConnected: boolean("is_connected").default(false).notNull(),
  lastConnectionAt: timestamp("last_connection_at", { withTimezone: true }),
  customColor: varchar("custom_color", { length: 50 }), // Custom background color class
  customLetter: varchar("custom_letter", { length: 10 }), // Custom letter or emoji
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const whatsappContacts = whatsappSchema.table("contacts", {
  jid: varchar("jid", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
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
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
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
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
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

export const whatsappMessageEditHistory = whatsappSchema.table("message_edit_history", {
  editId: serial("edit_id").primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  oldContent: text("old_content"),
  editTimestamp: timestamp("edit_timestamp", { withTimezone: true }).notNull(),
});

export const whatsappMessageMedia = whatsappSchema.table("message_media", {
  mediaId: serial("media_id").primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  mimetype: varchar("mimetype", { length: 100 }).notNull(),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  fileUrl: varchar("file_url", { length: 512 }),
  fileLocalPath: varchar("file_local_path", { length: 512 }),
  mediaKey: text("media_key"),
  caption: text("caption"),
  thumbnailUrl: varchar("thumbnail_url", { length: 512 }),
  height: integer("height"),
  width: integer("width"),
  durationSeconds: integer("duration_seconds"),
  isViewOnce: boolean("is_view_once").default(false).notNull(),
});

export const whatsappMessageReactions = whatsappSchema.table("message_reactions", {
  reactionId: serial("reaction_id").primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  reactorJid: varchar("reactor_jid", { length: 100 }).notNull(),
  reactionEmoji: varchar("reaction_emoji", { length: 10 }),
  fromMe: boolean("from_me").notNull().default(false),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

export const whatsappMessageUpdates = whatsappSchema.table("message_updates", {
  updateId: serial("update_id").primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  status: messageStatusEnum("status").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

export const whatsappGroups = whatsappSchema.table("groups", {
  groupJid: varchar("group_jid", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
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
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
}, (table) => ({
  pk: {
    name: "group_participants_pkey",
    columns: [table.groupJid, table.participantJid, table.instanceId]
  }
}));

export const whatsappLabels = whatsappSchema.table("labels", {
  labelId: varchar("label_id", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  colorIndex: integer("color_index"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: {
    name: "labels_pkey",
    columns: [table.labelId, table.instanceId]
  }
}));

export const whatsappChatLabels = whatsappSchema.table("chat_labels", {
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  labelId: varchar("label_id", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
}, (table) => ({
  pk: {
    name: "chat_labels_pkey",
    columns: [table.chatId, table.labelId, table.instanceId]
  }
}));

export const whatsappCallLogs = whatsappSchema.table("call_logs", {
  callLogId: varchar("call_log_id", { length: 255 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  fromJid: varchar("from_jid", { length: 100 }).notNull(),
  fromMe: boolean("from_me").notNull(),
  startTimestamp: timestamp("start_timestamp", { withTimezone: true }).notNull(),
  isVideoCall: boolean("is_video_call").notNull(),
  durationSeconds: integer("duration_seconds"),
  outcome: callOutcomeEnum("outcome"),
}, (table) => ({
  pk: {
    name: "call_logs_pkey",
    columns: [table.callLogId, table.instanceId]
  }
}));

export const whatsappMessageDeletions = whatsappSchema.table("message_deletions", {
  deletionId: varchar("deletion_id", { length: 255 }).primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  deletedBy: varchar("deleted_by", { length: 100 }).notNull(), // JID of who deleted the message
  deletionType: varchar("deletion_type", { length: 50 }).notNull(), // 'sender', 'admin', 'everyone'
  originalContent: text("original_content"), // Content of deleted message if available
  originalTimestamp: timestamp("original_timestamp", { withTimezone: true }), // When message was originally sent
  deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow().notNull(),
  rawApiPayload: jsonb("raw_api_payload"), // Full webhook payload for debugging
}, (table) => ({
  messageIndex: index("message_deletions_message_idx").on(table.messageId, table.instanceId),
  chatIndex: index("message_deletions_chat_idx").on(table.chatId, table.instanceId),
  deletedAtIndex: index("message_deletions_deleted_at_idx").on(table.deletedAt),
}));

export const whatsappDrafts = whatsappSchema.table("drafts", {
  messageId: varchar("message_id", { length: 255 }).primaryKey(), // DRAFT000001 format
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  content: text("content").notNull(),
  replyToMessageId: varchar("reply_to_message_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  chatInstanceIdx: index("drafts_chat_instance_idx").on(table.chatId, table.instanceId),
  updatedAtIndex: index("drafts_updated_at_idx").on(table.updatedAt),
}));

export const whatsappWaitingReply = whatsappSchema.table("waiting_reply", {
  id: serial("id").primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull().unique(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  messageInstanceIdx: index("waiting_reply_message_instance_idx").on(table.messageId, table.instanceId),
  chatInstanceIdx: index("waiting_reply_chat_instance_idx").on(table.chatId, table.instanceId),
}));

// Relations
export const whatsappInstancesRelations = relations(whatsappInstances, ({ many }) => ({
  contacts: many(whatsappContacts),
  chats: many(whatsappChats),
  messages: many(whatsappMessages),
  labels: many(whatsappLabels),
}));

export const whatsappContactsRelations = relations(whatsappContacts, ({ one, many }) => ({
  instance: one(whatsappInstances, {
    fields: [whatsappContacts.instanceId],
    references: [whatsappInstances.instanceId],
  }),
  chats: many(whatsappChats),
  sentMessages: many(whatsappMessages),
  reactions: many(whatsappMessageReactions),
}));

export const whatsappChatsRelations = relations(whatsappChats, ({ one, many }) => ({
  instance: one(whatsappInstances, {
    fields: [whatsappChats.instanceId],
    references: [whatsappInstances.instanceId],
  }),
  contact: one(whatsappContacts, {
    fields: [whatsappChats.chatId, whatsappChats.instanceId],
    references: [whatsappContacts.jid, whatsappContacts.instanceId],
  }),
  messages: many(whatsappMessages),
  labels: many(whatsappChatLabels),
  callLogs: many(whatsappCallLogs),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one, many }) => ({
  instance: one(whatsappInstances, {
    fields: [whatsappMessages.instanceId],
    references: [whatsappInstances.instanceId],
  }),
  chat: one(whatsappChats, {
    fields: [whatsappMessages.chatId, whatsappMessages.instanceId],
    references: [whatsappChats.chatId, whatsappChats.instanceId],
  }),
  sender: one(whatsappContacts, {
    fields: [whatsappMessages.senderJid, whatsappMessages.instanceId],
    references: [whatsappContacts.jid, whatsappContacts.instanceId],
  }),
  editHistory: many(whatsappMessageEditHistory),
  media: many(whatsappMessageMedia),
  reactions: many(whatsappMessageReactions),
  updates: many(whatsappMessageUpdates),
  deletions: many(whatsappMessageDeletions),
}));

export const whatsappMessageDeletionsRelations = relations(whatsappMessageDeletions, ({ one }) => ({
  message: one(whatsappMessages, {
    fields: [whatsappMessageDeletions.messageId, whatsappMessageDeletions.instanceId],
    references: [whatsappMessages.messageId, whatsappMessages.instanceId],
  }),
  instance: one(whatsappInstances, {
    fields: [whatsappMessageDeletions.instanceId],
    references: [whatsappInstances.instanceId],
  }),
  chat: one(whatsappChats, {
    fields: [whatsappMessageDeletions.chatId, whatsappMessageDeletions.instanceId],
    references: [whatsappChats.chatId, whatsappChats.instanceId],
  }),
}));

// Insert and Select schemas
export const insertWhatsappInstanceSchema = createInsertSchema(whatsappInstances).omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  instanceId: z.string().optional(),
  displayName: z.string().optional(),
  clientId: z.string().optional(),
  ownerJid: z.string().nullable().optional(),
  apiKey: z.string().nullable().optional(),
  webhookUrl: z.string().nullable().optional(),
  isConnected: z.boolean().optional(),
  lastConnectionAt: z.date().nullable().optional(),
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

export const insertWhatsappMessageEditHistorySchema = createInsertSchema(whatsappMessageEditHistory).omit({
  editId: true,
});

export const insertWhatsappMessageMediaSchema = createInsertSchema(whatsappMessageMedia).omit({
  mediaId: true,
});

export const insertWhatsappMessageReactionSchema = createInsertSchema(whatsappMessageReactions).omit({
  reactionId: true,
});

export const insertWhatsappMessageUpdateSchema = createInsertSchema(whatsappMessageUpdates).omit({
  updateId: true,
});

export const insertWhatsappGroupSchema = createInsertSchema(whatsappGroups).omit({
  updatedAt: true,
});

export const insertWhatsappGroupParticipantSchema = createInsertSchema(whatsappGroupParticipants);

export const insertWhatsappLabelSchema = createInsertSchema(whatsappLabels).omit({
  createdAt: true,
});

export const insertWhatsappChatLabelSchema = createInsertSchema(whatsappChatLabels);

export const insertWhatsappCallLogSchema = createInsertSchema(whatsappCallLogs);

export const insertWhatsappMessageDeletionSchema = createInsertSchema(whatsappMessageDeletions).omit({
  deletedAt: true,
});

// Types
export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsappInstance = z.infer<typeof insertWhatsappInstanceSchema>;

export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;

export type WhatsappChat = typeof whatsappChats.$inferSelect;
export type InsertWhatsappChat = z.infer<typeof insertWhatsappChatSchema>;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type WhatsappMessageEditHistory = typeof whatsappMessageEditHistory.$inferSelect;
export type InsertWhatsappMessageEditHistory = z.infer<typeof insertWhatsappMessageEditHistorySchema>;

export type WhatsappMessageMedia = typeof whatsappMessageMedia.$inferSelect;
export type InsertWhatsappMessageMedia = z.infer<typeof insertWhatsappMessageMediaSchema>;

export type WhatsappMessageReaction = typeof whatsappMessageReactions.$inferSelect;
export type InsertWhatsappMessageReaction = z.infer<typeof insertWhatsappMessageReactionSchema>;

export type WhatsappMessageUpdate = typeof whatsappMessageUpdates.$inferSelect;
export type InsertWhatsappMessageUpdate = z.infer<typeof insertWhatsappMessageUpdateSchema>;

export type WhatsappGroup = typeof whatsappGroups.$inferSelect;
export type InsertWhatsappGroup = z.infer<typeof insertWhatsappGroupSchema>;

export type WhatsappGroupParticipant = typeof whatsappGroupParticipants.$inferSelect;
export type InsertWhatsappGroupParticipant = z.infer<typeof insertWhatsappGroupParticipantSchema>;

export type WhatsappLabel = typeof whatsappLabels.$inferSelect;
export type InsertWhatsappLabel = z.infer<typeof insertWhatsappLabelSchema>;

export type WhatsappChatLabel = typeof whatsappChatLabels.$inferSelect;
export type InsertWhatsappChatLabel = z.infer<typeof insertWhatsappChatLabelSchema>;

export type WhatsappCallLog = typeof whatsappCallLogs.$inferSelect;
export type InsertWhatsappCallLog = z.infer<typeof insertWhatsappCallLogSchema>;

export type WhatsappMessageDeletion = typeof whatsappMessageDeletions.$inferSelect;
export type InsertWhatsappMessageDeletion = z.infer<typeof insertWhatsappMessageDeletionSchema>;

// Draft schemas
export const insertWhatsappDraftSchema = createInsertSchema(whatsappDrafts).omit({
  createdAt: true,
  updatedAt: true,
});

export type WhatsappDraft = typeof whatsappDrafts.$inferSelect;
export type InsertWhatsappDraft = z.infer<typeof insertWhatsappDraftSchema>;

export const insertWhatsappWaitingReplySchema = createInsertSchema(whatsappWaitingReply).omit({
  id: true,
  createdAt: true,
});

export type WhatsappWaitingReply = typeof whatsappWaitingReply.$inferSelect;
export type InsertWhatsappWaitingReply = z.infer<typeof insertWhatsappWaitingReplySchema>;

// Legacy types for backward compatibility (to be removed after migration)
export interface WhatsappInstanceLegacy {
  id: string;
  user_id: string;
  instance_name: string;
  display_name: string;
  instance_api_key: string;
  webhook_url?: string;
  webhook_events?: string[];
  qr_code?: string;
  status: string;
  profile_name?: string;
  profile_picture_url?: string;
  phone_number?: string;
  last_connected_at?: Date;
  disconnected_at?: Date;
  last_error?: string;
  settings?: any;
  created_at: Date;
  updated_at: Date;
  qr_expires_at?: Date;
  qr_code_url?: string;
  connection_state?: string;
  retry_count?: number;
  max_retries?: number;
  connection_retries?: number;
  qr_code_expires_at?: Date;
  battery_level?: number;
  is_plugged?: boolean;
  server_url?: string;
  is_active?: boolean;
}

export interface WhatsappConversationLegacy {
  id: string;
  user_id: string;
  instance_id: string;
  instance_name: string;
  contact_id?: string;
  remote_jid: string;
  chat_name?: string;
  chat_type: string;
  title?: string;
  unread_count: number;
  last_message_id?: string;
  last_message_content?: string;
  last_message_timestamp?: number;
  last_message_from_me?: boolean;
  is_archived: boolean;
  is_pinned: boolean;
  is_muted: boolean;
  is_read_only?: boolean;
  mute_until?: Date;
  presence_status?: string;
  presence_last_seen?: Date;
  total_message_count?: number;
  group_description?: string;
  group_owner?: string;
  group_creation_timestamp?: number;
  group_participants_count?: number;
  labels?: any;
  notification_settings?: any;
  custom_wallpaper?: string;
  created_at: Date;
  updated_at: Date;
}

export interface WhatsappMessageLegacy {
  id: string;
  user_id: string;
  instance_id: string;
  conversation_id: string;
  evolution_message_id: string;
  remote_jid: string;
  participant?: string;
  from_me: boolean;
  message_type: string;
  text_content?: string;
  message_content?: any;
  timestamp: number;
  push_name?: string;
  quoted_message_id?: string;
  quoted_content?: string;
  context_info?: any;
  media_url?: string;
  media_mimetype?: string;
  media_size?: number;
  media_filename?: string;
  media_caption?: string;
  media_thumb_url?: string;
  location_latitude?: number;
  location_longitude?: number;
  location_name?: string;
  location_address?: string;
  contact_display_name?: string;
  contact_vcard?: string;
  document_title?: string;
  document_page_count?: number;
  interactive_type?: string;
  interactive_body?: string;
  interactive_footer?: string;
  interactive_data?: any;
  is_forwarded?: boolean;
  forward_score?: number;
  mentions?: any;
  reactions?: any;
  edit_history?: any;
  status?: string;
  view_once?: boolean;
  is_ephemeral?: boolean;
  ephemeral_duration?: number;
  created_at: Date;
  updated_at: Date;
}

// User management (keeping existing structure)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").unique(),
  name: text("name"),
  avatar: text("avatar"),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const usersRelations = relations(users, ({ many }) => ({
  whatsappInstances: many(whatsappInstances),
}));

// =============================================================================
// APP SCHEMA TABLES
// =============================================================================

// Core app users table (new structure)
export const appUsers = appSchema.table("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  passwordResetToken: varchar("password_reset_token", { length: 10 }),
  passwordResetExpiry: timestamp("password_reset_expiry", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Workspaces table
export const appWorkspaces = appSchema.table("workspaces", {
  workspaceId: uuid("workspace_id").primaryKey().defaultRandom(),
  workspaceName: varchar("workspace_name", { length: 255 }).notNull(),
  ownerId: uuid("owner_id").notNull().references(() => appUsers.userId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Spaces table
export const appSpaces = appSchema.table("spaces", {
  spaceId: serial("space_id").primaryKey(),
  workspaceId: uuid("workspace_id").references(() => appWorkspaces.workspaceId),
  creatorUserId: uuid("creator_user_id").notNull().references(() => appUsers.userId),
  spaceName: varchar("space_name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 7 }),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Channels table
export const appChannels = appSchema.table("channels", {
  channelId: serial("channel_id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => appWorkspaces.workspaceId),
  channelType: channelTypeEnum("channel_type").notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  credentials: jsonb("credentials"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Workspace members junction table
export const appWorkspaceMembers = appSchema.table("workspace_members", {
  workspaceId: uuid("workspace_id").notNull().references(() => appWorkspaces.workspaceId),
  userId: uuid("user_id").notNull().references(() => appUsers.userId),
  role: workspaceRoleEnum("role").notNull().default("member"),
}, (table) => ({
  pk: {
    name: "workspace_members_pkey",
    columns: [table.workspaceId, table.userId]
  }
}));

// Space members junction table
export const appSpaceMembers = appSchema.table("space_members", {
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId),
  userId: uuid("user_id").notNull().references(() => appUsers.userId),
  role: spaceRoleEnum("role").notNull().default("viewer"),
}, (table) => ({
  pk: {
    name: "space_members_pkey",
    columns: [table.spaceId, table.userId]
  }
}));

// User preferences table
export const appUserPreferences = appSchema.table("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => appUsers.userId),
  theme: varchar("theme", { length: 20 }).notNull().default("system"),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  timezone: varchar("timezone", { length: 50 }).notNull().default("UTC"),
  notifications: jsonb("notifications"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// App schema insert schemas
export const insertAppUserSchema = createInsertSchema(appUsers).omit({
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppWorkspaceSchema = createInsertSchema(appWorkspaces).omit({
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppSpaceSchema = createInsertSchema(appSpaces).omit({
  spaceId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppChannelSchema = createInsertSchema(appChannels).omit({
  channelId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppWorkspaceMemberSchema = createInsertSchema(appWorkspaceMembers);
export const insertAppSpaceMemberSchema = createInsertSchema(appSpaceMembers);
export const insertAppUserPreferencesSchema = createInsertSchema(appUserPreferences).omit({
  updatedAt: true,
});

// App schema types
export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
export type AppWorkspace = typeof appWorkspaces.$inferSelect;
export type InsertAppWorkspace = z.infer<typeof insertAppWorkspaceSchema>;
export type AppSpace = typeof appSpaces.$inferSelect;
export type InsertAppSpace = z.infer<typeof insertAppSpaceSchema>;
export type AppChannel = typeof appChannels.$inferSelect;
export type InsertAppChannel = z.infer<typeof insertAppChannelSchema>;
export type AppWorkspaceMember = typeof appWorkspaceMembers.$inferSelect;
export type InsertAppWorkspaceMember = z.infer<typeof insertAppWorkspaceMemberSchema>;
export type AppSpaceMember = typeof appSpaceMembers.$inferSelect;
export type InsertAppSpaceMember = z.infer<typeof insertAppSpaceMemberSchema>;
export type AppUserPreferences = typeof appUserPreferences.$inferSelect;
export type InsertAppUserPreferences = z.infer<typeof insertAppUserPreferencesSchema>;

// App schema relations
export const appUsersRelations = relations(appUsers, ({ many, one }) => ({
  ownedWorkspaces: many(appWorkspaces),
  workspaceMembers: many(appWorkspaceMembers),
  spaceMembers: many(appSpaceMembers),
  createdSpaces: many(appSpaces),
  preferences: one(appUserPreferences),
}));

export const appWorkspacesRelations = relations(appWorkspaces, ({ one, many }) => ({
  owner: one(appUsers, {
    fields: [appWorkspaces.ownerId],
    references: [appUsers.userId],
  }),
  members: many(appWorkspaceMembers),
  spaces: many(appSpaces),
  channels: many(appChannels),
}));

export const appSpacesRelations = relations(appSpaces, ({ one, many }) => ({
  workspace: one(appWorkspaces, {
    fields: [appSpaces.workspaceId],
    references: [appWorkspaces.workspaceId],
  }),
  creator: one(appUsers, {
    fields: [appSpaces.creatorUserId],
    references: [appUsers.userId],
  }),
  members: many(appSpaceMembers),
}));

export const appChannelsRelations = relations(appChannels, ({ one }) => ({
  workspace: one(appWorkspaces, {
    fields: [appChannels.workspaceId],
    references: [appWorkspaces.workspaceId],
  }),
}));

export const appWorkspaceMembersRelations = relations(appWorkspaceMembers, ({ one }) => ({
  workspace: one(appWorkspaces, {
    fields: [appWorkspaceMembers.workspaceId],
    references: [appWorkspaces.workspaceId],
  }),
  user: one(appUsers, {
    fields: [appWorkspaceMembers.userId],
    references: [appUsers.userId],
  }),
}));

export const appSpaceMembersRelations = relations(appSpaceMembers, ({ one }) => ({
  space: one(appSpaces, {
    fields: [appSpaceMembers.spaceId],
    references: [appSpaces.spaceId],
  }),
  user: one(appUsers, {
    fields: [appSpaceMembers.userId],
    references: [appUsers.userId],
  }),
}));

export const appUserPreferencesRelations = relations(appUserPreferences, ({ one }) => ({
  user: one(appUsers, {
    fields: [appUserPreferences.userId],
    references: [appUsers.userId],
  }),
}));

// Legacy tables for backward compatibility during migration
export const tasks = pgTable("tasks", {
  taskId: uuid("task_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  parentTaskId: uuid("parent_task_id"),
  title: text("title").notNull(),
  description: text("description"),
  taskStatus: text("task_status").default("to_do"),
  subStatus: text("sub_status"),
  priority: text("priority").default("medium"),
  dueDate: timestamp("due_date"),
  conversationJid: varchar("conversation_jid"),
  contactJid: varchar("contact_jid"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const contacts = pgTable("contacts", {
  contactId: uuid("contact_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  email: varchar("email"),
  phone: varchar("phone"),
  company: varchar("company"),
  position: varchar("position"),
  notes: text("notes"),
  tags: jsonb("tags"),
  customFields: jsonb("custom_fields"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const conversations = pgTable("conversations", {
  conversationId: uuid("conversation_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  title: text("title"),
  description: text("description"),
  participants: jsonb("participants"),
  tags: jsonb("tags"),
  isArchived: boolean("is_archived").default(false),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const messages = pgTable("messages", {
  messageId: uuid("message_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  conversationId: uuid("conversation_id").references(() => conversations.conversationId),
  content: text("content"),
  messageType: text("message_type").default("text"),
  sender: text("sender"),
  recipient: text("recipient"),
  replyToMessageId: uuid("reply_to_message_id"),
  metadata: jsonb("metadata"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Legacy insert schemas
export const insertTaskSchema = createInsertSchema(tasks).omit({
  taskId: true,
  createdAt: true,
  updatedAt: true
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  contactId: true,
  createdAt: true,
  updatedAt: true
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  conversationId: true,
  createdAt: true,
  updatedAt: true
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  messageId: true,
  createdAt: true,
  updatedAt: true
});

// Legacy types
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Actions Schema - Event Triggering System
export const actionTriggerTypeEnum = actionsSchema.enum("trigger_type", [
  "reaction", "hashtag", "keyword", "time_based", "location", "contact_group"
]);

export const actionTypeEnum = actionsSchema.enum("action_type", [
  "create_task", "create_calendar_event", "send_message", "add_label", 
  "update_contact", "move_to_folder", "send_notification", "webhook"
]);

export const actionStatusEnum = actionsSchema.enum("action_status", [
  "active", "paused", "disabled"
]);

// Action Rules - Define trigger conditions and resulting actions
export const actionRules = actionsSchema.table("action_rules", {
  ruleId: uuid("rule_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(), // FK to app.users
  workspaceId: uuid("workspace_id"), // FK to app.workspaces (nullable for personal rules)
  spaceId: integer("space_id"), // FK to app.spaces (nullable for workspace-wide rules)
  
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  
  // Trigger Configuration
  triggerType: actionTriggerTypeEnum("trigger_type").notNull(),
  triggerConditions: jsonb("trigger_conditions").notNull(), // Flexible trigger config
  
  // Action Configuration  
  actionType: actionTypeEnum("action_type").notNull(),
  actionConfig: jsonb("action_config").notNull(), // Action-specific settings
  
  // Filtering and Scoping
  instanceFilters: jsonb("instance_filters"), // Which WhatsApp instances
  contactFilters: jsonb("contact_filters"), // Which contacts/groups
  performerFilters: jsonb("performer_filters"), // Who can trigger (user_only, contacts_only, both)
  timeFilters: jsonb("time_filters"), // Time-based restrictions
  
  // Execution Settings
  cooldownMinutes: integer("cooldown_minutes").default(0), // Prevent spam
  maxExecutionsPerDay: integer("max_executions_per_day").default(100),
  
  // Statistics
  totalExecutions: integer("total_executions").default(0),
  lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Action Executions - Log of triggered actions
export const actionExecutions = actionsSchema.table("action_executions", {
  executionId: uuid("execution_id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").notNull(), // FK to action_rules
  
  // Trigger Context
  triggeredBy: varchar("triggered_by", { length: 100 }).notNull(), // message_id, reaction_id, etc.
  triggerData: jsonb("trigger_data").notNull(), // Full context data
  
  // Execution Results
  status: varchar("status", { length: 20 }).notNull(), // success, failed, skipped
  result: jsonb("result"), // Action result data
  errorMessage: text("error_message"),
  
  // Timing
  executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull(),
  processingTimeMs: integer("processing_time_ms"),
});

// Action Templates - Predefined rule templates
export const actionTemplates = actionsSchema.table("action_templates", {
  templateId: uuid("template_id").primaryKey().defaultRandom(),
  templateName: varchar("template_name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(), // productivity, crm, automation, etc.
  
  // Template Configuration
  triggerType: actionTriggerTypeEnum("trigger_type").notNull(),
  actionType: actionTypeEnum("action_type").notNull(),
  defaultConfig: jsonb("default_config").notNull(),
  
  // Metadata
  isPublic: boolean("is_public").default(false),
  usageCount: integer("usage_count").default(0),
  rating: numeric("rating", { precision: 3, scale: 2 }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations for Actions Schema
export const actionRulesRelations = relations(actionRules, ({ one, many }) => ({
  executions: many(actionExecutions),
}));

export const actionExecutionsRelations = relations(actionExecutions, ({ one }) => ({
  rule: one(actionRules, {
    fields: [actionExecutions.ruleId],
    references: [actionRules.ruleId],
  }),
}));

// Insert schemas for Actions
export const insertActionRuleSchema = createInsertSchema(actionRules).omit({
  ruleId: true,
  totalExecutions: true,
  lastExecutedAt: true,
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
  rating: true,
  createdAt: true,
  updatedAt: true,
});

// Types for Actions
export type ActionRule = typeof actionRules.$inferSelect;
export type InsertActionRule = z.infer<typeof insertActionRuleSchema>;

export type ActionExecution = typeof actionExecutions.$inferSelect;
export type InsertActionExecution = z.infer<typeof insertActionExecutionSchema>;

export type ActionTemplate = typeof actionTemplates.$inferSelect;
export type InsertActionTemplate = z.infer<typeof insertActionTemplateSchema>;

// Legacy aliases for backward compatibility
export type InsertWhatsappConversation = InsertWhatsappChat;
export type WhatsappConversation = WhatsappChat;

// =============================================================================
// CRM SCHEMA - Customer Relationship Management
// =============================================================================

// Task status and priority enums for CRM
export const taskStatusEnum = crmSchema.enum("task_status", ["to_do", "in_progress", "done", "cancelled"]);
export const taskPriorityEnum = crmSchema.enum("task_priority", ["low", "medium", "high", "urgent"]);

// CRM Tasks - Main task management table
export const crmTasks = crmSchema.table("tasks", {
  taskId: serial("task_id").primaryKey(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("to_do"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  priority: varchar("priority", { length: 50 }).default("medium"),
  taskType: varchar("task_type", { length: 50 }).default("task"),
  projectId: integer("project_id"),
  parentTaskId: integer("parent_task_id"),
  triggeringMessageId: varchar("triggering_message_id", { length: 100 }),
  assignedToUserId: uuid("assigned_to_user_id"),
  relatedChatJid: varchar("related_chat_jid", { length: 100 }),
  senderJid: varchar("sender_jid", { length: 100 }),
  contactName: varchar("contact_name", { length: 255 }),
  originalMessageContent: text("original_message_content"),
  createdByUserId: uuid("created_by_user_id"),
  linkedPayableId: integer("linked_payable_id").references(() => financePayables.payableId), // Link to bill/payable
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  spaceId: integer("space_id"),
});

// CRM Tasks Relations
export const crmTasksRelations = relations(crmTasks, ({ one }) => ({
  instance: one(whatsappInstances, {
    fields: [crmTasks.instanceId],
    references: [whatsappInstances.instanceId],
  }),
  linkedPayable: one(financePayables, {
    fields: [crmTasks.linkedPayableId],
    references: [financePayables.payableId],
  }),
}));

// CRM Insert Schemas
export const insertCrmTaskSchema = createInsertSchema(crmTasks).omit({
  taskId: true,
  createdAt: true,
  updatedAt: true,
});

// CRM Types
export type CrmTask = typeof crmTasks.$inferSelect;
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;

// =============================================================================
// CALENDAR SCHEMA - External Calendar Integration
// =============================================================================

// Calendar Accounts - Store OAuth credentials for external calendar providers
export const calendarAccounts = calendarSchema.table("accounts", {
  accountId: serial("account_id").primaryKey(),
  userId: uuid("user_id").notNull().unique(), // One calendar account per app user
  workspaceId: uuid("workspace_id").notNull(),
  provider: providerTypeEnum("provider").notNull().default("google"),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(), // User's email address
  accessToken: text("access_token").notNull(), // Should be encrypted in production
  refreshToken: text("refresh_token"), // Should be encrypted in production
  tokenExpiryDate: timestamp("token_expiry_date", { withTimezone: true }),
  scopes: jsonb("scopes"), // OAuth permissions granted
  syncStatus: syncStatusTypeEnum("sync_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Calendar Calendars - Individual calendars (Work, Personal, etc.)
export const calendarCalendars = calendarSchema.table("calendars", {
  calendarId: serial("calendar_id").primaryKey(),
  accountId: integer("account_id").notNull(),
  providerCalendarId: varchar("provider_calendar_id", { length: 255 }).notNull(), // External calendar ID
  summary: varchar("summary", { length: 255 }).notNull(),
  description: text("description"),
  timezone: varchar("timezone", { length: 100 }),
  isPrimary: boolean("is_primary").default(false),
  isEnabledForSync: boolean("is_enabled_for_sync").default(true).notNull(),
  lastSyncToken: varchar("last_sync_token", { length: 255 }), // For incremental sync
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Calendar Events - Synchronized copy of external calendar events
export const calendarEvents = calendarSchema.table("events", {
  eventId: serial("event_id").primaryKey(),
  calendarId: integer("calendar_id").notNull(),
  providerEventId: varchar("provider_event_id", { length: 255 }).notNull(), // External event ID
  crmEventId: integer("crm_event_id").unique(), // Link to CRM event
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  isAllDay: boolean("is_all_day").notNull().default(false),
  location: varchar("location", { length: 512 }),
  meetLink: varchar("meet_link", { length: 512 }),
  providerHtmlLink: varchar("provider_html_link", { length: 512 }), // View on Google Calendar
  status: varchar("status", { length: 50 }), // confirmed, tentative, cancelled
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Calendar Attendees - Event attendees from external calendars
export const calendarAttendees = calendarSchema.table("attendees", {
  attendeeId: serial("attendee_id").primaryKey(),
  eventId: integer("event_id").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  responseStatus: attendeeResponseStatusEnum("response_status").notNull().default("needsAction"),
  isOrganizer: boolean("is_organizer").default(false),
});

// Calendar Schema Relations
export const calendarAccountsRelations = relations(calendarAccounts, ({ many, one }) => ({
  calendars: many(calendarCalendars),
  user: one(appUsers, {
    fields: [calendarAccounts.userId],
    references: [appUsers.userId],
  }),
  workspace: one(appWorkspaces, {
    fields: [calendarAccounts.workspaceId],
    references: [appWorkspaces.workspaceId],
  }),
}));

export const calendarCalendarsRelations = relations(calendarCalendars, ({ one, many }) => ({
  account: one(calendarAccounts, {
    fields: [calendarCalendars.accountId],
    references: [calendarAccounts.accountId],
  }),
  events: many(calendarEvents),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one, many }) => ({
  calendar: one(calendarCalendars, {
    fields: [calendarEvents.calendarId],
    references: [calendarCalendars.calendarId],
  }),
  // Note: CRM calendar events relation will be added when CRM schema is updated
  attendees: many(calendarAttendees),
}));

export const calendarAttendeesRelations = relations(calendarAttendees, ({ one }) => ({
  event: one(calendarEvents, {
    fields: [calendarAttendees.eventId],
    references: [calendarEvents.eventId],
  }),
}));

// Calendar Schema Insert Schemas
export const insertCalendarAccountSchema = createInsertSchema(calendarAccounts).omit({
  accountId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCalendarCalendarSchema = createInsertSchema(calendarCalendars).omit({
  calendarId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  eventId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCalendarAttendeeSchema = createInsertSchema(calendarAttendees).omit({
  attendeeId: true,
});

// Calendar Schema Types
export type CalendarAccount = typeof calendarAccounts.$inferSelect;
export type InsertCalendarAccount = z.infer<typeof insertCalendarAccountSchema>;

export type CalendarCalendar = typeof calendarCalendars.$inferSelect;
export type InsertCalendarCalendar = z.infer<typeof insertCalendarCalendarSchema>;

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

export type CalendarAttendee = typeof calendarAttendees.$inferSelect;
export type InsertCalendarAttendee = z.infer<typeof insertCalendarAttendeeSchema>;

// =============================================================================
// FINANCE SCHEMA TABLES
// =============================================================================

// Finance Categories - Hierarchical categories for income and expenses
export const financeCategories = financeSchema.table("categories", {
  categoryId: serial("category_id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => appWorkspaces.workspaceId, { onDelete: "cascade" }),
  parentCategoryId: integer("parent_category_id"),
  categoryName: varchar("category_name", { length: 100 }).notNull(),
});

// Finance Transactions - The immutable ledger of all past financial movements
export const financeTransactions = financeSchema.table("transactions", {
  transactionId: serial("transaction_id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  accountId: integer("account_id").references(() => financeAccounts.accountId), // Link to account
  transactionDate: varchar("transaction_date", { length: 10 }).notNull(), // DATE as string (YYYY-MM-DD)
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  description: text("description"),
  categoryId: integer("category_id").references(() => financeCategories.categoryId),
  contactId: integer("contact_id"), // References CRM contact when available
  createdByUserId: uuid("created_by_user_id").notNull().references(() => appUsers.userId),
});

// Finance Payables - Represents a single, specific bill to be paid
export const financePayables = financeSchema.table("payables", {
  payableId: serial("payable_id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  description: text("description").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0.00"),
  penaltyBalance: numeric("penalty_balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  dueDate: varchar("due_date", { length: 10 }).notNull(), // DATE as string (YYYY-MM-DD)
  status: payableStatusEnum("status").notNull().default("unpaid"),
  contactId: integer("contact_id"), // References CRM contact when available
  categoryId: integer("category_id").references(() => financeCategories.categoryId),
  moratoryRate: numeric("moratory_rate", { precision: 5, scale: 4 }).default("0.0000"), // Daily moratory interest rate
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Finance Payable Payments - Links transactions to the specific bills they are paying off
export const financePayablePayments = financeSchema.table("payable_payments", {
  paymentId: integer("payment_id").notNull().references(() => financeTransactions.transactionId, { onDelete: "cascade" }),
  payableId: integer("payable_id").notNull().references(() => financePayables.payableId, { onDelete: "cascade" }),
}, (table) => ({
  pk: {
    name: "payable_payments_pkey",
    columns: [table.paymentId, table.payableId]
  }
}));

// Finance Recurring Bills - Templates that generate Payables on a schedule
export const financeRecurringBills = financeSchema.table("recurring_bills", {
  recurringBillId: serial("recurring_bill_id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  description: text("description").notNull(),
  defaultAmount: numeric("default_amount", { precision: 12, scale: 2 }),
  recurrenceRule: text("recurrence_rule").notNull(), // iCal RRULE string
  nextDueDate: varchar("next_due_date", { length: 10 }).notNull(), // DATE as string (YYYY-MM-DD)
  contactId: integer("contact_id"), // References CRM contact when available
  categoryId: integer("category_id").references(() => financeCategories.categoryId),
});

// Finance Loans - Credit instruments with interest and payment schedules
export const financeLoans = financeSchema.table("loans", {
  loanId: serial("loan_id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  principalAmount: numeric("principal_amount", { precision: 12, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 4 }).notNull(),
  issueDate: varchar("issue_date", { length: 10 }).notNull(), // DATE as string (YYYY-MM-DD)
  termMonths: integer("term_months").notNull(),
  status: loanStatusEnum("status").notNull().default("active"),
  lenderContactId: integer("lender_contact_id"), // References CRM contact when available
  borrowerContactId: integer("borrower_contact_id"), // References CRM contact when available
  moratoryInterestRate: numeric("moratory_interest_rate", { precision: 5, scale: 4 }),
  moratoryInterestPeriod: interestPeriodTypeEnum("moratory_interest_period"),
});

// Finance Accounts - Bank accounts, credit cards, investment accounts, etc.
export const financeAccounts = financeSchema.table("accounts", {
  accountId: serial("account_id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  accountType: accountTypeEnum("account_type").notNull(),
  institutionName: varchar("institution_name", { length: 255 }),
  accountNumber: varchar("account_number", { length: 50 }), // Last 4 digits or masked number
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }).default("0.00"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Finance Loan Payments - Links transactions to loan payments with principal/interest breakdown
export const financeLoanPayments = financeSchema.table("loan_payments", {
  paymentId: integer("payment_id").notNull().references(() => financeTransactions.transactionId, { onDelete: "cascade" }),
  loanId: integer("loan_id").notNull().references(() => financeLoans.loanId, { onDelete: "cascade" }),
  principalPaid: numeric("principal_paid", { precision: 12, scale: 2 }).notNull(),
  interestPaid: numeric("interest_paid", { precision: 12, scale: 2 }).notNull(),
}, (table) => ({
  pk: {
    name: "loan_payments_pkey",
    columns: [table.paymentId, table.loanId]
  }
}));

// =============================================================================
// FINANCE SCHEMA RELATIONS
// =============================================================================

export const financeCategoriesRelations = relations(financeCategories, ({ one, many }) => ({
  workspace: one(appWorkspaces, {
    fields: [financeCategories.workspaceId],
    references: [appWorkspaces.workspaceId],
  }),
  parentCategory: one(financeCategories, {
    fields: [financeCategories.parentCategoryId],
    references: [financeCategories.categoryId],
  }),
  transactions: many(financeTransactions),
  recurringBills: many(financeRecurringBills),
}));

export const financeAccountsRelations = relations(financeAccounts, ({ one, many }) => ({
  space: one(appSpaces, {
    fields: [financeAccounts.spaceId],
    references: [appSpaces.spaceId],
  }),
  transactions: many(financeTransactions),
}));

export const financeTransactionsRelations = relations(financeTransactions, ({ one, many }) => ({
  space: one(appSpaces, {
    fields: [financeTransactions.spaceId],
    references: [appSpaces.spaceId],
  }),
  account: one(financeAccounts, {
    fields: [financeTransactions.accountId],
    references: [financeAccounts.accountId],
  }),
  category: one(financeCategories, {
    fields: [financeTransactions.categoryId],
    references: [financeCategories.categoryId],
  }),
  createdBy: one(appUsers, {
    fields: [financeTransactions.createdByUserId],
    references: [appUsers.userId],
  }),
  payablePayments: many(financePayablePayments),
  loanPayments: many(financeLoanPayments),
}));

export const financePayablesRelations = relations(financePayables, ({ one, many }) => ({
  space: one(appSpaces, {
    fields: [financePayables.spaceId],
    references: [appSpaces.spaceId],
  }),
  category: one(financeCategories, {
    fields: [financePayables.categoryId],
    references: [financeCategories.categoryId],
  }),
  payablePayments: many(financePayablePayments),
  linkedTask: one(crmTasks, {
    fields: [financePayables.payableId],
    references: [crmTasks.linkedPayableId],
  }),
}));

export const financePayablePaymentsRelations = relations(financePayablePayments, ({ one }) => ({
  payment: one(financeTransactions, {
    fields: [financePayablePayments.paymentId],
    references: [financeTransactions.transactionId],
  }),
  payable: one(financePayables, {
    fields: [financePayablePayments.payableId],
    references: [financePayables.payableId],
  }),
}));

export const financeRecurringBillsRelations = relations(financeRecurringBills, ({ one }) => ({
  space: one(appSpaces, {
    fields: [financeRecurringBills.spaceId],
    references: [appSpaces.spaceId],
  }),
  category: one(financeCategories, {
    fields: [financeRecurringBills.categoryId],
    references: [financeCategories.categoryId],
  }),
}));

export const financeLoansRelations = relations(financeLoans, ({ one, many }) => ({
  space: one(appSpaces, {
    fields: [financeLoans.spaceId],
    references: [appSpaces.spaceId],
  }),
  loanPayments: many(financeLoanPayments),
}));

export const financeLoanPaymentsRelations = relations(financeLoanPayments, ({ one }) => ({
  payment: one(financeTransactions, {
    fields: [financeLoanPayments.paymentId],
    references: [financeTransactions.transactionId],
  }),
  loan: one(financeLoans, {
    fields: [financeLoanPayments.loanId],
    references: [financeLoans.loanId],
  }),
}));

// =============================================================================
// FINANCE SCHEMA INSERT SCHEMAS
// =============================================================================

export const insertFinanceCategorySchema = createInsertSchema(financeCategories).omit({
  categoryId: true,
});

export const insertFinanceTransactionSchema = createInsertSchema(financeTransactions).omit({
  transactionId: true,
});

export const insertFinancePayableSchema = createInsertSchema(financePayables).omit({
  payableId: true,
});

export const insertFinancePayablePaymentSchema = createInsertSchema(financePayablePayments);

export const insertFinanceRecurringBillSchema = createInsertSchema(financeRecurringBills).omit({
  recurringBillId: true,
});

export const insertFinanceLoanSchema = createInsertSchema(financeLoans).omit({
  loanId: true,
});

export const insertFinanceLoanPaymentSchema = createInsertSchema(financeLoanPayments);

export const insertFinanceAccountSchema = createInsertSchema(financeAccounts).omit({
  accountId: true,
  createdAt: true,
  updatedAt: true,
});

// =============================================================================
// FINANCE SCHEMA TYPES
// =============================================================================

export type FinanceCategory = typeof financeCategories.$inferSelect;
export type InsertFinanceCategory = z.infer<typeof insertFinanceCategorySchema>;

export type FinanceAccount = typeof financeAccounts.$inferSelect;
export type InsertFinanceAccount = z.infer<typeof insertFinanceAccountSchema>;

export type FinanceTransaction = typeof financeTransactions.$inferSelect;
export type InsertFinanceTransaction = z.infer<typeof insertFinanceTransactionSchema>;

export type FinancePayable = typeof financePayables.$inferSelect;
export type InsertFinancePayable = z.infer<typeof insertFinancePayableSchema>;

export type FinancePayablePayment = typeof financePayablePayments.$inferSelect;
export type InsertFinancePayablePayment = z.infer<typeof insertFinancePayablePaymentSchema>;

export type FinanceRecurringBill = typeof financeRecurringBills.$inferSelect;
export type InsertFinanceRecurringBill = z.infer<typeof insertFinanceRecurringBillSchema>;

export type FinanceLoan = typeof financeLoans.$inferSelect;
export type InsertFinanceLoan = z.infer<typeof insertFinanceLoanSchema>;

export type FinanceLoanPayment = typeof financeLoanPayments.$inferSelect;
export type InsertFinanceLoanPayment = z.infer<typeof insertFinanceLoanPaymentSchema>;