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

    async upsertWhatsappInstance(instance: any): Promise<any> {
        // Use raw SQL to handle the visibility field requirement
        const result = await db.execute(sql`
            INSERT INTO whatsapp.instances (
                instance_id, display_name, client_id, api_key, webhook_url, 
                is_connected, visibility, owner_jid, last_connection_at
            )
            VALUES (
                ${instance.instanceId}, 
                ${instance.displayName}, 
                ${instance.clientId}, 
                ${instance.apiKey}, 
                ${instance.webhookUrl}, 
                ${instance.isConnected || false}, 
                'private', 
                ${instance.ownerJid}, 
                ${instance.lastConnectionAt}
            )
            ON CONFLICT (instance_id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                api_key = EXCLUDED.api_key,
                webhook_url = EXCLUDED.webhook_url,
                is_connected = EXCLUDED.is_connected,
                owner_jid = EXCLUDED.owner_jid,
                last_connection_at = EXCLUDED.last_connection_at,
                updated_at = NOW()
            RETURNING *
        `);
        
        return result.rows[0];
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
        const results = await db.execute(sql`
            SELECT 
                instance_name as "instanceId",
                instance_name as "instanceName", 
                display_name as "displayName",
                api_key as "apiKey",
                is_connected as "isConnected",
                created_at as "createdAt"
            FROM whatsapp.instances 
            ORDER BY created_at DESC
        `);
        
        return results.rows;
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
        const results = await db.execute(sql`
            SELECT 
                task_id,
                title,
                description,
                status,
                priority,
                due_date,
                project_id,
                parent_task_id,
                instance_id,
                triggering_message_id,
                assigned_to_user_id,
                related_chat_jid,
                created_by_user_id,
                created_at,
                updated_at,
                space_id
            FROM crm.tasks 
            ORDER BY created_at DESC
        `);
        
        return results.rows;
    }

    async updateTask(taskId: number, updates: any): Promise<any> {
        // Build dynamic SET clause based on provided updates
        const setFields = [];
        const values = [taskId]; // Start with taskId as $1
        let paramIndex = 2; // Next parameter will be $2
        
        if (updates.status !== undefined) {
            setFields.push(`status = $${paramIndex}`);
            values.push(updates.status);
            paramIndex++;
        }
        if (updates.priority !== undefined) {
            setFields.push(`priority = $${paramIndex}`);
            values.push(updates.priority);
            paramIndex++;
        }
        if (updates.title !== undefined) {
            setFields.push(`title = $${paramIndex}`);
            values.push(updates.title);
            paramIndex++;
        }
        if (updates.description !== undefined) {
            setFields.push(`description = $${paramIndex}`);
            values.push(updates.description);
            paramIndex++;
        }
        if (updates.due_date !== undefined) {
            setFields.push(`due_date = $${paramIndex}`);
            values.push(updates.due_date);
            paramIndex++;
        }
        
        setFields.push('updated_at = NOW()');
        
        const query = `
            UPDATE crm.tasks 
            SET ${setFields.join(', ')}
            WHERE task_id = $1
            RETURNING *
        `;
        
        const result = await db.execute(sql.raw(query, values));
        return result.rows[0];
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

    async getGroupsBySpace(spaceId: string): Promise<any[]> {
        try {
            console.log(`[Storage] Fetching groups for space: ${spaceId}`);
            
            // Execute direct SQL query to verify database connection
            const groupsRaw = await db.execute(sql`
                SELECT group_jid, instance_id, subject, description, is_locked, creation_timestamp 
                FROM whatsapp.groups 
                ORDER BY subject
            `);
            
            console.log(`[Storage] Raw query returned ${groupsRaw.length} rows`);
            
            if (groupsRaw.length === 0) {
                console.log('[Storage] No groups found in database');
                return [];
            }
            
            // Get participant counts
            const participantCounts = await db.execute(sql`
                SELECT group_jid, COUNT(*) as count 
                FROM whatsapp.group_participants 
                GROUP BY group_jid
            `);
            
            const participantMap = new Map(
                participantCounts.map((p: any) => [p.group_jid, parseInt(p.count)])
            );
            
            // Map to expected format
            const mappedGroups = groupsRaw.map((group: any) => ({
                jid: group.group_jid,
                instanceId: group.instance_id,
                subject: group.subject || 'Unknown Group',
                description: group.description,
                participantCount: participantMap.get(group.group_jid) || 0,
                isAnnounce: false,
                isLocked: group.is_locked || false,
                createdAt: group.creation_timestamp ? new Date(group.creation_timestamp).toISOString() : new Date().toISOString(),
            }));
            
            console.log(`[Storage] Returning ${mappedGroups.length} mapped groups`);
            console.log(`[Storage] Sample group:`, mappedGroups[0]);
            
            return mappedGroups;
        } catch (error) {
            console.error('[Storage] Error fetching groups:', error);
            return [];
        }
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

    async getWhatsappContact(jid: string, instanceId: string): Promise<WhatsappContact | undefined> {
        const [result] = await db.select()
            .from(whatsappContacts)
            .where(and(
                eq(whatsappContacts.jid, jid),
                eq(whatsappContacts.instanceId, instanceId)
            ))
            .limit(1);
        return result;
    }

    // =========================================================================
    // PATTERN-BASED QUERY METHODS FOR CLEANUP OPERATIONS
    // =========================================================================

    async getContactsByPattern(instanceId: string, jidPattern: string): Promise<WhatsappContact[]> {
        return await db.select()
            .from(whatsappContacts)
            .where(and(
                eq(whatsappContacts.instanceId, instanceId),
                ilike(whatsappContacts.jid, jidPattern)
            ));
    }

    async getChatsByPattern(instanceId: string, chatIdPattern: string): Promise<WhatsappChat[]> {
        return await db.select()
            .from(whatsappChats)
            .where(and(
                eq(whatsappChats.instanceId, instanceId),
                ilike(whatsappChats.chatId, chatIdPattern)
            ));
    }

    async getGroupsByPattern(instanceId: string, groupJidPattern: string): Promise<WhatsappGroup[]> {
        return await db.select()
            .from(whatsappGroups)
            .where(and(
                eq(whatsappGroups.instanceId, instanceId),
                ilike(whatsappGroups.groupJid, groupJidPattern)
            ));
    }

    async deleteWhatsappContact(jid: string, instanceId: string): Promise<void> {
        await db.delete(whatsappContacts)
            .where(and(
                eq(whatsappContacts.jid, jid),
                eq(whatsappContacts.instanceId, instanceId)
            ));
    }

    async deleteWhatsappChat(chatId: string, instanceId: string): Promise<void> {
        await db.delete(whatsappChats)
            .where(and(
                eq(whatsappChats.chatId, chatId),
                eq(whatsappChats.instanceId, instanceId)
            ));
    }

    async deleteWhatsappGroup(groupJid: string, instanceId: string): Promise<void> {
        await db.delete(whatsappGroups)
            .where(and(
                eq(whatsappGroups.groupJid, groupJid),
                eq(whatsappGroups.instanceId, instanceId)
            ));
    }

    async deleteWhatsappInstance(instanceId: string): Promise<void> {
        await db.delete(whatsappInstances)
            .where(eq(whatsappInstances.instanceId, instanceId));
    }
}

export const storage = new DatabaseStorage();