import { db } from "./db"; // Your Drizzle ORM instance
import { sql, eq, desc, and, or, ilike } from "drizzle-orm";
import {
    // App Schema
    appUsers, appWorkspaces, appSpaces, appWorkspaceMembers,
    // WhatsApp Schema
    whatsappInstances, whatsappContacts, whatsappChats, whatsappMessages,
    whatsappGroups, whatsappGroupParticipants, whatsappMessageReactions,
    whatsappMessageMedia,
    // Legacy Schema
    tasks, contacts,
    // Actions Schema
    actionRules,
    // CRM Schema
    crmTasks,
    // Type Imports
    type AppUser, type InsertAppUser,
    type WhatsappInstance, type InsertWhatsappInstance,
    type WhatsappContact, type InsertWhatsappContact,
    type WhatsappChat, type InsertWhatsappChat,
    type WhatsappMessage, type InsertWhatsappMessage,
    type WhatsappGroup, type InsertWhatsappGroup,
    type WhatsappGroupParticipant, type InsertWhatsappGroupParticipant,
    type WhatsappMessageReaction, type InsertWhatsappMessageReaction,
    type WhatsappMessageMedia, type InsertWhatsappMessageMedia,
    whatsappDrafts, type WhatsappDraft, type InsertWhatsappDraft
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
        // Use SQL to get conversations with last message content
        const results = await db.execute(sql`
            SELECT 
                c.chat_id as "chatId",
                c.instance_id as "instanceId", 
                c.type,
                c.unread_count as "unreadCount",
                c.last_message_timestamp as "lastMessageTimestamp",
                CASE 
                    WHEN c.type = 'group' THEN COALESCE(g.subject, 'Group')
                    WHEN ct.push_name IS NOT NULL AND ct.push_name != '' AND ct.push_name != c.chat_id 
                        THEN ct.push_name
                    ELSE REPLACE(REPLACE(c.chat_id, '@s.whatsapp.net', ''), '@g.us', '')
                END as "displayName",
                ct.profile_picture_url as "profilePictureUrl",
                COALESCE(last_msg.content, '') as "lastMessageContent",
                last_msg.from_me as "lastMessageFromMe",
                last_msg.timestamp as "actualLastMessageTime",
                last_msg.message_type as "lastMessageType"
            FROM whatsapp.chats c
            INNER JOIN whatsapp.instances i ON c.instance_id = i.instance_id
            LEFT JOIN whatsapp.contacts ct ON c.chat_id = ct.jid AND c.instance_id = ct.instance_id
            LEFT JOIN whatsapp.groups g ON c.chat_id = g.group_jid AND c.instance_id = g.instance_id
            LEFT JOIN LATERAL (
                SELECT m.content, m.from_me, m.timestamp, m.message_type
                FROM whatsapp.messages m
                WHERE m.chat_id = c.chat_id AND m.instance_id = c.instance_id
                ORDER BY m.timestamp DESC
                LIMIT 1
            ) last_msg ON true
            WHERE i.client_id = ${userId}
            ORDER BY COALESCE(last_msg.timestamp, c.last_message_timestamp, c.created_at) DESC
        `);

        return results.rows;
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
        // Check if contact already exists with a valid push name
        const existingContact = await db.select()
            .from(whatsappContacts)
            .where(
                and(
                    eq(whatsappContacts.jid, contact.jid),
                    eq(whatsappContacts.instanceId, contact.instanceId)
                )
            )
            .limit(1);

        const existing = existingContact[0];
        
        // Build the update object dynamically to avoid undefined values
        const updateSet: Partial<InsertWhatsappContact> = {};
        
        // Only update push name if the new one is better than existing
        if (contact.pushName && contact.pushName !== contact.jid) {
            // If no existing name, or existing name is just the JID, use new name
            if (!existing?.pushName || existing.pushName === existing.jid || existing.pushName === '') {
                updateSet.pushName = contact.pushName;
            }
            // If new name is more specific (not just phone number), prefer it
            else if (contact.pushName.length > 10 && !/^\d+$/.test(contact.pushName)) {
                updateSet.pushName = contact.pushName;
            }
        }
        
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
        // Ensure the chat exists before inserting the message
        await this.ensureChatExists(message.chatId, message.instanceId);

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

        // Update the chat's lastMessageTimestamp to keep conversations sorted correctly
        // Only update if this message is newer than the current lastMessageTimestamp
        if (result && message.timestamp) {
            await db.execute(sql`
                UPDATE whatsapp.chats 
                SET 
                    last_message_timestamp = ${message.timestamp},
                    updated_at = NOW()
                WHERE chat_id = ${message.chatId} 
                AND instance_id = ${message.instanceId}
                AND (last_message_timestamp IS NULL OR last_message_timestamp < ${message.timestamp})
            `);
        }

        return result;
    }

    async ensureChatExists(chatId: string, instanceId: string): Promise<void> {
        // Check if chat already exists
        const existingChat = await this.getWhatsappChat(chatId, instanceId);
        if (existingChat) {
            return; // Chat already exists
        }

        // Determine chat type based on JID format
        const chatType = chatId.endsWith('@g.us') ? 'group' as const : 'individual' as const;
        
        // Create the chat record
        const newChat: InsertWhatsappChat = {
            chatId,
            instanceId,
            type: chatType,
            unreadCount: 0,
            isArchived: false,
            isPinned: false,
            isMuted: false,
            lastMessageTimestamp: null
        };

        await this.upsertWhatsappChat(newChat);
        console.log(`✅ Auto-created chat: ${chatId} (${chatType})`);

        // Also ensure contact exists for the chat
        await this.ensureContactExists(chatId, instanceId, chatType);
    }

    async ensureContactExists(jid: string, instanceId: string, chatType: string): Promise<void> {
        // Check if contact already exists
        const existingContact = await db.select()
            .from(whatsappContacts)
            .where(and(
                eq(whatsappContacts.jid, jid),
                eq(whatsappContacts.instanceId, instanceId)
            ))
            .limit(1);

        if (existingContact.length > 0) {
            return; // Contact already exists
        }

        // Create contact record with appropriate name
        const contactName = chatType === 'group' ? 'Group Chat' : 'Contact';
        
        const newContact = {
            jid,
            instanceId,
            pushName: contactName,
            profilePictureUrl: null,
            verifiedName: null,
            isMe: false,
            isBlocked: false,
            isBusiness: false
        };

        await this.upsertWhatsappContact(newContact);
        console.log(`✅ Auto-created contact: ${jid} (${chatType})`);
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
                instance_id as "instanceId",
                display_name as "displayName",
                owner_jid as "ownerJid",
                client_id as "clientId",
                api_key as "apiKey",
                webhook_url as "webhookUrl",
                is_connected as "isConnected",
                last_connection_at as "lastConnectionAt",
                custom_color as "customColor",
                custom_letter as "customLetter",
                created_at as "createdAt",
                updated_at as "updatedAt"
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
        // Use a more complex query to include media data
        const baseQuery = db
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
                createdAt: whatsappMessages.createdAt,
                // Media fields (will be null for non-media messages)
                mediaId: whatsappMessageMedia.mediaId,
                mimetype: whatsappMessageMedia.mimetype,
                fileSizeBytes: whatsappMessageMedia.fileSizeBytes,
                fileUrl: whatsappMessageMedia.fileUrl,
                fileLocalPath: whatsappMessageMedia.fileLocalPath,
                mediaKey: whatsappMessageMedia.mediaKey,
                caption: whatsappMessageMedia.caption,
                thumbnailUrl: whatsappMessageMedia.thumbnailUrl,
                height: whatsappMessageMedia.height,
                width: whatsappMessageMedia.width,
                durationSeconds: whatsappMessageMedia.durationSeconds,
                isViewOnce: whatsappMessageMedia.isViewOnce,
            })
            .from(whatsappMessages)
            .leftJoin(
                whatsappMessageMedia,
                and(
                    eq(whatsappMessages.messageId, whatsappMessageMedia.messageId),
                    eq(whatsappMessages.instanceId, whatsappMessageMedia.instanceId)
                )
            );

        let query;
        if (chatId) {
            query = baseQuery
                .where(and(
                    eq(whatsappMessages.instanceId, instanceId),
                    eq(whatsappMessages.chatId, chatId)
                ))
                .orderBy(desc(whatsappMessages.timestamp))
                .limit(limit);
        } else {
            query = baseQuery
                .where(eq(whatsappMessages.instanceId, instanceId))
                .orderBy(desc(whatsappMessages.timestamp))
                .limit(limit);
        }

        const rawResults = await query;
        
        // Transform results to include media object for messages that have media
        const result = rawResults.map(row => {
            const message: any = {
                messageId: row.messageId,
                instanceId: row.instanceId,
                chatId: row.chatId,
                senderJid: row.senderJid,
                fromMe: row.fromMe,
                messageType: row.messageType,
                content: row.content,
                timestamp: row.timestamp,
                quotedMessageId: row.quotedMessageId,
                isForwarded: row.isForwarded,
                forwardingScore: row.forwardingScore,
                isStarred: row.isStarred,
                isEdited: row.isEdited,
                lastEditedAt: row.lastEditedAt,
                sourcePlatform: row.sourcePlatform,
                rawApiPayload: row.rawApiPayload,
                createdAt: row.createdAt,
            };

            // Add media object if the message has media
            if (row.mediaId) {
                message.media = {
                    mediaId: row.mediaId,
                    mimetype: row.mimetype,
                    fileSizeBytes: row.fileSizeBytes,
                    fileUrl: row.fileUrl,
                    fileLocalPath: row.fileLocalPath,
                    mediaKey: row.mediaKey,
                    caption: row.caption,
                    thumbnailUrl: row.thumbnailUrl,
                    height: row.height,
                    width: row.width,
                    durationSeconds: row.durationSeconds,
                    isViewOnce: row.isViewOnce,
                };
            } else {
                message.media = null;
            }

            return message;
        });

        return result;
    }

    async getWhatsappMessageById(messageId: string, instanceId: string): Promise<WhatsappMessage | undefined> {
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

    async upsertWhatsappMessageMedia(media: InsertWhatsappMessageMedia): Promise<WhatsappMessageMedia> {
        // Check if media already exists for this message
        const [existing] = await db.select().from(whatsappMessageMedia)
            .where(and(
                eq(whatsappMessageMedia.messageId, media.messageId),
                eq(whatsappMessageMedia.instanceId, media.instanceId)
            ))
            .limit(1);

        if (existing) {
            // Update existing media
            const [result] = await db.update(whatsappMessageMedia)
                .set({
                    mimetype: media.mimetype,
                    fileSizeBytes: media.fileSizeBytes,
                    fileUrl: media.fileUrl,
                    fileLocalPath: media.fileLocalPath,
                    mediaKey: media.mediaKey,
                    caption: media.caption,
                    thumbnailUrl: media.thumbnailUrl,
                    height: media.height,
                    width: media.width,
                    durationSeconds: media.durationSeconds,
                    isViewOnce: media.isViewOnce,
                })
                .where(eq(whatsappMessageMedia.mediaId, existing.mediaId))
                .returning();
            return result;
        } else {
            // Insert new media
            const [result] = await db.insert(whatsappMessageMedia)
                .values(media)
                .returning();
            return result;
        }
    }

    async getWhatsappMessageMedia(messageId: string, instanceId: string): Promise<WhatsappMessageMedia | undefined> {
        const [result] = await db.select().from(whatsappMessageMedia)
            .where(and(
                eq(whatsappMessageMedia.messageId, messageId),
                eq(whatsappMessageMedia.instanceId, instanceId)
            ))
            .limit(1);
        return result;
    }

    async updateWhatsappMessageMediaPath(messageId: string, instanceId: string, localPath: string): Promise<void> {
        await db.update(whatsappMessageMedia)
            .set({ fileLocalPath: localPath })
            .where(and(
                eq(whatsappMessageMedia.messageId, messageId),
                eq(whatsappMessageMedia.instanceId, instanceId)
            ));
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
        const result = await db.execute(sql`
            UPDATE crm.tasks 
            SET 
                status = COALESCE(${updates.status || null}, status),
                priority = COALESCE(${updates.priority || null}, priority),
                title = COALESCE(${updates.title || null}, title),
                description = COALESCE(${updates.description || null}, description),
                due_date = COALESCE(${updates.due_date || null}, due_date),
                updated_at = NOW()
            WHERE task_id = ${taskId}
            RETURNING *
        `);
        
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

    async updateWhatsappInstance(instanceId: string, updateData: { displayName?: string; customColor?: string; customLetter?: string }): Promise<WhatsappInstance> {
        const [updatedInstance] = await db.update(whatsappInstances)
            .set({
                ...updateData,
                updatedAt: new Date()
            })
            .where(eq(whatsappInstances.instanceId, instanceId))
            .returning();
        
        return updatedInstance;
    }

    async deleteWhatsappInstance(instanceId: string): Promise<void> {
        await db.delete(whatsappInstances)
            .where(eq(whatsappInstances.instanceId, instanceId));
    }

    async updateConversation(chatId: string, instanceId: string, updates: any): Promise<void> {
        await db.update(whatsappChats)
            .set({
                ...updates,
                updatedAt: new Date()
            })
            .where(and(
                eq(whatsappChats.chatId, chatId),
                eq(whatsappChats.instanceId, instanceId)
            ));
    }

    async deleteConversation(chatId: string, instanceId: string): Promise<void> {
        // Delete messages first due to foreign key constraints
        await db.delete(whatsappMessages)
            .where(and(
                eq(whatsappMessages.chatId, chatId),
                eq(whatsappMessages.instanceId, instanceId)
            ));
        
        // Delete drafts for this chat
        await db.delete(whatsappDrafts)
            .where(and(
                eq(whatsappDrafts.chatId, chatId),
                eq(whatsappDrafts.instanceId, instanceId)
            ));
        
        // Then delete the chat
        await db.delete(whatsappChats)
            .where(and(
                eq(whatsappChats.chatId, chatId),
                eq(whatsappChats.instanceId, instanceId)
            ));
    }

    // =========================================================================
    // DRAFT MANAGEMENT METHODS
    // =========================================================================

    async getAllDrafts(instanceId: string): Promise<WhatsappDraft[]> {
        return await db.select()
            .from(whatsappDrafts)
            .where(eq(whatsappDrafts.instanceId, instanceId))
            .orderBy(desc(whatsappDrafts.updatedAt));
    }

    async getDraft(chatId: string, instanceId: string): Promise<WhatsappDraft | null> {
        const [draft] = await db.select()
            .from(whatsappDrafts)
            .where(and(
                eq(whatsappDrafts.chatId, chatId),
                eq(whatsappDrafts.instanceId, instanceId)
            ));
        return draft || null;
    }

    private async generateDraftMessageId(): Promise<string> {
        // Get the highest existing draft ID to generate the next one
        const result = await db.select({ messageId: whatsappDrafts.messageId })
            .from(whatsappDrafts)
            .where(sql`${whatsappDrafts.messageId} LIKE 'DRAFT%'`)
            .orderBy(desc(whatsappDrafts.messageId))
            .limit(1);

        if (result.length === 0) {
            return 'DRAFT000001';
        }

        const lastId = result[0].messageId;
        const numberPart = parseInt(lastId.replace('DRAFT', ''));
        const nextNumber = numberPart + 1;
        return `DRAFT${nextNumber.toString().padStart(6, '0')}`;
    }

    async upsertDraft(draftData: InsertWhatsappDraft): Promise<WhatsappDraft> {
        // If content is empty, delete the draft instead of upserting
        if (!draftData.content || draftData.content.trim() === '') {
            await this.deleteDraft(draftData.chatId, draftData.instanceId);
            // Return a dummy draft object for API consistency
            return {
                messageId: '',
                chatId: draftData.chatId,
                instanceId: draftData.instanceId,
                content: '',
                replyToMessageId: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }

        // Check if draft already exists for this chat/instance
        const existingDraft = await this.getDraft(draftData.chatId, draftData.instanceId);
        
        if (existingDraft) {
            // Update existing draft
            const [draft] = await db.update(whatsappDrafts)
                .set({
                    content: draftData.content,
                    replyToMessageId: draftData.replyToMessageId,
                    updatedAt: new Date()
                })
                .where(eq(whatsappDrafts.messageId, existingDraft.messageId))
                .returning();
            return draft;
        } else {
            // Create new draft with generated ID
            const messageId = await this.generateDraftMessageId();
            const [draft] = await db.insert(whatsappDrafts)
                .values({
                    messageId,
                    ...draftData,
                    updatedAt: new Date()
                })
                .returning();
            return draft;
        }
    }

    async deleteDraft(chatId: string, instanceId: string): Promise<void> {
        await db.delete(whatsappDrafts)
            .where(and(
                eq(whatsappDrafts.chatId, chatId),
                eq(whatsappDrafts.instanceId, instanceId)
            ));
    }

    async deleteDraftById(messageId: string): Promise<void> {
        await db.delete(whatsappDrafts)
            .where(eq(whatsappDrafts.messageId, messageId));
    }

    // =========================================================================
    // CRM TASK METHODS
    // =========================================================================

    async createTask(taskData: any): Promise<any> {
        const [task] = await db.insert(crmTasks)
            .values({
                instanceId: taskData.instanceId,
                title: taskData.title,
                description: taskData.description,
                status: taskData.status || 'pending',
                priority: taskData.priority || 'medium',
                taskType: taskData.taskType || 'task',
                dueDate: taskData.dueDate || null,
                triggeringMessageId: taskData.triggeringMessageId || null,
                relatedChatJid: taskData.relatedChatJid || null,
                senderJid: taskData.senderJid || null,
                contactName: taskData.contactName || null,
                originalMessageContent: taskData.originalMessageContent || null,
                assignedToUserId: taskData.assignedToUserId || null,
                createdByUserId: taskData.createdByUserId || null,
                spaceId: taskData.spaceId || null,
                projectId: taskData.projectId || null,
                parentTaskId: taskData.parentTaskId || null
            })
            .returning();
        return task;
    }

    async getTasks(instanceId?: string): Promise<any[]> {
        let query = db.select().from(crmTasks).orderBy(desc(crmTasks.createdAt));
        
        if (instanceId) {
            query = query.where(eq(crmTasks.instanceId, instanceId));
        }
        
        return await query;
    }

    async getTaskById(taskId: number): Promise<any | null> {
        const [task] = await db.select().from(crmTasks).where(eq(crmTasks.taskId, taskId));
        return task || null;
    }
}

export const storage = new DatabaseStorage();