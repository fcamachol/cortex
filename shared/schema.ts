import { pgTable, pgSchema, text, boolean, timestamp, uuid, integer, jsonb, bigint, varchar, serial, numeric, index, primaryKey, uniqueIndex, pgEnum, unique, date } from "drizzle-orm/pg-core";
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
export const spaceTypeEnum = appSchema.enum("space_type", ["workspace", "project", "team", "personal", "archive"]);
export const spacePrivacyEnum = appSchema.enum("space_privacy", ["public", "private", "restricted"]);
export const templateTypeEnum = appSchema.enum("template_type", ["space", "project", "task", "document"]);

// Enums for Calendar schema
export const providerTypeEnum = calendarSchema.enum("provider_type", ["google", "outlook", "apple"]);
export const syncStatusTypeEnum = calendarSchema.enum("sync_status_type", ["active", "revoked", "error", "pending"]);
export const attendeeResponseStatusEnum = calendarSchema.enum("attendee_response_status", ["needsAction", "declined", "tentative", "accepted"]);

// Enums for Finance schema
export const transactionTypeEnum = financeSchema.enum("transaction_type", ["income", "expense"]);
export const payableStatusEnum = financeSchema.enum("payable_status", ["unpaid", "partially_paid", "paid", "overdue"]);
export const receivableStatusEnum = financeSchema.enum("receivable_status", ["draft", "sent", "partially_paid", "paid", "overdue"]);
export const loanStatusEnum = financeSchema.enum("loan_status", ["active", "paid_off", "in_arrears"]);
export const interestPeriodTypeEnum = financeSchema.enum("interest_period_type", ["daily", "weekly", "monthly", "annually"]);
// Temporarily commented out due to existing enum in database
// export const accountTypeEnum = financeSchema.enum("account_type", [
//   "checking", "savings", "credit_card", "investment", "loan", "mortgage", 
//   "business", "cash", "crypto", "retirement", "other"
// ]);

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
  instanceName: varchar("instance_name", { length: 100 }).primaryKey(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  ownerJid: varchar("owner_jid", { length: 100 }).unique(),
  clientId: uuid("client_id").notNull(), // FK to users table
  instanceId: varchar("instance_id", { length: 255 }),
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
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
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
    columns: [table.jid, table.instanceName]
  }
}));

export const whatsappChats = whatsappSchema.table("chats", {
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
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
    columns: [table.chatId, table.instanceName]
  }
}));

export const whatsappMessages = whatsappSchema.table("messages", {
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
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
    columns: [table.messageId, table.instanceName]
  }
}));

export const whatsappMessageEditHistory = whatsappSchema.table("message_edit_history", {
  editId: serial("edit_id").primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  oldContent: text("old_content"),
  editTimestamp: timestamp("edit_timestamp", { withTimezone: true }).notNull(),
});

export const whatsappMessageMedia = whatsappSchema.table("message_media", {
  mediaId: serial("media_id").primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
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
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  reactorJid: varchar("reactor_jid", { length: 100 }).notNull(),
  reactionEmoji: varchar("reaction_emoji", { length: 10 }),
  fromMe: boolean("from_me").notNull().default(false),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
}, (table) => ({
  // Unique constraint allowing same message_id across different instances
  uq_reaction: uniqueIndex("uq_reaction").on(table.messageId, table.instanceName, table.reactorJid),
}));

export const whatsappMessageUpdates = whatsappSchema.table("message_updates", {
  updateId: serial("update_id").primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  status: messageStatusEnum("status").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
});

export const whatsappGroups = whatsappSchema.table("groups", {
  groupJid: varchar("group_jid", { length: 100 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description"),
  ownerJid: varchar("owner_jid", { length: 100 }),
  creationTimestamp: timestamp("creation_timestamp", { withTimezone: true }),
  isLocked: boolean("is_locked").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: {
    name: "groups_pkey",
    columns: [table.groupJid, table.instanceName]
  }
}));

export const whatsappGroupParticipants = whatsappSchema.table("group_participants", {
  groupJid: varchar("group_jid", { length: 100 }).notNull(),
  participantJid: varchar("participant_jid", { length: 100 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
}, (table) => ({
  pk: {
    name: "group_participants_pkey",
    columns: [table.groupJid, table.participantJid, table.instanceName]
  }
}));

export const whatsappLabels = whatsappSchema.table("labels", {
  labelId: varchar("label_id", { length: 100 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  colorIndex: integer("color_index"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: {
    name: "labels_pkey",
    columns: [table.labelId, table.instanceName]
  }
}));

export const whatsappChatLabels = whatsappSchema.table("chat_labels", {
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  labelId: varchar("label_id", { length: 100 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
}, (table) => ({
  pk: {
    name: "chat_labels_pkey",
    columns: [table.chatId, table.labelId, table.instanceName]
  }
}));

export const whatsappCallLogs = whatsappSchema.table("call_logs", {
  callLogId: varchar("call_log_id", { length: 255 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
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
    columns: [table.callLogId, table.instanceName]
  }
}));

export const whatsappMessageDeletions = whatsappSchema.table("message_deletions", {
  deletionId: varchar("deletion_id", { length: 255 }).primaryKey(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  deletedBy: varchar("deleted_by", { length: 100 }).notNull(), // JID of who deleted the message
  deletionType: varchar("deletion_type", { length: 50 }).notNull(), // 'sender', 'admin', 'everyone'
  originalContent: text("original_content"), // Content of deleted message if available
  originalTimestamp: timestamp("original_timestamp", { withTimezone: true }), // When message was originally sent
  deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow().notNull(),
  rawApiPayload: jsonb("raw_api_payload"), // Full webhook payload for debugging
}, (table) => ({
  messageIndex: index("message_deletions_message_idx").on(table.messageId, table.instanceName),
  chatIndex: index("message_deletions_chat_idx").on(table.chatId, table.instanceName),
  deletedAtIndex: index("message_deletions_deleted_at_idx").on(table.deletedAt),
}));

export const whatsappDrafts = whatsappSchema.table("drafts", {
  messageId: varchar("message_id", { length: 255 }).primaryKey(), // DRAFT000001 format
  chatId: varchar("chat_id", { length: 100 }).notNull(),
  instanceName: varchar("instance_name", { length: 100 }).notNull(),
  content: text("content").notNull(),
  replyToMessageId: varchar("reply_to_message_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  chatInstanceIdx: index("drafts_chat_instance_idx").on(table.chatId, table.instanceName),
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

// Enhanced Spaces table (Notion/ClickUp style)
export const appSpaces = appSchema.table("spaces", {
  spaceId: serial("space_id").primaryKey(),
  workspaceId: uuid("workspace_id").references(() => appWorkspaces.workspaceId),
  creatorUserId: uuid("creator_user_id").notNull().references(() => appUsers.userId),
  parentSpaceId: integer("parent_space_id").references(() => appSpaces.spaceId), // For hierarchical spaces
  spaceName: varchar("space_name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }).default("📁"),
  color: varchar("color", { length: 7 }).default("#3B82F6"),
  coverImage: varchar("cover_image", { length: 512 }),
  spaceType: spaceTypeEnum("space_type").notNull().default("workspace"),
  privacy: spacePrivacyEnum("privacy").notNull().default("private"),
  displayOrder: integer("display_order").notNull().default(0),
  isArchived: boolean("is_archived").notNull().default(false),
  isFavorite: boolean("is_favorite").notNull().default(false),
  settings: jsonb("settings").default({}), // Custom space settings
  templateId: integer("template_id").references(() => appSpaceTemplates.templateId),
  category: varchar("category", { length: 50 }), // Space category (work, personal, etc.)
  level: integer("level").default(0), // Hierarchical level for unlimited nesting
  path: text("path"), // Hierarchical path for efficient queries
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Space Templates table
export const appSpaceTemplates = appSchema.table("space_templates", {
  templateId: serial("template_id").primaryKey(),
  templateName: varchar("template_name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }).default("📋"),
  category: varchar("category", { length: 50 }).notNull(),
  templateType: templateTypeEnum("template_type").notNull(),
  config: jsonb("config").notNull(), // Template configuration
  isPublic: boolean("is_public").notNull().default(false),
  creatorUserId: uuid("creator_user_id").references(() => appUsers.userId),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Space Items table (content within spaces)
export const appSpaceItems = appSchema.table("space_items", {
  itemId: serial("item_id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId),
  itemType: varchar("item_type", { length: 50 }).notNull(),
  parentItemId: integer("parent_item_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  content: jsonb("content").default({}),
  referenceId: varchar("reference_id", { length: 255 }), // For linking to external entities (e.g., cj_ prefixed UUIDs for projects)
  status: varchar("status", { length: 50 }).default("active"),
  priority: varchar("priority", { length: 50 }).default("medium"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  assignedTo: varchar("assigned_to", { length: 255 }),
  tags: text("tags").array(),
  metadata: jsonb("metadata").default({}),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Space Views table (different ways to view space content)
export const appSpaceViews = appSchema.table("space_views", {
  viewId: serial("view_id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId),
  viewName: varchar("view_name", { length: 100 }).notNull(),
  viewType: varchar("view_type", { length: 50 }).notNull(), // list, board, calendar, timeline, table
  config: jsonb("config").notNull(), // View configuration (filters, sorting, grouping)
  isDefault: boolean("is_default").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  creatorUserId: uuid("creator_user_id").notNull().references(() => appUsers.userId),
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

export const insertAppSpaceItemSchema = createInsertSchema(appSpaceItems).omit({
  itemId: true,
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
export type AppSpaceItem = typeof appSpaceItems.$inferSelect;
export type InsertAppSpaceItem = z.infer<typeof insertAppSpaceItemSchema>;
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
  parentSpace: one(appSpaces, {
    fields: [appSpaces.parentSpaceId],
    references: [appSpaces.spaceId],
    relationName: "parentSpace",
  }),
  childSpaces: many(appSpaces, { relationName: "parentSpace" }),
  template: one(appSpaceTemplates, {
    fields: [appSpaces.templateId],
    references: [appSpaceTemplates.templateId],
  }),
  members: many(appSpaceMembers),
  items: many(appSpaceItems),
  views: many(appSpaceViews),
  tasks: many(crmTasks),
  projects: many(crmProjects),
}));

export const appSpaceTemplatesRelations = relations(appSpaceTemplates, ({ one, many }) => ({
  creator: one(appUsers, {
    fields: [appSpaceTemplates.creatorUserId],
    references: [appUsers.userId],
  }),
  spaces: many(appSpaces),
}));

export const appSpaceItemsRelations = relations(appSpaceItems, ({ one }) => ({
  space: one(appSpaces, {
    fields: [appSpaceItems.spaceId],
    references: [appSpaces.spaceId],
  }),
}));

export const appSpaceViewsRelations = relations(appSpaceViews, ({ one }) => ({
  space: one(appSpaces, {
    fields: [appSpaceViews.spaceId],
    references: [appSpaces.spaceId],
  }),
  creator: one(appUsers, {
    fields: [appSpaceViews.creatorUserId],
    references: [appUsers.userId],
  }),
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

// =============================================================================
// GOOGLE DRIVE-LIKE SPACES SYSTEM (UNIFIED WITH APP SCHEMA)
// =============================================================================

// Use existing app.spaces table as foundation for Google Drive-like functionality
// The appSpaces table already has comprehensive space management capabilities

// Drive-like aliases for existing app schema tables (to maintain existing API compatibility)
export const driveSpaces = appSpaces;
export const driveSpaceMembers = appSpaceMembers;
export const driveSpaceItems = appSpaceItems;

// Additional Google Drive-like functionality tables that extend the app schema
// Space sharing links (Google Drive share links) - adds public sharing to existing spaces
export const appSpaceShareLinks = appSchema.table("space_share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  linkToken: varchar("link_token", { length: 100 }).notNull().unique(),
  accessLevel: varchar("access_level", { length: 20 }).notNull(), // 'viewer', 'commenter', 'editor'
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  passwordHash: varchar("password_hash", { length: 255 }), // Optional password protection
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by").notNull(),
  accessCount: integer("access_count").default(0).notNull(),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
});

// Recent activity (Google Drive activity feed) - adds activity tracking to existing spaces
export const appSpaceActivity = appSchema.table("space_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  actorId: uuid("actor_id").notNull(), // Who performed the action
  actionType: varchar("action_type", { length: 50 }).notNull(), // 'created', 'updated', 'deleted', 'shared', 'moved', 'copied'
  targetType: varchar("target_type", { length: 20 }), // 'space', 'item', 'member'
  targetId: varchar("target_id", { length: 50 }), // ID of the target
  details: jsonb("details"), // Action-specific details
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata"),
});

// Drive-like aliases for the new tables
export const driveSpaceShareLinks = appSpaceShareLinks;
export const driveSpaceActivity = appSpaceActivity;

// Google Drive-like insert schemas using the existing app schema tables
export const insertDriveSpaceSchema = createInsertSchema(appSpaces).omit({
  spaceId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDriveSpaceMemberSchema = createInsertSchema(appSpaceMembers).omit({
  memberId: true,
  joinedAt: true,
});

export const insertDriveSpaceItemSchema = createInsertSchema(appSpaceItems).omit({
  itemId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDriveSpaceShareLinkSchema = createInsertSchema(appSpaceShareLinks).omit({
  id: true,
  createdAt: true,
});

export const insertDriveSpaceActivitySchema = createInsertSchema(appSpaceActivity).omit({
  id: true,
  createdAt: true,
});

// Google Drive-like types using the existing app schema tables
export type DriveSpace = typeof appSpaces.$inferSelect;
export type InsertDriveSpace = z.infer<typeof insertDriveSpaceSchema>;
export type DriveSpaceMember = typeof appSpaceMembers.$inferSelect;
export type InsertDriveSpaceMember = z.infer<typeof insertDriveSpaceMemberSchema>;
export type DriveSpaceItem = typeof appSpaceItems.$inferSelect;
export type InsertDriveSpaceItem = z.infer<typeof insertDriveSpaceItemSchema>;
export type DriveSpaceShareLink = typeof appSpaceShareLinks.$inferSelect;
export type InsertDriveSpaceShareLink = z.infer<typeof insertDriveSpaceShareLinkSchema>;
export type DriveSpaceActivity = typeof appSpaceActivity.$inferSelect;
export type InsertDriveSpaceActivity = z.infer<typeof insertDriveSpaceActivitySchema>;

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
  "create_task", "create_project", "create_note", "store_file", "create_document",
  "create_calendar_event", "send_message", "add_label", 
  "update_contact", "move_to_folder", "send_notification", "webhook",
  "create_space", "update_project_status", "create_checklist", "assign_to_space",
  "create_financial_record", "schedule_meeting", "create_invoice", "update_task_priority"
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

// CRM Companies - Business entities for loans, contracts, and business relationships (LEGACY - replaced by unified system)
export const crmCompaniesLegacy = crmSchema.table("companies_legacy", {
  companyId: serial("company_id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  businessType: varchar("business_type", { length: 100 }),
  taxId: varchar("tax_id", { length: 50 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  website: varchar("website", { length: 255 }),
  address: text("address"),
  notes: text("notes"),
  tags: jsonb("tags"),
  customFields: jsonb("custom_fields"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// =========================================================================
// COMPREHENSIVE CONTACTS & CRM MODULE - The 360-Degree Network Intelligence System
// =========================================================================

// Core Contacts - The parent entity for all personal contacts
export const crmContacts = crmSchema.table("contacts", {
  contactId: serial("contact_id").primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => appUsers.userId, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  relationship: varchar("relationship", { length: 100 }), // 'Family', 'Client', 'Friend', etc.
  tags: jsonb("tags").default('[]'), // Array of tags: ['Client', 'Friend', 'Partner']
  profilePictureUrl: varchar("profile_picture_url", { length: 500 }),
  notes: text("notes"),
  // Direct profession and company fields for simplified display
  profession: varchar("profession", { length: 150 }), // Direct profession field
  company: varchar("company", { length: 150 }), // Direct company field
  // WhatsApp Integration - Link to WhatsApp contacts
  whatsappJid: varchar("whatsapp_jid", { length: 100 }), // Links to whatsapp.contacts.contactJid
  whatsappInstanceId: varchar("whatsapp_instance_id", { length: 100 }), // Track which WhatsApp instance
  isWhatsappLinked: boolean("is_whatsapp_linked").default(false).notNull(),
  whatsappLinkedAt: timestamp("whatsapp_linked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Contact Phone Numbers - Multiple phone numbers per contact
export const crmContactPhones = crmSchema.table("contact_phones", {
  phoneId: serial("phone_id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => crmContacts.contactId, { onDelete: "cascade" }),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
  label: varchar("label", { length: 50 }), // 'Work', 'Mobile', 'Home', etc.
  isWhatsappLinked: boolean("is_whatsapp_linked").default(false).notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Contact Email Addresses - Multiple emails per contact
export const crmContactEmails = crmSchema.table("contact_emails", {
  emailId: serial("email_id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => crmContacts.contactId, { onDelete: "cascade" }),
  emailAddress: varchar("email_address", { length: 255 }).notNull(),
  label: varchar("label", { length: 50 }), // 'Work', 'Personal', etc.
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Contact Addresses - Multiple addresses per contact
export const crmContactAddresses = crmSchema.table("contact_addresses", {
  addressId: serial("address_id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => crmContacts.contactId, { onDelete: "cascade" }),
  label: varchar("label", { length: 50 }), // 'Home', 'Work', 'Billing', etc.
  street: varchar("street", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Contact Aliases/Nicknames - Multiple nicknames per contact
export const crmContactAliases = crmSchema.table("contact_aliases", {
  aliasId: serial("alias_id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => crmContacts.contactId, { onDelete: "cascade" }),
  alias: varchar("alias", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Special Date Categories
export const specialDateCategoryEnum = crmSchema.enum("special_date_category", ["birthday", "anniversary", "other"]);

// Special Dates - Important dates for contacts (birthdays, anniversaries, etc.)
export const crmSpecialDates = crmSchema.table("special_dates", {
  specialDateId: serial("special_date_id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => crmContacts.contactId, { onDelete: "cascade" }),
  eventName: varchar("event_name", { length: 100 }).notNull(), // 'Birthday', 'Anniversary', etc.
  category: specialDateCategoryEnum("category").notNull().default("other"), // Category for specific logic
  eventDay: integer("event_day").notNull(), // Day of month (1-31)
  eventMonth: integer("event_month").notNull(), // Month (1-12)
  originalYear: integer("original_year"), // Optional: for reference (birth year, wedding year, etc.)
  reminderDaysBefore: integer("reminder_days_before").default(7).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Interests - Master list of interests/hobbies
export const crmInterests = crmSchema.table("interests", {
  interestId: serial("interest_id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Contact Interests - Many-to-many relationship between contacts and interests
export const crmContactInterests = crmSchema.table("contact_interests", {
  contactId: integer("contact_id").notNull().references(() => crmContacts.contactId, { onDelete: "cascade" }),
  interestId: integer("interest_id").notNull().references(() => crmInterests.interestId, { onDelete: "cascade" }),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.contactId, table.interestId] }),
}));

// Company Members - Many-to-many relationship between contacts and companies
export const crmCompanyMembers = crmSchema.table("company_members", {
  contactId: integer("contact_id").notNull().references(() => crmContacts.contactId, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => crmCompanies.companyId, { onDelete: "cascade" }),
  role: varchar("role", { length: 150 }), // 'CEO', 'Contador', 'Manager', etc.
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  isCurrent: boolean("is_current").default(true).notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.contactId, table.companyId] }),
}));

// Contact Groups - Custom collections of contacts for flexible organization
export const crmContactGroups = crmSchema.table("contact_groups", {
  groupId: uuid("group_id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => appUsers.userId, { onDelete: "cascade" }),
  groupName: varchar("group_name", { length: 255 }).notNull(),
  groupDescription: text("group_description"),
  groupIcon: varchar("group_icon", { length: 255 }), // Emoji or icon identifier
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Contact Group Members - Junction table linking contacts to groups
export const crmContactGroupMembers = crmSchema.table("contact_group_members", {
  groupId: uuid("group_id").notNull().references(() => crmContactGroups.groupId, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull().references(() => crmContacts.contactId, { onDelete: "cascade" }),
  roleInGroup: varchar("role_in_group", { length: 255 }), // Optional role within the group
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  addedBy: uuid("added_by").notNull().references(() => appUsers.userId), // User who added this member
}, (table) => ({
  pk: primaryKey({ columns: [table.groupId, table.contactId] }),
}));

// Contact Relationships - Interpersonal links between contacts
export const crmContactRelationships = crmSchema.table("contact_relationships", {
  contactAId: integer("contact_a_id").notNull().references(() => crmContacts.contactId, { onDelete: "cascade" }),
  contactBId: integer("contact_b_id").notNull().references(() => crmContacts.contactId, { onDelete: "cascade" }),
  relationshipAToB: varchar("relationship_a_to_b", { length: 100 }), // 'Spouse', 'Parent', 'Child', etc.
  relationshipBToA: varchar("relationship_b_to_a", { length: 100 }), // Reverse relationship
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.contactAId, table.contactBId] }),
}));

// CRM Objects - Physical items, assets, products, or any trackable entity (LEGACY - replaced by unified system)
export const crmObjectsLegacy = crmSchema.table("objects_legacy", {
  objectId: varchar("object_id", { length: 50 }).primaryKey(), // co_ prefixed UUID
  ownerUserId: uuid("owner_user_id").notNull().references(() => appUsers.userId),
  spaceId: integer("space_id").references(() => appSpaces.spaceId),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // 'Asset', 'Product', 'Equipment', 'Vehicle', etc.
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  purchaseDate: varchar("purchase_date", { length: 10 }), // DATE as string
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
  currentValue: numeric("current_value", { precision: 12, scale: 2 }),
  condition: varchar("condition", { length: 50 }), // 'New', 'Good', 'Fair', 'Poor'
  location: varchar("location", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("active"), // 'active', 'sold', 'lost', 'damaged'
  tags: text("tags").array(),
  imageUrls: text("image_urls").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ===== UNIFIED ENTITY SYSTEM =====
// Core entities use prefixed UUIDs (cp_, cc_, cg_, co_, ca_, cv_, cj_, ce_)
// Content entities use standard UUIDs for high-volume data

// Core Entity Types
export const crmPersons = crmSchema.table("persons", {
  id: varchar("id", { length: 50 }).primaryKey(), // cp_ prefixed UUID
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }),
  displayName: varchar("display_name", { length: 200 }),
  profession: varchar("profession", { length: 100 }),
  description: text("description"),
  avatar: text("avatar"),
  tags: jsonb("tags").$type<string[]>(),
  status: varchar("status", { length: 20 }).default("active"), // active, inactive, archived
  spaceId: integer("space_id").references(() => appSpaces.spaceId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmCompanies = crmSchema.table("companies", {
  companyId: serial("company_id").primaryKey(),
  spaceId: integer("space_id").references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  businessType: varchar("business_type", { length: 100 }),
  taxId: varchar("tax_id", { length: 100 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  website: varchar("website", { length: 255 }),
  address: text("address"),
  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>(),
  customFields: jsonb("custom_fields").$type<Record<string, any>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmGroups = crmSchema.table("groups", {
  id: varchar("id", { length: 50 }).primaryKey(), // cg_ prefixed UUID
  name: varchar("name", { length: 200 }).notNull(),
  type: varchar("type", { length: 50 }), // team, family, category, etc.
  description: text("description"),
  color: varchar("color", { length: 7 }), // hex color
  tags: text("tags").array(),
  parentGroupId: varchar("parent_group_id", { length: 50 }), // self-reference for hierarchy
  status: varchar("status", { length: 20 }).default("active"),
  // WhatsApp linking fields
  whatsappJid: varchar("whatsapp_jid", { length: 200 }),
  whatsappInstanceId: varchar("whatsapp_instance_id", { length: 50 }),
  whatsappLinkedAt: timestamp("whatsapp_linked_at", { withTimezone: true }),
  isWhatsappLinked: boolean("is_whatsapp_linked").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// UNIFIED SYSTEM - CRM Objects with prefixed UUIDs
export const crmObjects = crmSchema.table("objects", {
  id: varchar("id", { length: 50 }).primaryKey(), // co_ prefixed UUID
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  purchaseDate: varchar("purchase_date", { length: 10 }), // YYYY-MM-DD
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }),
  currentValue: numeric("current_value", { precision: 12, scale: 2 }),
  condition: varchar("condition", { length: 50 }), // new, good, fair, poor
  location: varchar("location", { length: 200 }),
  tags: jsonb("tags").$type<string[]>(),
  images: jsonb("images").$type<string[]>(),
  status: varchar("status", { length: 20 }).default("active"),
  spaceId: integer("space_id").references(() => appSpaces.spaceId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmAccounts = crmSchema.table("accounts", {
  id: varchar("id", { length: 50 }).primaryKey(), // ca_ prefixed UUID
  name: varchar("name", { length: 200 }).notNull(),
  accountType: varchar("account_type", { length: 50 }).notNull(), // checking, savings, credit, investment, etc.
  accountNumber: varchar("account_number", { length: 100 }),
  bankName: varchar("bank_name", { length: 200 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  balance: numeric("balance", { precision: 15, scale: 2 }).default("0.00"),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
  interestRate: numeric("interest_rate", { precision: 5, scale: 4 }),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>(),
  status: varchar("status", { length: 20 }).default("active"),
  spaceId: integer("space_id").references(() => appSpaces.spaceId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmVendors = crmSchema.table("vendors", {
  id: varchar("id", { length: 50 }).primaryKey(), // cv_ prefixed UUID
  name: varchar("name", { length: 200 }).notNull(),
  vendorType: varchar("vendor_type", { length: 100 }), // supplier, service_provider, contractor, etc.
  contactPerson: varchar("contact_person", { length: 200 }),
  email: varchar("email", { length: 300 }),
  phone: varchar("phone", { length: 50 }),
  website: varchar("website", { length: 300 }),
  taxId: varchar("tax_id", { length: 50 }),
  paymentTerms: varchar("payment_terms", { length: 100 }),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>(),
  rating: integer("rating"), // 1-5 stars
  status: varchar("status", { length: 20 }).default("active"),
  spaceId: integer("space_id").references(() => appSpaces.spaceId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmProjects = crmSchema.table("projects", {
  id: varchar("id", { length: 50 }).primaryKey(), // cj_ prefixed UUID
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("active"), 
  priority: varchar("priority", { length: 20 }).default("medium"), // low, medium, high, urgent
  startDate: date("start_date"), 
  endDate: date("end_date"),
  budget: numeric("budget", { precision: 15, scale: 2 }),
  spentAmount: numeric("spent_amount", { precision: 15, scale: 2 }).default("0.00"),
  progress: integer("progress").default(0), // 0-100 percentage
  tags: jsonb("tags").$type<string[]>(),
  color: varchar("color", { length: 7 }), // hex color
  parentProjectId: varchar("parent_project_id", { length: 50 }), // self-reference for sub-projects
  userId: uuid("user_id").notNull().references(() => appUsers.userId), // Link to authenticated users
  ownerUserId: uuid("owner_user_id").references(() => appUsers.userId), // Current owner
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmEvents = crmSchema.table("events", {
  id: varchar("id", { length: 50 }).primaryKey(), // ce_ prefixed UUID
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  eventType: varchar("event_type", { length: 50 }), // meeting, appointment, deadline, milestone, etc.
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  allDay: boolean("all_day").default(false),
  location: varchar("location", { length: 300 }),
  isRecurring: boolean("is_recurring").default(false),
  recurrenceRule: text("recurrence_rule"), // RRULE format
  status: varchar("status", { length: 20 }).default("scheduled"), // scheduled, completed, cancelled
  priority: varchar("priority", { length: 20 }).default("medium"),
  tags: jsonb("tags").$type<string[]>(),
  color: varchar("color", { length: 7 }),
  spaceId: integer("space_id").references(() => appSpaces.spaceId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});



// Content Entities (Standard UUIDs for high-volume data)
export const crmTasks = crmSchema.table("tasks", {
  id: varchar("id", { length: 50 }).primaryKey(), // ct_ prefixed UUID for unified entity system
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("to_do"), // to_do, in_progress, done, cancelled
  priority: varchar("priority", { length: 20 }).default("medium"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  estimatedHours: numeric("estimated_hours", { precision: 5, scale: 2 }),
  actualHours: numeric("actual_hours", { precision: 5, scale: 2 }),
  parentTaskId: varchar("parent_task_id", { length: 50 }), // hierarchical tasks using ct_ prefix
  tags: jsonb("tags").$type<string[]>(),
  userId: uuid("user_id").notNull().references(() => appUsers.userId), // Link to authenticated users
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmNotes = crmSchema.table("notes", {
  id: varchar("id", { length: 36 }).primaryKey(), // standard UUID
  title: varchar("title", { length: 300 }),
  content: text("content").notNull(),
  format: varchar("format", { length: 20 }).default("markdown"), // markdown, html, plain
  tags: jsonb("tags").$type<string[]>(),
  isPinned: boolean("is_pinned").default(false),
  isArchived: boolean("is_archived").default(false),
  searchVector: text("search_vector"), // for full-text search
  spaceId: integer("space_id").references(() => appSpaces.spaceId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmDocuments = crmSchema.table("documents", {
  id: varchar("id", { length: 36 }).primaryKey(), // standard UUID  
  filename: varchar("filename", { length: 300 }).notNull(),
  originalName: varchar("original_name", { length: 300 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  version: integer("version").default(1),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>(),
  isArchived: boolean("is_archived").default(false),
  spaceId: integer("space_id").references(() => appSpaces.spaceId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Universal Relationship Tables
export const entityRelationships = crmSchema.table("entity_relationships", {
  id: varchar("id", { length: 36 }).primaryKey(), // standard UUID
  fromEntityId: varchar("from_entity_id", { length: 50 }).notNull(),
  toEntityId: varchar("to_entity_id", { length: 50 }).notNull(),
  relationshipType: varchar("relationship_type", { length: 100 }).notNull(),
  description: text("description"),
  strength: integer("strength").default(1), // 1-10 relationship strength
  bidirectional: boolean("bidirectional").default(false),
  tags: jsonb("tags").$type<string[]>(),
  validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueRelation: unique().on(table.fromEntityId, table.toEntityId, table.relationshipType)
}));

// Content-to-Entity Linking Tables
export const taskEntities = crmSchema.table("task_entities", {
  taskId: varchar("task_id", { length: 36 }).references(() => crmTasks.id).notNull(),
  entityId: varchar("entity_id", { length: 50 }).notNull(),
  relationshipType: varchar("relationship_type", { length: 100 }).notNull(), // assigned_to, created_for, depends_on, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.taskId, table.entityId, table.relationshipType] })
}));

export const noteEntities = crmSchema.table("note_entities", {
  noteId: varchar("note_id", { length: 36 }).references(() => crmNotes.id).notNull(),
  entityId: varchar("entity_id", { length: 50 }).notNull(),
  relationshipType: varchar("relationship_type", { length: 100 }).notNull(), // about, mentions, taken_during, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.noteId, table.entityId, table.relationshipType] })
}));

export const documentEntities = crmSchema.table("document_entities", {
  documentId: varchar("document_id", { length: 36 }).references(() => crmDocuments.id).notNull(),
  entityId: varchar("entity_id", { length: 50 }).notNull(),
  relationshipType: varchar("relationship_type", { length: 100 }).notNull(), // belongs_to, signed_by, related_to, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.documentId, table.entityId, table.relationshipType] })
}));

// Activity Logging
export const activityLog = crmSchema.table("activity_log", {
  id: varchar("id", { length: 36 }).primaryKey(),
  entityId: varchar("entity_id", { length: 50 }).notNull(),
  activityType: varchar("activity_type", { length: 50 }).notNull(), // created, updated, deleted, linked, etc.
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  userId: integer("user_id"), // references users if available
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

// Tagging System
export const tags = crmSchema.table("tags", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }),
  category: varchar("category", { length: 50 }),
  description: text("description"),
  spaceId: integer("space_id").references(() => appSpaces.spaceId),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueName: unique().on(table.name, table.spaceId)
}));

export const entityTags = crmSchema.table("entity_tags", {
  entityId: varchar("entity_id", { length: 50 }).notNull(),
  tagId: varchar("tag_id", { length: 36 }).references(() => tags.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.entityId, table.tagId] })
}));

// Entity Activities - Junction table for linking entities to activities
export const entityActivities = crmSchema.table("entity_activities", {
  entityId: varchar("entity_id", { length: 50 }).notNull(), // cp_, cc_, cg_, co_, ca_, cv_, cj_, ce_ prefixed
  activityType: varchar("activity_type", { length: 20 }).notNull(), // task, event, note, payable, receivable, loan
  activityId: varchar("activity_id", { length: 36 }).notNull(), // Standard UUID for activity
  relationship: varchar("relationship", { length: 50 }), // owner, assignee, participant, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.entityId, table.activityType, table.activityId] })
}));

// CRM Tasks - Legacy main task management table (replaced by unified system)
export const crmTasksLegacy = crmSchema.table("tasks_legacy", {
  taskId: serial("task_id").primaryKey(),
  instanceId: varchar("instance_id", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("to_do"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  priority: varchar("priority", { length: 50 }).default("medium"),
  taskType: varchar("task_type", { length: 50 }).default("task"),
  projectId: integer("project_id").references(() => crmProjects.projectId),
  parentTaskId: integer("parent_task_id"),
  triggeringMessageId: varchar("triggering_message_id", { length: 100 }),
  assignedToUserId: uuid("assigned_to_user_id"),
  relatedChatJid: varchar("related_chat_jid", { length: 100 }),
  senderJid: varchar("sender_jid", { length: 100 }),
  contactName: varchar("contact_name", { length: 255 }),
  originalMessageContent: text("original_message_content"),
  createdByUserId: uuid("created_by_user_id"),
  linkedPayableId: integer("linked_payable_id").references(() => financePayables.payableId), // Link to bill/payable
  entityId: varchar("entity_id", { length: 50 }), // Unified entity ID (cp_, cg_, cc_, co_)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  spaceId: integer("space_id"),
});

// CRM Calendar Events - Source of truth for internal app events
export const crmCalendarEvents = crmSchema.table("calendar_events", {
  eventId: serial("event_id").primaryKey(),
  instanceId: varchar("instance_id", { length: 100 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  location: varchar("location", { length: 512 }),
  isAllDay: boolean("is_all_day").notNull().default(false),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => appUsers.userId),
  triggeringMessageId: varchar("triggering_message_id", { length: 100 }),
  projectId: integer("project_id"),
  taskId: integer("task_id"),
  relatedChatJid: varchar("related_chat_jid", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  spaceId: integer("space_id"),
});

// CRM Notes - Standalone notes with optional entity linking (LEGACY - replaced by unified system)
export const crmNotesLegacy = crmSchema.table("notes_legacy", {
  noteId: serial("note_id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => appUsers.userId),
  instanceId: varchar("instance_id", { length: 100 }),
  spaceId: integer("space_id").references(() => appSpaces.spaceId),
  // Optional entity linking
  contactId: integer("contact_id").references(() => crmContacts.contactId),
  taskId: integer("task_id").references(() => crmTasksLegacy.taskId),
  projectId: integer("project_id"),
  eventId: integer("event_id").references(() => crmCalendarEvents.eventId),
  companyId: integer("company_id").references(() => crmCompaniesLegacy.companyId),
  entityId: varchar("entity_id", { length: 50 }), // Unified entity ID (cp_, cg_, cc_, co_)
  // WhatsApp context
  triggeringMessageId: varchar("triggering_message_id", { length: 100 }),
  relatedChatJid: varchar("related_chat_jid", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// CRM Event Attendees - Many-to-many relationship between events and users
export const crmEventAttendees = crmSchema.table("event_attendees", {
  eventId: integer("event_id").notNull().references(() => crmCalendarEvents.eventId, { onDelete: "cascade" }),
  attendeeUserId: uuid("attendee_user_id").notNull().references(() => appUsers.userId, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).default("pending"), // pending, accepted, declined, tentative
}, (table) => ({
  pk: primaryKey({ columns: [table.eventId, table.attendeeUserId] }),
}));

// =========================================================================
// CRM RELATIONS - Comprehensive relationship definitions
// =========================================================================

// Core Contact Relations
export const crmContactsRelations = relations(crmContacts, ({ one, many }) => ({
  owner: one(appUsers, {
    fields: [crmContacts.ownerUserId],
    references: [appUsers.userId],
  }),
  phones: many(crmContactPhones),
  emails: many(crmContactEmails),
  addresses: many(crmContactAddresses),
  aliases: many(crmContactAliases),
  specialDates: many(crmSpecialDates),
  interests: many(crmContactInterests),
  companyMemberships: many(crmCompanyMembers),
  groupMemberships: many(crmContactGroupMembers),
  relationshipsAsA: many(crmContactRelationships, { relationName: "contactA" }),
  relationshipsAsB: many(crmContactRelationships, { relationName: "contactB" }),
}));

// Contact Phone Relations
export const crmContactPhonesRelations = relations(crmContactPhones, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmContactPhones.contactId],
    references: [crmContacts.contactId],
  }),
}));

// Contact Email Relations
export const crmContactEmailsRelations = relations(crmContactEmails, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmContactEmails.contactId],
    references: [crmContacts.contactId],
  }),
}));

// Contact Address Relations
export const crmContactAddressesRelations = relations(crmContactAddresses, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmContactAddresses.contactId],
    references: [crmContacts.contactId],
  }),
}));

// Contact Alias Relations
export const crmContactAliasesRelations = relations(crmContactAliases, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmContactAliases.contactId],
    references: [crmContacts.contactId],
  }),
}));

// Special Dates Relations
export const crmSpecialDatesRelations = relations(crmSpecialDates, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmSpecialDates.contactId],
    references: [crmContacts.contactId],
  }),
}));

// Interest Relations
export const crmInterestsRelations = relations(crmInterests, ({ many }) => ({
  contactInterests: many(crmContactInterests),
}));

// Contact Interest Relations
export const crmContactInterestsRelations = relations(crmContactInterests, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmContactInterests.contactId],
    references: [crmContacts.contactId],
  }),
  interest: one(crmInterests, {
    fields: [crmContactInterests.interestId],
    references: [crmInterests.interestId],
  }),
}));

// Company Member Relations
export const crmCompanyMembersRelations = relations(crmCompanyMembers, ({ one }) => ({
  contact: one(crmContacts, {
    fields: [crmCompanyMembers.contactId],
    references: [crmContacts.contactId],
  }),
  company: one(crmCompanies, {
    fields: [crmCompanyMembers.companyId],
    references: [crmCompanies.companyId],
  }),
}));

// Updated Company Relations
export const crmCompaniesRelations = relations(crmCompanies, ({ one, many }) => ({
  space: one(appSpaces, {
    fields: [crmCompanies.spaceId],
    references: [appSpaces.spaceId],
  }),
  members: many(crmCompanyMembers),
}));

// Contact Group Relations
export const crmContactGroupsRelations = relations(crmContactGroups, ({ one, many }) => ({
  owner: one(appUsers, {
    fields: [crmContactGroups.ownerUserId],
    references: [appUsers.userId],
  }),
  members: many(crmContactGroupMembers),
}));

// Contact Group Member Relations
export const crmContactGroupMembersRelations = relations(crmContactGroupMembers, ({ one }) => ({
  group: one(crmContactGroups, {
    fields: [crmContactGroupMembers.groupId],
    references: [crmContactGroups.groupId],
  }),
  contact: one(crmContacts, {
    fields: [crmContactGroupMembers.contactId],
    references: [crmContacts.contactId],
  }),
  addedByUser: one(appUsers, {
    fields: [crmContactGroupMembers.addedBy],
    references: [appUsers.userId],
  }),
}));

// Contact Relationship Relations
export const crmContactRelationshipsRelations = relations(crmContactRelationships, ({ one }) => ({
  contactA: one(crmContacts, {
    fields: [crmContactRelationships.contactAId],
    references: [crmContacts.contactId],
    relationName: "contactA",
  }),
  contactB: one(crmContacts, {
    fields: [crmContactRelationships.contactBId],
    references: [crmContacts.contactId],
    relationName: "contactB",
  }),
}));

// CRM Projects Relations
export const crmProjectsRelations = relations(crmProjects, ({ one, many }) => ({
  instance: one(whatsappInstances, {
    fields: [crmProjects.instanceId],
    references: [whatsappInstances.instanceId],
  }),
  space: one(appSpaces, {
    fields: [crmProjects.spaceId],
    references: [appSpaces.spaceId],
  }),
  tasks: many(crmTasks),
}));

// CRM Tasks Relations
export const crmTasksRelations = relations(crmTasks, ({ one }) => ({
  instance: one(whatsappInstances, {
    fields: [crmTasks.instanceId],
    references: [whatsappInstances.instanceId],
  }),
  project: one(crmProjects, {
    fields: [crmTasks.projectId],
    references: [crmProjects.projectId],
  }),
  space: one(appSpaces, {
    fields: [crmTasks.spaceId],
    references: [appSpaces.spaceId],
  }),
  linkedPayable: one(financePayables, {
    fields: [crmTasks.linkedPayableId],
    references: [financePayables.payableId],
  }),
}));

// =========================================================================
// CRM INSERT SCHEMAS & TYPES - Complete type safety for all entities
// =========================================================================

// Core Contact Schemas
export const insertCrmContactSchema = createInsertSchema(crmContacts).omit({
  contactId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmContactPhoneSchema = createInsertSchema(crmContactPhones).omit({
  phoneId: true,
  createdAt: true,
});

export const insertCrmContactEmailSchema = createInsertSchema(crmContactEmails).omit({
  emailId: true,
  createdAt: true,
});

export const insertCrmContactAddressSchema = createInsertSchema(crmContactAddresses).omit({
  addressId: true,
  createdAt: true,
});

export const insertCrmContactAliasSchema = createInsertSchema(crmContactAliases).omit({
  aliasId: true,
  createdAt: true,
});

export const insertCrmSpecialDateSchema = createInsertSchema(crmSpecialDates).omit({
  specialDateId: true,
  createdAt: true,
});

export const insertCrmInterestSchema = createInsertSchema(crmInterests).omit({
  interestId: true,
  createdAt: true,
});

export const insertCrmContactInterestSchema = createInsertSchema(crmContactInterests).omit({
  addedAt: true,
});

export const insertCrmCompanyMemberSchema = createInsertSchema(crmCompanyMembers).omit({
  addedAt: true,
});

export const insertCrmContactRelationshipSchema = createInsertSchema(crmContactRelationships).omit({
  createdAt: true,
});

// Existing schemas
export const insertCrmProjectSchema = createInsertSchema(crmProjects).omit({
  projectId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmTaskSchema = createInsertSchema(crmTasks).omit({
  taskId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmCompanySchema = createInsertSchema(crmCompanies).omit({
  companyId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmObjectSchema = createInsertSchema(crmObjects).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCrmContactGroupSchema = createInsertSchema(crmContactGroups).omit({
  groupId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmContactGroupMemberSchema = createInsertSchema(crmContactGroupMembers).omit({
  addedAt: true,
});

export const insertCrmNotesSchema = createInsertSchema(crmNotes).omit({
  noteId: true,
  createdAt: true,
  updatedAt: true,
});

// =========================================================================
// COMPREHENSIVE CRM TYPES - Complete TypeScript definitions
// =========================================================================

// Core Contact Types
export type CrmContact = typeof crmContacts.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type CrmContactPhone = typeof crmContactPhones.$inferSelect;
export type InsertCrmContactPhone = z.infer<typeof insertCrmContactPhoneSchema>;
export type CrmContactEmail = typeof crmContactEmails.$inferSelect;
export type InsertCrmContactEmail = z.infer<typeof insertCrmContactEmailSchema>;
export type CrmContactAddress = typeof crmContactAddresses.$inferSelect;
export type InsertCrmContactAddress = z.infer<typeof insertCrmContactAddressSchema>;
export type CrmContactAlias = typeof crmContactAliases.$inferSelect;
export type InsertCrmContactAlias = z.infer<typeof insertCrmContactAliasSchema>;
export type CrmSpecialDate = typeof crmSpecialDates.$inferSelect;
export type InsertCrmSpecialDate = z.infer<typeof insertCrmSpecialDateSchema>;
export type CrmInterest = typeof crmInterests.$inferSelect;
export type InsertCrmInterest = z.infer<typeof insertCrmInterestSchema>;
export type CrmContactInterest = typeof crmContactInterests.$inferSelect;
export type InsertCrmContactInterest = z.infer<typeof insertCrmContactInterestSchema>;
export type CrmCompanyMember = typeof crmCompanyMembers.$inferSelect;
export type InsertCrmCompanyMember = z.infer<typeof insertCrmCompanyMemberSchema>;
export type CrmContactRelationship = typeof crmContactRelationships.$inferSelect;
export type InsertCrmContactRelationship = z.infer<typeof insertCrmContactRelationshipSchema>;

// Existing Types
export type CrmProject = typeof crmProjects.$inferSelect;
export type InsertCrmProject = z.infer<typeof insertCrmProjectSchema>;
export type CrmTask = typeof crmTasks.$inferSelect;
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;
export type CrmCompany = typeof crmCompanies.$inferSelect;
export type InsertCrmCompany = z.infer<typeof insertCrmCompanySchema>;
export type CrmObject = typeof crmObjects.$inferSelect;
export type InsertCrmObject = z.infer<typeof insertCrmObjectSchema>;
export type CrmContactGroup = typeof crmContactGroups.$inferSelect;
export type InsertCrmContactGroup = z.infer<typeof insertCrmContactGroupSchema>;
export type CrmContactGroupMember = typeof crmContactGroupMembers.$inferSelect;
export type InsertCrmContactGroupMember = z.infer<typeof insertCrmContactGroupMemberSchema>;

// =========================================================================
// COMPREHENSIVE CONTACT WITH RELATIONS TYPE - For 360-degree view
// =========================================================================
export type ContactWithRelations = CrmContact & {
  phones: CrmContactPhone[];
  emails: CrmContactEmail[];
  addresses: CrmContactAddress[];
  aliases: CrmContactAlias[];
  specialDates: CrmSpecialDate[];
  interests: (CrmContactInterest & { interest: CrmInterest })[];
  companyMemberships: (CrmCompanyMember & { company: CrmCompany })[];
  groupMemberships: (CrmContactGroupMember & { group: CrmContactGroup })[];
  relationshipsAsA: (CrmContactRelationship & { contactB: CrmContact })[];
  relationshipsAsB: (CrmContactRelationship & { contactA: CrmContact })[];
};

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
  crmEvent: one(crmCalendarEvents, {
    fields: [calendarEvents.crmEventId],
    references: [crmCalendarEvents.eventId],
  }),
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

// Finance Receivables - Represents invoices or money owed to you
export const financeReceivables = financeSchema.table("receivables", {
  receivableId: serial("receivable_id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  description: text("description").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  amountReceived: numeric("amount_received", { precision: 12, scale: 2 }).notNull().default("0.00"),
  issueDate: varchar("issue_date", { length: 10 }).notNull(), // DATE as string (YYYY-MM-DD)
  dueDate: varchar("due_date", { length: 10 }), // DATE as string (YYYY-MM-DD) - optional
  status: receivableStatusEnum("status").notNull().default("draft"),
  contactId: integer("contact_id"), // References CRM contact when available
  categoryId: integer("category_id").references(() => financeCategories.categoryId),
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

// Finance Receivable Payments - Links income transactions to the specific receivables they are settling
export const financeReceivablePayments = financeSchema.table("receivable_payments", {
  paymentId: integer("payment_id").notNull().references(() => financeTransactions.transactionId, { onDelete: "cascade" }),
  receivableId: integer("receivable_id").notNull().references(() => financeReceivables.receivableId, { onDelete: "cascade" }),
}, (table) => ({
  pk: {
    name: "receivable_payments_pkey",
    columns: [table.paymentId, table.receivableId]
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
  interestType: varchar("interest_type", { length: 20 }).notNull().default("simple"), // 'simple' or 'compound'
  startDate: varchar("start_date", { length: 10 }).notNull(), // DATE as string (YYYY-MM-DD)
  termMonths: integer("term_months").notNull(),
  paymentFrequency: varchar("payment_frequency", { length: 20 }).notNull().default("monthly"), // monthly, weekly, etc
  purpose: varchar("purpose", { length: 100 }), // loan purpose
  collateral: text("collateral"), // collateral description
  status: loanStatusEnum("status").notNull().default("active"),
  // Polymorphic lender relationship - can be a contact or company
  lenderContactId: integer("lender_contact_id"), // ID of the contact or company (lender)
  lenderType: varchar("lender_type", { length: 20 }), // 'contact' or 'company'
  // Polymorphic borrower relationship - can be a contact or company
  borrowerContactId: integer("borrower_contact_id"), // ID of the contact or company (borrower)
  borrowerType: varchar("borrower_type", { length: 20 }), // 'contact' or 'company'
  moratoryInterestRate: numeric("moratory_interest_rate", { precision: 5, scale: 4 }),
  moratoryInterestPeriod: interestPeriodTypeEnum("moratory_interest_period"),
});

// Finance Accounts - Bank accounts, credit cards, investment accounts, etc.
export const financeAccounts = financeSchema.table("accounts", {
  accountId: serial("account_id").primaryKey(),
  spaceId: integer("space_id").notNull().references(() => appSpaces.spaceId, { onDelete: "cascade" }),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  accountType: varchar("account_type", { length: 50 }).notNull(), // Temporarily using varchar instead of enum
  institutionName: varchar("institution_name", { length: 255 }),
  accountNumber: varchar("account_number", { length: 50 }), // Last 4 digits or masked number
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }).default("0.00"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  isActive: boolean("is_active").notNull().default(true),
  last4Digits: varchar("last_4_digits", { length: 4 }), // For display purposes
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Credit Card Details - Specific information for credit card accounts
export const creditCardDetails = financeSchema.table("credit_card_details", {
  accountId: integer("account_id").primaryKey().references(() => financeAccounts.accountId, { onDelete: "cascade" }),
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }).notNull(),
  apr: numeric("apr", { precision: 6, scale: 4 }).notNull(), // Annual Percentage Rate
  statementClosingDay: integer("statement_closing_day").notNull(), // Day of month (1-31)
  paymentDueDaysAfterStatement: integer("payment_due_days_after_statement").notNull().default(21),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Statements - Historical record of monthly credit card statements
export const statements = financeSchema.table("statements", {
  statementId: serial("statement_id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => financeAccounts.accountId, { onDelete: "cascade" }),
  statementPeriodStart: varchar("statement_period_start", { length: 10 }).notNull(), // DATE as string
  statementPeriodEnd: varchar("statement_period_end", { length: 10 }).notNull(), // DATE as string
  closingBalance: numeric("closing_balance", { precision: 12, scale: 2 }).notNull(),
  minimumPaymentDue: numeric("minimum_payment_due", { precision: 12, scale: 2 }).notNull(),
  paymentDueDate: varchar("payment_due_date", { length: 10 }).notNull(), // DATE as string
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
  creditCardDetails: one(creditCardDetails, {
    fields: [financeAccounts.accountId],
    references: [creditCardDetails.accountId],
  }),
  statements: many(statements),
}));

export const creditCardDetailsRelations = relations(creditCardDetails, ({ one }) => ({
  account: one(financeAccounts, {
    fields: [creditCardDetails.accountId],
    references: [financeAccounts.accountId],
  }),
}));

export const statementsRelations = relations(statements, ({ one }) => ({
  account: one(financeAccounts, {
    fields: [statements.accountId],
    references: [financeAccounts.accountId],
  }),
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
  receivablePayments: many(financeReceivablePayments),
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

export const financeReceivablesRelations = relations(financeReceivables, ({ one, many }) => ({
  space: one(appSpaces, {
    fields: [financeReceivables.spaceId],
    references: [appSpaces.spaceId],
  }),
  category: one(financeCategories, {
    fields: [financeReceivables.categoryId],
    references: [financeCategories.categoryId],
  }),
  receivablePayments: many(financeReceivablePayments),
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

export const financeReceivablePaymentsRelations = relations(financeReceivablePayments, ({ one }) => ({
  payment: one(financeTransactions, {
    fields: [financeReceivablePayments.paymentId],
    references: [financeTransactions.transactionId],
  }),
  receivable: one(financeReceivables, {
    fields: [financeReceivablePayments.receivableId],
    references: [financeReceivables.receivableId],
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

export const insertFinanceReceivableSchema = createInsertSchema(financeReceivables).omit({
  receivableId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFinanceReceivablePaymentSchema = createInsertSchema(financeReceivablePayments);

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

export const insertCreditCardDetailsSchema = createInsertSchema(creditCardDetails).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertStatementSchema = createInsertSchema(statements).omit({
  statementId: true,
  createdAt: true,
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

export type FinanceReceivable = typeof financeReceivables.$inferSelect;
export type InsertFinanceReceivable = z.infer<typeof insertFinanceReceivableSchema>;

export type FinanceReceivablePayment = typeof financeReceivablePayments.$inferSelect;
export type InsertFinanceReceivablePayment = z.infer<typeof insertFinanceReceivablePaymentSchema>;

export type FinanceRecurringBill = typeof financeRecurringBills.$inferSelect;
export type InsertFinanceRecurringBill = z.infer<typeof insertFinanceRecurringBillSchema>;

export type FinanceLoan = typeof financeLoans.$inferSelect;
export type InsertFinanceLoan = z.infer<typeof insertFinanceLoanSchema>;

export type FinanceLoanPayment = typeof financeLoanPayments.$inferSelect;
export type InsertFinanceLoanPayment = z.infer<typeof insertFinanceLoanPaymentSchema>;

export type CreditCardDetails = typeof creditCardDetails.$inferSelect;
export type InsertCreditCardDetails = z.infer<typeof insertCreditCardDetailsSchema>;

export type Statement = typeof statements.$inferSelect;

// Unified Entity System Insert Schemas
export const insertCrmGroupSchema = createInsertSchema(crmGroups).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCrmEventSchema = createInsertSchema(crmEvents).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCrmAccountSchema = createInsertSchema(crmAccounts).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCrmVendorSchema = createInsertSchema(crmVendors).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCrmNoteSchema = createInsertSchema(crmNotes).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCrmDocumentSchema = createInsertSchema(crmDocuments).omit({
  createdAt: true,
  updatedAt: true,
});

// Unified Entity System Type Definitions
export type CrmContact = typeof crmContacts.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;

export type CrmGroup = typeof crmGroups.$inferSelect;
export type InsertCrmGroup = z.infer<typeof insertCrmGroupSchema>;

export type CrmCompany = typeof crmCompanies.$inferSelect;
export type InsertCrmCompany = z.infer<typeof insertCrmCompanySchema>;

export type CrmObject = typeof crmObjects.$inferSelect;
export type InsertCrmObject = z.infer<typeof insertCrmObjectSchema>;

export type CrmProject = typeof crmProjects.$inferSelect;
export type InsertCrmProject = z.infer<typeof insertCrmProjectSchema>;

export type CrmEvent = typeof crmEvents.$inferSelect;
export type InsertCrmEvent = z.infer<typeof insertCrmEventSchema>;

export type CrmAccount = typeof crmAccounts.$inferSelect;
export type InsertCrmAccount = z.infer<typeof insertCrmAccountSchema>;

export type CrmVendor = typeof crmVendors.$inferSelect;
export type InsertCrmVendor = z.infer<typeof insertCrmVendorSchema>;

// Content Entity Types (Standard UUIDs)
export type CrmTask = typeof crmTasks.$inferSelect;
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;

export type CrmNote = typeof crmNotes.$inferSelect;
export type InsertCrmNote = z.infer<typeof insertCrmNoteSchema>;

export type CrmDocument = typeof crmDocuments.$inferSelect;
export type InsertCrmDocument = z.infer<typeof insertCrmDocumentSchema>;

// Junction Tables
export type EntityActivity = typeof entityActivities.$inferSelect;
export type InsertEntityActivity = z.infer<typeof insertEntityActivitySchema>;

export type EntityTag = typeof entityTags.$inferSelect;
export type InsertEntityTag = z.infer<typeof insertEntityTagSchema>;

// Unified Entity ID Type Union
export type EntityId = 
  | `cp_${string}` // Contacts (Persons)
  | `cc_${string}` // Companies
  | `cg_${string}` // Groups
  | `co_${string}` // Objects
  | `ca_${string}` // Financial Accounts
  | `cv_${string}` // Vendors
  | `cj_${string}` // Projects
  | `ce_${string}`; // Events

// Entity Activity Linking System
export const insertEntityActivitySchema = createInsertSchema(entityActivities);
export const insertEntityTagSchema = createInsertSchema(entityTags);

export type InsertStatement = z.infer<typeof insertStatementSchema>;