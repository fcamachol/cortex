import { 
  appUsers, 
  whatsappInstances, 
  whatsappContacts, 
  whatsappConversations, 
  whatsappMessages,
  tasks,
  contacts,
  conversations,
  messages,
  type AppUser, 
  type InsertAppUser,
  type WhatsappInstance,
  type InsertWhatsappInstance,
  type WhatsappContact,
  type InsertWhatsappContact,
  type WhatsappConversation,
  type InsertWhatsappConversation,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type Task,
  type InsertTask,
  type Contact,
  type InsertContact,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ilike } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<AppUser | undefined>;
  getUserByEmail(email: string): Promise<AppUser | undefined>;
  createUser(user: InsertAppUser): Promise<AppUser>;
  updateUser(id: string, user: Partial<InsertAppUser>): Promise<AppUser>;

  // WhatsApp instances
  getWhatsappInstances(userId: string): Promise<WhatsappInstance[]>;
  getWhatsappInstance(id: string): Promise<WhatsappInstance | undefined>;
  createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance>;
  updateWhatsappInstance(id: string, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance>;
  deleteWhatsappInstance(id: string): Promise<void>;

  // WhatsApp contacts
  getWhatsappContacts(userId: string, instanceId?: string): Promise<WhatsappContact[]>;
  getWhatsappContact(id: string): Promise<WhatsappContact | undefined>;
  createWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact>;
  updateWhatsappContact(id: string, contact: Partial<InsertWhatsappContact>): Promise<WhatsappContact>;
  deleteWhatsappContact(id: string): Promise<void>;

  // WhatsApp conversations
  getWhatsappConversations(userId: string, instanceId?: string): Promise<WhatsappConversation[]>;
  getWhatsappConversation(id: string): Promise<WhatsappConversation | undefined>;
  createWhatsappConversation(conversation: InsertWhatsappConversation): Promise<WhatsappConversation>;
  updateWhatsappConversation(id: string, conversation: Partial<InsertWhatsappConversation>): Promise<WhatsappConversation>;
  deleteWhatsappConversation(id: string): Promise<void>;

  // WhatsApp messages
  getWhatsappMessages(conversationId: string, limit?: number): Promise<WhatsappMessage[]>;
  getWhatsappMessage(id: string): Promise<WhatsappMessage | undefined>;
  createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  updateWhatsappMessage(id: string, message: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage>;
  deleteWhatsappMessage(id: string): Promise<void>;

  // Tasks
  getTasks(userId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Contacts
  getContacts(userId: string, search?: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

  // Conversations
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, conversation: Partial<InsertConversation>): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;

  // Messages
  getMessages(conversationId: string, limit?: number): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, message: Partial<InsertMessage>): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User management
  async getUser(id: string): Promise<AppUser | undefined> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<AppUser | undefined> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertAppUser): Promise<AppUser> {
    const [user] = await db.insert(appUsers).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updateUser: Partial<InsertAppUser>): Promise<AppUser> {
    const [user] = await db.update(appUsers).set({ ...updateUser, updatedAt: new Date() }).where(eq(appUsers.id, id)).returning();
    return user;
  }

  // WhatsApp instances
  async getWhatsappInstances(userId: string): Promise<WhatsappInstance[]> {
    return await db.select().from(whatsappInstances).where(eq(whatsappInstances.userId, userId));
  }

  async getWhatsappInstance(id: string): Promise<WhatsappInstance | undefined> {
    const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.id, id));
    return instance || undefined;
  }

  async createWhatsappInstance(insertInstance: InsertWhatsappInstance): Promise<WhatsappInstance> {
    const [instance] = await db.insert(whatsappInstances).values(insertInstance).returning();
    return instance;
  }

  async updateWhatsappInstance(id: string, updateInstance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance> {
    const [instance] = await db.update(whatsappInstances).set({ ...updateInstance, updatedAt: new Date() }).where(eq(whatsappInstances.id, id)).returning();
    return instance;
  }

  async deleteWhatsappInstance(id: string): Promise<void> {
    await db.delete(whatsappInstances).where(eq(whatsappInstances.id, id));
  }

  // WhatsApp contacts
  async getWhatsappContacts(userId: string, instanceId?: string): Promise<WhatsappContact[]> {
    const whereClause = instanceId 
      ? and(eq(whatsappContacts.userId, userId), eq(whatsappContacts.instanceId, instanceId))
      : eq(whatsappContacts.userId, userId);
    
    return await db.select().from(whatsappContacts).where(whereClause).orderBy(desc(whatsappContacts.lastMessageAt));
  }

  async getWhatsappContact(id: string): Promise<WhatsappContact | undefined> {
    const [contact] = await db.select().from(whatsappContacts).where(eq(whatsappContacts.id, id));
    return contact || undefined;
  }

  async createWhatsappContact(insertContact: InsertWhatsappContact): Promise<WhatsappContact> {
    const [contact] = await db.insert(whatsappContacts).values(insertContact).returning();
    return contact;
  }

  async updateWhatsappContact(id: string, updateContact: Partial<InsertWhatsappContact>): Promise<WhatsappContact> {
    const [contact] = await db.update(whatsappContacts).set({ ...updateContact, updatedAt: new Date() }).where(eq(whatsappContacts.id, id)).returning();
    return contact;
  }

  async deleteWhatsappContact(id: string): Promise<void> {
    await db.delete(whatsappContacts).where(eq(whatsappContacts.id, id));
  }

  // WhatsApp conversations
  async getWhatsappConversations(userId: string, instanceId?: string): Promise<WhatsappConversation[]> {
    const whereClause = instanceId 
      ? and(eq(whatsappConversations.userId, userId), eq(whatsappConversations.instanceId, instanceId))
      : eq(whatsappConversations.userId, userId);
    
    return await db.select().from(whatsappConversations).where(whereClause).orderBy(desc(whatsappConversations.updatedAt));
  }

  async getWhatsappConversation(id: string): Promise<WhatsappConversation | undefined> {
    const [conversation] = await db.select().from(whatsappConversations).where(eq(whatsappConversations.id, id));
    return conversation || undefined;
  }

  async createWhatsappConversation(insertConversation: InsertWhatsappConversation): Promise<WhatsappConversation> {
    const [conversation] = await db.insert(whatsappConversations).values(insertConversation).returning();
    return conversation;
  }

  async updateWhatsappConversation(id: string, updateConversation: Partial<InsertWhatsappConversation>): Promise<WhatsappConversation> {
    const [conversation] = await db.update(whatsappConversations).set({ ...updateConversation, updatedAt: new Date() }).where(eq(whatsappConversations.id, id)).returning();
    return conversation;
  }

  async deleteWhatsappConversation(id: string): Promise<void> {
    await db.delete(whatsappConversations).where(eq(whatsappConversations.id, id));
  }

  // WhatsApp messages
  async getWhatsappMessages(conversationId: string, limit: number = 50): Promise<WhatsappMessage[]> {
    return await db.select().from(whatsappMessages)
      .where(eq(whatsappMessages.conversationId, conversationId))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit);
  }

  async getWhatsappMessage(id: string): Promise<WhatsappMessage | undefined> {
    const [message] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.id, id));
    return message || undefined;
  }

  async createWhatsappMessage(insertMessage: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [message] = await db.insert(whatsappMessages).values(insertMessage).returning();
    return message;
  }

  async updateWhatsappMessage(id: string, updateMessage: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage> {
    const [message] = await db.update(whatsappMessages).set(updateMessage).where(eq(whatsappMessages.id, id)).returning();
    return message;
  }

  async deleteWhatsappMessage(id: string): Promise<void> {
    await db.update(whatsappMessages).set({ deletedAt: new Date() }).where(eq(whatsappMessages.id, id));
  }

  // Tasks
  async getTasks(userId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning();
    return task;
  }

  async updateTask(id: string, updateTask: Partial<InsertTask>): Promise<Task> {
    const [task] = await db.update(tasks).set({ ...updateTask, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // Contacts
  async getContacts(userId: string, search?: string): Promise<Contact[]> {
    let whereClause = eq(contacts.userId, userId);
    
    if (search) {
      whereClause = and(
        eq(contacts.userId, userId),
        or(
          ilike(contacts.name, `%${search}%`),
          ilike(contacts.email, `%${search}%`),
          ilike(contacts.phone, `%${search}%`)
        )
      );
    }
    
    return await db.select().from(contacts).where(whereClause).orderBy(contacts.name);
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async updateContact(id: string, updateContact: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db.update(contacts).set({ ...updateContact, updatedAt: new Date() }).where(eq(contacts.id, id)).returning();
    return contact;
  }

  async deleteContact(id: string): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  // Conversations
  async getConversations(userId: string): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.lastMessageAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(insertConversation).returning();
    return conversation;
  }

  async updateConversation(id: string, updateConversation: Partial<InsertConversation>): Promise<Conversation> {
    const [conversation] = await db.update(conversations).set({ ...updateConversation, updatedAt: new Date() }).where(eq(conversations.id, id)).returning();
    return conversation;
  }

  async deleteConversation(id: string): Promise<void> {
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  // Messages
  async getMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.timestamp))
      .limit(limit);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message;
  }

  async updateMessage(id: string, updateMessage: Partial<InsertMessage>): Promise<Message> {
    const [message] = await db.update(messages).set(updateMessage).where(eq(messages.id, id)).returning();
    return message;
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }
}

export const storage = new DatabaseStorage();
