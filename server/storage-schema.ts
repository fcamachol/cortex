import { 
  users,
  whatsappInstances,
  whatsappContacts,
  whatsappChats,
  whatsappMessages,
  whatsappGroups,
  whatsappGroupParticipants,
  tasks,
  actionRules,
  actionExecutions,
  actionTemplates,
  type User,
  type InsertUser,
  type WhatsappInstance,
  type InsertWhatsappInstance,
  type WhatsappContact,
  type InsertWhatsappContact,
  type WhatsappChat,
  type InsertWhatsappChat,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type WhatsappGroup,
  type InsertWhatsappGroup,
  type WhatsappGroupParticipant,
  type InsertWhatsappGroupParticipant,
  type Task,
  type InsertTask,
  type ActionRule,
  type InsertActionRule,
  type ActionExecution,
  type InsertActionExecution,
  type ActionTemplate,
  type InsertActionTemplate
} from "../shared/schema-migration";
import { db } from "./db";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";

export interface ISchemaStorage {
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

  // WhatsApp chats
  getWhatsappChats(instanceId: string): Promise<WhatsappChat[]>;
  getWhatsappChat(instanceId: string, chatId: string): Promise<WhatsappChat | undefined>;
  createWhatsappChat(chat: InsertWhatsappChat): Promise<WhatsappChat>;
  updateWhatsappChat(instanceId: string, chatId: string, chat: Partial<InsertWhatsappChat>): Promise<WhatsappChat>;

  // WhatsApp messages
  getWhatsappMessages(instanceId: string, chatId: string, limit?: number): Promise<WhatsappMessage[]>;
  createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;

  // WhatsApp groups
  getWhatsappGroups(instanceId: string): Promise<WhatsappGroup[]>;
  getWhatsappGroup(instanceId: string, groupJid: string): Promise<WhatsappGroup | undefined>;
  createWhatsappGroup(group: InsertWhatsappGroup): Promise<WhatsappGroup>;
  updateWhatsappGroup(instanceId: string, groupJid: string, group: Partial<InsertWhatsappGroup>): Promise<WhatsappGroup>;

  // WhatsApp group participants
  getWhatsappGroupParticipants(instanceId: string, groupJid: string): Promise<WhatsappGroupParticipant[]>;
  createWhatsappGroupParticipant(participant: InsertWhatsappGroupParticipant): Promise<WhatsappGroupParticipant>;

  // Tasks
  getTasks(userId: string): Promise<Task[]>;
  getTask(userId: string, taskId: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(userId: string, taskId: string, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(userId: string, taskId: string): Promise<void>;

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

class SchemaStorage implements ISchemaStorage {
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
      .where(eq(whatsappInstances.clientId, userId))
      .orderBy(desc(whatsappInstances.createdAt));
  }

  async getWhatsappInstance(userId: string, instanceId: string): Promise<WhatsappInstance | undefined> {
    const [instance] = await db.select().from(whatsappInstances)
      .where(and(
        eq(whatsappInstances.clientId, userId),
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
      .orderBy(desc(whatsappContacts.lastUpdatedAt));
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
      .set({ ...contact, lastUpdatedAt: new Date() })
      .where(and(
        eq(whatsappContacts.instanceId, instanceId),
        eq(whatsappContacts.jid, jid)
      ))
      .returning();
    return updatedContact;
  }

  async getWhatsappChats(instanceId: string): Promise<WhatsappChat[]> {
    return await db.select().from(whatsappChats)
      .where(eq(whatsappChats.instanceId, instanceId))
      .orderBy(desc(whatsappChats.lastMessageTimestamp));
  }

  async getWhatsappChat(instanceId: string, chatId: string): Promise<WhatsappChat | undefined> {
    const [chat] = await db.select().from(whatsappChats)
      .where(and(
        eq(whatsappChats.instanceId, instanceId),
        eq(whatsappChats.chatId, chatId)
      ));
    return chat;
  }

  async createWhatsappChat(chat: InsertWhatsappChat): Promise<WhatsappChat> {
    const [newChat] = await db.insert(whatsappChats).values(chat).returning();
    return newChat;
  }

  async updateWhatsappChat(instanceId: string, chatId: string, chat: Partial<InsertWhatsappChat>): Promise<WhatsappChat> {
    const [updatedChat] = await db.update(whatsappChats)
      .set({ ...chat, updatedAt: new Date() })
      .where(and(
        eq(whatsappChats.instanceId, instanceId),
        eq(whatsappChats.chatId, chatId)
      ))
      .returning();
    return updatedChat;
  }

  async getWhatsappMessages(instanceId: string, chatId: string, limit: number = 50): Promise<WhatsappMessage[]> {
    return await db.select().from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.instanceId, instanceId),
        eq(whatsappMessages.chatId, chatId)
      ))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit);
  }

  async createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [newMessage] = await db.insert(whatsappMessages).values(message).returning();
    return newMessage;
  }

  async getWhatsappGroups(instanceId: string): Promise<WhatsappGroup[]> {
    return await db.select().from(whatsappGroups)
      .where(eq(whatsappGroups.instanceId, instanceId))
      .orderBy(desc(whatsappGroups.updatedAt));
  }

  async getWhatsappGroup(instanceId: string, groupJid: string): Promise<WhatsappGroup | undefined> {
    const [group] = await db.select().from(whatsappGroups)
      .where(and(
        eq(whatsappGroups.instanceId, instanceId),
        eq(whatsappGroups.groupJid, groupJid)
      ));
    return group;
  }

  async createWhatsappGroup(group: InsertWhatsappGroup): Promise<WhatsappGroup> {
    const [newGroup] = await db.insert(whatsappGroups).values(group).returning();
    return newGroup;
  }

  async updateWhatsappGroup(instanceId: string, groupJid: string, group: Partial<InsertWhatsappGroup>): Promise<WhatsappGroup> {
    const [updatedGroup] = await db.update(whatsappGroups)
      .set({ ...group, updatedAt: new Date() })
      .where(and(
        eq(whatsappGroups.instanceId, instanceId),
        eq(whatsappGroups.groupJid, groupJid)
      ))
      .returning();
    return updatedGroup;
  }

  async getWhatsappGroupParticipants(instanceId: string, groupJid: string): Promise<WhatsappGroupParticipant[]> {
    return await db.select().from(whatsappGroupParticipants)
      .where(and(
        eq(whatsappGroupParticipants.instanceId, instanceId),
        eq(whatsappGroupParticipants.groupJid, groupJid)
      ));
  }

  async createWhatsappGroupParticipant(participant: InsertWhatsappGroupParticipant): Promise<WhatsappGroupParticipant> {
    const [newParticipant] = await db.insert(whatsappGroupParticipants).values(participant).returning();
    return newParticipant;
  }

  async getTasks(userId: string): Promise<Task[]> {
    return await db.select().from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTask(userId: string, taskId: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        eq(tasks.taskId, taskId)
      ));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(userId: string, taskId: string, task: Partial<InsertTask>): Promise<Task> {
    const [updatedTask] = await db.update(tasks)
      .set({ ...task, updatedAt: new Date() })
      .where(and(
        eq(tasks.userId, userId),
        eq(tasks.taskId, taskId)
      ))
      .returning();
    return updatedTask;
  }

  async deleteTask(userId: string, taskId: string): Promise<void> {
    await db.delete(tasks).where(and(
      eq(tasks.userId, userId),
      eq(tasks.taskId, taskId)
    ));
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
      .where(eq(actionExecutions.triggeredBy, userId));
    
    if (ruleId) {
      query = query.where(and(
        eq(actionExecutions.triggeredBy, userId),
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

export const schemaStorage = new SchemaStorage();
export default schemaStorage;