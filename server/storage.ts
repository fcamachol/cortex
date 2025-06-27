import { db } from "./db"; // Your Drizzle ORM instance
import { sql, eq, desc, asc, and, or, ilike } from "drizzle-orm";
import {
    // App Schema
    appUsers, appWorkspaces, appSpaces, appWorkspaceMembers,
    // WhatsApp Schema
    whatsappInstances, whatsappContacts, whatsappChats, whatsappMessages,
    whatsappGroups, whatsappGroupParticipants, whatsappMessageReactions,
    whatsappMessageMedia, whatsappMessageUpdates,
    // Legacy Schema
    tasks, contacts,
    // Actions Schema
    actionRules, actionExecutions,
    // CRM Schema - Comprehensive Contacts Module
    crmProjects, crmTasks, crmCompanies, crmCalendarEvents, crmEventAttendees, crmNotes,
    crmContacts, crmContactPhones, crmContactEmails, crmContactAddresses, 
    crmContactAliases, crmSpecialDates, crmInterests, crmContactInterests,
    crmCompanyMembers, crmContactGroups, crmContactGroupMembers, crmContactRelationships,
    // Finance Schema
    financeAccounts, financeTransactions, financePayables, financeReceivables, financeCategories,
    financeRecurringBills, financeLoans, financeLoanPayments, financePayablePayments, financeReceivablePayments,
    creditCardDetails, statements,
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
    type WhatsappMessageUpdate, type InsertWhatsappMessageUpdate,
    whatsappDrafts, type WhatsappDraft, type InsertWhatsappDraft,
    type CrmProject, type InsertCrmProject,
    type CrmTask, type InsertCrmTask,
    type CrmCompany, type InsertCrmCompany,
    type FinanceAccount, type InsertFinanceAccount,
    type FinanceTransaction, type InsertFinanceTransaction,
    type FinancePayable, type InsertFinancePayable,
    type FinanceReceivable, type InsertFinanceReceivable,
    type FinanceCategory, type InsertFinanceCategory,
    type FinanceRecurringBill, type InsertFinanceRecurringBill,
    type FinanceLoan, type InsertFinanceLoan,
    type CreditCardDetails, type InsertCreditCardDetails,
    type Statement, type InsertStatement
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
        try {
            const spaces = await db.select().from(appSpaces).where(eq(appSpaces.creatorUserId, userId));
            return spaces;
        } catch (error) {
            console.error('Error fetching spaces for user:', error);
            return [];
        }
    }

    // Enhanced Spaces Management (Notion/ClickUp style) with unlimited hierarchy
    async getSpaces(userId: string): Promise<any[]> {
        try {
            const spaces = await db.select()
            .from(appSpaces)
            .where(and(
                eq(appSpaces.creatorUserId, userId),
                eq(appSpaces.isArchived, false)
            ))
            .orderBy(appSpaces.displayOrder, appSpaces.createdAt);



            // Build hierarchical structure with unlimited nesting
            const spacesMap = new Map();
            const rootSpaces: any[] = [];

            // Apply category inheritance: subspaces inherit parent's category
            const applyInheritedCategory = (space: any, parentCategory?: string) => {
                // Only inherit from parent if current space has no category AND parent has one
                const inheritedCategory = parentCategory && !space.category 
                    ? parentCategory 
                    : space.category || 'work';
                return { ...space, category: inheritedCategory, childSpaces: [], items: [] };
            };

            spaces.forEach(space => {
                spacesMap.set(space.spaceId, applyInheritedCategory(space));
            });

            spaces.forEach(space => {
                if (space.parentSpaceId) {
                    const parent = spacesMap.get(space.parentSpaceId);
                    if (parent) {
                        const childWithInheritedCategory = applyInheritedCategory(space, parent.category);
                        spacesMap.set(space.spaceId, childWithInheritedCategory);
                        parent.childSpaces.push(spacesMap.get(space.spaceId));
                    }
                } else {
                    rootSpaces.push(spacesMap.get(space.spaceId));
                }
            });

            // Group by category
            const categorizedSpaces = rootSpaces.reduce((acc, space) => {
                const category = space.category || 'work';
                if (!acc[category]) acc[category] = [];
                acc[category].push(space);
                return acc;
            }, {});

            return categorizedSpaces;
        } catch (error) {
            console.error('Error fetching spaces:', error);
            throw error;
        }
    }

    async createSpace(spaceData: any): Promise<any> {
        try {
            const [newSpace] = await db.insert(appSpaces).values({
                spaceName: spaceData.spaceName,
                description: spaceData.description,
                icon: spaceData.icon || "📁",
                color: spaceData.color || "#3B82F6",
                coverImage: spaceData.coverImage,
                spaceType: spaceData.spaceType || "workspace",
                privacy: spaceData.privacy || "private",
                parentSpaceId: spaceData.parentSpaceId,
                isArchived: false,
                isFavorite: spaceData.isFavorite || false,
                displayOrder: spaceData.displayOrder || 0,
                templateId: spaceData.templateId,
                creatorUserId: spaceData.creatorUserId,
                workspaceId: null, // Make optional for now
                settings: spaceData.settings || {}
            }).returning();
            return newSpace;
        } catch (error) {
            console.error('Error creating space:', error);
            throw error;
        }
    }

    async updateSpace(spaceId: number, updates: any): Promise<any> {
        try {
            const [updatedSpace] = await db.update(appSpaces)
                .set({
                    ...updates,
                    updatedAt: new Date()
                })
                .where(eq(appSpaces.spaceId, spaceId))
                .returning();
            return updatedSpace;
        } catch (error) {
            console.error('Error updating space:', error);
            throw error;
        }
    }

    async deleteSpace(spaceId: number): Promise<void> {
        try {
            await db.delete(appSpaces).where(eq(appSpaces.spaceId, spaceId));
        } catch (error) {
            console.error('Error deleting space:', error);
            throw error;
        }
    }

    async getSpaceTemplates(): Promise<any[]> {
        try {
            // Return predefined templates since appSpaceTemplates table doesn't exist yet
            return [
                { id: 1, name: 'Project Management', description: 'Organize projects with tasks and milestones' },
                { id: 2, name: 'Team Collaboration', description: 'Share docs and communicate with team' },
                { id: 3, name: 'Personal Workspace', description: 'Manage personal tasks and notes' }
            ];
        } catch (error) {
            console.error('Error fetching space templates:', error);
            return [];
        }
    }

    async createSpaceFromTemplate(templateId: number, spaceData: any): Promise<any> {
        try {
            // For now, just create a space with template-based defaults
            const templateDefaults = {
                1: { name: 'New Project', description: 'Project management workspace' },
                2: { name: 'Team Space', description: 'Team collaboration workspace' },
                3: { name: 'Personal Space', description: 'Personal workspace' }
            };
            
            const defaults = templateDefaults[templateId as keyof typeof templateDefaults] || templateDefaults[1];
            const mergedData = { ...defaults, ...spaceData };
            
            return await this.createSpace(mergedData);
        } catch (error) {
            console.error('Error creating space from template:', error);
            throw error;
        }
    }

    // =========================================================================
    // WHATSAPP SCHEMA METHODS
    // =========================================================================

    async getInstanceById(instanceName: string): Promise<WhatsappInstance | null> {
        const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.instanceName, instanceName));
        return instance || null;
    }

    async getWhatsappInstance(instanceName: string): Promise<WhatsappInstance | null> {
        const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.instanceName, instanceName));
        return instance || null;
    }

    async getWhatsappInstanceWithCredentials(instanceName: string): Promise<any | null> {
        const result = await db.execute(sql`
            SELECT 
                instance_name as "instanceName",
                instance_id as "apiKey",
                display_name as "displayName",
                webhook_url as "webhookUrl",
                is_connected as "isConnected"
            FROM whatsapp.instances 
            WHERE instance_name = ${instanceName}
        `);
        return result.rows[0] || null;
    }
    
    async getWhatsappConversations(userId: string): Promise<any[]> {
        // Use SQL to get conversations with last message content
        const results = await db.execute(sql`
            SELECT 
                c.chat_id as "chatId",
                c.instance_name as "instanceId", 
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
                last_msg.content as "lastMessageContent",
                last_msg.from_me as "lastMessageFromMe",
                last_msg.timestamp as "actualLastMessageTime",
                last_msg.message_type as "lastMessageType"
            FROM whatsapp.chats c
            INNER JOIN whatsapp.instances i ON c.instance_name = i.instance_name
            LEFT JOIN whatsapp.contacts ct ON c.chat_id = ct.jid AND c.instance_name = ct.instance_name
            LEFT JOIN whatsapp.groups g ON c.chat_id = g.group_jid AND c.instance_name = g.instance_name
            LEFT JOIN LATERAL (
                SELECT m.content, m.from_me, m.timestamp, m.message_type
                FROM whatsapp.messages m
                WHERE m.chat_id = c.chat_id AND m.instance_name = c.instance_name
                  AND m.content IS NOT NULL 
                  AND m.content != ''
                ORDER BY m.timestamp DESC
                LIMIT 1
            ) last_msg ON true
            WHERE i.client_id = ${userId}
            ORDER BY 
                CASE WHEN last_msg.timestamp IS NOT NULL THEN last_msg.timestamp ELSE c.last_message_timestamp END DESC,
                c.chat_id
        `);

        return results.rows.map(row => ({
            ...row,
            lastMessage: row.lastMessageContent ? {
                content: row.lastMessageContent,
                fromMe: row.lastMessageFromMe,
                timestamp: row.actualLastMessageTime,
                messageType: row.lastMessageType
            } : null
        }));
    }
    
    async getWhatsappContacts(userId: string): Promise<WhatsappContact[]> {
        const results = await db.select({ contact: whatsappContacts })
            .from(whatsappContacts)
            .innerJoin(whatsappInstances, eq(whatsappContacts.instanceName, whatsappInstances.instanceName))
            .where(and(
                eq(whatsappInstances.clientId, userId),
                eq(whatsappContacts.isMe, false)
            ));
            
        return results.map(r => r.contact);
    }
    
    async getWhatsappGroups(instanceName: string): Promise<WhatsappGroup[]> {
        return await db.select().from(whatsappGroups).where(eq(whatsappGroups.instanceName, instanceName));
    }

    async getWhatsappChat(chatId: string, instanceName: string): Promise<WhatsappChat | null> {
        const [chat] = await db.select().from(whatsappChats).where(
            and(
                eq(whatsappChats.chatId, chatId),
                eq(whatsappChats.instanceName, instanceName)
            )
        );
        return chat || null;
    }

    async getWhatsappGroup(groupJid: string, instanceName: string): Promise<WhatsappGroup | null> {
        const [group] = await db.select().from(whatsappGroups).where(
            and(
                eq(whatsappGroups.groupJid, groupJid),
                eq(whatsappGroups.instanceName, instanceName)
            )
        );
        return group || null;
    }

    async upsertWhatsappInstance(instance: any): Promise<any> {
        // Use raw SQL to handle the visibility field requirement
        const result = await db.execute(sql`
            INSERT INTO whatsapp.instances (
                instance_name, display_name, client_id, api_key, webhook_url, 
                is_connected, visibility, owner_jid, last_connection_at
            )
            VALUES (
                ${instance.instanceName || instance.instanceId}, 
                ${instance.displayName}, 
                ${instance.clientId}, 
                ${instance.apiKey}, 
                ${instance.webhookUrl}, 
                ${instance.isConnected || false}, 
                'private', 
                ${instance.ownerJid}, 
                ${instance.lastConnectionAt}
            )
            ON CONFLICT (instance_name) DO UPDATE SET
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
                    eq(whatsappContacts.instanceName, contact.instanceName)
                )
            )
            .limit(1);

        const existing = existingContact[0];
        
        // Build the update object dynamically to avoid undefined values
        const updateSet: any = {};
        
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
        
        // Always update the timestamp
        updateSet.lastUpdatedAt = new Date();

        // If no meaningful updates, just ensure we have something to update
        if (Object.keys(updateSet).length === 1) {
            // Only timestamp, force at least one field update
            if (!updateSet.pushName && contact.pushName) {
                updateSet.pushName = contact.pushName;
            }
        }

        const [result] = await db.insert(whatsappContacts)
            .values(contact)
            .onConflictDoUpdate({
                target: [whatsappContacts.jid, whatsappContacts.instanceName],
                set: updateSet
            })
            .returning();
        
        return result;
    }

    async upsertWhatsappChat(chat: InsertWhatsappChat): Promise<WhatsappChat> {
        const [result] = await db.insert(whatsappChats)
            .values(chat)
            .onConflictDoUpdate({
                target: [whatsappChats.chatId, whatsappChats.instanceName],
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
                target: [whatsappGroups.groupJid, whatsappGroups.instanceName],
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
        await this.ensureChatExists(message.chatId, message.instanceName);

        const [result] = await db.insert(whatsappMessages)
            .values(message)
            .onConflictDoUpdate({
                target: [whatsappMessages.messageId, whatsappMessages.instanceName],
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
                AND instance_name = ${message.instanceName}
                AND (last_message_timestamp IS NULL OR last_message_timestamp < ${message.timestamp})
            `);
        }

        return result;
    }

    async ensureChatExists(chatId: string, instanceName: string): Promise<void> {
        console.log(`🔊 LOUD DEBUG - ensureChatExists called with:`);
        console.log(`🔊   chatId: "${chatId}" (length: ${chatId?.length}, type: ${typeof chatId})`);
        console.log(`🔊   instanceName: "${instanceName}" (length: ${instanceName?.length}, type: ${typeof instanceName})`);
        console.log(`🔊   chatId ends with @g.us: ${chatId?.endsWith('@g.us')}`);
        console.log(`🔊   chatId ends with @s.whatsapp.net: ${chatId?.endsWith('@s.whatsapp.net')}`);
        
        // Check if chat already exists
        const existingChat = await this.getWhatsappChat(chatId, instanceName);
        if (existingChat) {
            console.log(`🔊 LOUD DEBUG - Chat already exists: ${chatId}`);
            return; // Chat already exists
        }

        // Determine chat type based on JID format
        const chatType = chatId.endsWith('@g.us') ? 'group' as const : 'individual' as const;
        console.log(`🔊 LOUD DEBUG - Determined chat type: ${chatType}`);
        
        // Create the chat record
        const newChat: InsertWhatsappChat = {
            chatId,
            instanceName,
            type: chatType,
            unreadCount: 0,
            isArchived: false,
            isPinned: false,
            isMuted: false,
            lastMessageTimestamp: null
        };

        console.log(`🔊 LOUD DEBUG - Creating new chat with data:`, JSON.stringify(newChat, null, 2));
        await this.upsertWhatsappChat(newChat);
        console.log(`✅ Auto-created chat: ${chatId} (${chatType})`);

        // Also ensure contact exists for the chat
        await this.ensureContactExists(chatId, instanceName, chatType);
    }

    async ensureContactExists(jid: string, instanceName: string, chatType: string): Promise<void> {
        // Check if contact already exists
        const existingContact = await db.select()
            .from(whatsappContacts)
            .where(and(
                eq(whatsappContacts.jid, jid),
                eq(whatsappContacts.instanceName, instanceName)
            ))
            .limit(1);

        if (existingContact.length > 0) {
            return; // Contact already exists
        }

        // Create contact record with appropriate name
        const contactName = chatType === 'group' ? 'Group Chat' : 'Contact';
        
        const newContact = {
            jid,
            instanceName,
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
                instance_name as "instanceName",
                display_name as "displayName",
                owner_jid as "ownerJid",
                client_id as "clientId",
                instance_id as "apiKey",
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

    async getAvailableWhatsappInstances(userId: string): Promise<any[]> {
        const results = await db.execute(sql`
            SELECT 
                instance_name as "instanceName",
                display_name as "displayName",
                owner_jid as "ownerJid",
                client_id as "clientId",
                visibility,
                is_connected as "isConnected",
                custom_color as "customColor",
                custom_letter as "customLetter"
            FROM whatsapp.instances 
            WHERE client_id = ${userId} OR visibility = 'shared'
            ORDER BY created_at DESC
        `);
        
        return results.rows;
    }

    async getWhatsappInstanceByName(instanceName: string): Promise<any | null> {
        const results = await db.execute(sql`
            SELECT 
                instance_name as "instanceName",
                display_name as "displayName",
                owner_jid as "ownerJid",
                client_id as "clientId",
                visibility,
                is_connected as "isConnected"
            FROM whatsapp.instances 
            WHERE instance_name = ${instanceName}
            LIMIT 1
        `);
        
        return results.rows[0] || null;
    }

    async updateContactWhatsAppLink(contactId: number, linkData: {
        whatsappJid: string | null;
        whatsappInstanceId: string | null;
        isWhatsappLinked: boolean;
        whatsappLinkedAt: Date | null;
    }): Promise<void> {
        await db.execute(sql`
            UPDATE crm.contacts 
            SET 
                whatsapp_jid = ${linkData.whatsappJid},
                whatsapp_instance_id = ${linkData.whatsappInstanceId},
                is_whatsapp_linked = ${linkData.isWhatsappLinked},
                whatsapp_linked_at = ${linkData.whatsappLinkedAt},
                updated_at = NOW()
            WHERE contact_id = ${contactId}
        `);
    }

    async getInstanceStatus(instanceName: string): Promise<any> {
        const instance = await this.getInstanceByName(instanceName);
        return {
            instanceName,
            isConnected: instance?.isConnected || false,
            status: instance?.isConnected ? 'connected' : 'disconnected'
        };
    }

    async getWhatsappMessages(userId: string, instanceName: string, chatId: string, limit: number = 50): Promise<any[]> {
        try {
            // Use raw SQL to avoid Drizzle ORM issues with complex joins
            const results = await db.execute(sql`
                SELECT 
                    m.message_id as "messageId",
                    m.instance_name as "instanceName", 
                    m.chat_id as "chatId",
                    m.sender_jid as "senderJid",
                    m.from_me as "fromMe",
                    m.message_type as "messageType",
                    m.content,
                    m.timestamp,
                    m.quoted_message_id as "quotedMessageId",
                    m.is_forwarded as "isForwarded",
                    m.forwarding_score as "forwardingScore",
                    m.is_starred as "isStarred",
                    m.is_edited as "isEdited",
                    m.last_edited_at as "lastEditedAt",
                    m.source_platform as "sourcePlatform",
                    m.raw_api_payload as "rawApiPayload",
                    m.created_at as "createdAt",
                    -- Media fields (will be null for non-media messages)
                    med.media_id as "mediaId",
                    med.mimetype,
                    med.file_size_bytes as "fileSizeBytes",
                    med.file_url as "fileUrl", 
                    med.file_local_path as "fileLocalPath",
                    med.media_key as "mediaKey",
                    med.caption,
                    med.thumbnail_url as "thumbnailUrl",
                    med.height,
                    med.width,
                    med.duration_seconds as "durationSeconds",
                    med.is_view_once as "isViewOnce"
                FROM whatsapp.messages m
                LEFT JOIN whatsapp.message_media med ON (
                    m.message_id = med.message_id AND 
                    m.instance_name = med.instance_name
                )
                WHERE m.instance_name = ${instanceName}
                ${chatId ? sql`AND m.chat_id = ${chatId}` : sql``}
                ORDER BY m.timestamp DESC
                LIMIT ${limit}
            `);
            
            const rawResults = results.rows as any[];
        
            // Transform results to include media object for messages that have media
            const result = rawResults.map(row => {
                const message: any = {
                    messageId: row.messageId,
                    instanceName: row.instanceName,
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
        } catch (error) {
            console.error('Error in getWhatsappMessages:', error);
            throw error;
        }
    }

    async getWhatsappMessageById(messageId: string, instanceName: string): Promise<WhatsappMessage | undefined> {
        const [result] = await db.select().from(whatsappMessages)
            .where(and(
                eq(whatsappMessages.messageId, messageId),
                eq(whatsappMessages.instanceName, instanceName)
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
                target: [whatsappMessageReactions.messageId, whatsappMessageReactions.instanceName, whatsappMessageReactions.reactorJid],
                set: updateSet
            })
            .returning();
        return result;
    }

    // Alias for backward compatibility with existing webhook code
    async upsertWhatsappMessageReaction(reaction: InsertWhatsappMessageReaction): Promise<WhatsappMessageReaction> {
        try {
            const [result] = await db
                .insert(whatsappMessageReactions)
                .values(reaction)
                .onConflictDoUpdate({
                    target: [whatsappMessageReactions.reactionId],
                    set: {
                        reactionEmoji: reaction.reactionEmoji,
                        timestamp: reaction.timestamp,
                        fromMe: reaction.fromMe
                    }
                })
                .returning();
            return result;
        } catch (error) {
            console.error('Error upserting reaction:', error);
            throw error;
        }
    }

    async upsertWhatsappMessageMedia(media: InsertWhatsappMessageMedia): Promise<WhatsappMessageMedia> {
        // Debug logging to trace null instance_name issue
        console.log(`🔍 upsertWhatsappMessageMedia called with:`, {
            messageId: media.messageId,
            instanceName: media.instanceName,
            hasInstanceName: !!media.instanceName,
            typeOfInstanceName: typeof media.instanceName,
            allKeys: Object.keys(media)
        });
        
        // Check if media already exists for this message
        const [existing] = await db.select().from(whatsappMessageMedia)
            .where(and(
                eq(whatsappMessageMedia.messageId, media.messageId),
                eq(whatsappMessageMedia.instanceName, media.instanceName)
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

    async getWhatsappMessageMedia(messageId: string, instanceName: string): Promise<WhatsappMessageMedia | undefined> {
        const [result] = await db.select().from(whatsappMessageMedia)
            .where(and(
                eq(whatsappMessageMedia.messageId, messageId),
                eq(whatsappMessageMedia.instanceName, instanceName)
            ))
            .limit(1);
        return result;
    }

    async getWhatsappMessageMediaAnyInstance(messageId: string): Promise<WhatsappMessageMedia | undefined> {
        const [result] = await db.select().from(whatsappMessageMedia)
            .where(eq(whatsappMessageMedia.messageId, messageId))
            .limit(1);
        return result;
    }

    async updateWhatsappMessageMediaPath(messageId: string, instanceName: string, localPath: string): Promise<void> {
        await db.update(whatsappMessageMedia)
            .set({ fileLocalPath: localPath })
            .where(and(
                eq(whatsappMessageMedia.messageId, messageId),
                eq(whatsappMessageMedia.instanceName, instanceName)
            ));
    }

    // Task management methods


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

    async getChecklistItems(): Promise<any[]> {
        return [];
    }

    // Calendar methods
    async getCalendarEvents(): Promise<any[]> {
        return [];
    }

    async createCalendarEvent(eventData: any): Promise<any> {
        try {
            console.log('📅 Creating calendar event in CRM schema:', eventData.title);
            
            const [createdEvent] = await db
                .insert(crmCalendarEvents)
                .values({
                    createdByUserId: eventData.ownerUserId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
                    title: eventData.title,
                    description: eventData.description || null,
                    startTime: eventData.startTime || new Date(),
                    endTime: eventData.endTime || null,
                    isAllDay: eventData.isAllDay || false,
                    location: eventData.location || null,
                    instanceId: eventData.instanceId || null,
                    triggeringMessageId: eventData.triggeringMessageId || null,
                    projectId: eventData.projectId || null,
                    taskId: eventData.taskId || null,
                    relatedChatJid: eventData.relatedChatJid || null,
                    spaceId: eventData.spaceId || null,
                })
                .returning();

            // Handle attendees if provided
            if (eventData.attendees && Array.isArray(eventData.attendees)) {
                const attendeeInserts = eventData.attendees.map((attendeeId: string) => ({
                    eventId: createdEvent.eventId,
                    attendeeUserId: attendeeId,
                    status: 'pending'
                }));
                
                await db.insert(crmEventAttendees).values(attendeeInserts);
                console.log(`✅ Added ${attendeeInserts.length} attendees to calendar event`);
            }
            
            console.log('✅ CRM calendar event created successfully:', createdEvent.title);
            return createdEvent;
        } catch (error) {
            console.error('❌ Error creating CRM calendar event:', error);
            throw error;
        }
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
    async createGroupPlaceholderIfNeeded(groupJid: string, instanceName: string): Promise<void> {
        await db.insert(whatsappGroups)
            .values({
                instanceName,
                groupJid,
                subject: 'Group'
            })
            .onConflictDoNothing({
                target: [whatsappGroups.groupJid, whatsappGroups.instanceName]
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
            console.log(`🔍 [getActionRulesByTrigger] Searching for ${triggerType}:${triggerValue}:${instanceId}`);
            
            // Get ALL active rules first, then filter in code for better debugging
            const rules = await db.select()
                .from(actionRules)
                .where(eq(actionRules.isActive, true));

            console.log(`🔍 [getActionRulesByTrigger] Found ${rules.length} total active rules`);
            console.log('🔍 [getActionRulesByTrigger] All rules:', rules.map(r => ({
                ruleName: r.ruleName,
                triggerType: r.triggerType,
                triggerConditions: r.triggerConditions
            })));

            // Filter by trigger type and conditions
            const matchingRules = rules.filter(rule => {
                console.log(`🔍 [getActionRulesByTrigger] Checking rule "${rule.ruleName}" (${rule.triggerType})`);
                
                if (rule.triggerType !== triggerType) {
                    console.log(`🔍 [getActionRulesByTrigger] Rule type mismatch: ${rule.triggerType} !== ${triggerType}`);
                    return false;
                }
                
                const conditions = rule.triggerConditions as any || {};
                console.log(`🔍 [getActionRulesByTrigger] Rule conditions:`, conditions);
                
                switch (triggerType) {
                    case 'reaction':
                        // Check multiple possible formats for reactions
                        const reactions = conditions.reactions || [];
                        const emoji = conditions.emoji;
                        const reaction_emoji = conditions.reaction_emoji;
                        const value = conditions.value;
                        
                        console.log(`🔍 [getActionRulesByTrigger] Checking reaction formats:`, {
                            reactions,
                            emoji,
                            reaction_emoji,
                            value,
                            triggerValue
                        });
                        
                        const matches = reactions.includes(triggerValue) || 
                                      emoji === triggerValue || 
                                      reaction_emoji === triggerValue ||
                                      value === triggerValue;
                        
                        console.log(`🔍 [getActionRulesByTrigger] Match result: ${matches}`);
                        return matches;
                        
                    case 'keyword':
                        const keywords = conditions.keywords || [];
                        return keywords.some((keyword: string) => 
                            triggerValue.toLowerCase().includes(keyword.toLowerCase())
                        );
                        
                    case 'hashtag':
                        const hashtag = conditions.hashtag;
                        return triggerValue === hashtag;
                        
                    default:
                        return false;
                }
            });

            // Filter by instance if the rule has instance filters
            const finalRules = matchingRules.filter(rule => {
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

            console.log(`🔍 [getActionRulesByTrigger] Found ${finalRules.length} final matching rules`);
            return finalRules;

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

    async removeGroupParticipant(groupJid: string, participantJid: string, instanceName: string): Promise<void> {
        await db.delete(whatsappGroupParticipants)
            .where(and(
                eq(whatsappGroupParticipants.groupJid, groupJid),
                eq(whatsappGroupParticipants.participantJid, participantJid),
                eq(whatsappGroupParticipants.instanceName, instanceName)
            ));
    }

    async updateGroupParticipantRole(groupJid: string, participantJid: string, instanceName: string, isAdmin: boolean): Promise<void> {
        await db.update(whatsappGroupParticipants)
            .set({
                isAdmin: isAdmin,
                isSuperAdmin: false, // Reset super admin when demoting
                updatedAt: new Date()
            })
            .where(and(
                eq(whatsappGroupParticipants.groupJid, groupJid),
                eq(whatsappGroupParticipants.participantJid, participantJid),
                eq(whatsappGroupParticipants.instanceName, instanceName)
            ));
    }

    async getGroupParticipants(groupJid: string, instanceName: string): Promise<WhatsappGroupParticipant[]> {
        return await db.select()
            .from(whatsappGroupParticipants)
            .where(and(
                eq(whatsappGroupParticipants.groupJid, groupJid),
                eq(whatsappGroupParticipants.instanceName, instanceName)
            ));
    }

    async getWhatsappContact(jid: string, instanceName: string): Promise<WhatsappContact | undefined> {
        const [result] = await db.select()
            .from(whatsappContacts)
            .where(and(
                eq(whatsappContacts.jid, jid),
                eq(whatsappContacts.instanceName, instanceName)
            ))
            .limit(1);
        return result;
    }

    async findWhatsappContactsByName(contactName: string, instanceName: string): Promise<WhatsappContact[]> {
        const results = await db.select()
            .from(whatsappContacts)
            .where(and(
                eq(whatsappContacts.instanceName, instanceName),
                or(
                    eq(whatsappContacts.pushName, contactName),
                    eq(whatsappContacts.verifiedName, contactName)
                )
            ))
            .limit(10);
        return results;
    }

    // =========================================================================
    // PATTERN-BASED QUERY METHODS FOR CLEANUP OPERATIONS
    // =========================================================================

    async getContactsByPattern(instanceName: string, jidPattern: string): Promise<WhatsappContact[]> {
        return await db.select()
            .from(whatsappContacts)
            .where(and(
                eq(whatsappContacts.instanceName, instanceName),
                ilike(whatsappContacts.jid, jidPattern)
            ));
    }

    async getChatsByPattern(instanceName: string, chatIdPattern: string): Promise<WhatsappChat[]> {
        return await db.select()
            .from(whatsappChats)
            .where(and(
                eq(whatsappChats.instanceName, instanceName),
                ilike(whatsappChats.chatId, chatIdPattern)
            ));
    }

    async getGroupsByPattern(instanceName: string, groupJidPattern: string): Promise<WhatsappGroup[]> {
        return await db.select()
            .from(whatsappGroups)
            .where(and(
                eq(whatsappGroups.instanceName, instanceName),
                ilike(whatsappGroups.groupJid, groupJidPattern)
            ));
    }

    async deleteWhatsappContact(jid: string, instanceName: string): Promise<void> {
        await db.delete(whatsappContacts)
            .where(and(
                eq(whatsappContacts.jid, jid),
                eq(whatsappContacts.instanceName, instanceName)
            ));
    }

    async deleteWhatsappChat(chatId: string, instanceName: string): Promise<void> {
        await db.delete(whatsappChats)
            .where(and(
                eq(whatsappChats.chatId, chatId),
                eq(whatsappChats.instanceName, instanceName)
            ));
    }

    async deleteWhatsappGroup(groupJid: string, instanceName: string): Promise<void> {
        await db.delete(whatsappGroups)
            .where(and(
                eq(whatsappGroups.groupJid, groupJid),
                eq(whatsappGroups.instanceName, instanceName)
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
                eq(whatsappDrafts.instanceName, instanceId)
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

    // Draft functionality removed for system optimization

    // =========================================================================
    // CRM PROJECT METHODS
    // =========================================================================

    async createProject(projectData: any): Promise<CrmProject> {
        const [project] = await db.insert(crmProjects)
            .values({
                instanceId: projectData.instanceId || 'default-instance',
                projectName: projectData.projectName || projectData.project_name,
                description: projectData.description,
                status: projectData.status || 'active',
                priority: projectData.priority || 'medium',
                startDate: projectData.startDate,
                dueDate: projectData.dueDate,
                assignedToUserId: projectData.assignedToUserId,
                createdByUserId: projectData.createdByUserId,
                spaceId: projectData.spaceId || projectData.space_id || null
            })
            .returning();
        return project;
    }

    async getProjects(): Promise<any[]> {
        return await db.select().from(crmProjects).orderBy(desc(crmProjects.createdAt));
    }

    async getProjectById(projectId: number): Promise<CrmProject | null> {
        const [project] = await db.select().from(crmProjects).where(eq(crmProjects.projectId, projectId));
        return project || null;
    }

    async updateProject(projectId: number, updates: any): Promise<CrmProject> {
        const [project] = await db.update(crmProjects)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(crmProjects.projectId, projectId))
            .returning();
        return project;
    }

    async deleteProject(projectId: number): Promise<void> {
        await db.delete(crmProjects).where(eq(crmProjects.projectId, projectId));
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
                parentTaskId: taskData.parentTaskId || null,
                linkedPayableId: taskData.linkedPayableId || null
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

    // =========================================================================
    // MESSAGE UPDATE METHODS
    // =========================================================================

    async createWhatsappMessageUpdate(updateData: InsertWhatsappMessageUpdate): Promise<WhatsappMessageUpdate> {
        const [result] = await db.insert(whatsappMessageUpdates)
            .values({
                messageId: updateData.messageId,
                instanceId: updateData.instanceId,
                status: updateData.status,
                timestamp: updateData.timestamp || new Date()
            })
            .returning();
        
        console.log(`💾 [${updateData.instanceId}] Message update logged: ${updateData.messageId} -> ${updateData.status}`);
        return result;
    }

    async getMessageUpdates(messageId: string, instanceId: string): Promise<WhatsappMessageUpdate[]> {
        return await db.select()
            .from(whatsappMessageUpdates)
            .where(and(
                eq(whatsappMessageUpdates.messageId, messageId),
                eq(whatsappMessageUpdates.instanceId, instanceId)
            ))
            .orderBy(desc(whatsappMessageUpdates.timestamp));
    }

    async getLatestMessageStatus(messageId: string, instanceId: string): Promise<string | null> {
        const [update] = await db.select({
            status: whatsappMessageUpdates.status
        })
        .from(whatsappMessageUpdates)
        .where(and(
            eq(whatsappMessageUpdates.messageId, messageId),
            eq(whatsappMessageUpdates.instanceId, instanceId)
        ))
        .orderBy(desc(whatsappMessageUpdates.timestamp))
        .limit(1);
        
        return update?.status || null;
    }

    // Finance module methods
    async getFinancialSummary(type: 'income' | 'expense'): Promise<{ total: number; change: number }> {
        try {
            // Return placeholder data for now - will be replaced with actual database queries
            return {
                total: type === 'income' ? 25000 : 18500,
                change: type === 'income' ? 12.5 : -3.2
            };
        } catch (error) {
            console.error('Error getting financial summary:', error);
            return { total: 0, change: 0 };
        }
    }

    async getPendingPayables(): Promise<{ count: number; total: number }> {
        try {
            // Return placeholder data for now
            return { count: 3, total: 5400 };
        } catch (error) {
            console.error('Error getting pending payables:', error);
            return { count: 0, total: 0 };
        }
    }

    async getActiveLoans(): Promise<{ count: number; total: number }> {
        try {
            // Return placeholder data for now
            return { count: 2, total: 45000 };
        } catch (error) {
            console.error('Error getting active loans:', error);
            return { count: 0, total: 0 };
        }
    }

    async getRecentTransactions(limit: number): Promise<any[]> {
        try {
            // Return placeholder data for now
            return [
                {
                    transactionId: 1,
                    description: "Client payment",
                    amount: 5000,
                    type: "income",
                    date: new Date().toISOString(),
                    category: "Revenue"
                },
                {
                    transactionId: 2,
                    description: "Office supplies",
                    amount: -350,
                    type: "expense",
                    date: new Date().toISOString(),
                    category: "Office"
                }
            ];
        } catch (error) {
            console.error('Error getting recent transactions:', error);
            return [];
        }
    }

    async getFinanceCategories(): Promise<any[]> {
        try {
            // Return placeholder data for now
            return [
                { categoryId: 1, name: "Revenue", type: "income", parentId: null },
                { categoryId: 2, name: "Office", type: "expense", parentId: null },
                { categoryId: 3, name: "Marketing", type: "expense", parentId: null }
            ];
        } catch (error) {
            console.error('Error getting finance categories:', error);
            return [];
        }
    }

    async createFinanceCategory(data: any): Promise<any> {
        try {
            // Placeholder implementation
            return {
                categoryId: Date.now(),
                ...data,
                createdAt: new Date()
            };
        } catch (error) {
            console.error('Error creating finance category:', error);
            throw error;
        }
    }

    async getTransactions(): Promise<any[]> {
        try {
            // Return placeholder data for now
            return [
                {
                    transactionId: 1,
                    description: "Client payment",
                    amount: 5000,
                    type: "income",
                    date: new Date().toISOString(),
                    category: "Revenue"
                },
                {
                    transactionId: 2,
                    description: "Office supplies",
                    amount: 350,
                    type: "expense",
                    date: new Date().toISOString(),
                    category: "Office"
                }
            ];
        } catch (error) {
            console.error('Error getting transactions:', error);
            return [];
        }
    }

    async createTransaction(data: any): Promise<any> {
        try {
            // Placeholder implementation
            return {
                transactionId: Date.now(),
                ...data,
                createdAt: new Date()
            };
        } catch (error) {
            console.error('Error creating transaction:', error);
            throw error;
        }
    }

    async getPayables(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT 
                    p.payable_id as "payableId",
                    p.description,
                    p.total_amount as "totalAmount",
                    p.amount_paid as "amountPaid",
                    p.due_date as "dueDate",
                    p.status,
                    p.category_id as "categoryId",
                    p.contact_id as "contactId",
                    p.created_at as "createdAt",
                    t.task_id as "linkedTaskId",
                    t.title as "linkedTaskTitle",
                    t.status as "linkedTaskStatus"
                FROM finance.payables p
                LEFT JOIN crm.tasks t ON t.linked_payable_id = p.payable_id
                ORDER BY p.due_date ASC, p.created_at DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error getting payables:', error);
            return [];
        }
    }

    async createPayable(data: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO finance.payables (
                    space_id, description, total_amount, due_date, status, contact_id
                )
                VALUES (
                    ${data.spaceId || 1}, ${data.description}, ${data.amount}, 
                    ${data.dueDate}, ${data.status || 'unpaid'}, ${data.contactId || null}
                )
                RETURNING 
                    payable_id as "payableId",
                    description,
                    total_amount as "totalAmount",
                    due_date as "dueDate",
                    status,
                    created_at as "createdAt"
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating payable:', error);
            throw error;
        }
    }

    // Receivables Management - Money owed to you
    async getReceivables(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT 
                    r.receivable_id as "receivableId",
                    r.description,
                    r.total_amount as "totalAmount",
                    r.amount_received as "amountReceived",
                    r.issue_date as "issueDate",
                    r.due_date as "dueDate",
                    r.status,
                    r.category_id as "categoryId",
                    r.contact_id as "contactId",
                    r.created_at as "createdAt"
                FROM finance.receivables r
                ORDER BY r.due_date ASC, r.created_at DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error getting receivables:', error);
            return [];
        }
    }

    async createReceivable(data: InsertFinanceReceivable): Promise<FinanceReceivable> {
        try {
            const [receivable] = await db
                .insert(financeReceivables)
                .values({
                    ...data,
                    updatedAt: new Date(),
                })
                .returning();
            return receivable;
        } catch (error) {
            console.error('Error creating receivable:', error);
            throw error;
        }
    }

    async updateReceivable(receivableId: number, data: Partial<InsertFinanceReceivable>): Promise<FinanceReceivable> {
        try {
            const [receivable] = await db
                .update(financeReceivables)
                .set({
                    ...data,
                    updatedAt: new Date(),
                })
                .where(eq(financeReceivables.receivableId, receivableId))
                .returning();
            return receivable;
        } catch (error) {
            console.error('Error updating receivable:', error);
            throw error;
        }
    }

    async deleteReceivable(receivableId: number): Promise<void> {
        try {
            await db
                .delete(financeReceivables)
                .where(eq(financeReceivables.receivableId, receivableId));
        } catch (error) {
            console.error('Error deleting receivable:', error);
            throw error;
        }
    }

    async getLoans(): Promise<any[]> {
        try {
            // Return placeholder data for now
            return [
                {
                    loanId: 1,
                    loanName: "Business Equipment Loan",
                    originalAmount: 25000,
                    currentBalance: 18500,
                    interestRate: 5.5,
                    termMonths: 36,
                    paymentAmount: 750,
                    startDate: "2024-01-01",
                    status: "active"
                },
                {
                    loanId: 2,
                    loanName: "Office Expansion Loan",
                    originalAmount: 50000,
                    currentBalance: 26500,
                    interestRate: 4.8,
                    termMonths: 60,
                    paymentAmount: 950,
                    startDate: "2023-06-01",
                    status: "active"
                }
            ];
        } catch (error) {
            console.error('Error getting loans:', error);
            return [];
        }
    }

    async createLoan(data: any): Promise<any> {
        try {
            // Placeholder implementation
            return {
                loanId: Date.now(),
                ...data,
                createdAt: new Date()
            };
        } catch (error) {
            console.error('Error creating loan:', error);
            throw error;
        }
    }

    // Finance Accounts
    async getFinanceAccounts(spaceId: number): Promise<FinanceAccount[]> {
        try {
            const accounts = await db
                .select()
                .from(financeAccounts)
                .where(eq(financeAccounts.spaceId, spaceId))
                .orderBy(financeAccounts.accountName);
            return accounts;
        } catch (error) {
            console.error('Error getting finance accounts:', error);
            return [];
        }
    }

    async createFinanceAccount(data: InsertFinanceAccount): Promise<FinanceAccount> {
        try {
            const [account] = await db
                .insert(financeAccounts)
                .values({
                    ...data,
                    updatedAt: new Date(),
                })
                .returning();
            return account;
        } catch (error) {
            console.error('Error creating finance account:', error);
            throw error;
        }
    }

    async updateFinanceAccount(accountId: number, data: Partial<InsertFinanceAccount>): Promise<FinanceAccount> {
        try {
            const [account] = await db
                .update(financeAccounts)
                .set({
                    ...data,
                    updatedAt: new Date(),
                })
                .where(eq(financeAccounts.accountId, accountId))
                .returning();
            return account;
        } catch (error) {
            console.error('Error updating finance account:', error);
            throw error;
        }
    }

    async deleteFinanceAccount(accountId: number): Promise<void> {
        try {
            await db
                .delete(financeAccounts)
                .where(eq(financeAccounts.accountId, accountId));
        } catch (error) {
            console.error('Error deleting finance account:', error);
            throw error;
        }
    }

    // =========================================================================
    // CRM COMPANIES METHODS - For polymorphic creditor relationships
    // =========================================================================

    async getCrmCompanies(spaceId: number): Promise<CrmCompany[]> {
        try {
            return await db
                .select()
                .from(crmCompanies)
                .where(eq(crmCompanies.spaceId, spaceId))
                .orderBy(crmCompanies.companyName);
        } catch (error) {
            console.error('Error fetching CRM companies:', error);
            throw error;
        }
    }

    async createCrmCompany(company: InsertCrmCompany): Promise<CrmCompany> {
        try {
            const [newCompany] = await db
                .insert(crmCompanies)
                .values(company)
                .returning();
            return newCompany;
        } catch (error) {
            console.error('Error creating CRM company:', error);
            throw error;
        }
    }

    async updateCrmCompany(companyId: number, updates: Partial<InsertCrmCompany>): Promise<CrmCompany> {
        try {
            const [company] = await db
                .update(crmCompanies)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(crmCompanies.companyId, companyId))
                .returning();
            return company;
        } catch (error) {
            console.error('Error updating CRM company:', error);
            throw error;
        }
    }

    async deleteCrmCompany(companyId: number): Promise<void> {
        try {
            await db
                .delete(crmCompanies)
                .where(eq(crmCompanies.companyId, companyId));
        } catch (error) {
            console.error('Error deleting CRM company:', error);
            throw error;
        }
    }

    // =========================================================================
    // CREDIT CARD DETAILS METHODS - For credit card specific information
    // =========================================================================

    async createCreditCardDetails(details: InsertCreditCardDetails): Promise<CreditCardDetails> {
        try {
            const [creditCard] = await db
                .insert(creditCardDetails)
                .values(details)
                .returning();
            return creditCard;
        } catch (error) {
            console.error('Error creating credit card details:', error);
            throw error;
        }
    }

    async getCreditCardDetails(accountId: number): Promise<CreditCardDetails | undefined> {
        try {
            const [creditCard] = await db
                .select()
                .from(creditCardDetails)
                .where(eq(creditCardDetails.accountId, accountId));
            return creditCard;
        } catch (error) {
            console.error('Error fetching credit card details:', error);
            throw error;
        }
    }

    async updateCreditCardDetails(accountId: number, updates: Partial<InsertCreditCardDetails>): Promise<CreditCardDetails> {
        try {
            const [creditCard] = await db
                .update(creditCardDetails)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(creditCardDetails.accountId, accountId))
                .returning();
            return creditCard;
        } catch (error) {
            console.error('Error updating credit card details:', error);
            throw error;
        }
    }

    // =========================================================================
    // STATEMENTS METHODS - For credit card monthly statements
    // =========================================================================

    async createStatement(statement: InsertStatement): Promise<Statement> {
        try {
            const [newStatement] = await db
                .insert(statements)
                .values(statement)
                .returning();
            return newStatement;
        } catch (error) {
            console.error('Error creating statement:', error);
            throw error;
        }
    }

    async getStatements(accountId: number): Promise<Statement[]> {
        try {
            return await db
                .select()
                .from(statements)
                .where(eq(statements.accountId, accountId))
                .orderBy(desc(statements.statementPeriodEnd));
        } catch (error) {
            console.error('Error fetching statements:', error);
            throw error;
        }
    }

    async getLatestStatement(accountId: number): Promise<Statement | undefined> {
        try {
            const [statement] = await db
                .select()
                .from(statements)
                .where(eq(statements.accountId, accountId))
                .orderBy(desc(statements.statementPeriodEnd))
                .limit(1);
            return statement;
        } catch (error) {
            console.error('Error fetching latest statement:', error);
            throw error;
        }
    }

    // =========================================================================
    // CRM CONTACT GROUPS METHODS
    // =========================================================================

    async getContactGroups(contactId: number): Promise<any[]> {
        // Temporary simplified implementation to avoid Drizzle ORM errors
        // Returns empty array for now - will implement full functionality later
        return [];
    }

    async getContactGroupWithMembers(groupId: string): Promise<any> {
        const group = await db.select().from(crmContactGroups)
            .where(eq(crmContactGroups.groupId, groupId))
            .limit(1);

        if (!group.length) return null;

        const members = await db.select({
            contactId: crmContactGroupMembers.contactId,
            roleInGroup: crmContactGroupMembers.roleInGroup,
            addedAt: crmContactGroupMembers.addedAt,
            addedBy: crmContactGroupMembers.addedBy,
        }).from(crmContactGroupMembers)
        .where(eq(crmContactGroupMembers.groupId, groupId));

        return {
            ...group[0],
            members
        };
    }

    async createContactGroup(groupData: any): Promise<any> {
        const [group] = await db.insert(crmContactGroups)
            .values(groupData)
            .returning();
        return group;
    }

    async updateContactGroup(groupId: string, updates: any): Promise<any> {
        const [group] = await db.update(crmContactGroups)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(crmContactGroups.groupId, groupId))
            .returning();
        return group;
    }

    async deleteContactGroup(groupId: string): Promise<void> {
        // Soft delete by setting isActive to false
        await db.update(crmContactGroups)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(crmContactGroups.groupId, groupId));
    }

    async addContactToGroup(groupId: string, contactId: number, addedBy: string, roleInGroup?: string): Promise<any> {
        const [member] = await db.insert(crmContactGroupMembers)
            .values({
                groupId,
                contactId,
                addedBy,
                roleInGroup: roleInGroup || null
            })
            .returning();
        return member;
    }

    async removeContactFromGroup(groupId: string, contactId: number): Promise<void> {
        await db.delete(crmContactGroupMembers)
            .where(and(
                eq(crmContactGroupMembers.groupId, groupId),
                eq(crmContactGroupMembers.contactId, contactId)
            ));
    }

    async updateContactRoleInGroup(groupId: string, contactId: number, roleInGroup: string): Promise<any> {
        const [member] = await db.update(crmContactGroupMembers)
            .set({ roleInGroup })
            .where(and(
                eq(crmContactGroupMembers.groupId, groupId),
                eq(crmContactGroupMembers.contactId, contactId)
            ))
            .returning();
        return member;
    }

    async getContactGroupsByContact(contactId: number): Promise<any[]> {
        return await db.select({
            groupId: crmContactGroups.groupId,
            groupName: crmContactGroups.groupName,
            groupDescription: crmContactGroups.groupDescription,
            groupIcon: crmContactGroups.groupIcon,
            roleInGroup: crmContactGroupMembers.roleInGroup,
            addedAt: crmContactGroupMembers.addedAt,
        }).from(crmContactGroupMembers)
        .innerJoin(crmContactGroups, eq(crmContactGroupMembers.groupId, crmContactGroups.groupId))
        .where(and(
            eq(crmContactGroupMembers.contactId, contactId),
            eq(crmContactGroups.isActive, true)
        ));
    }

    // =========================================================================
    // COMPREHENSIVE CONTACTS MODULE - 360-Degree CRM Storage Methods
    // =========================================================================

    // Core Contact Operations
    async getCrmContacts(ownerUserId: string): Promise<any[]> {
        return await db.select().from(crmContacts)
            .where(eq(crmContacts.ownerUserId, ownerUserId))
            .orderBy(desc(crmContacts.createdAt));
    }

    async getCrmContactById(contactId: number): Promise<any | null> {
        const [contact] = await db.select().from(crmContacts)
            .where(eq(crmContacts.contactId, contactId))
            .limit(1);
        return contact || null;
    }

    async getCrmContactWithFullDetails(contactId: number): Promise<any | null> {
        // Get the main contact
        const contact = await this.getCrmContactById(contactId);
        if (!contact) return null;

        // Get all related data in parallel with error handling
        const [phones, emails, addresses, aliases, specialDates, interests, companies, groups, relationships] = await Promise.all([
            this.getContactPhones(contactId).catch(() => []),
            this.getContactEmails(contactId).catch(() => []),
            this.getContactAddresses(contactId).catch(() => []),
            this.getContactAliases(contactId).catch(() => []),
            this.getContactSpecialDates(contactId).catch(() => []),
            this.getContactInterests(contactId).catch(() => []),
            this.getContactCompanies(contactId).catch(() => []),
            this.getContactGroups(contactId).catch(() => []),
            this.getContactRelationships(contactId).catch(() => [])
        ]);

        return {
            ...contact,
            phones,
            emails,
            addresses,
            aliases,
            specialDates,
            interests,
            companies,
            groups,
            relationships
        };
    }

    async createCrmContact(contactData: any): Promise<any> {
        try {
            // Remove contactId if present to let the database auto-generate it
            const { contactId, ...insertData } = contactData;
            const [contact] = await db.insert(crmContacts)
                .values(insertData)
                .returning();
            return contact;
        } catch (error) {
            console.error('Error creating CRM contact:', error);
            throw error;
        }
    }

    async updateCrmContact(contactId: number, updates: any): Promise<any> {
        const [contact] = await db.update(crmContacts)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(crmContacts.contactId, contactId))
            .returning();
        return contact;
    }

    async deleteCrmContact(contactId: number): Promise<void> {
        await db.delete(crmContacts)
            .where(eq(crmContacts.contactId, contactId));
    }

    // Find CRM contacts by phone number or WhatsApp JID
    async getCrmContactsByPhoneOrJid(phoneNumber: string, whatsappJid: string): Promise<any[]> {
        try {
            // First check by WhatsApp JID
            const contactsByJid = await db.select()
                .from(crmContacts)
                .where(eq(crmContacts.whatsappJid, whatsappJid));
            
            if (contactsByJid.length > 0) {
                return contactsByJid;
            }
            
            // Then check by phone number in contact phones
            const contactsByPhone = await db.select({
                contactId: crmContacts.contactId,
                fullName: crmContacts.fullName,
                whatsappJid: crmContacts.whatsappJid,
                whatsappInstanceId: crmContacts.whatsappInstanceId,
                isWhatsappLinked: crmContacts.isWhatsappLinked,
                whatsappLinkedAt: crmContacts.whatsappLinkedAt
            })
            .from(crmContacts)
            .innerJoin(crmContactPhones, eq(crmContacts.contactId, crmContactPhones.contactId))
            .where(eq(crmContactPhones.phoneNumber, phoneNumber));
            
            return contactsByPhone;
        } catch (error) {
            console.error('Error finding CRM contacts by phone or JID:', error);
            return [];
        }
    }

    // Complete Contact Methods (handles all block data)
    async createCompleteContact(contactData: any): Promise<any> {
        try {
            // Extract block data
            const { phones = [], emails = [], addresses = [], ...mainContactData } = contactData;
            
            // Create the main contact first
            const contact = await this.createCrmContact(mainContactData);
            
            // Process phones (ensure Mobile label instead of WhatsApp)
            // The addContactPhone method will automatically handle instance linking for main contacts
            for (const phone of phones) {
                await this.addContactPhone({
                    ...phone,
                    label: phone.label === 'WhatsApp' ? 'Mobile' : phone.label,
                    contactId: contact.contactId
                });
            }
            
            // Process emails
            for (const email of emails) {
                await this.addContactEmail({
                    ...email,
                    contactId: contact.contactId
                });
            }
            
            // Process addresses
            for (const address of addresses) {
                await this.addContactAddress({
                    ...address,
                    contactId: contact.contactId
                });
            }
            
            return contact;
        } catch (error) {
            console.error('Error creating complete contact:', error);
            throw error;
        }
    }

    async updateCompleteContact(contactId: number, contactData: any): Promise<any> {
        try {
            // Extract block data
            const { phones = [], emails = [], addresses = [], relationships = [], ...mainContactData } = contactData;
            
            // Update the main contact first
            const contact = await this.updateCrmContact(contactId, mainContactData);
            
            // Clear existing data and recreate with new block data
            // This is a simple approach - delete all existing and recreate
            
            // Delete existing phones, emails, addresses, relationships
            await db.delete(crmContactPhones).where(eq(crmContactPhones.contactId, contactId));
            await db.delete(crmContactEmails).where(eq(crmContactEmails.contactId, contactId));
            await db.delete(crmContactAddresses).where(eq(crmContactAddresses.contactId, contactId));
            await db.delete(crmContactRelationships).where(
                or(
                    eq(crmContactRelationships.contactAId, contactId),
                    eq(crmContactRelationships.contactBId, contactId)
                )
            );
            
            // Add new phones (ensure Mobile label instead of WhatsApp)
            for (const phone of phones) {
                await this.addContactPhone({
                    ...phone,
                    label: phone.label === 'WhatsApp' ? 'Mobile' : phone.label,
                    contactId: contactId
                });
            }
            
            // Add new emails
            for (const email of emails) {
                await this.addContactEmail({
                    ...email,
                    contactId: contactId
                });
            }
            
            // Add new addresses
            for (const address of addresses) {
                await this.addContactAddress({
                    ...address,
                    contactId: contactId
                });
            }
            
            // Add new relationships
            for (const relationship of relationships) {
                if (relationship.relatedContactId && relationship.relationshipType) {
                    await this.addContactRelationship({
                        contactId: contactId,
                        relatedContactId: relationship.relatedContactId,
                        relationshipType: relationship.relationshipType,
                        notes: relationship.notes || null
                    });
                }
            }
            
            return contact;
        } catch (error) {
            console.error('Error updating complete contact:', error);
            throw error;
        }
    }

    // Create contact phone record
    async createCrmContactPhone(phoneData: any): Promise<any> {
        try {
            // If this is set as primary, unset other primary phones for this contact
            if (phoneData.isPrimary) {
                await db.update(crmContactPhones)
                    .set({ isPrimary: false })
                    .where(eq(crmContactPhones.contactId, phoneData.contactId));
            }

            const [phone] = await db.insert(crmContactPhones)
                .values(phoneData)
                .returning();
            
            return phone;
        } catch (error) {
            console.error('Error creating CRM contact phone:', error);
            throw error;
        }
    }

    // Contact Phone Methods
    async getContactPhones(contactId: number): Promise<any[]> {
        try {
            const phones = await db.select().from(crmContactPhones)
                .where(eq(crmContactPhones.contactId, contactId))
                .orderBy(desc(crmContactPhones.isPrimary), desc(crmContactPhones.createdAt));
            
            // Check WhatsApp linking status for each phone using database join
            return await Promise.all(phones.map(async (phone) => {
                const whatsappJid = this.phoneToWhatsAppJid(phone.phoneNumber);
                const whatsappContact = await this.getWhatsappContactByJid(whatsappJid);
                
                return {
                    phoneId: phone.phoneId,
                    contactId: phone.contactId,
                    phoneNumber: phone.phoneNumber,
                    label: phone.label,
                    isPrimary: phone.isPrimary,
                    isWhatsappLinked: !!whatsappContact,
                    whatsappJid: whatsappContact ? whatsappJid : null,
                    createdAt: phone.createdAt,
                    updatedAt: phone.updatedAt
                };
            }));
        } catch (error) {
            console.error('Error fetching contact phones:', error);
            return [];
        }
    }

    async addContactPhone(phoneData: any): Promise<any> {
        // If this is set as primary, unset other primary phones for this contact
        if (phoneData.isPrimary) {
            await db.update(crmContactPhones)
                .set({ isPrimary: false })
                .where(eq(crmContactPhones.contactId, phoneData.contactId));
        }

        // Get contact details to check if it's a main contact
        const contact = await this.getCrmContactById(phoneData.contactId);
        
        let isWhatsappLinked = false;
        let whatsappJid = null;
        let whatsappInstanceName = null;
        
        if (contact) {
            // Create WhatsApp JID from phone number
            const potentialJid = this.phoneToWhatsAppJid(phoneData.phoneNumber);
            
            if (contact.relationship === 'Self' || contact.relationship === 'self') {
                // For main contacts, check WhatsApp instances (they own these instances)
                const instance = await this.getWhatsappInstanceByOwnerJid(potentialJid);
                if (instance) {
                    isWhatsappLinked = true;
                    whatsappJid = instance.ownerJid;
                    whatsappInstanceName = instance.instanceName;
                    
                    // Also update the main contact with WhatsApp linking info
                    await this.updateCrmContact(contact.contactId, {
                        whatsappJid: instance.ownerJid,
                        whatsappInstanceId: instance.instanceName,
                        isWhatsappLinked: true,
                        whatsappLinkedAt: new Date()
                    });
                    
                    console.log(`🔗 Main contact ${contact.fullName} linked to WhatsApp instance: ${instance.instanceName}`);
                }
            } else {
                // For regular contacts, check regular WhatsApp contacts
                const whatsappContact = await this.getWhatsappContactByJid(potentialJid);
                if (whatsappContact) {
                    isWhatsappLinked = true;
                    whatsappJid = potentialJid;
                }
            }
        }
        
        const [phone] = await db.insert(crmContactPhones)
            .values({
                ...phoneData,
                isWhatsappLinked,
                whatsappJid
            })
            .returning();
        
        return phone;
    }

    // Helper method to convert phone number to WhatsApp JID
    private phoneToWhatsAppJid(phoneNumber: string): string {
        // Remove all non-digit characters and convert to international format
        const digits = phoneNumber.replace(/\D/g, '');
        
        // If it starts with +, remove it
        const cleanNumber = digits.startsWith('1') ? digits : digits.replace(/^0+/, '');
        
        // Return WhatsApp JID format
        return `${cleanNumber}@s.whatsapp.net`;
    }

    // Helper method to check if WhatsApp contact exists
    private async getWhatsappContactByJid(jid: string): Promise<any | null> {
        try {
            const [contact] = await db.select()
                .from(whatsappContacts)
                .where(eq(whatsappContacts.jid, jid))
                .limit(1);
            return contact || null;
        } catch (error) {
            console.error('Error checking WhatsApp contact:', error);
            return null;
        }
    }

    private async getWhatsappInstanceByOwnerJid(ownerJid: string): Promise<any | null> {
        try {
            const [instance] = await db.select()
                .from(whatsappInstances)
                .where(eq(whatsappInstances.ownerJid, ownerJid))
                .limit(1);
            return instance || null;
        } catch (error) {
            console.error('Error checking WhatsApp instance by owner JID:', error);
            return null;
        }
    }

    async updateContactPhone(phoneId: number, updates: any): Promise<any> {
        const [phone] = await db.update(crmContactPhones)
            .set(updates)
            .where(eq(crmContactPhones.phoneId, phoneId))
            .returning();
        return phone;
    }

    async deleteContactPhone(phoneId: number): Promise<void> {
        await db.delete(crmContactPhones)
            .where(eq(crmContactPhones.phoneId, phoneId));
    }

    // Contact Email Methods
    async getContactEmails(contactId: number): Promise<any[]> {
        return await db.select().from(crmContactEmails)
            .where(eq(crmContactEmails.contactId, contactId))
            .orderBy(desc(crmContactEmails.isPrimary), desc(crmContactEmails.createdAt));
    }

    async addContactEmail(emailData: any): Promise<any> {
        // If this is set as primary, unset other primary emails for this contact
        if (emailData.isPrimary) {
            await db.update(crmContactEmails)
                .set({ isPrimary: false })
                .where(eq(crmContactEmails.contactId, emailData.contactId));
        }

        const [email] = await db.insert(crmContactEmails)
            .values(emailData)
            .returning();
        return email;
    }

    async updateContactEmail(emailId: number, updates: any): Promise<any> {
        const [email] = await db.update(crmContactEmails)
            .set(updates)
            .where(eq(crmContactEmails.emailId, emailId))
            .returning();
        return email;
    }

    async deleteContactEmail(emailId: number): Promise<void> {
        await db.delete(crmContactEmails)
            .where(eq(crmContactEmails.emailId, emailId));
    }

    // Contact Address Methods
    async getContactAddresses(contactId: number): Promise<any[]> {
        return await db.select().from(crmContactAddresses)
            .where(eq(crmContactAddresses.contactId, contactId))
            .orderBy(desc(crmContactAddresses.isPrimary), desc(crmContactAddresses.createdAt));
    }

    async addContactAddress(addressData: any): Promise<any> {
        // If this is set as primary, unset other primary addresses for this contact
        if (addressData.isPrimary) {
            await db.update(crmContactAddresses)
                .set({ isPrimary: false })
                .where(eq(crmContactAddresses.contactId, addressData.contactId));
        }

        const [address] = await db.insert(crmContactAddresses)
            .values(addressData)
            .returning();
        return address;
    }

    async updateContactAddress(addressId: number, updates: any): Promise<any> {
        const [address] = await db.update(crmContactAddresses)
            .set(updates)
            .where(eq(crmContactAddresses.addressId, addressId))
            .returning();
        return address;
    }

    async deleteContactAddress(addressId: number): Promise<void> {
        await db.delete(crmContactAddresses)
            .where(eq(crmContactAddresses.addressId, addressId));
    }

    // Contact Alias Methods
    async getContactAliases(contactId: number): Promise<any[]> {
        return await db.select().from(crmContactAliases)
            .where(eq(crmContactAliases.contactId, contactId))
            .orderBy(desc(crmContactAliases.createdAt));
    }

    async addContactAlias(aliasData: any): Promise<any> {
        const [alias] = await db.insert(crmContactAliases)
            .values(aliasData)
            .returning();
        return alias;
    }

    async deleteContactAlias(aliasId: number): Promise<void> {
        await db.delete(crmContactAliases)
            .where(eq(crmContactAliases.aliasId, aliasId));
    }

    // Special Dates Methods
    async getContactSpecialDates(contactId: number): Promise<any[]> {
        return await db.select().from(crmSpecialDates)
            .where(eq(crmSpecialDates.contactId, contactId))
            .orderBy(asc(crmSpecialDates.eventDate));
    }

    async addContactSpecialDate(dateData: any): Promise<any> {
        const [specialDate] = await db.insert(crmSpecialDates)
            .values(dateData)
            .returning();
        return specialDate;
    }

    async updateContactSpecialDate(specialDateId: number, updates: any): Promise<any> {
        const [specialDate] = await db.update(crmSpecialDates)
            .set(updates)
            .where(eq(crmSpecialDates.specialDateId, specialDateId))
            .returning();
        return specialDate;
    }

    async deleteContactSpecialDate(specialDateId: number): Promise<void> {
        await db.delete(crmSpecialDates)
            .where(eq(crmSpecialDates.specialDateId, specialDateId));
    }

    // Interest Methods
    async getAllInterests(): Promise<any[]> {
        return await db.select().from(crmInterests)
            .orderBy(asc(crmInterests.name));
    }

    async createInterest(interestData: any): Promise<any> {
        const [interest] = await db.insert(crmInterests)
            .values(interestData)
            .returning();
        return interest;
    }

    async getContactInterests(contactId: number): Promise<any[]> {
        return await db.select({
            interestId: crmInterests.interestId,
            name: crmInterests.name,
            addedAt: crmContactInterests.addedAt,
        }).from(crmContactInterests)
        .innerJoin(crmInterests, eq(crmContactInterests.interestId, crmInterests.interestId))
        .where(eq(crmContactInterests.contactId, contactId))
        .orderBy(asc(crmInterests.name));
    }

    async addContactInterest(contactId: number, interestId: number): Promise<any> {
        const [contactInterest] = await db.insert(crmContactInterests)
            .values({ contactId, interestId })
            .returning();
        return contactInterest;
    }

    async removeContactInterest(contactId: number, interestId: number): Promise<void> {
        await db.delete(crmContactInterests)
            .where(and(
                eq(crmContactInterests.contactId, contactId),
                eq(crmContactInterests.interestId, interestId)
            ));
    }

    // Company Membership Methods
    async getContactCompanies(contactId: number): Promise<any[]> {
        return await db.select({
            companyId: crmCompanies.companyId,
            companyName: crmCompanies.companyName,
            role: crmCompanyMembers.role,
            startDate: crmCompanyMembers.startDate,
            endDate: crmCompanyMembers.endDate,
            isCurrent: crmCompanyMembers.isCurrent,
            addedAt: crmCompanyMembers.addedAt,
        }).from(crmCompanyMembers)
        .innerJoin(crmCompanies, eq(crmCompanyMembers.companyId, crmCompanies.companyId))
        .where(eq(crmCompanyMembers.contactId, contactId))
        .orderBy(desc(crmCompanyMembers.isCurrent), desc(crmCompanyMembers.addedAt));
    }

    async addContactToCompany(membershipData: any): Promise<any> {
        const [membership] = await db.insert(crmCompanyMembers)
            .values(membershipData)
            .returning();
        return membership;
    }

    async updateContactCompanyMembership(contactId: number, companyId: number, updates: any): Promise<any> {
        const [membership] = await db.update(crmCompanyMembers)
            .set(updates)
            .where(and(
                eq(crmCompanyMembers.contactId, contactId),
                eq(crmCompanyMembers.companyId, companyId)
            ))
            .returning();
        return membership;
    }

    async removeContactFromCompany(contactId: number, companyId: number): Promise<void> {
        await db.delete(crmCompanyMembers)
            .where(and(
                eq(crmCompanyMembers.contactId, contactId),
                eq(crmCompanyMembers.companyId, companyId)
            ));
    }

    // Contact Relationship Methods
    async getContactRelationships(contactId: number): Promise<any[]> {
        return await db.select({
            relationshipId: crmContactRelationships.contactAId, // Using as ID
            relatedContactId: crmContactRelationships.contactBId,
            relatedContactName: crmContacts.fullName,
            relationshipType: crmContactRelationships.relationshipAToB,
            createdAt: crmContactRelationships.createdAt,
        }).from(crmContactRelationships)
        .innerJoin(crmContacts, eq(crmContactRelationships.contactBId, crmContacts.contactId))
        .where(eq(crmContactRelationships.contactAId, contactId))
        .union(
            db.select({
                relationshipId: crmContactRelationships.contactBId, // Using as ID
                relatedContactId: crmContactRelationships.contactAId,
                relatedContactName: crmContacts.fullName,
                relationshipType: crmContactRelationships.relationshipBToA,
                createdAt: crmContactRelationships.createdAt,
            }).from(crmContactRelationships)
            .innerJoin(crmContacts, eq(crmContactRelationships.contactAId, crmContacts.contactId))
            .where(eq(crmContactRelationships.contactBId, contactId))
        );
    }

    async createContactRelationship(relationshipData: any): Promise<any> {
        const [relationship] = await db.insert(crmContactRelationships)
            .values(relationshipData)
            .returning();
        return relationship;
    }

    async addContactRelationship(relationshipData: any): Promise<any> {
        // Create relationship data for the database
        const dbRelationshipData = {
            contactAId: relationshipData.contactId,
            contactBId: relationshipData.relatedContactId,
            relationshipAToB: relationshipData.relationshipType,
            relationshipBToA: relationshipData.relationshipType, // Could be different if needed
            notes: relationshipData.notes
        };
        
        const [relationship] = await db.insert(crmContactRelationships)
            .values(dbRelationshipData)
            .returning();
        return relationship;
    }

    async deleteContactRelationship(contactAId: number, contactBId: number): Promise<void> {
        await db.delete(crmContactRelationships)
            .where(and(
                eq(crmContactRelationships.contactAId, contactAId),
                eq(crmContactRelationships.contactBId, contactBId)
            ));
    }

    // Search and Intelligence Methods
    async searchCrmContacts(ownerUserId: string, searchTerm: string): Promise<any[]> {
        const searchPattern = `%${searchTerm}%`;
        
        return await db.select().from(crmContacts)
            .where(and(
                eq(crmContacts.ownerUserId, ownerUserId),
                or(
                    sql`${crmContacts.fullName} ILIKE ${searchPattern}`,
                    sql`EXISTS (SELECT 1 FROM ${crmContactAliases} WHERE ${crmContactAliases.contactId} = ${crmContacts.contactId} AND ${crmContactAliases.alias} ILIKE ${searchPattern})`
                )
            ))
            .orderBy(desc(crmContacts.createdAt));
    }

    async getContactsByRelationship(ownerUserId: string, relationship: string): Promise<any[]> {
        return await db.select().from(crmContacts)
            .where(and(
                eq(crmContacts.ownerUserId, ownerUserId),
                eq(crmContacts.relationship, relationship)
            ))
            .orderBy(asc(crmContacts.fullName));
    }

    async getUpcomingSpecialDates(ownerUserId: string, daysAhead: number = 30): Promise<any[]> {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + daysAhead);

        return await db.select({
            contactId: crmContacts.contactId,
            contactName: crmContacts.fullName,
            eventName: crmSpecialDates.eventName,
            eventDate: crmSpecialDates.eventDate,
            reminderDaysBefore: crmSpecialDates.reminderDaysBefore,
        }).from(crmSpecialDates)
        .innerJoin(crmContacts, eq(crmSpecialDates.contactId, crmContacts.contactId))
        .where(and(
            eq(crmContacts.ownerUserId, ownerUserId),
            sql`${crmSpecialDates.eventDate} BETWEEN ${today} AND ${futureDate}`
        ))
        .orderBy(asc(crmSpecialDates.eventDate));
    }

    // Company Management Methods
    async getAllCompanies(spaceId: number): Promise<any[]> {
        return await db.select().from(crmCompanies)
            .where(eq(crmCompanies.spaceId, spaceId))
            .orderBy(asc(crmCompanies.companyName));
    }

    async getCompanyWithDetails(companyId: number): Promise<any> {
        const [company] = await db.select().from(crmCompanies)
            .where(eq(crmCompanies.companyId, companyId))
            .limit(1);

        if (!company) return null;

        // Get company contacts/employees
        const contacts = await db.select({
            contactId: crmCompanyMembers.contactId,
            role: crmCompanyMembers.role,
            startDate: crmCompanyMembers.startDate,
            endDate: crmCompanyMembers.endDate,
            addedAt: crmCompanyMembers.addedAt,
            fullName: crmContacts.fullName,
            relationship: crmContacts.relationship,
        }).from(crmCompanyMembers)
        .innerJoin(crmContacts, eq(crmCompanyMembers.contactId, crmContacts.contactId))
        .where(eq(crmCompanyMembers.companyId, companyId))
        .orderBy(asc(crmContacts.fullName));

        return {
            ...company,
            contacts
        };
    }

    async createCompany(companyData: any): Promise<any> {
        const [company] = await db.insert(crmCompanies)
            .values(companyData)
            .returning();
        return company;
    }

    async updateCompany(companyId: number, updates: any): Promise<any> {
        const [company] = await db.update(crmCompanies)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(crmCompanies.companyId, companyId))
            .returning();
        return company;
    }

    async deleteCompany(companyId: number): Promise<void> {
        // First remove all company members
        await db.delete(crmCompanyMembers)
            .where(eq(crmCompanyMembers.companyId, companyId));
        
        // Then delete the company
        await db.delete(crmCompanies)
            .where(eq(crmCompanies.companyId, companyId));
    }

    async searchCompanies(spaceId: number, searchTerm: string): Promise<any[]> {
        return await db.select().from(crmCompanies)
            .where(and(
                eq(crmCompanies.spaceId, spaceId),
                or(
                    ilike(crmCompanies.companyName, `%${searchTerm}%`),
                    ilike(crmCompanies.businessType, `%${searchTerm}%`)
                )
            ))
            .orderBy(asc(crmCompanies.companyName));
    }

    async addCompanyMember(memberData: any): Promise<any> {
        const [member] = await db.insert(crmCompanyMembers)
            .values(memberData)
            .returning();
        return member;
    }

    async removeCompanyMember(companyId: number, contactId: number): Promise<void> {
        await db.delete(crmCompanyMembers)
            .where(and(
                eq(crmCompanyMembers.companyId, companyId),
                eq(crmCompanyMembers.contactId, contactId)
            ));
    }

    async getContactsByCompany(companyId: number): Promise<any[]> {
        return await db.select({
            contactId: crmContacts.contactId,
            fullName: crmContacts.fullName,
            relationship: crmContacts.relationship,
            role: crmCompanyMembers.role,
            startDate: crmCompanyMembers.startDate,
        }).from(crmContacts)
        .innerJoin(crmCompanyMembers, eq(crmContacts.contactId, crmCompanyMembers.contactId))
        .where(eq(crmCompanyMembers.companyId, companyId))
        .orderBy(asc(crmContacts.fullName));
    }

    // WhatsApp contact validation method
    async getWhatsAppContactByPhone(phoneNumber: string): Promise<any> {
        // Normalize the phone number for comparison
        const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
        
        // Search in WhatsApp contacts table (use the whatsapp schema contacts table)
        const [contact] = await db.select()
            .from(whatsappContacts)
            .where(
                or(
                    eq(whatsappContacts.jid, `${normalizedPhone}@s.whatsapp.net`),
                    ilike(whatsappContacts.jid, `${normalizedPhone}%`)
                )
            )
            .limit(1);
        
        return contact;
    }

    // Space Items Management - projects, tasks, notes, documents, events, finance
    async createSpaceItem(itemData: any): Promise<any> {
        try {
            // For now, return a mock item since appSpaceItems table structure is being refactored
            return {
                id: Date.now().toString(),
                spaceId: itemData.spaceId,
                itemType: itemData.itemType,
                parentItemId: itemData.parentItemId,
                title: itemData.title,
                description: itemData.description,
                content: itemData.content || {},
                status: itemData.status || 'active',
                priority: itemData.priority || 'medium',
                dueDate: itemData.dueDate,
                assignedTo: itemData.assignedTo,
                tags: itemData.tags || [],
                metadata: itemData.metadata || {},
                displayOrder: itemData.displayOrder || 0
            };
        } catch (error) {
            console.error('Error creating space item:', error);
            throw error;
        }
    }

    async getSpaceItems(spaceId: number, itemType?: string): Promise<any[]> {
        try {
            // Return empty array for now since space items are managed through specific tables
            const items: any[] = [];

            // Build hierarchical structure for tasks/subtasks
            const itemsMap = new Map();
            const rootItems: any[] = [];

            items.forEach(item => {
                itemsMap.set(item.itemId, { ...item, childItems: [] });
            });

            items.forEach(item => {
                if (item.parentItemId) {
                    const parent = itemsMap.get(item.parentItemId);
                    if (parent) {
                        parent.childItems.push(itemsMap.get(item.itemId));
                    }
                } else {
                    rootItems.push(itemsMap.get(item.itemId));
                }
            });

            return rootItems;
        } catch (error) {
            console.error('Error fetching space items:', error);
            throw error;
        }
    }

    async updateSpaceItem(itemId: number, updates: any): Promise<any> {
        try {
            // Return mock updated item for now
            return { id: itemId, ...updates, updatedAt: new Date() };
        } catch (error) {
            console.error('Error updating space item:', error);
            throw error;
        }
    }

    async deleteSpaceItem(itemId: number): Promise<void> {
        try {
            // Space items deletion handled through specific tables
            console.log('Space item deletion:', itemId);
        } catch (error) {
            console.error('Error deleting space item:', error);
            throw error;
        }
    }

    async getSpaceHierarchy(spaceId: number): Promise<any> {
        try {
            // Get space details
            const [space] = await db.select().from(appSpaces).where(eq(appSpaces.spaceId, spaceId));
            
            if (!space) return null;

            // Get all items for this space
            const projects = await this.getSpaceItems(spaceId, 'project');
            const tasks = await this.getSpaceItems(spaceId, 'task');
            const notes = await this.getSpaceItems(spaceId, 'note');
            const documents = await this.getSpaceItems(spaceId, 'document');
            const events = await this.getSpaceItems(spaceId, 'event');
            const finance = await this.getSpaceItems(spaceId, 'finance');

            // Get subspaces
            const subspaces = await db.select().from(appSpaces)
                .where(eq(appSpaces.parentSpaceId, spaceId))
                .orderBy(appSpaces.displayOrder);

            return {
                ...space,
                projects,
                tasks,
                notes,
                documents,
                events,
                finance,
                subspaces
            };
        } catch (error) {
            console.error('Error fetching space hierarchy:', error);
            throw error;
        }
    }

    // Action management methods
    async getActionTemplates(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT 
                    template_id as "templateId",
                    template_name as "templateName",
                    action_type as "actionType",
                    trigger_type as "triggerType",
                    default_config as "defaultConfig",
                    is_public as "isPublic",
                    category,
                    description,
                    created_at as "createdAt",
                    updated_at as "updatedAt"
                FROM actions.action_templates
                WHERE is_public = true OR is_public IS NULL
                ORDER BY template_name ASC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching action templates:', error);
            return [];
        }
    }

    async createActionTemplate(templateData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO actions.action_templates (
                    template_name,
                    action_type,
                    trigger_type,
                    default_config,
                    category,
                    description,
                    is_public
                ) VALUES (
                    ${templateData.template_name},
                    ${templateData.action_type},
                    ${templateData.trigger_type},
                    ${JSON.stringify(templateData.default_config)},
                    ${templateData.category || 'automation'},
                    ${templateData.description || ''},
                    ${templateData.is_public || false}
                ) RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating action template:', error);
            throw error;
        }
    }

    async getActionRules(userId?: string): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT 
                    rule_id as "ruleId",
                    rule_name as "ruleName",
                    description,
                    trigger_type as "triggerType",
                    trigger_conditions as "triggerConditions",
                    action_type as "actionType",
                    action_config as "actionConfig",
                    performer_filters as "performerFilters",
                    instance_filters as "instanceFilters",
                    is_active as "isActive",
                    total_executions as "totalExecutions",
                    last_executed_at as "lastExecutedAt",
                    created_at as "createdAt",
                    user_id as "userId"
                FROM actions.action_rules
                WHERE is_active = true
                ${userId ? sql`AND user_id = ${userId}` : sql``}
                ORDER BY rule_name ASC
            `);
            console.log('🔍 Raw action rules from DB:', result.rows);
            return result.rows;
        } catch (error) {
            console.error('Error fetching action rules:', error);
            return [];
        }
    }

    async createActionRule(ruleData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO actions.action_rules (
                    rule_name,
                    trigger_type,
                    trigger_conditions,
                    action_type,
                    action_config,
                    is_active,
                    user_id,
                    workspace_id,
                    space_id
                ) VALUES (
                    ${ruleData.rule_name},
                    ${ruleData.trigger_type},
                    ${JSON.stringify(ruleData.trigger_conditions)},
                    ${ruleData.action_type},
                    ${JSON.stringify(ruleData.action_config)},
                    ${ruleData.is_active || true},
                    ${ruleData.user_id || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'},
                    ${ruleData.workspace_id || null},
                    ${ruleData.space_id || null}
                ) RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating action rule:', error);
            throw error;
        }
    }

    async updateActionRule(ruleId: string, ruleData: any): Promise<any> {
        try {
            console.log('Storage updateActionRule - ruleId:', ruleId);
            console.log('Storage updateActionRule - ruleData:', ruleData);
            
            const result = await db.execute(sql`
                UPDATE actions.action_rules 
                SET 
                    rule_name = ${ruleData.ruleName || ruleData.rule_name},
                    description = ${ruleData.description || null},
                    trigger_type = ${ruleData.triggerType || ruleData.trigger_type},
                    trigger_conditions = ${JSON.stringify(ruleData.triggerConditions || ruleData.trigger_conditions || {})},
                    action_type = ${ruleData.actionType || ruleData.action_type},
                    action_config = ${JSON.stringify(ruleData.actionConfig || ruleData.action_config || {})},
                    performer_filters = ${JSON.stringify(ruleData.performerFilters || ruleData.performer_filters || {})},
                    instance_filters = ${JSON.stringify(ruleData.instanceFilters || ruleData.instance_filters || {})},
                    is_active = ${ruleData.isActive !== undefined ? ruleData.isActive : (ruleData.is_active !== undefined ? ruleData.is_active : true)},
                    updated_at = NOW()
                WHERE rule_id = ${ruleId}
                RETURNING 
                    rule_id as "ruleId",
                    rule_name as "ruleName",
                    description,
                    trigger_type as "triggerType",
                    trigger_conditions as "triggerConditions",
                    action_type as "actionType",
                    action_config as "actionConfig",
                    performer_filters as "performerFilters",
                    instance_filters as "instanceFilters",
                    is_active as "isActive",
                    total_executions as "totalExecutions",
                    last_executed_at as "lastExecutedAt",
                    created_at as "createdAt",
                    updated_at as "updatedAt"
            `);
            
            console.log('Storage updateActionRule - result:', result.rows[0]);
            return result.rows[0];
        } catch (error) {
            console.error('Error updating action rule:', error);
            throw error;
        }
    }

    async createNote(noteData: any): Promise<any> {
        try {
            // Generate title if missing - use chat ID and date format
            const finalTitle = noteData.title || `${noteData.relatedChatJid || 'Unknown'} ${new Date().toLocaleDateString()}`;
            
            // Create note using Drizzle ORM
            const [createdNote] = await db
                .insert(crmNotes)
                .values({
                    title: finalTitle,
                    content: noteData.content || 'Automatically created note',
                    createdByUserId: noteData.userId,
                    instanceId: noteData.instanceId,
                    spaceId: noteData.spaceId,
                    triggeringMessageId: noteData.triggeringMessageId,
                    relatedChatJid: noteData.relatedChatJid,
                })
                .returning();

            console.log('✅ Note created successfully in CRM schema:', createdNote.title);
            return createdNote;
        } catch (error) {
            console.error('❌ Error creating note in CRM schema:', error);
            throw error;
        }
    }
    async getMessageReplies(originalMessageId: string, instanceId: string): Promise<any[]> {
        try {
            const replies = await db.select()
                .from(whatsappMessages)
                .where(
                    and(
                        eq(whatsappMessages.quotedMessageId, originalMessageId),
                        eq(whatsappMessages.instanceId, instanceId)
                    )
                )
                .orderBy(asc(whatsappMessages.timestamp));
            
            return replies;
        } catch (error) {
            console.error('Error fetching message replies:', error);
            return [];
        }
    }

    async createPayable(payableData: any): Promise<any> {
        try {
            console.log('💰 Creating payable:', payableData);
            
            const [payable] = await db
                .insert(financePayables)
                .values({
                    spaceId: payableData.spaceId,
                    description: payableData.description,
                    totalAmount: payableData.totalAmount,
                    dueDate: payableData.dueDate,
                    status: payableData.status || 'unpaid'
                })
                .returning();
            
            console.log('✅ Payable created successfully:', payable);
            return payable;
        } catch (error) {
            console.error('❌ Error creating payable:', error);
            throw error;
        }
    }

    // Missing storage methods for production deployment
    async createAppUser(userData: any): Promise<any> {
        try {
            const [user] = await db
                .insert(appUsers)
                .values(userData)
                .returning();
            return user;
        } catch (error) {
            console.error('Error creating app user:', error);
            throw error;
        }
    }

    async getActionRule(ruleId: string): Promise<any> {
        try {
            const [rule] = await db
                .select()
                .from(actionRules)
                .where(eq(actionRules.ruleId, ruleId));
            return rule;
        } catch (error) {
            console.error('Error getting action rule:', error);
            return null;
        }
    }

    async deleteActionRule(ruleId: string): Promise<boolean> {
        try {
            await db
                .delete(actionRules)
                .where(eq(actionRules.ruleId, ruleId));
            return true;
        } catch (error) {
            console.error('Error deleting action rule:', error);
            return false;
        }
    }

    async getCalendars(spaceId: string): Promise<any[]> {
        try {
            return await db
                .select()
                .from(crmCalendarEvents)
                .orderBy(crmCalendarEvents.createdAt);
        } catch (error) {
            console.error('Error getting calendars:', error);
            return [];
        }
    }

    async createCalendar(calendarData: any): Promise<any> {
        try {
            const [calendar] = await db
                .insert(crmCalendarEvents)
                .values(calendarData)
                .returning();
            return calendar;
        } catch (error) {
            console.error('Error creating calendar:', error);
            throw error;
        }
    }



    async updateCalendar(calendarId: string, updateData: any): Promise<any> {
        try {
            const [calendar] = await db
                .update(crmCalendarEvents)
                .set(updateData)
                .where(eq(crmCalendarEvents.eventId, parseInt(calendarId)))
                .returning();
            return calendar;
        } catch (error) {
            console.error('Error updating calendar:', error);
            throw error;
        }
    }

    async deleteCalendar(calendarId: string): Promise<boolean> {
        try {
            await db
                .delete(crmCalendarEvents)
                .where(eq(crmCalendarEvents.eventId, parseInt(calendarId)));
            return true;
        } catch (error) {
            console.error('Error deleting calendar:', error);
            return false;
        }
    }

    async upsertGroup(groupData: any): Promise<any> {
        try {
            const [group] = await db
                .insert(whatsappGroups)
                .values(groupData)
                .onConflictDoUpdate({
                    target: [whatsappGroups.instanceId, whatsappGroups.groupJid],
                    set: groupData
                })
                .returning();
            return group;
        } catch (error) {
            console.error('Error upserting group:', error);
            throw error;
        }
    }

    async updatePayable(payableId: string, updateData: any): Promise<any> {
        try {
            const [payable] = await db
                .update(financePayables)
                .set(updateData)
                .where(eq(financePayables.payableId, parseInt(payableId)))
                .returning();
            return payable;
        } catch (error) {
            console.error('Error updating payable:', error);
            throw error;
        }
    }

    async upsertCallLog(callData: any): Promise<any> {
        try {
            const [callLog] = await db
                .insert(whatsappCallLogs)
                .values(callData)
                .onConflictDoUpdate({
                    target: [whatsappCallLogs.instanceId, whatsappCallLogs.callId],
                    set: callData
                })
                .returning();
            return callLog;
        } catch (error) {
            console.error('Error upserting call log:', error);
            throw error;
        }
    }

    // Action Execution Logging
    async createActionExecution(executionData: {
        ruleId: string;
        triggeredBy: string;
        triggerData: any;
        status: string;
        result?: any;
        errorMessage?: string;
        processingTimeMs?: number;
    }): Promise<any> {
        try {
            const [execution] = await db
                .insert(actionExecutions)
                .values({
                    ruleId: executionData.ruleId,
                    triggeredBy: executionData.triggeredBy,
                    triggerData: executionData.triggerData,
                    status: executionData.status,
                    result: executionData.result,
                    errorMessage: executionData.errorMessage,
                    processingTimeMs: executionData.processingTimeMs
                })
                .returning();
            
            return execution;
        } catch (error) {
            console.error('Storage createActionExecution - error:', error);
            throw error;
        }
    }

    async getActionExecutions(ruleId?: string, status?: string, limit: number = 100): Promise<any[]> {
        try {
            const result = await db
                .select({
                    executionId: actionExecutions.executionId,
                    ruleId: actionExecutions.ruleId,
                    triggeredBy: actionExecutions.triggeredBy,
                    triggerData: actionExecutions.triggerData,
                    status: actionExecutions.status,
                    result: actionExecutions.result,
                    errorMessage: actionExecutions.errorMessage,
                    executedAt: actionExecutions.executedAt,
                    processingTimeMs: actionExecutions.processingTimeMs
                })
                .from(actionExecutions)
                .where(
                    ruleId && status ? 
                        and(eq(actionExecutions.ruleId, ruleId), eq(actionExecutions.status, status)) :
                    ruleId ? 
                        eq(actionExecutions.ruleId, ruleId) :
                    status ? 
                        eq(actionExecutions.status, status) : 
                        undefined
                )
                .orderBy(desc(actionExecutions.executedAt))
                .limit(limit);
            
            return result;
        } catch (error) {
            console.error('Storage getActionExecutions - error:', error);
            return [];
        }
    }

    // =============================
    // WHATSAPP-CRM CONTACT LINKING
    // =============================
    
    /**
     * Automatically links a CRM contact to WhatsApp based on phone number
     * @param contactId - CRM contact ID
     * @param phoneNumber - Phone number to check for WhatsApp presence
     */
    async linkContactToWhatsApp(contactId: number, phoneNumber: string): Promise<void> {
        try {
            console.log(`🔗 Checking WhatsApp link for contact ${contactId} with phone ${phoneNumber}`);
            
            // Normalize phone number for WhatsApp JID format
            const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
            const possibleJids = [
                `${normalizedPhone}@s.whatsapp.net`
            ];
            
            console.log(`🔍 Searching for WhatsApp JIDs: ${possibleJids.join(', ')}`)
            
            // Search for existing WhatsApp contacts with matching JID
            for (const jid of possibleJids) {
                const whatsappContact = await db.select()
                    .from(whatsappContacts)
                    .where(eq(whatsappContacts.jid, jid))
                    .limit(1);
                
                if (whatsappContact.length > 0) {
                    const contact = whatsappContact[0];
                    
                    // Update CRM contact with WhatsApp linking information
                    await db.update(crmContacts)
                        .set({
                            whatsappJid: contact.jid,
                            whatsappInstanceId: contact.instanceId,
                            isWhatsappLinked: true,
                            whatsappLinkedAt: new Date(),
                            updatedAt: new Date()
                        })
                        .where(eq(crmContacts.contactId, contactId));
                    
                    // Update phone record to indicate WhatsApp linking
                    await db.update(crmContactPhones)
                        .set({ isWhatsappLinked: true })
                        .where(and(
                            eq(crmContactPhones.contactId, contactId),
                            eq(crmContactPhones.phoneNumber, phoneNumber)
                        ));
                    
                    console.log(`✅ Linked CRM contact ${contactId} to WhatsApp JID: ${contact.jid}`);
                    return;
                }
            }
            
            console.log(`📱 No WhatsApp contact found for phone ${phoneNumber}`);
        } catch (error) {
            console.error(`❌ Error linking contact ${contactId} to WhatsApp:`, error);
        }
    }

    /**
     * Normalizes phone number for WhatsApp JID matching
     * @param phoneNumber - Raw phone number
     * @returns Normalized phone number
     */
    private normalizePhoneNumber(phoneNumber: string): string {
        // Remove all non-digit characters
        let normalized = phoneNumber.replace(/[^\d]/g, '');
        
        // WhatsApp JIDs don't include the + sign, just the country code + number
        return normalized;
    }


}

export const storage = new DatabaseStorage();