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
    crmProjects, crmTasks, crmCompanies,
    crmContacts, crmContactPhones, crmContactEmails, crmContactAddresses, 
    crmContactAliases, crmSpecialDates, crmInterests, crmContactInterests,
    crmCompanyMembers, crmContactGroups, crmContactGroupMembers, crmContactRelationships,
    // Finance Schema
    financeAccounts, financeTransactions, financePayables, financeCategories,
    financeRecurringBills, financeLoans, financeLoanPayments, financePayablePayments,
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
    type FinanceCategory, type InsertFinanceCategory,
    type FinanceRecurringBill, type InsertFinanceRecurringBill,
    type FinanceLoan, type InsertFinanceLoan,
    type CreditCardDetails, type InsertCreditCardDetails,
    type Statement, type InsertStatement,
    type CrmCompany, type InsertCrmCompany
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
                const inheritedCategory = parentCategory || space.category || 'work';
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
            return await db.select().from(appSpaceTemplates)
                .where(eq(appSpaceTemplates.isPublic, true))
                .orderBy(appSpaceTemplates.usageCount);
        } catch (error) {
            console.error('Error fetching space templates:', error);
            return [];
        }
    }

    async createSpaceFromTemplate(templateId: number, spaceData: any): Promise<any> {
        try {
            const [template] = await db.select().from(appSpaceTemplates)
                .where(eq(appSpaceTemplates.templateId, templateId));
            
            if (!template) {
                throw new Error('Template not found');
            }

            // Merge template config with custom data
            const mergedData = {
                ...template.config,
                ...spaceData,
                templateId: templateId
            };

            const newSpace = await this.createSpace(mergedData);

            // Increment template usage
            await db.update(appSpaceTemplates)
                .set({ usageCount: template.usageCount + 1 })
                .where(eq(appSpaceTemplates.templateId, templateId));

            return newSpace;
        } catch (error) {
            console.error('Error creating space from template:', error);
            throw error;
        }
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
        try {
            // Simplified query to avoid timeouts
            const results = await db.select({
                chatId: whatsappChats.chatId,
                instanceId: whatsappChats.instanceId,
                type: whatsappChats.type,
                unreadCount: whatsappChats.unreadCount,
                lastMessageTimestamp: whatsappChats.lastMessageTimestamp,
                displayName: whatsappChats.chatId,
                profilePictureUrl: sql`NULL`,
                lastMessageContent: sql`''`,
                lastMessageFromMe: sql`false`,
                actualLastMessageTime: whatsappChats.lastMessageTimestamp,
                lastMessageType: sql`'text'`
            })
            .from(whatsappChats)
            .innerJoin(whatsappInstances, eq(whatsappChats.instanceId, whatsappInstances.instanceId))
            .where(eq(whatsappInstances.clientId, userId))
            .orderBy(desc(whatsappChats.lastMessageTimestamp))
            .limit(50);
            
            return results;
        } catch (error) {
            console.error('Error in getWhatsappConversations:', error);
            return [];
        }
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
        console.log(`🔊 LOUD DEBUG - upsertWhatsappMessage called with:`);
        console.log(`🔊   messageId: "${message.messageId}"`);
        console.log(`🔊   chatId: "${message.chatId}" (length: ${message.chatId?.length})`);
        console.log(`🔊   instanceId: "${message.instanceId}"`);
        console.log(`🔊   senderJid: "${message.senderJid}"`);
        console.log(`🔊   content: "${message.content?.substring(0, 50)}..."`);
        console.log(`🔊   fromMe: ${message.fromMe}`);
        console.log(`🔊   messageType: "${message.messageType}"`);
        console.log(`🔊   Full message object:`, JSON.stringify(message, null, 2));
        
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
        console.log(`🔊 LOUD DEBUG - ensureChatExists called with:`);
        console.log(`🔊   chatId: "${chatId}" (length: ${chatId?.length}, type: ${typeof chatId})`);
        console.log(`🔊   instanceId: "${instanceId}" (length: ${instanceId?.length}, type: ${typeof instanceId})`);
        console.log(`🔊   chatId ends with @g.us: ${chatId?.endsWith('@g.us')}`);
        console.log(`🔊   chatId ends with @s.whatsapp.net: ${chatId?.endsWith('@s.whatsapp.net')}`);
        
        // Check if chat already exists
        const existingChat = await this.getWhatsappChat(chatId, instanceId);
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
            instanceId,
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

    // CRM Calendar Events - Source of truth for internal app events
    async createCrmCalendarEvent(eventData: any): Promise<any> {
        try {
            console.log('📅 Creating calendar event in CRM schema:', eventData.title);
            
            const result = await db.execute(sql`
                INSERT INTO crm.calendar_events (
                    created_by_user_id, title, description, start_time, end_time, 
                    is_all_day, location, instance_id, created_at, updated_at
                )
                VALUES (
                    ${eventData.ownerUserId}, ${eventData.title}, ${eventData.description}, 
                    ${eventData.startTime}, ${eventData.endTime}, ${eventData.isAllDay || false}, 
                    ${eventData.location}, ${eventData.instanceId}, NOW(), NOW()
                )
                RETURNING *
            `);
            
            const createdEvent = result.rows?.[0] || result[0];
            console.log('✅ CRM calendar event created successfully:', createdEvent.title || eventData.title);
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

    async getContactGroups(spaceId: number): Promise<any[]> {
        return await db.select().from(crmContactGroups)
            .where(and(
                eq(crmContactGroups.spaceId, spaceId),
                eq(crmContactGroups.isActive, true)
            ))
            .orderBy(desc(crmContactGroups.createdAt));
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

        // Get all related data in parallel
        const [phones, emails, addresses, aliases, specialDates, interests, companies, groups, relationships] = await Promise.all([
            this.getContactPhones(contactId),
            this.getContactEmails(contactId),
            this.getContactAddresses(contactId),
            this.getContactAliases(contactId),
            this.getContactSpecialDates(contactId),
            this.getContactInterests(contactId),
            this.getContactCompanies(contactId),
            this.getContactGroups(contactId),
            this.getContactRelationships(contactId)
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

    // Contact Phone Methods
    async getContactPhones(contactId: number): Promise<any[]> {
        return await db.select().from(crmContactPhones)
            .where(eq(crmContactPhones.contactId, contactId))
            .orderBy(desc(crmContactPhones.isPrimary), desc(crmContactPhones.createdAt));
    }

    async addContactPhone(phoneData: any): Promise<any> {
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
            const [newItem] = await db.insert(appSpaceItems).values({
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
            }).returning();

            return newItem;
        } catch (error) {
            console.error('Error creating space item:', error);
            throw error;
        }
    }

    async getSpaceItems(spaceId: number, itemType?: string): Promise<any[]> {
        try {
            let query = db.select().from(appSpaceItems).where(eq(appSpaceItems.spaceId, spaceId));
            
            if (itemType) {
                query = db.select().from(appSpaceItems).where(and(
                    eq(appSpaceItems.spaceId, spaceId), 
                    eq(appSpaceItems.itemType, itemType)
                ));
            }

            const items = await query.orderBy(appSpaceItems.displayOrder, appSpaceItems.createdAt);

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
            const [updatedItem] = await db.update(appSpaceItems)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(appSpaceItems.itemId, itemId))
                .returning();

            return updatedItem;
        } catch (error) {
            console.error('Error updating space item:', error);
            throw error;
        }
    }

    async deleteSpaceItem(itemId: number): Promise<void> {
        try {
            await db.delete(appSpaceItems).where(eq(appSpaceItems.itemId, itemId));
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
            const note = {
                title: noteData.title,
                content: noteData.content,
                category: 'automation',
                priority: 'medium',
                status: 'active',
                createdBy: noteData.userId,
                assignedTo: noteData.userId,
                metadata: {
                    instanceId: noteData.instanceId,
                    triggeringMessageId: noteData.triggeringMessageId,
                    relatedChatJid: noteData.relatedChatJid,
                    autoCreated: true,
                    spaceId: noteData.spaceId,
                    source: 'whatsapp-reaction'
                }
            };

            // Generate title if missing - use chat ID and date format
            const finalTitle = noteData.title || `${noteData.relatedChatJid || 'Unknown'} ${new Date().toLocaleDateString()}`;
            
            // Create note without space assignment - notes are standalone
            const result = await db.execute(sql`
                INSERT INTO crm.notes (title, content, created_by_user_id, instance_id, created_at, updated_at)
                VALUES (${finalTitle}, ${noteData.content}, ${noteData.userId}, ${noteData.instanceId}, NOW(), NOW())
                RETURNING *
            `);
            
            const createdNote = result.rows?.[0] || result[0] || { title: finalTitle, content: noteData.content };

            console.log('✅ Note created successfully in CRM schema:', createdNote.title || finalTitle);
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
}

export const storage = new DatabaseStorage();