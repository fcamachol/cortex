import { pgTable, text, serial, integer, boolean, timestamp, uuid, varchar, jsonb, bigint, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User management
export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email").notNull().unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  avatarUrl: varchar("avatar_url"),
  passwordHash: varchar("password_hash").notNull(),
  emailVerified: boolean("email_verified").default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  status: varchar("status", { enum: ["pending", "active", "suspended", "deleted"] }).default("pending"),
  plan: varchar("plan", { enum: ["free", "basic", "premium", "enterprise"] }).default("free"),
  maxInstances: integer("max_instances").default(1),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// WhatsApp integration
export const whatsappInstances = pgTable("whatsapp_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  instanceName: varchar("instance_name").notNull().unique(),
  displayName: varchar("display_name"),
  apiKey: varchar("api_key").notNull(),
  webhookUrl: varchar("webhook_url"),
  phoneNumber: varchar("phone_number"),
  profileName: varchar("profile_name"),
  profilePictureUrl: varchar("profile_picture_url"),
  status: varchar("status", { enum: ["connected", "disconnected", "connecting", "error", "qr_pending"] }).default("disconnected"),
  qrCode: text("qr_code"),
  qrExpiresAt: timestamp("qr_expires_at"),
  lastConnectedAt: timestamp("last_connected_at"),
  disconnectedAt: timestamp("disconnected_at"),
  lastError: text("last_error"),
  connectionRetries: integer("connection_retries").default(0),
  webhookEvents: jsonb("webhook_events"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const whatsappContacts = pgTable("whatsapp_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id).notNull(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  whatsappId: varchar("whatsapp_id").notNull(),
  name: varchar("name"),
  displayName: varchar("display_name"),
  profilePictureUrl: varchar("profile_picture_url"),
  isBusiness: boolean("is_business").default(false),
  businessDescription: text("business_description"),
  isBlocked: boolean("is_blocked").default(false),
  isFavorite: boolean("is_favorite").default(false),
  lastSeenAt: timestamp("last_seen_at"),
  lastMessageAt: timestamp("last_message_at"),
  notes: text("notes"),
  tags: jsonb("tags"),
  labels: jsonb("labels"),
  customFields: jsonb("custom_fields"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const whatsappConversations = pgTable("whatsapp_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id).notNull(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  chatId: varchar("chat_id").notNull(),
  type: varchar("type", { enum: ["individual", "group"] }).notNull(),
  contactId: uuid("contact_id").references(() => whatsappContacts.id),
  title: varchar("title"),
  lastMessageId: uuid("last_message_id"),
  unreadCount: integer("unread_count").default(0),
  isPinned: boolean("is_pinned").default(false),
  isArchived: boolean("is_archived").default(false),
  isMuted: boolean("is_muted").default(false),
  muteUntil: timestamp("mute_until"),
  customWallpaper: varchar("custom_wallpaper"),
  notificationSettings: jsonb("notification_settings"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id).notNull(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  conversationId: uuid("conversation_id").references(() => whatsappConversations.id).notNull(),
  messageId: varchar("message_id").notNull(),
  fromNumber: varchar("from_number").notNull(),
  toNumber: varchar("to_number").notNull(),
  messageType: varchar("message_type", { enum: ["text", "image", "video", "audio", "document", "location", "contact", "sticker", "reaction", "system", "poll", "list", "button"] }).notNull(),
  whatsappMessageType: varchar("whatsapp_message_type"),
  content: text("content"),
  mediaUrl: text("media_url"),
  mediaFilename: varchar("media_filename"),
  mediaMimetype: varchar("media_mimetype"),
  mediaSize: integer("media_size"),
  mediaDuration: integer("media_duration"),
  locationLatitude: numeric("location_latitude"),
  locationLongitude: numeric("location_longitude"),
  locationName: varchar("location_name"),
  locationAddress: text("location_address"),
  quotedMessageId: varchar("quoted_message_id"),
  quotedMessageContent: text("quoted_message_content"),
  isFromMe: boolean("is_from_me").notNull(),
  isForwarded: boolean("is_forwarded").default(false),
  forwardScore: integer("forward_score").default(0),
  isStarred: boolean("is_starred").default(false),
  mentions: jsonb("mentions"),
  reactionEmoji: varchar("reaction_emoji"),
  reactionTargetId: varchar("reaction_target_id"),
  participantJid: varchar("participant_jid"),
  remoteJid: varchar("remote_jid"),
  pushName: varchar("push_name"),
  broadcastListOwner: varchar("broadcast_list_owner"),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  messageTimestamp: bigint("message_timestamp", { mode: "number" }),
  editedAt: bigint("edited_at", { mode: "number" }),
  status: varchar("status", { enum: ["pending", "sent", "delivered", "read", "failed"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at")
});

// Task management
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  parentTaskId: uuid("parent_task_id").references(() => tasks.id),
  title: text("title").notNull(),
  description: text("description"),
  taskStatus: text("task_status").default("to_do"),
  subStatus: text("sub_status"),
  priority: text("priority").default("medium"),
  dueDate: timestamp("due_date"),
  conversationId: uuid("conversation_id").references(() => whatsappConversations.id),
  contactId: uuid("contact_id").references(() => whatsappContacts.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Contact management
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  avatar: text("avatar"),
  address: text("address"),
  birthday: date("birthday"),
  notes: text("notes"),
  interests: text("interests"),
  company: text("company"),
  jobTitle: text("job_title"),
  website: text("website"),
  socialMedia: jsonb("social_media").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  contactId: uuid("contact_id").references(() => contacts.id).notNull(),
  isPinned: boolean("is_pinned").default(false),
  isUnread: boolean("is_unread").default(false),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").default("text"),
  isFromUser: boolean("is_from_user").default(false),
  replyToMessageId: uuid("reply_to_message_id").references(() => messages.id),
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow()
});

// Relations
export const appUsersRelations = relations(appUsers, ({ many }) => ({
  whatsappInstances: many(whatsappInstances),
  whatsappContacts: many(whatsappContacts),
  whatsappConversations: many(whatsappConversations),
  whatsappMessages: many(whatsappMessages),
  tasks: many(tasks),
  contacts: many(contacts),
  conversations: many(conversations),
  messages: many(messages)
}));

export const whatsappInstancesRelations = relations(whatsappInstances, ({ one, many }) => ({
  user: one(appUsers, {
    fields: [whatsappInstances.userId],
    references: [appUsers.id]
  }),
  contacts: many(whatsappContacts),
  conversations: many(whatsappConversations),
  messages: many(whatsappMessages)
}));

export const whatsappContactsRelations = relations(whatsappContacts, ({ one, many }) => ({
  user: one(appUsers, {
    fields: [whatsappContacts.userId],
    references: [appUsers.id]
  }),
  instance: one(whatsappInstances, {
    fields: [whatsappContacts.instanceId],
    references: [whatsappInstances.id]
  }),
  conversations: many(whatsappConversations)
}));

export const whatsappConversationsRelations = relations(whatsappConversations, ({ one, many }) => ({
  user: one(appUsers, {
    fields: [whatsappConversations.userId],
    references: [appUsers.id]
  }),
  instance: one(whatsappInstances, {
    fields: [whatsappConversations.instanceId],
    references: [whatsappInstances.id]
  }),
  contact: one(whatsappContacts, {
    fields: [whatsappConversations.contactId],
    references: [whatsappContacts.id]
  }),
  messages: many(whatsappMessages)
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  user: one(appUsers, {
    fields: [whatsappMessages.userId],
    references: [appUsers.id]
  }),
  instance: one(whatsappInstances, {
    fields: [whatsappMessages.instanceId],
    references: [whatsappInstances.id]
  }),
  conversation: one(whatsappConversations, {
    fields: [whatsappMessages.conversationId],
    references: [whatsappConversations.id]
  })
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(appUsers, {
    fields: [tasks.userId],
    references: [appUsers.id]
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id]
  }),
  subtasks: many(tasks),
  conversation: one(whatsappConversations, {
    fields: [tasks.conversationId],
    references: [whatsappConversations.id]
  }),
  contact: one(whatsappContacts, {
    fields: [tasks.contactId],
    references: [whatsappContacts.id]
  })
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  user: one(appUsers, {
    fields: [contacts.userId],
    references: [appUsers.id]
  }),
  conversations: many(conversations)
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(appUsers, {
    fields: [conversations.userId],
    references: [appUsers.id]
  }),
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id]
  }),
  messages: many(messages)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(appUsers, {
    fields: [messages.userId],
    references: [appUsers.id]
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  replyToMessage: one(messages, {
    fields: [messages.replyToMessageId],
    references: [messages.id]
  })
}));

// Insert schemas
export const insertAppUserSchema = createInsertSchema(appUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertWhatsappInstanceSchema = createInsertSchema(whatsappInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  createdAt: true,
  deletedAt: true
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true
});

// Types
export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;

export type WhatsappInstance = typeof whatsappInstances.$inferSelect;
export type InsertWhatsappInstance = z.infer<typeof insertWhatsappInstanceSchema>;

export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;

export type WhatsappConversation = typeof whatsappConversations.$inferSelect;
export type InsertWhatsappConversation = z.infer<typeof insertWhatsappConversationSchema>;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
