import { 
  users,
  appUsers,
  whatsappInstances,
  whatsappContacts,
  whatsappChats,
  whatsappMessages,
  whatsappMessageEditHistory,
  whatsappMessageMedia,
  whatsappMessageReactions,
  whatsappMessageUpdates,
  whatsappGroups,
  whatsappGroupParticipants,
  whatsappLabels,
  whatsappChatLabels,
  whatsappCallLogs,
  whatsappMessageDeletions,
  calendarAccounts,
  calendarCalendars,
  calendarEvents,
  calendarAttendees,
  actionRules,
  actionExecutions,
  tasks,
  type User,
  type InsertUser,
  type AppUser,
  type InsertAppUser,
  type WhatsappInstance,
  type InsertWhatsappInstance,
  type WhatsappContact,
  type InsertWhatsappContact,
  type WhatsappChat,
  type InsertWhatsappChat,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type WhatsappMessageEditHistory,
  type InsertWhatsappMessageEditHistory,
  type WhatsappMessageMedia,
  type InsertWhatsappMessageMedia,
  type WhatsappMessageReaction,
  type InsertWhatsappMessageReaction,
  type WhatsappMessageUpdate,
  type InsertWhatsappMessageUpdate,
  type WhatsappGroup,
  type InsertWhatsappGroup,
  type WhatsappGroupParticipant,
  type InsertWhatsappGroupParticipant,
  type WhatsappLabel,
  type InsertWhatsappLabel,
  type WhatsappChatLabel,
  type InsertWhatsappChatLabel,
  type WhatsappCallLog,
  type InsertWhatsappCallLog,
  type WhatsappMessageDeletion,
  type InsertWhatsappMessageDeletion,
  type CalendarAccount,
  type InsertCalendarAccount,
  type CalendarCalendar,
  type InsertCalendarCalendar,
  type CalendarEvent,
  type InsertCalendarEvent,
  type CalendarAttendee,
  type InsertCalendarAttendee
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(userId: string): Promise<User | undefined>;
  getUserById(userId: string): Promise<AppUser | null>;
  getUserByEmail(email: string): Promise<AppUser | null>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createAppUser(user: InsertAppUser): Promise<AppUser>;
  updateUser(userId: string, user: Partial<InsertUser>): Promise<User>;

  // WhatsApp instances
  getWhatsappInstances(userId: string): Promise<WhatsappInstance[]>;
  getWhatsappInstance(userId: string, instanceId: string): Promise<WhatsappInstance | undefined>;
  getInstanceById(instanceId: string): Promise<WhatsappInstance | null>;
  createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance>;
  updateWhatsappInstance(userId: string, instanceId: string, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance>;
  updateWhatsappInstanceStatus(instanceId: string, status: string, connectionData?: any): Promise<WhatsappInstance | null>;
  deleteWhatsappInstance(userId: string, instanceId: string): Promise<void>;

  // WhatsApp contacts
  getWhatsappContacts(userId: string, instanceId?: string): Promise<WhatsappContact[]>;
  getWhatsappContact(userId: string, instanceId: string, jid: string): Promise<WhatsappContact | undefined>;
  createWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact>;
  updateWhatsappContact(userId: string, instanceId: string, jid: string, contact: Partial<InsertWhatsappContact>): Promise<WhatsappContact>;
  deleteWhatsappContact(userId: string, instanceId: string, jid: string): Promise<void>;
  upsertWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact>;

  // WhatsApp chats
  getWhatsappChats(userId: string, instanceId?: string): Promise<WhatsappChat[]>;
  getWhatsappChat(userId: string, instanceId: string, chatId: string): Promise<WhatsappChat | undefined>;
  createWhatsappChat(chat: InsertWhatsappChat): Promise<WhatsappChat>;
  updateWhatsappChat(userId: string, instanceId: string, chatId: string, chat: Partial<InsertWhatsappChat>): Promise<WhatsappChat>;
  deleteWhatsappChat(userId: string, instanceId: string, chatId: string): Promise<void>;
  getConversationsWithLatestMessages(userId: string): Promise<any[]>;
  upsertWhatsappChat(chat: InsertWhatsappChat): Promise<WhatsappChat>;

  // WhatsApp messages
  getWhatsappMessages(userId: string, instanceId: string, chatId: string, limit?: number): Promise<WhatsappMessage[]>;
  getWhatsappMessage(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessage | undefined>;
  createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  updateWhatsappMessage(userId: string, instanceId: string, messageId: string, message: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage>;
  deleteWhatsappMessage(userId: string, instanceId: string, messageId: string): Promise<void>;
  upsertWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  getWhatsappMessageById(messageId: string, instanceId: string): Promise<WhatsappMessage | undefined>;
  upsertWhatsappMessageReaction(reaction: InsertWhatsappMessageReaction): Promise<WhatsappMessageReaction>;
  getActionRulesByTrigger(triggerType: string, triggerValue: string, instanceId: string): Promise<any[]>;

  // WhatsApp message edit history
  createWhatsappMessageEditHistory(editHistory: InsertWhatsappMessageEditHistory): Promise<WhatsappMessageEditHistory>;
  getWhatsappMessageEditHistory(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessageEditHistory[]>;

  // WhatsApp message media
  createWhatsappMessageMedia(media: InsertWhatsappMessageMedia): Promise<WhatsappMessageMedia>;
  getWhatsappMessageMedia(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessageMedia | undefined>;

  // WhatsApp message reactions
  createWhatsappMessageReaction(reaction: InsertWhatsappMessageReaction): Promise<WhatsappMessageReaction>;
  getWhatsappMessageReactions(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessageReaction[]>;
  deleteWhatsappMessageReaction(userId: string, instanceId: string, messageId: string, reactorJid: string): Promise<void>;

  // WhatsApp message updates
  createWhatsappMessageUpdate(update: InsertWhatsappMessageUpdate): Promise<WhatsappMessageUpdate>;
  getWhatsappMessageUpdates(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessageUpdate[]>;

  // WhatsApp groups
  createWhatsappGroup(group: InsertWhatsappGroup): Promise<WhatsappGroup>;
  getWhatsappGroup(userId: string, instanceId: string, groupJid: string): Promise<WhatsappGroup | undefined>;
  getWhatsappGroups(userId: string, instanceId?: string): Promise<WhatsappGroup[]>;
  updateWhatsappGroup(userId: string, instanceId: string, groupJid: string, group: Partial<InsertWhatsappGroup>): Promise<WhatsappGroup>;
  upsertWhatsappGroup(group: InsertWhatsappGroup): Promise<WhatsappGroup>;

  // WhatsApp group participants
  createWhatsappGroupParticipant(participant: InsertWhatsappGroupParticipant): Promise<WhatsappGroupParticipant>;
  updateWhatsappGroupParticipant(instanceId: string, groupJid: string, participantJid: string, updates: Partial<InsertWhatsappGroupParticipant>): Promise<WhatsappGroupParticipant>;
  removeWhatsappGroupParticipant(instanceId: string, groupJid: string, participantJid: string): Promise<void>;
  getWhatsappGroupParticipants(userId: string, instanceId: string, groupJid: string): Promise<WhatsappGroupParticipant[]>;
  deleteWhatsappGroupParticipant(userId: string, instanceId: string, groupJid: string, participantJid: string): Promise<void>;
  clearWhatsappGroupParticipants(userId: string, instanceId: string, groupJid: string): Promise<void>;

  // Calendar integration
  getCalendarAccount(userId: string): Promise<CalendarAccount | undefined>;
  createCalendarAccount(account: InsertCalendarAccount): Promise<CalendarAccount>;
  updateCalendarAccount(userId: string, account: Partial<InsertCalendarAccount>): Promise<CalendarAccount>;
  deleteCalendarAccount(userId: string): Promise<void>;
  
  getCalendarCalendars(userId: string): Promise<CalendarCalendar[]>;
  createCalendarCalendar(calendar: InsertCalendarCalendar): Promise<CalendarCalendar>;
  updateCalendarCalendar(calendarId: number, calendar: Partial<InsertCalendarCalendar>): Promise<CalendarCalendar>;
  deleteCalendarCalendar(calendarId: number): Promise<void>;
  
  getCalendarEvents(userId: string, calendarId?: number): Promise<CalendarEvent[]>;
  getCalendarEvent(eventId: number): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(eventId: number, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent>;
  deleteCalendarEvent(eventId: number): Promise<void>;
  
  getCalendarAttendees(eventId: number): Promise<CalendarAttendee[]>;
  createCalendarAttendee(attendee: InsertCalendarAttendee): Promise<CalendarAttendee>;
  updateCalendarAttendee(attendeeId: number, attendee: Partial<InsertCalendarAttendee>): Promise<CalendarAttendee>;
  deleteCalendarAttendee(attendeeId: number): Promise<void>;

  // Legacy compatibility methods
  getWhatsappConversations(userId: string, instanceId?: string): Promise<WhatsappChat[]>;
  createWhatsappConversation(chat: InsertWhatsappChat): Promise<WhatsappChat>;
  saveWhatsappConversation(chat: InsertWhatsappChat): Promise<WhatsappChat>;
  getWhatsappInstanceByName(userId: string, instanceName: string): Promise<WhatsappInstance | undefined>;
  createEvolutionMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;

  // Additional API methods
  getAppSpaces(userId: string): Promise<any[]>;
  getSpacesForUser(userId: string): Promise<any[]>;
  getTasks(): Promise<any[]>;
  getCrmTasks(): Promise<any[]>;
  getCrmProjects(): Promise<any[]>;
  getCrmChecklistItems(): Promise<any[]>;
  getCalendarTasks(): Promise<any[]>;
  getCalendars(): Promise<any[]>;
  getCalendarProviders(): Promise<any[]>;
  getActionsInstances(): Promise<any[]>;

  // Action Rules methods
  getActionRules(userId: string): Promise<any[]>;
  getActionRule(userId: string, ruleId: string): Promise<any>;
  createActionRule(rule: any): Promise<any>;
  updateActionRule(userId: string, ruleId: string, rule: any): Promise<any>;
  deleteActionRule(userId: string, ruleId: string): Promise<void>;
  getActionTemplates(): Promise<any[]>;
  getMatchingActionRules(triggerType: string, triggerValue: string, instanceId: string): Promise<any[]>;
  getActionExecutionsToday(ruleId: string): Promise<number>;
  createActionExecution(execution: any): Promise<any>;
  updateActionRuleStats(ruleId: string): Promise<void>;
  createTask(taskData: any): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // User management
  async getUser(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(userId: string, user: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async getUserById(userId: string): Promise<AppUser | null> {
    try {
      const [user] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.userId, userId))
        .limit(1);
      return user || null;
    } catch (error) {
      console.error(`Error fetching user by ID: ${userId}`, error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<AppUser | null> {
    try {
      const [user] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.email, email))
        .limit(1);
      return user || null;
    } catch (error) {
      console.error(`Error fetching user by email: ${email}`, error);
      throw error;
    }
  }

  async createAppUser(user: InsertAppUser): Promise<AppUser> {
    try {
      const [newUser] = await db
        .insert(appUsers)
        .values(user)
        .returning();
      return newUser;
    } catch (error) {
      console.error('Error creating app user:', error);
      throw error;
    }
  }

  // WhatsApp instances
  async getWhatsappInstances(userId: string): Promise<WhatsappInstance[]> {
    return await db
      .select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.clientId, userId));
  }

  async getWhatsappInstance(userId: string, instanceId: string): Promise<WhatsappInstance | undefined> {
    const [instance] = await db
      .select()
      .from(whatsappInstances)
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappInstances.instanceId, instanceId)
      ));
    return instance || undefined;
  }

  async createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance> {
    // Ensure required fields are provided
    const instanceData = {
      instanceId: instance.instanceId || `instance-${Date.now()}`,
      displayName: instance.displayName || 'WhatsApp Instance',
      clientId: instance.clientId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
      ownerJid: instance.ownerJid || null,
      apiKey: instance.apiKey || null,
      webhookUrl: instance.webhookUrl || null,
      isConnected: instance.isConnected ?? false,
      lastConnectionAt: instance.lastConnectionAt || null,
    };

    const [newInstance] = await db
      .insert(whatsappInstances)
      .values(instanceData)
      .returning();
    return newInstance;
  }

  async updateWhatsappInstance(userId: string, instanceId: string, instance: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance> {
    const [updatedInstance] = await db
      .update(whatsappInstances)
      .set({ ...instance, updatedAt: new Date() })
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappInstances.instanceId, instanceId)
      ))
      .returning();
    return updatedInstance;
  }

  async deleteWhatsappInstance(userId: string, instanceId: string): Promise<void> {
    await db
      .delete(whatsappInstances)
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappInstances.instanceId, instanceId)
      ));
  }

  async updateWhatsappInstanceStatus(instanceId: string, status: string, connectionData?: any): Promise<WhatsappInstance | null> {
    try {
      const updateData: any = {
        isConnected: status === 'connected',
        updatedAt: new Date()
      };

      if (status === 'connected') {
        updateData.lastConnectionAt = new Date();
        if (connectionData?.ownerJid) {
          updateData.ownerJid = connectionData.ownerJid;
        }
      }

      const [updatedInstance] = await db
        .update(whatsappInstances)
        .set(updateData)
        .where(eq(whatsappInstances.instanceId, instanceId))
        .returning();
      
      return updatedInstance || null;
    } catch (error) {
      console.error('Error updating instance status:', error);
      return null;
    }
  }

  // WhatsApp contacts
  async getWhatsappContacts(userId: string, instanceId?: string): Promise<WhatsappContact[]> {
    const query = db
      .select()
      .from(whatsappContacts)
      .innerJoin(whatsappInstances, eq(whatsappContacts.instanceId, whatsappInstances.instanceId))
      .where(eq(whatsappInstances.clientId, userId));

    if (instanceId) {
      return await db
        .select()
        .from(whatsappContacts)
        .innerJoin(whatsappInstances, eq(whatsappContacts.instanceId, whatsappInstances.instanceId))
        .where(and(
          eq(whatsappInstances.clientId, userId),
          eq(whatsappContacts.instanceId, instanceId)
        ))
        .then(results => results.map(result => result.contacts));
    }

    const results = await query;
    return results.map(result => result.contacts);
  }

  async getWhatsappContact(userId: string, instanceId: string, jid: string): Promise<WhatsappContact | undefined> {
    const [result] = await db
      .select()
      .from(whatsappContacts)
      .innerJoin(whatsappInstances, eq(whatsappContacts.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappContacts.instanceId, instanceId),
        eq(whatsappContacts.jid, jid)
      ));
    return result?.contacts || undefined;
  }

  async getWhatsappContactByJid(userId: string, instanceId: string, jid: string): Promise<WhatsappContact | undefined> {
    return this.getWhatsappContact(userId, instanceId, jid);
  }

  async createWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact> {
    const [newContact] = await db
      .insert(whatsappContacts)
      .values(contact)
      .onConflictDoUpdate({
        target: [whatsappContacts.jid, whatsappContacts.instanceId],
        set: {
          pushName: contact.pushName,
          verifiedName: contact.verifiedName,
          profilePictureUrl: contact.profilePictureUrl,
          isBusiness: contact.isBusiness,
          isMe: contact.isMe,
          isBlocked: contact.isBlocked,
          lastUpdatedAt: new Date()
        }
      })
      .returning();
    return newContact;
  }

  async updateWhatsappContact(userId: string, instanceId: string, jid: string, contact: Partial<InsertWhatsappContact>): Promise<WhatsappContact> {
    const [updatedContact] = await db
      .update(whatsappContacts)
      .set({ ...contact, lastUpdatedAt: new Date() })
      .where(and(
        eq(whatsappContacts.instanceId, instanceId),
        eq(whatsappContacts.jid, jid)
      ))
      .returning();
    return updatedContact;
  }

  async deleteWhatsappContact(userId: string, instanceId: string, jid: string): Promise<void> {
    await db
      .delete(whatsappContacts)
      .where(and(
        eq(whatsappContacts.instanceId, instanceId),
        eq(whatsappContacts.jid, jid)
      ));
  }

  async upsertWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact> {
    // Validate required fields before insertion
    if (!contact.jid || !contact.instanceId) {
      throw new Error(`Invalid contact data: jid=${contact.jid}, instanceId=${contact.instanceId}`);
    }

    const [upsertedContact] = await db
      .insert(whatsappContacts)
      .values(contact)
      .onConflictDoUpdate({
        target: [whatsappContacts.jid, whatsappContacts.instanceId],
        set: {
          pushName: contact.pushName,
          verifiedName: contact.verifiedName,
          profilePictureUrl: contact.profilePictureUrl,
          isBusiness: contact.isBusiness,
          isMe: contact.isMe,
          isBlocked: contact.isBlocked,
          lastUpdatedAt: new Date()
        }
      })
      .returning();
    return upsertedContact;
  }

  // WhatsApp chats
  async getWhatsappChats(userId: string, instanceId?: string): Promise<WhatsappChat[]> {
    const query = db
      .select()
      .from(whatsappChats)
      .innerJoin(whatsappInstances, eq(whatsappChats.instanceId, whatsappInstances.instanceId))
      .where(eq(whatsappInstances.clientId, userId))
      .orderBy(desc(whatsappChats.lastMessageTimestamp));

    if (instanceId) {
      return await db
        .select()
        .from(whatsappChats)
        .innerJoin(whatsappInstances, eq(whatsappChats.instanceId, whatsappInstances.instanceId))
        .where(and(
          eq(whatsappInstances.clientId, userId),
          eq(whatsappChats.instanceId, instanceId)
        ))
        .orderBy(desc(whatsappChats.lastMessageTimestamp))
        .then(results => results.map(result => result.chats));
    }

    const results = await query;
    return results.map(result => result.chats);
  }

  async getWhatsappChat(userId: string, instanceId: string, chatId: string): Promise<WhatsappChat | undefined> {
    const [result] = await db
      .select()
      .from(whatsappChats)
      .innerJoin(whatsappInstances, eq(whatsappChats.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappChats.instanceId, instanceId),
        eq(whatsappChats.chatId, chatId)
      ));
    return result?.chats || undefined;
  }

  async createWhatsappChat(chat: InsertWhatsappChat): Promise<WhatsappChat> {
    const [newChat] = await db
      .insert(whatsappChats)
      .values(chat)
      .onConflictDoUpdate({
        target: [whatsappChats.chatId, whatsappChats.instanceId],
        set: {
          type: chat.type,
          unreadCount: chat.unreadCount,
          isArchived: chat.isArchived,
          isPinned: chat.isPinned,
          isMuted: chat.isMuted,
          muteEndTimestamp: chat.muteEndTimestamp,
          lastMessageTimestamp: chat.lastMessageTimestamp,
          updatedAt: new Date()
        }
      })
      .returning();
    return newChat;
  }

  async updateWhatsappChat(userId: string, instanceId: string, chatId: string, chat: Partial<InsertWhatsappChat>): Promise<WhatsappChat> {
    const [updatedChat] = await db
      .update(whatsappChats)
      .set({ ...chat, updatedAt: new Date() })
      .where(and(
        eq(whatsappChats.instanceId, instanceId),
        eq(whatsappChats.chatId, chatId)
      ))
      .returning();
    return updatedChat;
  }

  async deleteWhatsappChat(userId: string, instanceId: string, chatId: string): Promise<void> {
    await db
      .delete(whatsappChats)
      .where(and(
        eq(whatsappChats.instanceId, instanceId),
        eq(whatsappChats.chatId, chatId)
      ));
  }

  async upsertWhatsappChat(chat: InsertWhatsappChat): Promise<WhatsappChat> {
    const [upsertedChat] = await db
      .insert(whatsappChats)
      .values(chat)
      .onConflictDoUpdate({
        target: [whatsappChats.chatId, whatsappChats.instanceId],
        set: {
          type: chat.type,
          unreadCount: chat.unreadCount,
          isArchived: chat.isArchived,
          isPinned: chat.isPinned,
          isMuted: chat.isMuted,
          muteEndTimestamp: chat.muteEndTimestamp,
          lastMessageTimestamp: chat.lastMessageTimestamp,
          updatedAt: new Date()
        }
      })
      .returning();
    return upsertedChat;
  }

  async getConversationsWithLatestMessages(userId: string): Promise<any[]> {
    // Single optimized query to get conversations with their latest message and contact info
    const result = await db.execute(sql`
      WITH latest_messages AS (
        SELECT DISTINCT ON (chat_id, instance_id)
          chat_id,
          instance_id,
          message_id,
          content,
          message_type,
          from_me,
          timestamp,
          sender_jid
        FROM whatsapp.messages
        ORDER BY chat_id, instance_id, timestamp DESC
      )
      SELECT 
        c.chat_id,
        c.instance_id,
        c.type,
        c.unread_count,
        c.is_archived,
        c.is_pinned,
        c.is_muted,
        c.last_message_timestamp,
        c.created_at,
        c.updated_at,
        -- Latest message info
        lm.message_id as latest_message_id,
        lm.content as latest_message_content,
        lm.message_type as latest_message_type,
        lm.from_me as latest_message_from_me,
        lm.timestamp as latest_message_timestamp,
        lm.sender_jid as latest_message_sender,
        -- Contact info
        ct.push_name,
        ct.verified_name,
        ct.profile_picture_url,
        -- Group info  
        g.subject as group_subject,
        g.description as group_description,
        -- Instance info
        i.display_name as instance_name
      FROM whatsapp.chats c
      INNER JOIN whatsapp.instances i ON c.instance_id = i.instance_id
      LEFT JOIN latest_messages lm ON c.chat_id = lm.chat_id AND c.instance_id = lm.instance_id
      LEFT JOIN whatsapp.contacts ct ON c.chat_id = ct.jid AND c.instance_id = ct.instance_id
      LEFT JOIN whatsapp.groups g ON c.chat_id = g.group_jid AND c.instance_id = g.instance_id
      WHERE i.client_id = ${userId}
      ORDER BY COALESCE(lm.timestamp, c.last_message_timestamp, c.created_at) DESC NULLS LAST
    `);

    return result.rows.map((row: any) => {
      // Determine display name
      let displayName = row.chat_id;
      if (row.group_subject) {
        displayName = row.group_subject;
      } else if (row.push_name || row.verified_name) {
        displayName = row.push_name || row.verified_name;
      } else if (row.chat_id.includes('@s.whatsapp.net')) {
        displayName = row.chat_id.split('@')[0];
      }

      return {
        chatId: row.chat_id,
        instanceId: row.instance_id,
        type: row.type,
        unreadCount: row.unread_count || 0,
        isArchived: row.is_archived || false,
        isPinned: row.is_pinned || false,
        isMuted: row.is_muted || false,
        lastMessageTimestamp: row.last_message_timestamp,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        title: displayName,
        displayName: displayName,
        // Latest message info
        latestMessage: row.latest_message_id ? {
          messageId: row.latest_message_id,
          content: row.latest_message_content,
          messageType: row.latest_message_type,
          fromMe: row.latest_message_from_me,
          timestamp: row.latest_message_timestamp,
          senderJid: row.latest_message_sender
        } : null,
        // Contact info
        contactInfo: (row.push_name || row.verified_name || row.profile_picture_url) ? {
          pushName: row.push_name,
          verifiedName: row.verified_name,
          profilePictureUrl: row.profile_picture_url
        } : null,
        // Group info
        groupInfo: row.group_subject ? {
          subject: row.group_subject,
          description: row.group_description
        } : null,
        // Instance info
        instanceName: row.instance_name
      };
    });
  }

  // WhatsApp messages
  async getWhatsappMessages(userId: string, instanceId: string, chatId: string, limit: number = 50): Promise<WhatsappMessage[]> {
    const results = await db
      .select()
      .from(whatsappMessages)
      .innerJoin(whatsappInstances, eq(whatsappMessages.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappMessages.instanceId, instanceId),
        eq(whatsappMessages.chatId, chatId)
      ))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit);

    return results.map(result => result.messages);
  }

  async getAllWhatsappMessagesForInstance(userId: string, instanceId: string, limit: number = 50): Promise<WhatsappMessage[]> {
    const results = await db
      .select()
      .from(whatsappMessages)
      .innerJoin(whatsappInstances, eq(whatsappMessages.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappMessages.instanceId, instanceId)
      ))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit);

    return results.map(result => result.messages);
  }

  async getWhatsappMessage(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessage | undefined> {
    console.log('Storage: fetching message with params:', { userId, instanceId, messageId });
    
    const [result] = await db
      .select({
        messageId: whatsappMessages.messageId,
        instanceId: whatsappMessages.instanceId,
        chatId: whatsappMessages.chatId,
        senderJid: whatsappMessages.senderJid,
        fromMe: whatsappMessages.fromMe,
        messageType: whatsappMessages.messageType,
        content: whatsappMessages.content,
        timestamp: whatsappMessages.timestamp,
        quotedMessageId: whatsappMessages.quotedMessageId,
        isForwarded: whatsappMessages.isForwarded,
        forwardingScore: whatsappMessages.forwardingScore,
        isStarred: whatsappMessages.isStarred,
        isEdited: whatsappMessages.isEdited,
        lastEditedAt: whatsappMessages.lastEditedAt,
        sourcePlatform: whatsappMessages.sourcePlatform,
        rawApiPayload: whatsappMessages.rawApiPayload,
        createdAt: whatsappMessages.createdAt
      })
      .from(whatsappMessages)
      .innerJoin(whatsappInstances, eq(whatsappMessages.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappMessages.instanceId, instanceId),
        eq(whatsappMessages.messageId, messageId)
      ));
    
    console.log('Storage: query result:', result);
    return result || undefined;
  }

  async createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    try {
      const [newMessage] = await db
        .insert(whatsappMessages)
        .values(message)
        .onConflictDoUpdate({
          target: [whatsappMessages.messageId, whatsappMessages.instanceId],
          set: {
            content: message.content,
            messageType: message.messageType,
            isEdited: message.isEdited || false,
            lastEditedAt: message.lastEditedAt,
            rawApiPayload: message.rawApiPayload,
            updatedAt: new Date()
          }
        })
        .returning();
      return newMessage;
    } catch (error: any) {
      if (error.message?.includes('No values to set')) {
        // Message already exists and is identical, just fetch and return it
        const existingMessage = await this.getWhatsappMessage('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', message.instanceId, message.messageId);
        if (existingMessage) {
          return existingMessage;
        }
      }
      throw error;
    }
  }

  async upsertWhatsappMessage(message: any): Promise<any> {
    try {
      // Convert the message format to match the WhatsApp schema
      const messageRecord = {
        messageId: message.message_id,
        instanceId: message.instance_id,
        chatId: message.chat_id,
        senderJid: message.sender_jid,
        fromMe: message.from_me,
        messageType: message.message_type,
        content: message.content,
        timestamp: message.timestamp,
        quotedMessageId: message.quoted_message_id,
        isForwarded: message.is_forwarded || false,
        forwardingScore: message.forwarding_score || 0,
        isStarred: message.is_starred || false,
        isEdited: message.is_edited || false,
        lastEditedAt: message.last_edited_at,
        sourcePlatform: message.source_platform || 'evolution-api',
        rawApiPayload: message.raw_api_payload
      };

      const [newMessage] = await db
        .insert(whatsappMessages)
        .values(messageRecord)
        .onConflictDoUpdate({
          target: [whatsappMessages.messageId, whatsappMessages.instanceId],
          set: {
            content: messageRecord.content,
            messageType: messageRecord.messageType,
            isEdited: messageRecord.isEdited,
            lastEditedAt: messageRecord.lastEditedAt,
            rawApiPayload: messageRecord.rawApiPayload,
            updatedAt: new Date()
          }
        })
        .returning();
      return newMessage;
    } catch (error: any) {
      console.error('Error upserting WhatsApp message:', error);
      throw error;
    }
  }

  async updateWhatsappMessage(userId: string, instanceId: string, messageId: string, message: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage> {
    const [updatedMessage] = await db
      .update(whatsappMessages)
      .set(message)
      .where(and(
        eq(whatsappMessages.instanceId, instanceId),
        eq(whatsappMessages.messageId, messageId)
      ))
      .returning();
    return updatedMessage;
  }

  async updateWhatsappMessageContent(params: { 
    messageId: string; 
    instanceId: string; 
    newContent: string; 
    isEdited: boolean; 
    lastEditedAt: Date; 
  }): Promise<WhatsappMessage> {
    const [updatedMessage] = await db
      .update(whatsappMessages)
      .set({
        content: params.newContent,
        isEdited: params.isEdited,
        lastEditedAt: params.lastEditedAt
      })
      .where(and(
        eq(whatsappMessages.instanceId, params.instanceId),
        eq(whatsappMessages.messageId, params.messageId)
      ))
      .returning();
    return updatedMessage;
  }

  async deleteWhatsappMessage(userId: string, instanceId: string, messageId: string): Promise<void> {
    await db
      .delete(whatsappMessages)
      .where(and(
        eq(whatsappMessages.instanceId, instanceId),
        eq(whatsappMessages.messageId, messageId)
      ));
  }

  async upsertWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    try {
      const [upsertedMessage] = await db
        .insert(whatsappMessages)
        .values(message)
        .onConflictDoUpdate({
          target: [whatsappMessages.messageId, whatsappMessages.instanceId],
          set: {
            content: message.content,
            messageType: message.messageType,
            isEdited: message.isEdited || false,
            lastEditedAt: message.lastEditedAt,
            rawApiPayload: message.rawApiPayload
          }
        })
        .returning();
      return upsertedMessage;
    } catch (error: any) {
      console.error('Error upserting WhatsApp message:', error);
      throw error;
    }
  }

  async getWhatsappMessageById(messageId: string, instanceId: string): Promise<WhatsappMessage | undefined> {
    const [result] = await db
      .select()
      .from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.messageId, messageId),
        eq(whatsappMessages.instanceId, instanceId)
      ));
    return result || undefined;
  }

  async upsertWhatsappMessageReaction(reaction: InsertWhatsappMessageReaction): Promise<WhatsappMessageReaction> {
    const [upsertedReaction] = await db
      .insert(whatsappMessageReactions)
      .values(reaction)
      .onConflictDoUpdate({
        target: [whatsappMessageReactions.messageId, whatsappMessageReactions.instanceId, whatsappMessageReactions.reactorJid],
        set: {
          reactionEmoji: reaction.reactionEmoji,
          fromMe: reaction.fromMe,
          timestamp: reaction.timestamp
        }
      })
      .returning();
    return upsertedReaction;
  }

  async getActionRulesByTrigger(triggerType: string, triggerValue: string, instanceId: string): Promise<any[]> {
    try {
      const results = await db
        .select()
        .from(actionRules)
        .where(and(
          eq(actionRules.triggerType, triggerType as any),
          eq(actionRules.triggerValue, triggerValue),
          eq(actionRules.instanceId, instanceId),
          eq(actionRules.isActive, true)
        ));
      return results;
    } catch (error) {
      console.error('Error fetching action rules:', error);
      return [];
    }
  }

  async getWhatsappMessageById(messageId: string, instanceId: string): Promise<WhatsappMessage | null> {
    try {
      const [message] = await db
        .select()
        .from(whatsappMessages)
        .where(and(
          eq(whatsappMessages.messageId, messageId),
          eq(whatsappMessages.instanceId, instanceId)
        ))
        .limit(1);
      
      return message || null;
    } catch (error) {
      console.error('Error fetching message by ID:', error);
      throw error;
    }
  }

  async getMessageReplies(originalMessageId: string, instanceId: string): Promise<WhatsappMessage[]> {
    try {
      const replies = await db
        .select()
        .from(whatsappMessages)
        .where(and(
          eq(whatsappMessages.quotedMessageId, originalMessageId),
          eq(whatsappMessages.instanceId, instanceId)
        ))
        .orderBy(asc(whatsappMessages.timestamp));
      
      return replies;
    } catch (error) {
      console.error('Error fetching message replies:', error);
      throw error;
    }
  }

  // WhatsApp message edit history
  async createWhatsappMessageEditHistory(editHistory: InsertWhatsappMessageEditHistory): Promise<WhatsappMessageEditHistory> {
    const [newEditHistory] = await db
      .insert(whatsappMessageEditHistory)
      .values(editHistory)
      .returning();
    return newEditHistory;
  }

  async getWhatsappMessageEditHistory(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessageEditHistory[]> {
    const results = await db
      .select()
      .from(whatsappMessageEditHistory)
      .innerJoin(whatsappMessages, and(
        eq(whatsappMessageEditHistory.messageId, whatsappMessages.messageId),
        eq(whatsappMessageEditHistory.instanceId, whatsappMessages.instanceId)
      ))
      .innerJoin(whatsappInstances, eq(whatsappMessages.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappMessageEditHistory.instanceId, instanceId),
        eq(whatsappMessageEditHistory.messageId, messageId)
      ))
      .orderBy(desc(whatsappMessageEditHistory.editTimestamp));

    return results.map(result => result.message_edit_history);
  }

  // WhatsApp message media
  async createWhatsappMessageMedia(media: InsertWhatsappMessageMedia): Promise<WhatsappMessageMedia> {
    const [newMedia] = await db
      .insert(whatsappMessageMedia)
      .values(media)
      .returning();
    return newMedia;
  }

  async getWhatsappMessageMedia(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessageMedia | undefined> {
    const [result] = await db
      .select()
      .from(whatsappMessageMedia)
      .innerJoin(whatsappMessages, and(
        eq(whatsappMessageMedia.messageId, whatsappMessages.messageId),
        eq(whatsappMessageMedia.instanceId, whatsappMessages.instanceId)
      ))
      .innerJoin(whatsappInstances, eq(whatsappMessages.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappMessageMedia.instanceId, instanceId),
        eq(whatsappMessageMedia.messageId, messageId)
      ));

    return result?.message_media || undefined;
  }

  // WhatsApp message reactions
  async createWhatsappMessageReaction(reaction: InsertWhatsappMessageReaction): Promise<WhatsappMessageReaction> {
    const [newReaction] = await db
      .insert(whatsappMessageReactions)
      .values(reaction)
      .onConflictDoUpdate({
        target: [whatsappMessageReactions.messageId, whatsappMessageReactions.instanceId, whatsappMessageReactions.reactorJid],
        set: {
          reactionEmoji: reaction.reactionEmoji,
          fromMe: reaction.fromMe,
          timestamp: reaction.timestamp
        }
      })
      .returning();
    return newReaction;
  }

  async getWhatsappMessageReactions(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessageReaction[]> {
    const results = await db
      .select()
      .from(whatsappMessageReactions)
      .innerJoin(whatsappMessages, and(
        eq(whatsappMessageReactions.messageId, whatsappMessages.messageId),
        eq(whatsappMessageReactions.instanceId, whatsappMessages.instanceId)
      ))
      .innerJoin(whatsappInstances, eq(whatsappMessages.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappMessageReactions.instanceId, instanceId),
        eq(whatsappMessageReactions.messageId, messageId)
      ));

    return results.map(result => result.message_reactions);
  }

  async deleteWhatsappMessageReaction(userId: string, instanceId: string, messageId: string, reactorJid: string): Promise<void> {
    await db
      .delete(whatsappMessageReactions)
      .where(and(
        eq(whatsappMessageReactions.instanceId, instanceId),
        eq(whatsappMessageReactions.messageId, messageId),
        eq(whatsappMessageReactions.reactorJid, reactorJid)
      ));
  }

  // WhatsApp message updates
  async createWhatsappMessageUpdate(update: InsertWhatsappMessageUpdate): Promise<WhatsappMessageUpdate> {
    const [newUpdate] = await db
      .insert(whatsappMessageUpdates)
      .values(update)
      .returning();
    return newUpdate;
  }

  async getWhatsappMessageUpdates(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessageUpdate[]> {
    const results = await db
      .select()
      .from(whatsappMessageUpdates)
      .innerJoin(whatsappMessages, and(
        eq(whatsappMessageUpdates.messageId, whatsappMessages.messageId),
        eq(whatsappMessageUpdates.instanceId, whatsappMessages.instanceId)
      ))
      .innerJoin(whatsappInstances, eq(whatsappMessages.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappMessageUpdates.instanceId, instanceId),
        eq(whatsappMessageUpdates.messageId, messageId)
      ));

    return results.map(result => result.message_updates);
  }

  // WhatsApp groups
  async createWhatsappGroup(group: InsertWhatsappGroup): Promise<WhatsappGroup> {
    const [newGroup] = await db
      .insert(whatsappGroups)
      .values(group)
      .onConflictDoUpdate({
        target: [whatsappGroups.groupJid, whatsappGroups.instanceId],
        set: {
          subject: group.subject,
          description: group.description,
          ownerJid: group.ownerJid,
          isLocked: group.isLocked,
          updatedAt: new Date()
        }
      })
      .returning();
    return newGroup;
  }

  async getWhatsappGroup(userId: string, instanceId: string, groupJid: string): Promise<WhatsappGroup | undefined> {
    const [result] = await db
      .select()
      .from(whatsappGroups)
      .innerJoin(whatsappInstances, eq(whatsappGroups.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappGroups.instanceId, instanceId),
        eq(whatsappGroups.groupJid, groupJid)
      ));
    return result?.groups || undefined;
  }

  async getWhatsappGroups(userId: string, instanceId?: string): Promise<WhatsappGroup[]> {
    let whereCondition = eq(whatsappInstances.clientId, userId);
    
    if (instanceId) {
      whereCondition = and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappGroups.instanceId, instanceId)
      );
    }

    const results = await db
      .select({
        groupJid: whatsappGroups.groupJid,
        instanceId: whatsappGroups.instanceId,
        subject: whatsappGroups.subject,
        description: whatsappGroups.description,
        ownerJid: whatsappGroups.ownerJid,
        creationTimestamp: whatsappGroups.creationTimestamp,
        isLocked: whatsappGroups.isLocked,
        updatedAt: whatsappGroups.updatedAt
      })
      .from(whatsappGroups)
      .innerJoin(whatsappInstances, eq(whatsappGroups.instanceId, whatsappInstances.instanceId))
      .where(whereCondition)
      .orderBy(whatsappGroups.updatedAt);
      
    return results;
  }

  async updateWhatsappGroup(userId: string, instanceId: string, groupJid: string, group: Partial<InsertWhatsappGroup>): Promise<WhatsappGroup> {
    const [updatedGroup] = await db
      .update(whatsappGroups)
      .set({ ...group, updatedAt: new Date() })
      .where(and(
        eq(whatsappGroups.instanceId, instanceId),
        eq(whatsappGroups.groupJid, groupJid)
      ))
      .returning();
    return updatedGroup;
  }

  async upsertWhatsappGroup(group: InsertWhatsappGroup): Promise<WhatsappGroup> {
    // Use the existing createWhatsappGroup function which already implements upsert logic
    return this.createWhatsappGroup(group);
  }

  // WhatsApp group participants
  async createWhatsappGroupParticipant(participant: InsertWhatsappGroupParticipant): Promise<WhatsappGroupParticipant> {
    const [newParticipant] = await db
      .insert(whatsappGroupParticipants)
      .values(participant)
      .onConflictDoUpdate({
        target: [whatsappGroupParticipants.groupJid, whatsappGroupParticipants.participantJid, whatsappGroupParticipants.instanceId],
        set: {
          isAdmin: participant.isAdmin,
          isSuperAdmin: participant.isSuperAdmin
        }
      })
      .returning();
    return newParticipant;
  }

  async updateWhatsappGroupParticipant(instanceId: string, groupJid: string, participantJid: string, updates: Partial<InsertWhatsappGroupParticipant>): Promise<WhatsappGroupParticipant> {
    const [updatedParticipant] = await db
      .update(whatsappGroupParticipants)
      .set(updates)
      .where(and(
        eq(whatsappGroupParticipants.instanceId, instanceId),
        eq(whatsappGroupParticipants.groupJid, groupJid),
        eq(whatsappGroupParticipants.participantJid, participantJid)
      ))
      .returning();
    return updatedParticipant;
  }

  async removeWhatsappGroupParticipant(instanceId: string, groupJid: string, participantJid: string): Promise<void> {
    await db
      .delete(whatsappGroupParticipants)
      .where(and(
        eq(whatsappGroupParticipants.instanceId, instanceId),
        eq(whatsappGroupParticipants.groupJid, groupJid),
        eq(whatsappGroupParticipants.participantJid, participantJid)
      ));
  }

  async getWhatsappGroupParticipants(userId: string, instanceId: string, groupJid: string): Promise<WhatsappGroupParticipant[]> {
    const results = await db
      .select()
      .from(whatsappGroupParticipants)
      .innerJoin(whatsappInstances, eq(whatsappGroupParticipants.instanceId, whatsappInstances.instanceId))
      .where(and(
        eq(whatsappInstances.clientId, userId),
        eq(whatsappGroupParticipants.instanceId, instanceId),
        eq(whatsappGroupParticipants.groupJid, groupJid)
      ));

    return results.map(result => result.group_participants);
  }

  async deleteWhatsappGroupParticipant(userId: string, instanceId: string, groupJid: string, participantJid: string): Promise<void> {
    await db
      .delete(whatsappGroupParticipants)
      .where(and(
        eq(whatsappGroupParticipants.instanceId, instanceId),
        eq(whatsappGroupParticipants.groupJid, groupJid),
        eq(whatsappGroupParticipants.participantJid, participantJid)
      ));
  }

  async clearWhatsappGroupParticipants(userId: string, instanceId: string, groupJid: string): Promise<void> {
    await db
      .delete(whatsappGroupParticipants)
      .where(and(
        eq(whatsappGroupParticipants.instanceId, instanceId),
        eq(whatsappGroupParticipants.groupJid, groupJid)
      ));
  }

  // Legacy compatibility methods
  async getWhatsappConversations(userId: string, instanceId?: string): Promise<WhatsappChat[]> {
    return this.getWhatsappChats(userId, instanceId);
  }

  async createWhatsappConversation(chat: InsertWhatsappChat): Promise<WhatsappChat> {
    return this.createWhatsappChat(chat);
  }

  async saveWhatsappConversation(chat: InsertWhatsappChat): Promise<WhatsappChat> {
    return this.createWhatsappChat(chat);
  }

  async getWhatsappInstanceByName(userId: string, instanceName: string): Promise<WhatsappInstance | undefined> {
    // Since the new schema uses instanceId instead of instanceName, 
    // we'll treat instanceName as instanceId for compatibility
    return this.getWhatsappInstance(userId, instanceName);
  }

  async createEvolutionMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    return this.createWhatsappMessage(message);
  }

  // Calendar integration implementations
  async getCalendarAccount(userId: string): Promise<CalendarAccount | undefined> {
    const [account] = await db.select().from(calendarAccounts).where(eq(calendarAccounts.userId, userId));
    return account || undefined;
  }

  async createCalendarAccount(account: InsertCalendarAccount): Promise<CalendarAccount> {
    const [newAccount] = await db.insert(calendarAccounts).values(account).returning();
    return newAccount;
  }

  async updateCalendarAccount(userId: string, account: Partial<InsertCalendarAccount>): Promise<CalendarAccount> {
    const [updatedAccount] = await db
      .update(calendarAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(calendarAccounts.userId, userId))
      .returning();
    return updatedAccount;
  }

  async deleteCalendarAccount(userId: string): Promise<void> {
    await db.delete(calendarAccounts).where(eq(calendarAccounts.userId, userId));
  }

  async getCalendarCalendars(userId: string): Promise<CalendarCalendar[]> {
    const account = await this.getCalendarAccount(userId);
    if (!account) return [];
    return await db.select().from(calendarCalendars).where(eq(calendarCalendars.accountId, account.accountId));
  }

  async createCalendarCalendar(calendar: InsertCalendarCalendar): Promise<CalendarCalendar> {
    const [newCalendar] = await db.insert(calendarCalendars).values(calendar).returning();
    return newCalendar;
  }

  async updateCalendarCalendar(calendarId: number, calendar: Partial<InsertCalendarCalendar>): Promise<CalendarCalendar> {
    const [updatedCalendar] = await db
      .update(calendarCalendars)
      .set({ ...calendar, updatedAt: new Date() })
      .where(eq(calendarCalendars.calendarId, calendarId))
      .returning();
    return updatedCalendar;
  }

  async deleteCalendarCalendar(calendarId: number): Promise<void> {
    await db.delete(calendarCalendars).where(eq(calendarCalendars.calendarId, calendarId));
  }

  async getCalendarEvents(userId: string, calendarId?: number): Promise<CalendarEvent[]> {
    const account = await this.getCalendarAccount(userId);
    if (!account) return [];
    
    if (calendarId) {
      return await db.select().from(calendarEvents).where(eq(calendarEvents.calendarId, calendarId));
    }
    
    // Get events from all user's calendars
    const calendars = await this.getCalendarCalendars(userId);
    const calendarIds = calendars.map(c => c.calendarId);
    if (calendarIds.length === 0) return [];
    
    return await db.select().from(calendarEvents).where(sql`${calendarEvents.calendarId} = ANY(${calendarIds})`);
  }

  async getCalendarEvent(eventId: number): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.eventId, eventId));
    return event || undefined;
  }

  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const [newEvent] = await db.insert(calendarEvents).values(event).returning();
    return newEvent;
  }

  async updateCalendarEvent(eventId: number, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent> {
    const [updatedEvent] = await db
      .update(calendarEvents)
      .set({ ...event, updatedAt: new Date() })
      .where(eq(calendarEvents.eventId, eventId))
      .returning();
    return updatedEvent;
  }

  async deleteCalendarEvent(eventId: number): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.eventId, eventId));
  }

  async getCalendarAttendees(eventId: number): Promise<CalendarAttendee[]> {
    return await db.select().from(calendarAttendees).where(eq(calendarAttendees.eventId, eventId));
  }

  async createCalendarAttendee(attendee: InsertCalendarAttendee): Promise<CalendarAttendee> {
    const [newAttendee] = await db.insert(calendarAttendees).values(attendee).returning();
    return newAttendee;
  }

  async updateCalendarAttendee(attendeeId: number, attendee: Partial<InsertCalendarAttendee>): Promise<CalendarAttendee> {
    const [updatedAttendee] = await db
      .update(calendarAttendees)
      .set(attendee)
      .where(eq(calendarAttendees.attendeeId, attendeeId))
      .returning();
    return updatedAttendee;
  }

  async deleteCalendarAttendee(attendeeId: number): Promise<void> {
    await db.delete(calendarAttendees).where(eq(calendarAttendees.attendeeId, attendeeId));
  }

  // WhatsApp Message Deletion Tracking
  async createWhatsappMessageDeletion(deletion: InsertWhatsappMessageDeletion): Promise<WhatsappMessageDeletion> {
    const [newDeletion] = await db.insert(whatsappMessageDeletions).values(deletion).returning();
    return newDeletion;
  }

  async getWhatsappMessageDeletions(userId: string, instanceId: string, chatId?: string, limit: number = 50): Promise<WhatsappMessageDeletion[]> {
    let query = db.select().from(whatsappMessageDeletions)
      .where(eq(whatsappMessageDeletions.instanceId, instanceId))
      .orderBy(desc(whatsappMessageDeletions.deletedAt))
      .limit(limit);

    if (chatId) {
      query = query.where(eq(whatsappMessageDeletions.chatId, chatId));
    }

    return await query;
  }

  async getWhatsappMessageDeletion(deletionId: string): Promise<WhatsappMessageDeletion | undefined> {
    const [deletion] = await db.select().from(whatsappMessageDeletions).where(eq(whatsappMessageDeletions.deletionId, deletionId));
    return deletion || undefined;
  }

  // Additional API methods implementation
  async getAppSpaces(userId: string): Promise<any[]> {
    // Return empty array for now - can be implemented based on your app schema
    return [];
  }

  async getTasks(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          task_id,
          instance_id,
          title,
          description,
          status,
          priority,
          due_date,
          parent_task_id,
          triggering_message_id,
          assigned_to_user_id,
          related_chat_jid,
          created_by_user_id,
          created_at,
          updated_at,
          space_id,
          project_id
        FROM crm.tasks 
        ORDER BY created_at DESC
      `);
      
      console.log('Raw task query result:', result.rows?.length, 'tasks found');
      console.log('Query result type:', typeof result);
      console.log('Query result structure:', Object.keys(result));
      
      // Debug: Check first row with related_chat_jid
      if (result.rows && result.rows.length > 0) {
        const taskWithJid = result.rows.find((row: any) => row.related_chat_jid);
        if (taskWithJid) {
          console.log('Sample task with JID:', {
            task_id: taskWithJid.task_id,
            title: taskWithJid.title,
            related_chat_jid: taskWithJid.related_chat_jid,
            jid_type: typeof taskWithJid.related_chat_jid
          });
        }
      }
      
      if (result.rows && Array.isArray(result.rows)) {
        return result.rows;
      } else if (Array.isArray(result)) {
        return result;
      } else {
        console.log('Unexpected result format:', result);
        return [];
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  }

  async getCrmTasks(): Promise<any[]> {
    // Return empty array for now - can be implemented based on your CRM schema
    return [];
  }

  async getCrmProjects(): Promise<any[]> {
    // Return empty array for now - can be implemented based on your CRM schema
    return [];
  }

  async getCrmChecklistItems(): Promise<any[]> {
    // Return empty array for now - can be implemented based on your CRM schema
    return [];
  }

  async getCalendarTasks(): Promise<any[]> {
    // Return empty array for now - can be implemented based on your calendar schema
    return [];
  }

  async getCalendarCalendars(userId: string): Promise<any[]> {
    try {
      const results = await db
        .select()
        .from(calendarCalendars)
        .innerJoin(calendarAccounts, eq(calendarCalendars.accountId, calendarAccounts.accountId))
        .where(eq(calendarAccounts.userId, userId))
        .orderBy(calendarCalendars.summary);
      return results.map(result => result.calendars);
    } catch (error) {
      console.error('Error fetching calendars:', error);
      return [];
    }
  }

  // WhatsApp Labels
  async createWhatsappLabel(label: any): Promise<any> {
    // Simple storage method for webhook handlers - implement with proper typing later
    console.log('Label storage not implemented yet, logging:', label);
    return label;
  }

  // WhatsApp Chat Labels
  async createWhatsappChatLabel(chatLabel: any): Promise<any> {
    // Simple storage method for webhook handlers - implement with proper typing later
    console.log('Chat label storage not implemented yet, logging:', chatLabel);
    return chatLabel;
  }

  // WhatsApp Call Logs
  async createWhatsappCallLog(callLog: any): Promise<any> {
    // Simple storage method for webhook handlers - implement with proper typing later
    console.log('Call log storage not implemented yet, logging:', callLog);
    return callLog;
  }

  async createCalendarCalendar(calendar: any): Promise<any> {
    try {
      const [newCalendar] = await db
        .insert(calendarCalendars)
        .values(calendar)
        .returning();
      return newCalendar;
    } catch (error) {
      console.error('Error creating calendar:', error);
      throw error;
    }
  }

  async updateCalendarCalendar(id: number, updates: any): Promise<any> {
    try {
      const [updatedCalendar] = await db
        .update(calendarCalendars)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(calendarCalendars.calendarId, id))
        .returning();
      return updatedCalendar;
    } catch (error) {
      console.error('Error updating calendar:', error);
      throw error;
    }
  }

  async deleteCalendarCalendar(id: number): Promise<void> {
    try {
      await db
        .delete(calendarCalendars)
        .where(eq(calendarCalendars.calendarId, id));
    } catch (error) {
      console.error('Error deleting calendar:', error);
      throw error;
    }
  }

  async getCalendarProviders(): Promise<any[]> {
    try {
      return await db.select().from(calendarAccounts);
    } catch (error) {
      console.error('Error fetching calendar providers:', error);
      return [];
    }
  }

  async getActionsInstances(): Promise<any[]> {
    // Return empty array for now - can be implemented based on your actions schema
    return [];
  }

  // Action Rules implementation
  async getMatchingActionRules(triggerType: string, triggerValue: string, instanceId: string): Promise<any[]> {
    try {
      // Query active action rules that match the trigger type and conditions
      const rules = await db.select().from(actionRules)
        .where(
          and(
            eq(actionRules.isActive, true),
            eq(actionRules.triggerType, triggerType as any)
          )
        );

      // Filter rules based on trigger conditions and instance filters
      const matchingRules = rules.filter(rule => {
        // Check trigger conditions based on trigger type
        const conditions = rule.triggerConditions as any;
        if (conditions) {
          if (triggerType === 'reaction' && conditions.reactions) {
            if (!conditions.reactions.includes(triggerValue)) {
              return false;
            }
          } else if (triggerType === 'hashtag' && conditions.hashtags) {
            if (!conditions.hashtags.includes(triggerValue)) {
              return false;
            }
          } else if (conditions.values) {
            // Fallback for other trigger types
            if (!conditions.values.includes(triggerValue)) {
              return false;
            }
          }
        }

        // Check instance filters
        const instanceFilters = rule.instanceFilters as any;
        if (instanceFilters && instanceFilters.instances) {
          if (!instanceFilters.instances.includes(instanceId)) {
            return false;
          }
        }

        return true;
      });

      return matchingRules;
    } catch (error) {
      console.error('Error getting matching action rules:', error);
      return [];
    }
  }

  async getActionExecutionsToday(ruleId: string): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [result] = await db.select({ count: sql<number>`count(*)` })
        .from(actionExecutions)
        .where(
          and(
            eq(actionExecutions.ruleId, ruleId),
            sql`${actionExecutions.executedAt} >= ${today}`,
            sql`${actionExecutions.executedAt} < ${tomorrow}`
          )
        );

      return result.count || 0;
    } catch (error) {
      console.error('Error getting today action executions:', error);
      return 0;
    }
  }

  async createActionExecution(execution: any): Promise<any> {
    try {
      const [newExecution] = await db.insert(actionExecutions).values({
        ruleId: execution.ruleId,
        triggeredBy: execution.triggeredBy,
        triggerData: execution.triggerData,
        status: execution.status,
        result: execution.result,
        errorMessage: execution.errorMessage,
        executedAt: execution.executedAt,
        processingTimeMs: execution.processingTimeMs
      }).returning();
      
      return newExecution;
    } catch (error) {
      console.error('Error creating action execution:', error);
      throw error;
    }
  }

  async updateActionRuleStats(ruleId: string): Promise<void> {
    try {
      await db.update(actionRules)
        .set({ 
          totalExecutions: sql`${actionRules.totalExecutions} + 1`,
          lastExecutedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(actionRules.ruleId, ruleId));
    } catch (error) {
      console.error('Error updating action rule stats:', error);
    }
  }

  async createTask(taskData: any): Promise<any> {
    try {
      // Use simplified raw SQL for CRM tasks table
      const instanceId = taskData.instanceId || 'instance-1750433520122';
      const title = taskData.title || 'Automated Task';
      const description = taskData.description || 'Task created from WhatsApp reaction';
      const status = taskData.status || 'pending';
      const priority = taskData.priority || 'medium';
      const triggeringMessageId = taskData.triggeringMessageId || null;
      const relatedChatJid = taskData.relatedChatJid || null;
      
      const result = await db.execute(sql`
        INSERT INTO crm.tasks (
          instance_id, title, description, status, priority, 
          triggering_message_id, related_chat_jid, created_at, updated_at
        ) 
        VALUES (
          ${instanceId}, ${title}, ${description}, ${status}, ${priority}, 
          ${triggeringMessageId}, ${relatedChatJid}, NOW(), NOW()
        ) 
        RETURNING *
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async createCalendarEvent(eventData: any): Promise<any> {
    try {
      // Use raw SQL to insert into the correct calendar events table
      const result = await db.execute(sql`
        INSERT INTO calendar.events (
          calendar_id, provider_event_id, title, description, 
          start_time, end_time, is_all_day, location, status,
          created_at, updated_at
        ) VALUES (
          ${eventData.calendarId || 1},
          ${eventData.providerEventId || `whatsapp-${Date.now()}`},
          ${eventData.title},
          ${eventData.description || ''},
          ${eventData.startTime || new Date()},
          ${eventData.endTime || new Date(Date.now() + 60 * 60 * 1000)},
          ${eventData.isAllDay || false},
          ${eventData.location || null},
          ${eventData.status || 'confirmed'},
          NOW(),
          NOW()
        ) RETURNING *
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  // Action Service support methods
  async getActionRulesByTrigger(triggerType: string, triggerValue: string, instanceId: string): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT rule_id, rule_name, trigger_type, trigger_value, action_type, action_config, instance_id, is_active
        FROM crm.action_rules 
        WHERE is_active = true 
        AND trigger_type = ${triggerType}
        AND trigger_value = ${triggerValue}
        AND (instance_id = ${instanceId} OR instance_id IS NULL)
      `);
      return result.rows;
    } catch (error) {
      console.error('Error getting action rules:', error);
      return [];
    }
  }

  async getTasksByTriggeringMessageId(messageId: string, instanceId: string): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM crm.tasks 
        WHERE triggering_message_id = ${messageId}
        AND instance_id = ${instanceId}
      `);
      return result.rows;
    } catch (error) {
      console.error('Error getting tasks by triggering message:', error);
      return [];
    }
  }

  async getSpacesForUser(userId: string): Promise<any[]> {
    try {
      // Return default workspace spaces for the user
      return [
        {
          space_id: 1,
          space_name: "General",
          icon: "🏠",
          color: "#6366f1",
          display_order: 0,
          creator_user_id: userId
        },
        {
          space_id: 2,
          space_name: "Work",
          icon: "💼",
          color: "#059669",
          display_order: 1,
          creator_user_id: userId
        }
      ];
    } catch (error) {
      console.error('Error fetching spaces for user:', userId, error);
      return [];
    }
  }

  async updateTask(taskId: number, updates: any): Promise<any> {
    try {
      const setClause = Object.keys(updates)
        .map(key => `${key} = $${Object.keys(updates).indexOf(key) + 2}`)
        .join(', ');
      
      const values = [taskId, ...Object.values(updates)];
      
      const result = await db.execute(sql`
        UPDATE crm.tasks 
        SET ${sql.raw(setClause)}, updated_at = NOW()
        WHERE task_id = $1
        RETURNING *
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async getWhatsappMessage(messageId: string, instanceId: string): Promise<any> {
    try {
      const [message] = await db
        .select()
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.messageId, messageId),
            eq(whatsappMessages.instanceId, instanceId)
          )
        )
        .limit(1);
      
      return message;
    } catch (error) {
      console.error('Error getting WhatsApp message:', error);
      return null;
    }
  }



  // Action Rules methods
  async getActionRules(userId: string): Promise<any[]> {
    try {
      const result = await db.select().from(actionRules)
        .where(eq(actionRules.userId, userId))
        .orderBy(desc(actionRules.createdAt));
      return result;
    } catch (error) {
      console.error('Error fetching action rules:', error);
      return [];
    }
  }

  async getActionRule(userId: string, ruleId: string): Promise<any> {
    try {
      const [rule] = await db.select().from(actionRules)
        .where(and(
          eq(actionRules.userId, userId),
          eq(actionRules.ruleId, ruleId)
        ));
      return rule;
    } catch (error) {
      console.error('Error fetching action rule:', error);
      return null;
    }
  }

  async createActionRule(rule: any): Promise<any> {
    try {
      const [newRule] = await db.insert(actionRules).values(rule).returning();
      return newRule;
    } catch (error) {
      console.error('Error creating action rule:', error);
      throw error;
    }
  }

  async updateActionRule(userId: string, ruleId: string, rule: any): Promise<any> {
    try {
      const [updatedRule] = await db.update(actionRules)
        .set({ ...rule, updatedAt: new Date() })
        .where(and(
          eq(actionRules.userId, userId),
          eq(actionRules.ruleId, ruleId)
        ))
        .returning();
      return updatedRule;
    } catch (error) {
      console.error('Error updating action rule:', error);
      throw error;
    }
  }

  async deleteActionRule(userId: string, ruleId: string): Promise<void> {
    try {
      await db.delete(actionRules).where(and(
        eq(actionRules.userId, userId),
        eq(actionRules.ruleId, ruleId)
      ));
    } catch (error) {
      console.error('Error deleting action rule:', error);
      throw error;
    }
  }

  async getActionTemplates(): Promise<any[]> {
    try {
      // Return some basic templates for now since the action templates table might not have data
      return [
        {
          templateId: '1',
          templateName: 'Create Task from Hashtag',
          description: 'Automatically create a task when a message contains #task',
          category: 'productivity',
          triggerType: 'hashtag',
          actionType: 'create_task',
          defaultConfig: {
            triggerConditions: { hashtag: 'task' },
            actionConfig: { priority: 'medium' }
          }
        },
        {
          templateId: '2',
          templateName: 'Urgent Item Detection',
          description: 'Create priority tasks for messages with urgent keywords',
          category: 'productivity',
          triggerType: 'keyword',
          actionType: 'create_task',
          defaultConfig: {
            triggerConditions: { keywords: ['urgent', 'URGENT', 'urgente'] },
            actionConfig: { priority: 'high' }
          }
        }
      ];
    } catch (error) {
      console.error('Error fetching action templates:', error);
      return [];
    }
  }

  async getInstanceById(instanceId: string): Promise<any> {
    try {
      const [instance] = await db.select().from(whatsappInstances)
        .where(eq(whatsappInstances.instanceId, instanceId));
      return instance || null;
    } catch (error) {
      console.error('Error fetching instance by ID:', instanceId, error);
      return null;
    }
  }
}

export const storage = new DatabaseStorage();