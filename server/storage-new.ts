import { 
  appUsers, 
  whatsappInstances, 
  whatsappContacts, 
  whatsappConversations, 
  whatsappMessages,
  evolutionMessages,
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
  type EvolutionMessage,
  type InsertEvolutionMessage,
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
  getUser(userId: string): Promise<AppUser | undefined>;
  getUserByEmail(email: string): Promise<AppUser | undefined>;
  createUser(user: InsertAppUser): Promise<AppUser>;
  updateUser(userId: string, user: Partial<InsertAppUser>): Promise<AppUser>;

  // WhatsApp instances
  getWhatsappInstances(userId: string): Promise<WhatsappInstance[]>;
  getWhatsappInstance(userId: string, instanceName: string): Promise<WhatsappInstance | undefined>;
  createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance>;
  updateWhatsappInstance(userId: string, instanceName: string, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance>;
  deleteWhatsappInstance(userId: string, instanceName: string): Promise<void>;

  // WhatsApp contacts
  getWhatsappContacts(userId: string, instanceName?: string): Promise<WhatsappContact[]>;
  getWhatsappContact(userId: string, remoteJid: string): Promise<WhatsappContact | undefined>;
  createWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact>;
  updateWhatsappContact(userId: string, remoteJid: string, contact: Partial<InsertWhatsappContact>): Promise<WhatsappContact>;
  deleteWhatsappContact(userId: string, remoteJid: string): Promise<void>;

  // WhatsApp conversations
  getWhatsappConversations(userId: string, instanceName?: string): Promise<WhatsappConversation[]>;
  getWhatsappConversation(userId: string, remoteJid: string): Promise<WhatsappConversation | undefined>;
  createWhatsappConversation(conversation: InsertWhatsappConversation): Promise<WhatsappConversation>;
  updateWhatsappConversation(userId: string, remoteJid: string, conversation: Partial<InsertWhatsappConversation>): Promise<WhatsappConversation>;
  deleteWhatsappConversation(userId: string, remoteJid: string): Promise<void>;

  // WhatsApp messages
  getWhatsappMessages(userId: string, conversationJid: string, limit?: number): Promise<WhatsappMessage[]>;
  getWhatsappMessage(messageId: string): Promise<WhatsappMessage | undefined>;
  createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  updateWhatsappMessage(messageId: string, message: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage>;
  deleteWhatsappMessage(messageId: string): Promise<void>;

  // Tasks
  getTasks(userId: string): Promise<Task[]>;
  getTask(taskId: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(taskId: string, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(taskId: string): Promise<void>;

  // Contacts
  getContacts(userId: string, search?: string): Promise<Contact[]>;
  getContact(contactId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(contactId: string, contact: Partial<InsertContact>): Promise<Contact>;
  deleteContact(contactId: string): Promise<void>;

  // Conversations
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(conversationId: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(conversationId: string, conversation: Partial<InsertConversation>): Promise<Conversation>;
  deleteConversation(conversationId: string): Promise<void>;

  // Messages
  getMessages(conversationId: string, limit?: number): Promise<Message[]>;
  getMessage(messageId: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(messageId: string, message: Partial<InsertMessage>): Promise<Message>;
  deleteMessage(messageId: string): Promise<void>;

  // Evolution Messages
  getEvolutionMessages(userId: string, instanceName?: string, limit?: number): Promise<EvolutionMessage[]>;
  getEvolutionMessage(messageId: string): Promise<EvolutionMessage | undefined>;
  createEvolutionMessage(message: InsertEvolutionMessage): Promise<EvolutionMessage>;
  getWhatsappInstanceByName(instanceName: string): Promise<WhatsappInstance | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User management
  async getUser(userId: string): Promise<AppUser | undefined> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.userId, userId));
    return user as AppUser || undefined;
  }

  async getUserByEmail(email: string): Promise<AppUser | undefined> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.email, email));
    return user as AppUser || undefined;
  }

  async createUser(insertUser: InsertAppUser): Promise<AppUser> {
    const [user] = await db.insert(appUsers).values(insertUser).returning();
    return user as AppUser;
  }

  async updateUser(userId: string, updateUser: Partial<InsertAppUser>): Promise<AppUser> {
    const [user] = await db.update(appUsers).set(updateUser).where(eq(appUsers.userId, userId)).returning();
    return user as AppUser;
  }

  // WhatsApp instances
  async getWhatsappInstances(userId: string): Promise<WhatsappInstance[]> {
    const result = await db.select().from(whatsappInstances).where(eq(whatsappInstances.userId, userId)).orderBy(desc(whatsappInstances.createdAt));
    return result as WhatsappInstance[];
  }

  async getWhatsappInstance(userId: string, instanceName: string): Promise<WhatsappInstance | undefined> {
    const [instance] = await db.select().from(whatsappInstances).where(
      and(
        eq(whatsappInstances.userId, userId),
        eq(whatsappInstances.instanceName, instanceName)
      )
    );
    return instance as WhatsappInstance || undefined;
  }

  async createWhatsappInstance(insertInstance: InsertWhatsappInstance): Promise<WhatsappInstance> {
    const [instance] = await db.insert(whatsappInstances).values(insertInstance).returning();
    return instance as WhatsappInstance;
  }

  async updateWhatsappInstance(userId: string, instanceName: string, updateInstance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance> {
    const [instance] = await db.update(whatsappInstances)
      .set(updateInstance)
      .where(
        and(
          eq(whatsappInstances.userId, userId),
          eq(whatsappInstances.instanceName, instanceName)
        )
      )
      .returning();
    return instance as WhatsappInstance;
  }

  async deleteWhatsappInstance(userId: string, instanceName: string): Promise<void> {
    await db.delete(whatsappInstances).where(
      and(
        eq(whatsappInstances.userId, userId),
        eq(whatsappInstances.instanceName, instanceName)
      )
    );
  }

  // WhatsApp contacts
  async getWhatsappContacts(userId: string, instanceName?: string): Promise<WhatsappContact[]> {
    let query = db.select().from(whatsappContacts).where(eq(whatsappContacts.userId, userId));
    
    if (instanceName) {
      query = query.where(and(
        eq(whatsappContacts.userId, userId),
        eq(whatsappContacts.instanceName, instanceName)
      ));
    }
    
    const result = await query.orderBy(desc(whatsappContacts.lastMessageAt));
    return result as WhatsappContact[];
  }

  async getWhatsappContact(userId: string, remoteJid: string): Promise<WhatsappContact | undefined> {
    const [contact] = await db.select().from(whatsappContacts).where(
      and(
        eq(whatsappContacts.userId, userId),
        eq(whatsappContacts.remoteJid, remoteJid)
      )
    );
    return contact as WhatsappContact || undefined;
  }

  async createWhatsappContact(insertContact: InsertWhatsappContact): Promise<WhatsappContact> {
    const [contact] = await db.insert(whatsappContacts).values(insertContact).returning();
    return contact as WhatsappContact;
  }

  async updateWhatsappContact(userId: string, remoteJid: string, updateContact: Partial<InsertWhatsappContact>): Promise<WhatsappContact> {
    const [contact] = await db.update(whatsappContacts)
      .set(updateContact)
      .where(
        and(
          eq(whatsappContacts.userId, userId),
          eq(whatsappContacts.remoteJid, remoteJid)
        )
      )
      .returning();
    return contact as WhatsappContact;
  }

  async deleteWhatsappContact(userId: string, remoteJid: string): Promise<void> {
    await db.delete(whatsappContacts).where(
      and(
        eq(whatsappContacts.userId, userId),
        eq(whatsappContacts.remoteJid, remoteJid)
      )
    );
  }

  // WhatsApp conversations
  async getWhatsappConversations(userId: string, instanceName?: string): Promise<WhatsappConversation[]> {
    let query = db.select().from(whatsappConversations).where(eq(whatsappConversations.userId, userId));
    
    if (instanceName) {
      query = query.where(and(
        eq(whatsappConversations.userId, userId),
        eq(whatsappConversations.instanceName, instanceName)
      ));
    }
    
    const result = await query.orderBy(desc(whatsappConversations.lastMessageTimestamp));
    return result as WhatsappConversation[];
  }

  async getWhatsappConversation(userId: string, remoteJid: string): Promise<WhatsappConversation | undefined> {
    const [conversation] = await db.select().from(whatsappConversations).where(
      and(
        eq(whatsappConversations.userId, userId),
        eq(whatsappConversations.remoteJid, remoteJid)
      )
    );
    return conversation as WhatsappConversation || undefined;
  }

  async createWhatsappConversation(insertConversation: InsertWhatsappConversation): Promise<WhatsappConversation> {
    const [conversation] = await db.insert(whatsappConversations).values(insertConversation).returning();
    return conversation as WhatsappConversation;
  }

  async updateWhatsappConversation(userId: string, remoteJid: string, updateConversation: Partial<InsertWhatsappConversation>): Promise<WhatsappConversation> {
    const [conversation] = await db.update(whatsappConversations)
      .set(updateConversation)
      .where(
        and(
          eq(whatsappConversations.userId, userId),
          eq(whatsappConversations.remoteJid, remoteJid)
        )
      )
      .returning();
    return conversation as WhatsappConversation;
  }

  async deleteWhatsappConversation(userId: string, remoteJid: string): Promise<void> {
    await db.delete(whatsappConversations).where(
      and(
        eq(whatsappConversations.userId, userId),
        eq(whatsappConversations.remoteJid, remoteJid)
      )
    );
  }

  // WhatsApp messages
  async getWhatsappMessages(userId: string, conversationJid: string, limit: number = 50): Promise<WhatsappMessage[]> {
    const result = await db.select().from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.userId, userId),
          eq(whatsappMessages.conversationJid, conversationJid)
        )
      )
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit);
    return result as WhatsappMessage[];
  }

  async getWhatsappMessage(messageId: string): Promise<WhatsappMessage | undefined> {
    const [message] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageId, messageId));
    return message as WhatsappMessage || undefined;
  }

  async createWhatsappMessage(insertMessage: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [message] = await db.insert(whatsappMessages).values(insertMessage).returning();
    return message as WhatsappMessage;
  }

  async updateWhatsappMessage(messageId: string, updateMessage: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage> {
    const [message] = await db.update(whatsappMessages)
      .set(updateMessage)
      .where(eq(whatsappMessages.messageId, messageId))
      .returning();
    return message as WhatsappMessage;
  }

  async deleteWhatsappMessage(messageId: string): Promise<void> {
    await db.delete(whatsappMessages).where(eq(whatsappMessages.messageId, messageId));
  }

  // Tasks
  async getTasks(userId: string): Promise<Task[]> {
    const result = await db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
    return result as Task[];
  }

  async getTask(taskId: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.taskId, taskId));
    return task as Task || undefined;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask).returning();
    return task as Task;
  }

  async updateTask(taskId: string, updateTask: Partial<InsertTask>): Promise<Task> {
    const [task] = await db.update(tasks)
      .set(updateTask)
      .where(eq(tasks.taskId, taskId))
      .returning();
    return task as Task;
  }

  async deleteTask(taskId: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.taskId, taskId));
  }

  // Contacts
  async getContacts(userId: string, search?: string): Promise<Contact[]> {
    let query = db.select().from(contacts).where(eq(contacts.userId, userId));
    
    if (search) {
      query = query.where(
        and(
          eq(contacts.userId, userId),
          or(
            ilike(contacts.firstName, `%${search}%`),
            ilike(contacts.lastName, `%${search}%`),
            ilike(contacts.email, `%${search}%`),
            ilike(contacts.phone, `%${search}%`)
          )
        )
      );
    }
    
    const result = await query.orderBy(desc(contacts.createdAt));
    return result as Contact[];
  }

  async getContact(contactId: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.contactId, contactId));
    return contact as Contact || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact as Contact;
  }

  async updateContact(contactId: string, updateContact: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db.update(contacts)
      .set(updateContact)
      .where(eq(contacts.contactId, contactId))
      .returning();
    return contact as Contact;
  }

  async deleteContact(contactId: string): Promise<void> {
    await db.delete(contacts).where(eq(contacts.contactId, contactId));
  }

  // Conversations
  async getConversations(userId: string): Promise<Conversation[]> {
    const result = await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.lastMessageAt));
    return result as Conversation[];
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.conversationId, conversationId));
    return conversation as Conversation || undefined;
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(insertConversation).returning();
    return conversation as Conversation;
  }

  async updateConversation(conversationId: string, updateConversation: Partial<InsertConversation>): Promise<Conversation> {
    const [conversation] = await db.update(conversations)
      .set(updateConversation)
      .where(eq(conversations.conversationId, conversationId))
      .returning();
    return conversation as Conversation;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await db.delete(conversations).where(eq(conversations.conversationId, conversationId));
  }

  // Messages
  async getMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
    const result = await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    return result as Message[];
  }

  async getMessage(messageId: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.messageId, messageId));
    return message as Message || undefined;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message as Message;
  }

  async updateMessage(messageId: string, updateMessage: Partial<InsertMessage>): Promise<Message> {
    const [message] = await db.update(messages)
      .set(updateMessage)
      .where(eq(messages.messageId, messageId))
      .returning();
    return message as Message;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await db.delete(messages).where(eq(messages.messageId, messageId));
  }

  // Evolution Messages
  async getEvolutionMessages(userId: string, instanceName?: string, limit: number = 50): Promise<EvolutionMessage[]> {
    let query = db.select().from(evolutionMessages).where(eq(evolutionMessages.userId, userId));
    
    if (instanceName) {
      query = query.where(and(
        eq(evolutionMessages.userId, userId),
        eq(evolutionMessages.instanceName, instanceName)
      ));
    }
    
    const result = await query.orderBy(desc(evolutionMessages.timestamp)).limit(limit);
    return result as EvolutionMessage[];
  }

  async getEvolutionMessage(messageId: string): Promise<EvolutionMessage | undefined> {
    const [message] = await db.select().from(evolutionMessages).where(eq(evolutionMessages.messageId, messageId));
    return message as EvolutionMessage || undefined;
  }

  async createEvolutionMessage(insertMessage: InsertEvolutionMessage): Promise<EvolutionMessage> {
    const [message] = await db.insert(evolutionMessages).values(insertMessage).returning();
    return message as EvolutionMessage;
  }

  async getWhatsappInstanceByName(instanceName: string): Promise<WhatsappInstance | undefined> {
    const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.instanceName, instanceName));
    return instance as WhatsappInstance || undefined;
  }
}

export const storage = new DatabaseStorage();