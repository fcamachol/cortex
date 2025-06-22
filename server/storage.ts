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
                target: [whatsappMessageReactions.message_id, whatsappMessageReactions.instance_id, whatsappMessageReactions.reactor_jid],
                set: {
                    reaction_emoji: reaction.reaction_emoji,
                    timestamp: reaction.timestamp
                }
            })
            .returning();
        return result;
    }
    
    async createGroupPlaceholderIfNeeded(groupJid: string, instanceId: string): Promise<void> {
        // This query attempts to insert a placeholder. If the group already exists,
        // the ON CONFLICT clause does nothing, preventing overwrites.
        const [result] = await db.insert(whatsappGroups)
            .values({
                groupJid,
                instanceId,
                subject: 'Group',
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .onConflictDoNothing({
                target: [whatsappGroups.groupJid, whatsappGroups.instanceId]
            })
            .returning();
    }
}

export const storage = new DatabaseStorage();