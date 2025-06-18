import { pgTable, text, serial, integer, boolean, timestamp, uuid, varchar, jsonb, bigint, numeric, date, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User management - user_id is the primary identifier
export const appUsers = pgTable("app_users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
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

// WhatsApp integration - composite key with user_id and instance_name
export const whatsappInstances = pgTable("whatsapp_instances", {
  userId: uuid("user_id").references(() => appUsers.userId).notNull(),
  instanceName: varchar("instance_name").notNull(),
  displayName: varchar("display_name"),
  instanceApiKey: varchar("instance_api_key"),
  webhookUrl: varchar("webhook_url"),
  phoneNumber: varchar("phone_number"),
  profileName: varchar("profile_name"),
  profilePictureUrl: varchar("profile_picture_url"),
  status: varchar("status", { enum: ["connected", "disconnected", "connecting", "error", "qr_pending", "created", "creation_failed"] }).default("disconnected"),
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
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.instanceName] })
  };
});

// WhatsApp contacts - composite key with user_id and remote_jid
export const whatsappContacts = pgTable("whatsapp_contacts", {
  userId: uuid("user_id").references(() => appUsers.userId).notNull(),
  instanceName: varchar("instance_name").notNull(),
  remoteJid: varchar("remote_jid").notNull(), // Contact JID from Evolution
  
  // Evolution API fields
  pushName: varchar("push_name"), // Display name from WhatsApp
  profileName: varchar("profile_name"), // Profile name
  profilePictureUrl: varchar("profile_picture_url"),
  profilePictureThumb: varchar("profile_picture_thumb"),
  phoneNumber: varchar("phone_number"),
  
  // Business info
  isBusiness: boolean("is_business").default(false),
  isEnterprise: boolean("is_enterprise").default(false),
  isMyContact: boolean("is_my_contact").default(false),
  isPsa: boolean("is_psa").default(false), // Public Service Announcement
  isUser: boolean("is_user").default(true),
  isWaContact: boolean("is_wa_contact").default(true),
  statusMessage: text("status_message"),
  
  businessName: varchar("business_name"),
  businessCategory: varchar("business_category"),
  businessDescription: text("business_description"),
  businessWebsite: varchar("business_website"),
  businessEmail: varchar("business_email"),
  businessAddress: text("business_address"),
  
  // Additional custom fields for CRM
  isBlocked: boolean("is_blocked").default(false),
  isFavorite: boolean("is_favorite").default(false),
  notes: text("notes"),
  tags: jsonb("tags"),
  labels: jsonb("labels"),
  customFields: jsonb("custom_fields"),
  
  // Timestamps
  lastSeen: timestamp("last_seen"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.remoteJid] })
  };
});

// WhatsApp conversations - composite key with user_id and remote_jid
export const whatsappConversations = pgTable("whatsapp_conversations", {
  userId: uuid("user_id").references(() => appUsers.userId).notNull(),
  instanceName: varchar("instance_name").notNull(),
  remoteJid: varchar("remote_jid").notNull(), // Chat JID from Evolution
  
  // Evolution API fields
  chatName: varchar("chat_name"),
  chatType: varchar("chat_type", { enum: ["individual", "group", "broadcast"] }).default("individual"),
  isGroup: boolean("is_group").default(false),
  groupOwner: varchar("group_owner"),
  groupDescription: text("group_description"),
  groupSubject: varchar("group_subject"),
  groupPictureUrl: varchar("group_picture_url"),
  
  // Participants for group chats
  participantCount: integer("participant_count").default(0),
  participants: jsonb("participants"),
  admins: jsonb("admins"),
  
  // Chat settings
  isMuted: boolean("is_muted").default(false),
  mutedUntil: timestamp("muted_until"),
  isPinned: boolean("is_pinned").default(false),
  isArchived: boolean("is_archived").default(false),
  isBlocked: boolean("is_blocked").default(false),
  
  // Message counts and status
  unreadCount: integer("unread_count").default(0),
  lastMessageTimestamp: bigint("last_message_timestamp", { mode: "number" }),
  lastMessagePreview: text("last_message_preview"),
  lastMessageFromMe: boolean("last_message_from_me").default(false),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.remoteJid] })
  };
});

// WhatsApp messages - use UUID for message ID but include user_id for RLS
export const whatsappMessages = pgTable("whatsapp_messages", {
  messageId: uuid("message_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.userId).notNull(),
  instanceName: varchar("instance_name").notNull(),
  conversationJid: varchar("conversation_jid").notNull(),
  
  // Evolution API fields
  evolutionMessageId: varchar("evolution_message_id").notNull(), // Evolution API message ID
  remoteJid: varchar("remote_jid").notNull(), // Chat/Contact JID from Evolution
  fromMe: boolean("from_me").notNull().default(false),
  participant: varchar("participant"), // For group messages
  
  // Message content (JSON for flexibility as per Evolution schema)
  messageContent: jsonb("message_content"),
  
  // Message types from Evolution API
  messageType: varchar("message_type", { 
    enum: ["conversation", "extendedTextMessage", "imageMessage", "videoMessage", 
           "audioMessage", "documentMessage", "stickerMessage", "locationMessage",
           "contactMessage", "listResponseMessage", "buttonsResponseMessage",
           "templateButtonReplyMessage", "pollCreationMessage", "pollUpdateMessage"] 
  }).notNull(),
  
  // Text content
  textContent: text("text_content"),
  
  // Media fields
  mediaUrl: text("media_url"),
  mediaMimetype: varchar("media_mimetype"),
  mediaSize: bigint("media_size", { mode: "number" }),
  mediaFilename: varchar("media_filename"),
  mediaCaption: text("media_caption"),
  mediaThumbUrl: text("media_thumb_url"),
  
  // Document specific
  documentTitle: varchar("document_title"),
  documentPageCount: integer("document_page_count"),
  
  // Location fields
  locationLatitude: numeric("location_latitude", { precision: 10, scale: 8 }),
  locationLongitude: numeric("location_longitude", { precision: 11, scale: 8 }),
  locationName: varchar("location_name"),
  locationAddress: text("location_address"),
  
  // Contact message
  contactDisplayName: varchar("contact_display_name"),
  contactVcard: text("contact_vcard"),
  
  // Interactive messages
  interactiveType: varchar("interactive_type"),
  interactiveBody: text("interactive_body"),
  interactiveFooter: text("interactive_footer"),
  interactiveData: jsonb("interactive_data"),
  
  // Message status and metadata
  status: varchar("status", { enum: ["pending", "sent", "delivered", "read", "failed"] }).default("pending"),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  
  // Quoted message
  quotedMessageId: varchar("quoted_message_id"),
  quotedRemoteJid: varchar("quoted_remote_jid"),
  quotedParticipant: varchar("quoted_participant"),
  quotedContent: text("quoted_content"),
  
  // Reactions
  reactionEmoji: varchar("reaction_emoji"),
  reactionFromMe: boolean("reaction_from_me").default(false),
  
  // Forward info
  isForwarded: boolean("is_forwarded").default(false),
  forwardScore: integer("forward_score").default(0),
  
  // Context info
  contextInfo: jsonb("context_info"),
  pushName: varchar("push_name"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Evolution API raw messages table (no foreign key constraints) - use user_id for RLS
export const evolutionMessages = pgTable("evolution_messages", {
  messageId: varchar("message_id").primaryKey(), // Use provided message ID from Evolution API
  userId: uuid("user_id").notNull(), // For RLS
  instanceName: varchar("instance_name").notNull(),
  
  // Evolution API fields
  evolutionMessageId: varchar("evolution_message_id").notNull(),
  remoteJid: varchar("remote_jid").notNull(),
  fromMe: boolean("from_me").notNull().default(false),
  participant: varchar("participant"),
  pushName: varchar("push_name"),
  
  // Message content
  messageContent: jsonb("message_content"),
  messageType: varchar("message_type").notNull(),
  textContent: text("text_content"),
  
  // Media fields
  mediaUrl: text("media_url"),
  mediaMimetype: varchar("media_mimetype"),
  mediaSize: bigint("media_size", { mode: "number" }),
  mediaFilename: varchar("media_filename"),
  mediaCaption: text("media_caption"),
  
  // Status and metadata
  status: varchar("status").default("received"),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  contextInfo: jsonb("context_info"),
  
  // Raw webhook data for debugging
  rawWebhookData: jsonb("raw_webhook_data"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Task management - use user_id as primary key component
export const tasks = pgTable("tasks", {
  taskId: uuid("task_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.userId).notNull(),
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

// Contact management - use user_id as primary key component
export const contacts = pgTable("contacts", {
  contactId: uuid("contact_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.userId).notNull(),
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

// Conversations management - use user_id as primary key component
export const conversations = pgTable("conversations", {
  conversationId: uuid("conversation_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.userId).notNull(),
  title: varchar("title"),
  description: text("description"),
  status: varchar("status").default("active"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Messages management - use user_id for RLS
export const messages = pgTable("messages", {
  messageId: uuid("message_id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.userId).notNull(),
  conversationId: uuid("conversation_id").references(() => conversations.conversationId).notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type").default("text"),
  fromUser: boolean("from_user").default(true),
  replyToMessageId: uuid("reply_to_message_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
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
    references: [appUsers.userId]
  })
}));

export const whatsappContactsRelations = relations(whatsappContacts, ({ one }) => ({
  user: one(appUsers, {
    fields: [whatsappContacts.userId],
    references: [appUsers.userId]
  })
}));

export const whatsappConversationsRelations = relations(whatsappConversations, ({ one, many }) => ({
  user: one(appUsers, {
    fields: [whatsappConversations.userId],
    references: [appUsers.userId]
  }),
  messages: many(whatsappMessages)
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  user: one(appUsers, {
    fields: [whatsappMessages.userId],
    references: [appUsers.userId]
  })
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(appUsers, {
    fields: [tasks.userId],
    references: [appUsers.userId]
  })
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(appUsers, {
    fields: [contacts.userId],
    references: [appUsers.userId]
  })
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(appUsers, {
    fields: [conversations.userId],
    references: [appUsers.userId]
  }),
  messages: many(messages)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(appUsers, {
    fields: [messages.userId],
    references: [appUsers.userId]
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.conversationId]
  }),
  replyToMessage: one(messages, {
    fields: [messages.replyToMessageId],
    references: [messages.messageId]
  })
}));

// Insert schemas
export const insertAppUserSchema = createInsertSchema(appUsers).omit({
  userId: true,
  createdAt: true,
  updatedAt: true
});

export const insertWhatsappInstanceSchema = createInsertSchema(whatsappInstances).omit({
  createdAt: true,
  updatedAt: true
});

export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts).omit({
  createdAt: true,
  updatedAt: true
});

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversations).omit({
  createdAt: true,
  updatedAt: true
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  messageId: true,
  createdAt: true,
  updatedAt: true
});

export const insertEvolutionMessageSchema = createInsertSchema(evolutionMessages).omit({
  messageId: true,
  createdAt: true,
  updatedAt: true
});

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

export type EvolutionMessage = typeof evolutionMessages.$inferSelect;
export type InsertEvolutionMessage = z.infer<typeof insertEvolutionMessageSchema>;