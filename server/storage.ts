import { db } from "./db"; // Your Drizzle ORM instance
import { sql, eq, desc, and, or, ilike } from "drizzle-orm";
import {
    // App Schema
    appUsers,
    // WhatsApp Schema
    whatsappInstances, whatsappContacts, whatsappChats, whatsappMessages,
    whatsappGroups, whatsappGroupParticipants, whatsappMessageReactions,
    // Legacy Schema
    tasks, contacts,
    // Actions Schema
    actionRules,
    // Type Imports
    type AppUser, type InsertAppUser,
    type WhatsappInstance, type InsertWhatsappInstance,
    type WhatsappContact, type InsertWhatsappContact,
    type WhatsappChat, type InsertWhatsappChat,
    type WhatsappMessage, type InsertWhatsappMessage,
    type WhatsappGroup, type InsertWhatsappGroup,
    type WhatsappGroupParticipant, type InsertWhatsappGroupParticipant,
    type WhatsappMessageReaction, type InsertWhatsappMessageReaction
} from "../shared/schema"; // Assuming a single, final schema definition file

/**
 * @class DatabaseStorage
 * @description The "Warehouse Clerk" layer. Its only job is to execute SQL
 * queries against the database using a shared connection pool. It abstracts all
 * database interactions away from the rest of the application.
 */
class DatabaseStorage {

    // =========================================================================
    // APP SCHEMA METHODS
    // =========================================================================

    async getUserById(userId: string): Promise<AppUser | null> {
        const [user] = await db.select().from(appUsers).where(eq(appUsers.userId, userId));
        return user || null;
    }

    async getUserByEmail(email: string): Promise<AppUser | null> {
        const [user] = await db.select().from(appUsers).where(eq(appUsers.email, email.toLowerCase()));
        return user || null;
    }
    
    async getSpacesForUser(userId: string): Promise<any[]> {
        return [];
    }

    // =========================================================================
    // WHATSAPP SCHEMA METHODS
    // =========================================================================

    async getInstanceById(instanceId: string): Promise<WhatsappInstance | null> {
        const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.instanceId, instanceId));
        return instance || null;
    }
    
    async getWhatsappConversations(userId: string): Promise<any[]> {
        const results = await db.select({
            chatId: whatsappChats.chatId,
            instanceId: whatsappChats.instanceId,
            type: whatsappChats.type,
            unreadCount: whatsappChats.unreadCount,
            lastMessageTimestamp: whatsappChats.lastMessageTimestamp,
            displayName: sql<string>`COALESCE(${whatsappGroups.subject}, ${whatsappContacts.pushName}, ${whatsappChats.chatId})`,
            profilePictureUrl: whatsappContacts.profilePictureUrl,
        })
        .from(whatsappChats)
        .innerJoin(whatsappInstances, eq(whatsappChats.instanceId, whatsappInstances.instanceId))
        .leftJoin(whatsappContacts, and(eq(whatsappChats.chatId, whatsappContacts.jid), eq(whatsappChats.instanceId, whatsappContacts.instanceId)))
        .leftJoin(whatsappGroups, and(eq(whatsappChats.chatId, whatsappGroups.groupJid), eq(whatsappChats.instanceId, whatsappGroups.instanceId)))
        .where(eq(whatsappInstances.clientId, userId))
        .orderBy(desc(sql`COALESCE(${whatsappChats.lastMessageTimestamp}, ${whatsappChats.createdAt})`));

        return results;
    }
    
    async getWhatsappContacts(userId: string): Promise<WhatsappContact[]> {
        const results = await db.select().from(whatsappContacts);
        return results;
    }

    async getWhatsappGroups(instanceId?: string): Promise<WhatsappGroup[]> {
        if (instanceId) {
            const results = await db.select().from(whatsappGroups)
                .where(eq(whatsappGroups.instanceId, instanceId));
            return results;
        }
        const results = await db.select().from(whatsappGroups);
        return results;
    }

    async upsertWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact> {
        const [result] = await db.insert(whatsappContacts)
            .values(contact)
            .onConflictDoUpdate({
                target: [whatsappContacts.jid, whatsappContacts.instance_id],
                set: {
                    push_name: contact.push_name,
                    profile_picture_url: contact.profile_picture_url,
                    last_updated_at: new Date()
                }
            })
            .returning();
        return result;
    }

    async upsertWhatsappChat(chat: InsertWhatsappChat): Promise<WhatsappChat> {
        const [result] = await db.insert(whatsappChats)
            .values(chat)
            .onConflictDoUpdate({
                target: [whatsappChats.chat_id, whatsappChats.instance_id],
                set: {
                    unread_count: chat.unread_count,
                    last_message_timestamp: chat.last_message_timestamp,
                    updated_at: new Date()
                }
            })
            .returning();
        return result;
    }
    
    async upsertWhatsappGroup(group: InsertWhatsappGroup): Promise<WhatsappGroup> {
        const [result] = await db.insert(whatsappGroups)
            .values(group)
            .onConflictDoUpdate({
                target: [whatsappGroups.group_jid, whatsappGroups.instance_id],
                set: {
                    subject: group.subject,
                    description: group.description,
                    owner_jid: group.owner_jid,
                    updated_at: new Date()
                }
            })
            .returning();
        return result;
    }

    async upsertWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
        const [result] = await db.insert(whatsappMessages)
            .values(message)
            .onConflictDoUpdate({
                target: [whatsappMessages.message_id, whatsappMessages.instance_id],
                set: {
                    content: message.content,
                    is_edited: message.is_edited,
                    last_edited_at: message.last_edited_at,
                }
            })
            .returning();
        return result;
    }

    // =========================================================================
    // ADDITIONAL REQUIRED METHODS
    // =========================================================================

    async getConversationsWithLatestMessages(userId: string): Promise<any[]> {
        return this.getWhatsappConversations(userId);
    }

    async getWhatsappInstances(userId: string): Promise<any[]> {
        const results = await db.select().from(whatsappInstances);
        return results;
    }

    async getInstanceStatus(instanceId: string): Promise<any> {
        const instance = await this.getInstanceById(instanceId);
        return {
            instanceId,
            isConnected: instance?.is_connected || false,
            status: instance?.is_connected ? 'connected' : 'disconnected'
        };
    }

    async getWhatsappMessages(userId: string, instanceId: string, chatId: string, limit: number = 50): Promise<any[]> {
        let query = db.select().from(whatsappMessages)
            .where(eq(whatsappMessages.instance_id, instanceId))
            .orderBy(desc(whatsappMessages.timestamp))
            .limit(limit);

        if (chatId) {
            query = db.select().from(whatsappMessages)
                .where(and(
                    eq(whatsappMessages.instance_id, instanceId),
                    eq(whatsappMessages.chat_id, chatId)
                ))
                .orderBy(desc(whatsappMessages.timestamp))
                .limit(limit);
        }

        const result = await query;
        return result;
    }

    // Reaction methods for webhook processing
    async upsertWhatsappReaction(reaction: InsertWhatsappMessageReaction): Promise<WhatsappMessageReaction> {
        const [result] = await db.insert(whatsappMessageReactions)
            .values(reaction)
            .onConflictDoUpdate({
                target: [whatsappMessageReactions.message_id, whatsappMessageReactions.instance_id, whatsappMessageReactions.reactor_jid],
                set: {
                    reaction_emoji: reaction.reaction_emoji,
                    timestamp: reaction.timestamp
                }
            })
            .returning();
        return result;
    }

    // Alias for backward compatibility with existing webhook code
    async upsertWhatsappMessageReaction(reaction: InsertWhatsappMessageReaction): Promise<WhatsappMessageReaction> {
        return this.upsertWhatsappReaction(reaction);
    }

    // Task management methods
    async getTasks(): Promise<any[]> {
        const results = await db.select().from(tasks);
        return results;
    }

    async getProjects(): Promise<any[]> {
        return [];
    }

    async getChecklistItems(): Promise<any[]> {
        return [];
    }

    // Calendar methods
    async getCalendarEvents(): Promise<any[]> {
        return [];
    }

    async createCalendarEvent(eventData: any): Promise<any> {
        return { id: 'placeholder', ...eventData };
    }

    async updateCalendarEvent(id: string, eventData: any): Promise<any> {
        return { id, ...eventData };
    }

    async deleteCalendarEvent(id: string): Promise<void> {
        // Implementation
    }

    async getCalendarProviders(): Promise<any[]> {
        return [];
    }

    // Action rules methods
    async getActionRules(userId: string): Promise<any[]> {
        const results = await db.select().from(actionRules);
        return results;
    }

    // Group placeholder creation
    async createGroupPlaceholderIfNeeded(groupJid: string, instanceId: string): Promise<void> {
        await db.insert(whatsappGroups)
            .values({
                group_jid: groupJid,
                instance_id: instanceId,
                subject: 'Group',
                created_at: new Date(),
                updated_at: new Date()
            })
            .onConflictDoNothing({
                target: [whatsappGroups.group_jid, whatsappGroups.instance_id]
            });
    }
}

export const storage = new DatabaseStorage();