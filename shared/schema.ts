import { pgTable, pgSchema, text, boolean, timestamp, uuid, integer, jsonb, bigint, varchar, serial, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Create whatsapp schema
export const whatsappSchema = pgSchema("whatsapp");

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
  ownerJid: varchar("owner_jid", { length: 100 }).unique(),
  clientId: uuid("client_id").notNull(), // FK to users table
  apiKey: varchar("api_key", { length: 255 }),
  webhookUrl: varchar("webhook_url", { length: 255 }),
  isConnected: boolean("is_connected").default(false).notNull(),
  lastConnectionAt: timestamp("last_connection_at", { withTimezone: true }),
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
}));

// Insert and Select schemas
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

// Legacy aliases for backward compatibility
export type InsertWhatsappConversation = InsertWhatsappChat;
export type WhatsappConversation = WhatsappChat;