import { db } from "./db"; // Your Drizzle ORM instance
import { sql, eq, desc, and, or, ilike } from "drizzle-orm";
import {
    // App Schema
    appUsers, workspaces, appSpaces, workspaceMembers,
    // WhatsApp Schema
    whatsappInstances, whatsappContacts, whatsappChats, whatsappMessages,
    whatsappGroups, whatsappGroupParticipants, whatsappMessageReactions,
    // Legacy Schema
    tasks, contacts,
    // Actions Schema
    actionRules,
    // CRM Schema
    crmProjects, crmTasks, crmTaskChecklistItems,
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

    async getWhatsappInstance(instanceId: string): Promise<WhatsappInstance | null> {
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
        const results = await db.select({ contact: whatsappContacts })
            .from(whatsappContacts)
            .innerJoin(whatsappInstances, eq(whatsappContacts.instanceId, whatsappInstances.instanceId))
            .where(and(
                eq(whatsappInstances.clientId, userId),
                eq(whatsappContacts.isMe, false)
            ));
            
        return results.map(r => r.contact);
    }
    
    async getWhatsappGroups(instanceId: string): Promise<WhatsappGroup[]> {
        return await db.select().from(whatsappGroups).where(eq(whatsappGroups.instanceId, instanceId));
    }

    async getWhatsappChat(chatId: string, instanceId: string): Promise<WhatsappChat | null> {
        const [chat] = await db.select().from(whatsappChats).where(
            and(
                eq(whatsappChats.chatId, chatId),
                eq(whatsappChats.instanceId, instanceId)
            )
        );
        return chat || null;
    }

    async getWhatsappGroup(groupJid: string, instanceId: string): Promise<WhatsappGroup | null> {
        const [group] = await db.select().from(whatsappGroups).where(
            and(
                eq(whatsappGroups.groupJid, groupJid),
                eq(whatsappGroups.instanceId, instanceId)
            )
        );
        return group || null;
    }

    async upsertWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact> {
        // Build the update object dynamically to avoid undefined values
        const updateSet: Partial<InsertWhatsappContact> = { lastUpdatedAt: new Date() };
        if (contact.pushName) updateSet.pushName = contact.pushName;
        if (contact.profilePictureUrl) updateSet.profilePictureUrl = contact.profilePictureUrl;
        if (contact.verifiedName) updateSet.verifiedName = contact.verifiedName;
        if (typeof contact.isBusiness === 'boolean') updateSet.isBusiness = contact.isBusiness;
        if (typeof contact.isBlocked === 'boolean') updateSet.isBlocked = contact.isBlocked;

        const [result] = await db.insert(whatsappContacts)
            .values(contact)
            .onConflictDoUpdate({
                target: [whatsappContacts.jid, whatsappContacts.instanceId],
                set: updateSet
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
                    unreadCount: chat.unreadCount,
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
                    subject: group.subject,
                    description: group.description,
                    ownerJid: group.ownerJid,
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
                    isEdited: message.isEdited,
                    lastEditedAt: message.lastEditedAt,
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

    async getWhatsappMessageById(messageId: string, instanceId: string): Promise<WhatsappMessages | undefined> {
        const [result] = await db.select().from(whatsappMessages)
            .where(and(
                eq(whatsappMessages.messageId, messageId),
                eq(whatsappMessages.instanceId, instanceId)
            ))
            .limit(1);
        return result;
    }

    async upsertWhatsappReaction(reaction: InsertWhatsappMessageReaction): Promise<WhatsappMessageReaction> {
        // Build the update object dynamically to avoid undefined values
        const updateSet: Partial<InsertWhatsappMessageReaction> = { timestamp: reaction.timestamp };
        if (reaction.reactionEmoji) updateSet.reactionEmoji = reaction.reactionEmoji;

        const [result] = await db.insert(whatsappMessageReactions)
            .values(reaction)
            .onConflictDoUpdate({
                target: [whatsappMessageReactions.messageId, whatsappMessageReactions.instanceId, whatsappMessageReactions.reactorJid],
                set: updateSet
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

    async getGroupsBySpace(spaceId: string): Promise<WhatsappGroup[]> {
        // For now, return all groups since instance-space mapping needs to be established
        // This matches the space ID being used in the frontend
        const groups = await db.select().from(whatsappGroups);
        
        // Map the database columns to the expected format
        return groups.map(group => ({
            jid: group.groupJid,
            instanceId: group.instanceId,
            subject: group.subject || 'Unknown Group',
            description: group.description,
            participantCount: 0, // Will be populated from participants table if needed
            isAnnounce: group.isLocked || false,
            isLocked: group.isLocked || false,
            createdAt: group.creationTimestamp?.toISOString() || new Date().toISOString(),
        }));
    }

    /**
     * Fetches all active action rules that match a specific trigger type and value.
     * @param triggerType - The type of trigger (e.g., 'reaction', 'hashtag').
     * @param triggerValue - The specific value of the trigger (e.g., '✅', '#task').
     * @param instanceId - The instance where the trigger occurred.
     * @returns An array of matching action rule records.
     */
    async getActionRulesByTrigger(triggerType: string, triggerValue: string, instanceId: string): Promise<any[]> {
        try {
            // Find all active rules for the given instance that match the trigger type
            const rules = await db.select()
                .from(actionRules)
                .where(and(
                    eq(actionRules.isActive, true),
                    eq(actionRules.triggerType, triggerType as any),
                    // Check if the trigger_conditions JSONB contains the trigger value
                    sql`trigger_conditions ->> 'emoji' = ${triggerValue} OR trigger_conditions ->> 'hashtag' = ${triggerValue}`
                ));

            // Filter by instance if the rule has instance filters
            return rules.filter(rule => {
                if (!rule.instanceFilters) return true; // Rule applies to all instances
                const filters = rule.instanceFilters as any;
                if (Array.isArray(filters.include) && filters.include.length > 0) {
                    return filters.include.includes(instanceId);
                }
                if (Array.isArray(filters.exclude) && filters.exclude.length > 0) {
                    return !filters.exclude.includes(instanceId);
                }
                return true;
            });

        } catch (error) {
            console.error('Error fetching action rules by trigger:', error);
            return [];
        }
    }

    // =========================================================================
    // GROUP PARTICIPANT METHODS
    // =========================================================================

    async upsertGroupParticipant(participant: InsertWhatsappGroupParticipant): Promise<WhatsappGroupParticipant> {
        const [result] = await db.insert(whatsappGroupParticipants)
            .values({
                ...participant,
                joinedAt: participant.joinedAt || new Date(),
                updatedAt: new Date()
            })
            .onConflictDoUpdate({
                target: [whatsappGroupParticipants.groupJid, whatsappGroupParticipants.participantJid, whatsappGroupParticipants.instanceId],
                set: {
                    isAdmin: participant.isAdmin,
                    isSuperAdmin: participant.isSuperAdmin,
                    updatedAt: new Date()
                }
            })
            .returning();
        return result;
    }

    async removeGroupParticipant(groupJid: string, participantJid: string, instanceId: string): Promise<void> {
        await db.delete(whatsappGroupParticipants)
            .where(and(
                eq(whatsappGroupParticipants.groupJid, groupJid),
                eq(whatsappGroupParticipants.participantJid, participantJid),
                eq(whatsappGroupParticipants.instanceId, instanceId)
            ));
    }

    async updateGroupParticipantRole(groupJid: string, participantJid: string, instanceId: string, isAdmin: boolean): Promise<void> {
        await db.update(whatsappGroupParticipants)
            .set({
                isAdmin: isAdmin,
                isSuperAdmin: false, // Reset super admin when demoting
                updatedAt: new Date()
            })
            .where(and(
                eq(whatsappGroupParticipants.groupJid, groupJid),
                eq(whatsappGroupParticipants.participantJid, participantJid),
                eq(whatsappGroupParticipants.instanceId, instanceId)
            ));
    }

    async getGroupParticipants(groupJid: string, instanceId: string): Promise<WhatsappGroupParticipant[]> {
        return await db.select()
            .from(whatsappGroupParticipants)
            .where(and(
                eq(whatsappGroupParticipants.groupJid, groupJid),
                eq(whatsappGroupParticipants.instanceId, instanceId)
            ));
    }
}

export const storage = new DatabaseStorage();