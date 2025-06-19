import { 
  users,
  whatsappInstances,
  whatsappContacts,
  whatsappConversations,
  whatsappMessages,
  actionRules,
  actionExecutions,
  actionTemplates,
  type User,
  type InsertUser,
  type WhatsappInstance,
  type InsertWhatsappInstance,
  type WhatsappContact,
  type InsertWhatsappContact,
  type WhatsappConversation,
  type InsertWhatsappConversation,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type ActionRule,
  type InsertActionRule,
  type ActionExecution,
  type InsertActionExecution,
  type ActionTemplate,
  type InsertActionTemplate
} from "../shared/schema-working";
import { db } from "./db";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";

export interface ISimpleStorage {
  // Users
  getUser(userId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: string, user: Partial<InsertUser>): Promise<User>;

  // WhatsApp instances
  getWhatsappInstances(userId: string): Promise<WhatsappInstance[]>;
  getWhatsappInstance(userId: string, instanceId: string): Promise<WhatsappInstance | undefined>;
  createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance>;
  updateWhatsappInstance(instanceId: string, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance>;
  deleteWhatsappInstance(instanceId: string): Promise<void>;

  // WhatsApp contacts
  getWhatsappContacts(instanceId: string): Promise<WhatsappContact[]>;
  getWhatsappContact(instanceId: string, jid: string): Promise<WhatsappContact | undefined>;
  createWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact>;
  updateWhatsappContact(instanceId: string, jid: string, contact: Partial<InsertWhatsappContact>): Promise<WhatsappContact>;

  // WhatsApp conversations
  getWhatsappConversations(userId: string, instanceId?: string): Promise<WhatsappConversation[]>;
  getWhatsappConversation(userId: string, instanceId: string, remoteJid: string): Promise<WhatsappConversation | undefined>;
  createWhatsappConversation(conversation: InsertWhatsappConversation): Promise<WhatsappConversation>;
  updateWhatsappConversation(id: number, conversation: Partial<InsertWhatsappConversation>): Promise<WhatsappConversation>;

  // WhatsApp messages
  getWhatsappMessages(instanceId: string, conversationId: number, limit?: number): Promise<WhatsappMessage[]>;
  createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;

  // Action rules
  getActionRules(userId: string): Promise<ActionRule[]>;
  getActionRule(userId: string, ruleId: string): Promise<ActionRule | undefined>;
  createActionRule(rule: InsertActionRule): Promise<ActionRule>;
  updateActionRule(userId: string, ruleId: string, rule: Partial<InsertActionRule>): Promise<ActionRule>;
  deleteActionRule(userId: string, ruleId: string): Promise<void>;

  // Action executions
  getActionExecutions(userId: string, ruleId?: string): Promise<ActionExecution[]>;
  createActionExecution(execution: InsertActionExecution): Promise<ActionExecution>;

  // Action templates
  getActionTemplates(): Promise<ActionTemplate[]>;
  createActionTemplate(template: InsertActionTemplate): Promise<ActionTemplate>;
}

class SimpleStorage implements ISimpleStorage {
  async getUser(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.userId, userId));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(userId: string, user: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(users.userId, userId))
      .returning();
    return updatedUser;
  }

  async getWhatsappInstances(userId: string): Promise<WhatsappInstance[]> {
    return await db.select().from(whatsappInstances)
      .where(eq(whatsappInstances.userId, userId))
      .orderBy(desc(whatsappInstances.createdAt));
  }

  async getWhatsappInstance(userId: string, instanceId: string): Promise<WhatsappInstance | undefined> {
    const [instance] = await db.select().from(whatsappInstances)
      .where(and(
        eq(whatsappInstances.userId, userId),
        eq(whatsappInstances.instanceId, instanceId)
      ));
    return instance;
  }

  async createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance> {
    const [newInstance] = await db.insert(whatsappInstances).values(instance).returning();
    return newInstance;
  }

  async updateWhatsappInstance(instanceId: string, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance> {
    const [updatedInstance] = await db.update(whatsappInstances)
      .set({ ...instance, updatedAt: new Date() })
      .where(eq(whatsappInstances.instanceId, instanceId))
      .returning();
    return updatedInstance;
  }

  async deleteWhatsappInstance(instanceId: string): Promise<void> {
    await db.delete(whatsappInstances).where(eq(whatsappInstances.instanceId, instanceId));
  }

  async getWhatsappContacts(instanceId: string): Promise<WhatsappContact[]> {
    return await db.select().from(whatsappContacts)
      .where(eq(whatsappContacts.instanceId, instanceId))
      .orderBy(desc(whatsappContacts.createdAt));
  }

  async getWhatsappContact(instanceId: string, jid: string): Promise<WhatsappContact | undefined> {
    const [contact] = await db.select().from(whatsappContacts)
      .where(and(
        eq(whatsappContacts.instanceId, instanceId),
        eq(whatsappContacts.jid, jid)
      ));
    return contact;
  }

  async createWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact> {
    const [newContact] = await db.insert(whatsappContacts).values(contact).returning();
    return newContact;
  }

  async updateWhatsappContact(instanceId: string, jid: string, contact: Partial<InsertWhatsappContact>): Promise<WhatsappContact> {
    const [updatedContact] = await db.update(whatsappContacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(and(
        eq(whatsappContacts.instanceId, instanceId),
        eq(whatsappContacts.jid, jid)
      ))
      .returning();
    return updatedContact;
  }

  async getWhatsappConversations(userId: string, instanceId?: string): Promise<WhatsappConversation[]> {
    let query = db.select().from(whatsappConversations)
      .where(eq(whatsappConversations.userId, userId));
    
    if (instanceId) {
      query = query.where(and(
        eq(whatsappConversations.userId, userId),
        eq(whatsappConversations.instanceId, instanceId)
      ));
    }
    
    return await query.orderBy(desc(whatsappConversations.lastMessageTimestamp));
  }

  async getWhatsappConversation(userId: string, instanceId: string, remoteJid: string): Promise<WhatsappConversation | undefined> {
    const [conversation] = await db.select().from(whatsappConversations)
      .where(and(
        eq(whatsappConversations.userId, userId),
        eq(whatsappConversations.instanceId, instanceId),
        eq(whatsappConversations.remoteJid, remoteJid)
      ));
    return conversation;
  }

  async createWhatsappConversation(conversation: InsertWhatsappConversation): Promise<WhatsappConversation> {
    const [newConversation] = await db.insert(whatsappConversations).values(conversation).returning();
    return newConversation;
  }

  async updateWhatsappConversation(id: number, conversation: Partial<InsertWhatsappConversation>): Promise<WhatsappConversation> {
    const [updatedConversation] = await db.update(whatsappConversations)
      .set({ ...conversation, updatedAt: new Date() })
      .where(eq(whatsappConversations.id, id))
      .returning();
    return updatedConversation;
  }

  async getWhatsappMessages(instanceId: string, conversationId: number, limit: number = 50): Promise<WhatsappMessage[]> {
    return await db.select().from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.instanceId, instanceId),
        eq(whatsappMessages.conversationId, conversationId)
      ))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit);
  }

  async createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [newMessage] = await db.insert(whatsappMessages).values(message).returning();
    return newMessage;
  }

  async getActionRules(userId: string): Promise<ActionRule[]> {
    return await db.select().from(actionRules)
      .where(eq(actionRules.userId, userId))
      .orderBy(desc(actionRules.createdAt));
  }

  async getActionRule(userId: string, ruleId: string): Promise<ActionRule | undefined> {
    const [rule] = await db.select().from(actionRules)
      .where(and(
        eq(actionRules.userId, userId),
        eq(actionRules.ruleId, ruleId)
      ));
    return rule;
  }

  async createActionRule(rule: InsertActionRule): Promise<ActionRule> {
    const [newRule] = await db.insert(actionRules).values(rule).returning();
    return newRule;
  }

  async updateActionRule(userId: string, ruleId: string, rule: Partial<InsertActionRule>): Promise<ActionRule> {
    const [updatedRule] = await db.update(actionRules)
      .set({ ...rule, updatedAt: new Date() })
      .where(and(
        eq(actionRules.userId, userId),
        eq(actionRules.ruleId, ruleId)
      ))
      .returning();
    return updatedRule;
  }

  async deleteActionRule(userId: string, ruleId: string): Promise<void> {
    await db.delete(actionRules).where(and(
      eq(actionRules.userId, userId),
      eq(actionRules.ruleId, ruleId)
    ));
  }

  async getActionExecutions(userId: string, ruleId?: string): Promise<ActionExecution[]> {
    let query = db.select().from(actionExecutions)
      .where(eq(actionExecutions.userId, userId));
    
    if (ruleId) {
      query = query.where(and(
        eq(actionExecutions.userId, userId),
        eq(actionExecutions.ruleId, ruleId)
      ));
    }
    
    return await query.orderBy(desc(actionExecutions.executedAt));
  }

  async createActionExecution(execution: InsertActionExecution): Promise<ActionExecution> {
    const [newExecution] = await db.insert(actionExecutions).values(execution).returning();
    return newExecution;
  }

  async getActionTemplates(): Promise<ActionTemplate[]> {
    return await db.select().from(actionTemplates)
      .orderBy(desc(actionTemplates.createdAt));
  }

  async createActionTemplate(template: InsertActionTemplate): Promise<ActionTemplate> {
    const [newTemplate] = await db.insert(actionTemplates).values(template).returning();
    return newTemplate;
  }
}

export const simpleStorage = new SimpleStorage();
export default simpleStorage;