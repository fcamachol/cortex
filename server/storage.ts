import { db } from "./db";
import { sql, eq, desc, and, or, ilike } from "drizzle-orm";
import {
    // App Schema
    appUsers,
    // WhatsApp Schema
    whatsappInstances, whatsappContacts, whatsappChats, whatsappMessages,
    whatsappMessageReactions, whatsappGroups, whatsappGroupParticipants,
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
} from "../shared/schema";

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

    // =========================================================================
    // WHATSAPP SCHEMA METHODS
    // =========================================================================

    async getInstanceById(instanceId: string): Promise<WhatsappInstance | null> {
        const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.instanceId, instanceId));
        return instance || null;
    }

    async upsertWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact> {
        const [result] = await db.insert(whatsappContacts)
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
        return result;
    }

    async upsertWhatsappChat(chat: InsertWhatsappChat): Promise<WhatsappChat> {
        const [result] = await db.insert(whatsappChats)
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
        return result;
    }
    
    async upsertWhatsappGroup(group: InsertWhatsappGroup): Promise<WhatsappGroup> {
        const [result] = await db.insert(whatsappGroups)
            .values(group)
            .onConflictDoUpdate({
                target: [whatsappGroups.groupJid, whatsappGroups.instanceId],
                set: {
                    // Only update the subject if it's not the generic placeholder
                    subject: group.subject !== 'New Group' && group.subject !== 'Group' ? group.subject : sql`${whatsappGroups.subject}`,
                    description: group.description,
                    ownerJid: group.ownerJid,
                    creationTimestamp: group.creationTimestamp,
                    isLocked: group.isLocked,
                    updatedAt: new Date()
                }
            })
            .returning();
        return result;
    }

    async upsertWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
        const [result] = await db.insert(whatsappMessages)
            .values(message)
            .onConflictDoUpdate({
                target: [whatsappMessages.messageId, whatsappMessages.instanceId],
                set: {
                    content: message.content,
                    isStarred: message.isStarred,
                    isEdited: message.isEdited,
                    lastEditedAt: message.lastEditedAt,
                    rawApiPayload: message.rawApiPayload
                }
            })
            .returning();
        return result;
    }

    async upsertWhatsappReaction(reaction: InsertWhatsappMessageReaction): Promise<WhatsappMessageReaction> {
        const [result] = await db.insert(whatsappMessageReactions)
            .values(reaction)
            .onConflictDoUpdate({
                target: [whatsappMessageReactions.messageId, whatsappMessageReactions.instanceId, whatsappMessageReactions.reactorJid],
                set: {
                    reactionEmoji: reaction.reactionEmoji,
                    timestamp: reaction.timestamp
                }
            })
            .returning();
        return result;
    }
    
    async createGroupPlaceholderIfNeeded(groupJid: string, instanceId: string): Promise<void> {
        // This query attempts to insert a placeholder. If the group already exists,
        // the ON CONFLICT clause does nothing, preventing overwrites.
        await db.insert(whatsappGroups)
            .values({
                groupJid,
                instanceId,
                subject: 'Group',
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .onConflictDoNothing({
                target: [whatsappGroups.groupJid, whatsappGroups.instanceId]
            });
    }

    // =========================================================================
    // LEGACY SUPPORT METHODS (for backward compatibility)
    // =========================================================================

    async getWhatsappConversations(userId: string): Promise<any[]> {
        // Query chats with contact information for conversations view
        const result = await db.select({
            chatId: whatsappChats.chatId,
            instanceId: whatsappChats.instanceId,
            type: whatsappChats.type,
            unreadCount: whatsappChats.unreadCount,
            lastMessageTimestamp: whatsappChats.lastMessageTimestamp,
            contactName: whatsappContacts.pushName,
            contactProfilePicture: whatsappContacts.profilePictureUrl,
            groupSubject: whatsappGroups.subject
        })
        .from(whatsappChats)
        .leftJoin(whatsappContacts, and(
            eq(whatsappContacts.jid, whatsappChats.chatId),
            eq(whatsappContacts.instanceId, whatsappChats.instanceId)
        ))
        .leftJoin(whatsappGroups, and(
            eq(whatsappGroups.groupJid, whatsappChats.chatId),
            eq(whatsappGroups.instanceId, whatsappChats.instanceId)
        ))
        .orderBy(desc(whatsappChats.lastMessageTimestamp));
        
        return result;
    }

    async getConversationsWithLatestMessages(userId: string): Promise<any[]> {
        // Get chats with their latest messages
        return this.getWhatsappConversations(userId);
    }

    async getWhatsappInstances(userId: string): Promise<any[]> {
        const result = await db.select().from(whatsappInstances);
        return result;
    }

    async getInstanceStatus(instanceId: string): Promise<any> {
        const instance = await this.getInstanceById(instanceId);
        return {
            instanceId,
            isConnected: instance?.isConnected || false,
            status: instance?.isConnected ? 'connected' : 'disconnected'
        };
    }

    async getWhatsappMessages(userId: string, instanceId: string, chatId: string, limit: number = 50): Promise<any[]> {
        let query = db.select().from(whatsappMessages)
            .where(eq(whatsappMessages.instanceId, instanceId))
            .orderBy(desc(whatsappMessages.timestamp))
            .limit(limit);

        if (chatId) {
            query = db.select().from(whatsappMessages)
                .where(and(
                    eq(whatsappMessages.instanceId, instanceId),
                    eq(whatsappMessages.chatId, chatId)
                ))
                .orderBy(desc(whatsappMessages.timestamp))
                .limit(limit);
        }

        const result = await query;
        return result;
    }

    async getWhatsappContacts(userId: string): Promise<any[]> {
        const result = await db.select().from(whatsappContacts)
            .orderBy(whatsappContacts.pushName);
        return result;
    }
}

export const storage = new DatabaseStorage();