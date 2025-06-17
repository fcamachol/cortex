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
});

export const whatsappContacts = pgTable("whatsapp_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id).notNull(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  
  // Evolution API fields
  remoteJid: varchar("remote_jid").notNull(), // Contact JID from Evolution
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
});

export const whatsappConversations = pgTable("whatsapp_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id).notNull(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  
  // Evolution API fields
  remoteJid: varchar("remote_jid").notNull(), // Chat JID from Evolution
  chatName: varchar("chat_name"),
  chatType: varchar("chat_type", { enum: ["individual", "group", "broadcast"] }).notNull(),
  
  // Chat status
  isArchived: boolean("is_archived").default(false),
  isPinned: boolean("is_pinned").default(false),
  isReadOnly: boolean("is_read_only").default(false),
  isMuted: boolean("is_muted").default(false),
  muteUntil: timestamp("mute_until"),
  
  // Message counts
  unreadCount: integer("unread_count").default(0),
  totalMessageCount: integer("total_message_count").default(0),
  
  // Last message info
  lastMessageId: varchar("last_message_id"),
  lastMessageContent: text("last_message_content"),
  lastMessageTimestamp: bigint("last_message_timestamp", { mode: "number" }),
  lastMessageFromMe: boolean("last_message_from_me").default(false),
  
  // Presence info
  presenceStatus: varchar("presence_status", { 
    enum: ["available", "unavailable", "composing", "recording", "paused"] 
  }).default("unavailable"),
  presenceLastSeen: timestamp("presence_last_seen"),
  
  // Group specific
  groupOwner: varchar("group_owner"), // Group owner JID
  groupDescription: text("group_description"),
  groupCreationTimestamp: bigint("group_creation_timestamp", { mode: "number" }),
  groupParticipantsCount: integer("group_participants_count").default(0),
  
  // Labels (Business Feature)
  labels: jsonb("labels"), // Array of label IDs
  
  // Additional CRM fields
  contactId: uuid("contact_id").references(() => whatsappContacts.id),
  title: varchar("title"),
  customWallpaper: varchar("custom_wallpaper"),
  notificationSettings: jsonb("notification_settings"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  instanceId: uuid("instance_id").references(() => whatsappInstances.id).notNull(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  conversationId: uuid("conversation_id").references(() => whatsappConversations.id).notNull(),
  
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
  interactiveType: varchar("interactive_type"), // button, list, etc.
  interactiveBody: text("interactive_body"),
  interactiveFooter: text("interactive_footer"),
  interactiveData: jsonb("interactive_data"),
  
  // Quoted/Reply messages
  quotedMessageId: varchar("quoted_message_id"),
  quotedContent: text("quoted_content"),
  
  // Reactions and mentions stored in JSONB
  reactions: jsonb("reactions"),
  mentions: jsonb("mentions"),
  
  // Forwarding
  isForwarded: boolean("is_forwarded").default(false),
  forwardScore: integer("forward_score").default(0),
  
  // Business features
  contextInfo: jsonb("context_info"),
  
  // Status and timestamps
  status: varchar("status", { enum: ["pending", "sent", "delivered", "read", "failed"] }).default("pending"),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(), // Unix timestamp from WhatsApp
  pushName: varchar("push_name"), // Sender's display name
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at")
});

// Task management
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => appUsers.id).notNull(),
  parentTaskId: uuid("parent_task_id"),
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
  replyToMessageId: uuid("reply_to_message_id"),
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
