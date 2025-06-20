import { 
  users,
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
  calendarAccounts,
  calendarCalendars,
  calendarEvents,
  calendarAttendees,
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
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(userId: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: string, user: Partial<InsertUser>): Promise<User>;

  // WhatsApp instances
  getWhatsappInstances(userId: string): Promise<WhatsappInstance[]>;
  getWhatsappInstance(userId: string, instanceId: string): Promise<WhatsappInstance | undefined>;
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

  // WhatsApp chats
  getWhatsappChats(userId: string, instanceId?: string): Promise<WhatsappChat[]>;
  getWhatsappChat(userId: string, instanceId: string, chatId: string): Promise<WhatsappChat | undefined>;
  createWhatsappChat(chat: InsertWhatsappChat): Promise<WhatsappChat>;
  updateWhatsappChat(userId: string, instanceId: string, chatId: string, chat: Partial<InsertWhatsappChat>): Promise<WhatsappChat>;
  deleteWhatsappChat(userId: string, instanceId: string, chatId: string): Promise<void>;
  getConversationsWithLatestMessages(userId: string): Promise<any[]>;

  // WhatsApp messages
  getWhatsappMessages(userId: string, instanceId: string, chatId: string, limit?: number): Promise<WhatsappMessage[]>;
  getWhatsappMessage(userId: string, instanceId: string, messageId: string): Promise<WhatsappMessage | undefined>;
  createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  updateWhatsappMessage(userId: string, instanceId: string, messageId: string, message: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage>;
  deleteWhatsappMessage(userId: string, instanceId: string, messageId: string): Promise<void>;

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
  updateWhatsappGroup(userId: string, instanceId: string, groupJid: string, group: Partial<InsertWhatsappGroup>): Promise<WhatsappGroup>;

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

  async deleteWhatsappMessage(userId: string, instanceId: string, messageId: string): Promise<void> {
    await db
      .delete(whatsappMessages)
      .where(and(
        eq(whatsappMessages.instanceId, instanceId),
        eq(whatsappMessages.messageId, messageId)
      ));
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
}

export const storage = new DatabaseStorage();