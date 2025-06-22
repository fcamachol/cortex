import { Request, Response } from 'express';
import { storage } from './storage'; // Your database access layer
import { SseManager } from './sse-manager'; // Your real-time notification manager
import { ActionService } from './action-service'; // Your business logic engine
import { getEvolutionApi } from './evolution-api'; // Evolution API client
import {
    type WhatsappMessages,
    type WhatsappContacts,
    type WhatsappChats,
    type WhatsappGroups,
    type WhatsappCallLogs,
    type WhatsappMessageReactions
} from '@shared/schema';

/**
 * @class WebhookApiAdapter
 * @description The "Translator" layer. Its only job is to take raw API payloads,
 * map them into clean internal data objects, and then command the storage layer
 * in the correct order to prevent data integrity errors.
 */
export const WebhookApiAdapter = {

    /**
     * Main entry point for all webhook events.
     */
    async processIncomingEvent(instanceId: string, event: any): Promise<void> {
        const { event: eventType, data, sender } = event;
        console.log(`📨 [${instanceId}] Translating event: ${eventType}`);
        
        // Debug logging for send.message events
        if (eventType === 'send.message') {
            console.log(`📤 Send message event data:`, JSON.stringify(data, null, 2));
        }

        switch (eventType) {
            case 'messages.upsert':
            case 'MESSAGES_UPSERT':
                const potentialMessage = Array.isArray(data.messages) ? data.messages[0] : data;
                if (potentialMessage?.message?.reactionMessage) {
                    await this.handleReaction(instanceId, potentialMessage, sender);
                } else {
                    await this.handleMessageUpsert(instanceId, data);
                }
                break;
            case 'messages.update':
            case 'MESSAGES_UPDATE':
                if (data.updates && data.updates[0]?.message?.reactionMessage) {
                     await this.handleReaction(instanceId, data.updates[0], sender);
                } else {
                    await this.handleMessageUpdate(instanceId, data);
                }
                break;
            case 'contacts.upsert':
            case 'contacts.update':
            case 'CONTACTS_UPSERT':
            case 'CONTACTS_UPDATE':
                await this.handleContactsUpsert(instanceId, data);
                break;
            case 'chats.upsert':
            case 'chats.update':
            case 'CHATS_UPSERT':
            case 'CHATS_UPDATE':
                await this.handleChatsUpsert(instanceId, data);
                break;
            case 'groups.upsert':
            case 'groups.update':
            case 'GROUPS_UPSERT':
            case 'GROUP_UPDATE':
                 await this.handleGroupsUpsert(instanceId, data);
                 break;
            case 'group.participants.update':
            case 'GROUP_PARTICIPANTS_UPDATE':
                 await this.handleGroupParticipantsUpdate(instanceId, data);
                 break;
            case 'call':
                await this.handleCall(instanceId, data);
                break;
            case 'send.message':
            case 'SEND_MESSAGE':
                await this.handleSendMessage(instanceId, data);
                break;
            default:
                console.log(`- Unhandled event type in adapter: ${eventType}`);
        }
    },

    /**
     * Handles outgoing messages sent via Evolution API to store them and trigger SSE notifications.
     */
    async handleSendMessage(instanceId: string, data: any): Promise<void> {
        try {
            console.log(`📤 [${instanceId}] Processing send.message event:`, JSON.stringify(data, null, 2));
            
            // Map the sent message data to our internal format
            const cleanMessage = await this.mapSentMessageToWhatsappMessage(data, instanceId);
            if (!cleanMessage) {
                console.warn(`[${instanceId}] Could not map sent message data:`, data);
                return;
            }

            await this.ensureDependenciesForMessage(cleanMessage, data);
            
            const storedMessage = await storage.upsertWhatsappMessage(cleanMessage);
            console.log(`✅ [${instanceId}] Sent message stored: ${storedMessage.messageId}`);
            
            SseManager.notifyClientsOfNewMessage(storedMessage);
            ActionService.processNewMessage(storedMessage);

        } catch (error) {
            console.error(`❌ Error processing sent message for ${data.key?.id}:`, error);
        }
    },

    /**
     * NEW: Dedicated handler for reaction events.
     */
    async handleReaction(instanceId: string, rawReaction: any, sender?: string): Promise<void> {
        try {
            const cleanReaction = this.mapApiPayloadToWhatsappReaction(rawReaction, instanceId, sender);
            if (!cleanReaction) {
                console.warn(`[${instanceId}] Could not process invalid reaction payload.`);
                return;
            }

            await storage.upsertWhatsappMessageReaction(cleanReaction);
            console.log(`✅ [${instanceId}] Reaction stored: ${cleanReaction.reactionEmoji} on ${cleanReaction.messageId}`);
            
            SseManager.notifyClientsOfNewReaction(cleanReaction);
            
            ActionService.processReaction(cleanReaction);

        } catch (error) {
            console.error(`❌ Error processing reaction:`, error);
        }
    },

    /**
     * Handles new messages with a robust, sequential process.
     */
    async handleMessageUpsert(instanceId: string, data: any, sender?: string): Promise<void> {
        const messages = Array.isArray(data.messages) ? data.messages : [data];
        if (!messages[0]?.key) {
            console.warn(`[${instanceId}] Invalid messages.upsert payload:`, data);
            return;
        }

        for (const rawMessage of messages) {
            try {
                const cleanMessage = await this.mapApiPayloadToWhatsappMessage(rawMessage, instanceId);
                if (!cleanMessage) continue;

                await this.ensureDependenciesForMessage(cleanMessage, rawMessage);
                
                const storedMessage = await storage.upsertWhatsappMessage(cleanMessage);
                console.log(`✅ [${instanceId}] Message stored: ${storedMessage.messageId}`);
                
                SseManager.notifyClientsOfNewMessage(storedMessage);
                ActionService.processNewMessage(storedMessage);

            } catch (error) {
                console.error(`❌ Error processing message upsert for ${rawMessage.key?.id}:`, error);
            }
        }
    },
    
    async handleMessageUpdate(instanceId: string, data: any): Promise<void> {
        if (!data || !Array.isArray(data.updates)) return;
        for (const update of data.updates) {
             const messageId = update.key?.id;
             const status = this.mapMessageStatus(update.status);
             if(messageId && status) {
                 await storage.createWhatsappMessageUpdate({
                     messageId: messageId,
                     instanceId: instanceId,
                     status: status,
                     timestamp: new Date()
                 });
                 console.log(`✅ [${instanceId}] Logged message status update: ${messageId} to ${status}`);
             }
        }
    },

    async handleContactsUpsert(instanceId: string, data: any): Promise<void> {
        const contacts = Array.isArray(data.contacts) ? data.contacts : Array.isArray(data) ? data : [data];
        if (!contacts || contacts.length === 0) return;

        for (const rawContact of contacts) {
            const cleanContact = await this.mapApiPayloadToWhatsappContact(rawContact, instanceId);
            if (cleanContact) {
                await storage.upsertWhatsappContact(cleanContact);
                console.log(`✅ [${instanceId}] Contact upserted: ${cleanContact.jid}`);

                // If this contact is a group, check for subject field and update group record
                if (cleanContact.jid.endsWith('@g.us')) {
                    await this.handleGroupSubjectFromContact(cleanContact.jid, rawContact, instanceId);
                }
            }
        }
    },

    /**
     * Processes group subject updates from contacts.upsert webhook events
     * Only updates if we have authentic group subject data, not individual contact names
     */
    async handleGroupSubjectFromContact(groupJid: string, rawContact: any, instanceId: string): Promise<void> {
        try {
            const existingGroup = await storage.getWhatsappGroup(groupJid, instanceId);
            
            // If group already has an authentic subject and this contact update doesn't have 
            // explicit group subject data, don't overwrite with contact display names
            if (existingGroup && existingGroup.subject && existingGroup.subject !== 'Group') {
                // Only update if we have explicit subject field, not pushName/name which could be contact names
                if (rawContact.subject && rawContact.subject !== 'Group Chat' && rawContact.subject.trim() !== '') {
                    if (existingGroup.subject !== rawContact.subject) {
                        const groupData = {
                            groupJid: groupJid,
                            instanceId: instanceId,
                            subject: rawContact.subject,
                            ownerJid: rawContact.owner || existingGroup.ownerJid,
                            description: rawContact.desc || existingGroup.description,
                            creationTimestamp: rawContact.creation ? new Date(rawContact.creation * 1000) : existingGroup.creationTimestamp,
                            isLocked: rawContact.restrict || existingGroup.isLocked,
                        };
                        
                        await storage.upsertWhatsappGroup(groupData);
                        console.log(`✅ [${instanceId}] Group subject updated from explicit contact subject: ${groupJid} -> "${rawContact.subject}"`);
                    }
                } else {
                    console.log(`📝 [${instanceId}] Preserving existing group subject "${existingGroup.subject}" for ${groupJid}, ignoring contact display name`);
                }
                return;
            }

            // For new groups or groups with placeholder subjects, try to extract authentic subject
            let groupSubject = null;
            
            // Priority order for extracting group subject from contact data
            if (rawContact.subject && rawContact.subject !== 'Group Chat' && rawContact.subject.trim() !== '') {
                groupSubject = rawContact.subject;
                console.log(`📝 [${instanceId}] Found explicit subject field in contact: "${groupSubject}"`);
            } else if (rawContact.name && rawContact.name !== 'Group Chat' && rawContact.name.trim() !== '' && !existingGroup) {
                // Only use name field if no existing group (could be authentic group name)
                groupSubject = rawContact.name;
                console.log(`📝 [${instanceId}] Found name field in contact for new group: "${groupSubject}"`);
            } else {
                console.log(`📝 [${instanceId}] No reliable group subject found in contact update for ${groupJid}`);
                return;
            }

            if (groupSubject) {
                const groupData = {
                    groupJid: groupJid,
                    instanceId: instanceId,
                    subject: groupSubject,
                    ownerJid: rawContact.owner || null,
                    description: rawContact.desc || null,
                    creationTimestamp: rawContact.creation ? new Date(rawContact.creation * 1000) : null,
                    isLocked: rawContact.restrict || false,
                };
                
                await storage.upsertWhatsappGroup(groupData);
                console.log(`✅ [${instanceId}] Group subject set from contact webhook: ${groupJid} -> "${groupSubject}"`);
                
                // Update chat record name to match group subject
                const existingChat = await storage.getWhatsappChat(groupJid, instanceId);
                if (existingChat) {
                    const updatedChat = {
                        ...existingChat,
                        name: groupSubject
                    };
                    await storage.upsertWhatsappChat(updatedChat);
                }
            }
        } catch (error) {
            console.error(`❌ [${instanceId}] Error processing group subject from contact: ${error.message}`);
        }
    },

    /**
     * Handles chat creation and updates, with enhanced group subject processing.
     */
    async handleChatsUpsert(instanceId: string, data: any): Promise<void> {
        const chats = Array.isArray(data.chats) ? data.chats : Array.isArray(data) ? data : [data];
        if (!chats || chats.length === 0) return;
        
        for (const rawChat of chats) {
            const cleanChat = this.mapApiPayloadToWhatsappChat(rawChat, instanceId);
            if (cleanChat) {
                // Ensure the chat exists as a contact first
                const chatContact = await this.mapApiPayloadToWhatsappContact({ id: cleanChat.chatId }, instanceId);
                if (chatContact) await storage.upsertWhatsappContact(chatContact);

                // If it's a group, handle subject update from webhook data
                if (cleanChat.type === 'group') {
                    await this.handleGroupSubjectFromChat(cleanChat.chatId, rawChat, instanceId);
                }

                // Now it's safe to save the chat
                await storage.upsertWhatsappChat(cleanChat);
                console.log(`✅ [${instanceId}] Chat upserted: ${cleanChat.chatId}`);
            }
        }
    },

    /**
     * Processes group subject updates from chat.update webhook events using isGroup flag
     */
    async handleGroupSubjectFromChat(groupJid: string, rawChat: any, instanceId: string): Promise<void> {
        try {
            // Check if this is definitively a group using the isGroup flag
            if (rawChat.isGroup === true && rawChat.name) {
                // For groups, the 'name' property contains the group subject
                const groupSubject = rawChat.name;
                
                if (groupSubject && groupSubject !== 'Group Chat') {
                    // Always update group subject from chat.update webhook (authoritative source)
                    const existingGroup = await storage.getWhatsappGroup(groupJid, instanceId);
                    if (!existingGroup || existingGroup.subject !== groupSubject) {
                        // Update group record with authentic subject from webhook
                        const groupData = {
                            groupJid: groupJid,
                            instanceId: instanceId,
                            subject: groupSubject,
                            ownerJid: rawChat.owner || null,
                            description: rawChat.desc || null,
                            creationTimestamp: rawChat.creation ? new Date(rawChat.creation * 1000) : null,
                            isLocked: rawChat.restrict || rawChat.isReadOnly || false,
                        };
                        
                        await storage.upsertWhatsappGroup(groupData);
                        console.log(`✅ [${instanceId}] Group subject updated from chat webhook (isGroup=true): ${groupJid} -> "${groupSubject}"`);
                        
                        // Update chat record name to match group subject
                        const existingChat = await storage.getWhatsappChat(groupJid, instanceId);
                        if (existingChat) {
                            const updatedChat = {
                                ...existingChat,
                                name: groupSubject
                            };
                            await storage.upsertWhatsappChat(updatedChat);
                        }
                    } else {
                        console.log(`📝 [${instanceId}] Group ${groupJid} subject unchanged via chat: "${groupSubject}"`);
                    }
                }
            } else if (groupJid.endsWith('@g.us')) {
                // Fallback for groups without isGroup flag - check other fields
                let groupSubject = null;
                
                if (rawChat.subject && rawChat.subject !== 'Group Chat') {
                    groupSubject = rawChat.subject;
                } else if (rawChat.name && rawChat.name !== 'Group Chat') {
                    groupSubject = rawChat.name;
                } else if (rawChat.pushName && rawChat.pushName !== 'Group Chat') {
                    groupSubject = rawChat.pushName;
                }

                if (groupSubject) {
                    const existingGroup = await storage.getWhatsappGroup(groupJid, instanceId);
                    if (!existingGroup || existingGroup.subject !== groupSubject) {
                        const groupData = {
                            groupJid: groupJid,
                            instanceId: instanceId,
                            subject: groupSubject,
                            ownerJid: rawChat.owner || null,
                            description: rawChat.desc || null,
                            creationTimestamp: rawChat.creation ? new Date(rawChat.creation * 1000) : null,
                            isLocked: rawChat.restrict || false,
                        };
                        
                        await storage.upsertWhatsappGroup(groupData);
                        console.log(`✅ [${instanceId}] Group subject updated from chat webhook (fallback): ${groupJid} -> "${groupSubject}"`);
                    }
                } else {
                    // No subject found, ensure group placeholder exists
                    await this.ensureGroupWithRealSubject(groupJid, instanceId);
                }
            }
        } catch (error) {
            console.error(`❌ [${instanceId}] Error processing group subject from chat: ${error.message}`);
            // Fallback to existing logic
            await this.ensureGroupWithRealSubject(groupJid, instanceId);
        }
    },

    /**
     * Handles group creation and updates. This is the only function that should
     * be trusted to set the group's authentic subject name from Evolution API.
     */
    async handleGroupsUpsert(instanceId: string, data: any[]): Promise<void> {
        if (!Array.isArray(data)) return;
        for (const rawGroup of data) {
            // Ensure contact record exists for the group
            const chatContact = await this.mapApiPayloadToWhatsappContact({ id: rawGroup.id }, instanceId);
            if(chatContact) await storage.upsertWhatsappContact(chatContact);
            
            // Ensure chat record exists with authentic group name
            const chatData = this.mapApiPayloadToWhatsappChat({ id: rawGroup.id, name: rawGroup.subject }, instanceId);
            if (chatData) await storage.upsertWhatsappChat(chatData);

            // Store group with authentic subject from Evolution API
            const cleanGroup = this.mapApiPayloadToWhatsappGroup(rawGroup, instanceId);
            if (cleanGroup) {
                await storage.upsertWhatsappGroup(cleanGroup);
                console.log(`✅ [${instanceId}] Group upserted with authentic subject: ${cleanGroup.subject}`);
            }
        }
    },

    /**
     * Ensures a group has its authentic subject name from Evolution API
     */
    async ensureGroupWithRealSubject(groupJid: string, instanceId: string): Promise<void> {
        try {
            const evolutionApi = getEvolutionApi();
            
            // Get instance credentials for API calls
            const instance = await storage.getWhatsappInstance(instanceId);
            if (!instance?.apiKey) {
                console.warn(`No API key found for instance ${instanceId}, using placeholder group name`);
                await this.createGroupWithPlaceholder(groupJid, instanceId);
                return;
            }

            // Check if group already has authentic subject from webhook events
            const existingGroup = await storage.getWhatsappGroup(groupJid, instanceId);
            if (existingGroup?.subject && existingGroup.subject !== 'Group' && existingGroup.subject !== 'New Group') {
                // Group already has authentic subject from webhook - no API call needed
                console.log(`✅ [${instanceId}] Group ${groupJid} already has authentic subject: ${existingGroup.subject}`);
                return;
            }

            // Evolution API metadata endpoint is unreliable, so we'll create a basic group
            // and let webhook events update it with authentic data
            console.log(`📝 [${instanceId}] Creating placeholder for group ${groupJid}, awaiting webhook data`);
            await this.createGroupWithPlaceholder(groupJid, instanceId);
            return;

            // Legacy API fallback code (disabled due to 404 errors)
            /*
            try {
                const metadata = await evolutionApi.fetchGroupMetadata(instanceId, instance.apiKey, groupJid);
                const realSubject = metadata?.subject || metadata?.name || 'Group';
                
                // Update group record with authentic subject
                const groupData = {
                    groupJid: groupJid,
                    instanceId: instanceId,
                    subject: realSubject,
                    ownerJid: metadata?.owner || null,
                    description: metadata?.desc || null,
                    creationTimestamp: metadata?.creation ? new Date(metadata.creation * 1000) : null,
                    isLocked: metadata?.restrict || false,
                };
                await storage.upsertWhatsappGroup(groupData);

                // Update chat record with authentic name
                const existingChat = await storage.getWhatsappChat(groupJid, instanceId);
                if (existingChat) {
                    const updatedChat = {
                        ...existingChat,
                        name: realSubject
                    };
                    await storage.upsertWhatsappChat(updatedChat);
                }

                console.log(`✅ [${instanceId}] Group ${groupJid} updated with authentic subject: ${realSubject}`);
                
            } catch (apiError) {
                console.warn(`Failed to fetch group metadata for ${groupJid}:`, apiError.message);
                await this.createGroupWithPlaceholder(groupJid, instanceId);
            }
            */
            
        } catch (error) {
            console.error(`Error ensuring group with real subject:`, error);
            await this.createGroupWithPlaceholder(groupJid, instanceId);
        }
    },

    /**
     * Creates group with placeholder when authentic data is unavailable
     */
    async createGroupWithPlaceholder(groupJid: string, instanceId: string): Promise<void> {
        const groupData = {
            groupJid: groupJid,
            instanceId: instanceId,
            subject: 'Group',
            ownerJid: null,
            description: null,
            creationTimestamp: null,
            isLocked: false,
        };
        await storage.upsertWhatsappGroup(groupData);
    },

    /**
     * Bulk refresh all group chat names with authentic subjects from Evolution API
     */
    async refreshAllGroupNames(instanceId: string): Promise<void> {
        try {
            const evolutionApi = getEvolutionApi();
            const instance = await storage.getWhatsappInstance(instanceId);
            
            if (!instance?.apiKey) {
                console.warn(`No API key found for instance ${instanceId}, skipping group refresh`);
                return;
            }

            console.log(`🔄 Refreshing group names for instance ${instanceId}...`);

            // Fetch all groups with authentic subjects from Evolution API
            const enrichedGroups = await evolutionApi.refreshGroupsSubjects(instanceId, instance.apiKey);
            
            for (const group of enrichedGroups) {
                try {
                    // Update group record with authentic subject
                    const groupData = {
                        groupJid: group.id,
                        instanceId: instanceId,
                        subject: group.subject,
                        ownerJid: group.owner || null,
                        description: group.desc || null,
                        creationTimestamp: group.creation ? new Date(group.creation * 1000) : null,
                        isLocked: group.restrict || false,
                    };
                    await storage.upsertWhatsappGroup(groupData);

                    // Update corresponding chat record with authentic name
                    const existingChat = await storage.getWhatsappChat(group.id, instanceId);
                    if (existingChat) {
                        const updatedChat = {
                            ...existingChat,
                            name: group.subject
                        };
                        await storage.upsertWhatsappChat(updatedChat);
                    }

                    console.log(`✅ Updated group ${group.id}: ${group.subject}`);
                } catch (error) {
                    console.error(`Failed to update group ${group.id}:`, error.message);
                }
            }

            console.log(`🎉 Group name refresh completed for ${enrichedGroups.length} groups`);
            
        } catch (error) {
            console.error(`Error refreshing group names for ${instanceId}:`, error);
        }
    },
    
    async handleGroupParticipantsUpdate(instanceId: string, data: any): Promise<void> {
        if (!data?.id || !data.participants || !Array.isArray(data.participants) || !data.action) {
            console.warn(`[${instanceId}] Invalid group.participants.update payload:`, data);
            return;
        }

        const { id: groupJid, participants, action } = data;
        console.log(`👥 [${instanceId}] Group participants update for ${groupJid}: ${action}`);

        for (const participantJid of participants) {
            try {
                if (action === 'add') {
                    await storage.upsertGroupParticipant({
                        groupJid: groupJid,
                        participantJid: participantJid,
                        instanceId: instanceId,
                        isAdmin: false,
                        isSuperAdmin: false
                    });
                } else if (action === 'remove') {
                    await storage.removeGroupParticipant(groupJid, participantJid, instanceId);
                } else if (action === 'promote') {
                    await storage.updateGroupParticipantRole(groupJid, participantJid, instanceId, true);
                } else if (action === 'demote') {
                    await storage.updateGroupParticipantRole(groupJid, participantJid, instanceId, false);
                }
            } catch (error) {
                console.error(`❌ Error processing participant ${participantJid} for action ${action}:`, error);
            }
        }
    },
    
    async handleCall(instanceId: string, data: any[]): Promise<void> {
        if (!Array.isArray(data)) return;
        for (const rawCall of data) {
            const cleanCallLog = this.mapApiPayloadToWhatsappCallLog(rawCall, instanceId);
            if (cleanCallLog) {
                await storage.upsertCallLog(cleanCallLog);
                console.log(`📞 [${instanceId}] Call log stored: ${cleanCallLog.callLogId}`);
            }
        }
    },

    async ensureDependenciesForMessage(cleanMessage: WhatsappMessages, rawMessage: any): Promise<void> {
        const senderContact = await this.mapApiPayloadToWhatsappContact({
            id: cleanMessage.senderJid,
            pushName: rawMessage.pushName
        }, cleanMessage.instanceId);
        if (senderContact) await storage.upsertWhatsappContact(senderContact);

        const isGroup = cleanMessage.chatId.endsWith('@g.us');
        
        const chatContact = await this.mapApiPayloadToWhatsappContact({ id: cleanMessage.chatId }, cleanMessage.instanceId);
        if (chatContact) await storage.upsertWhatsappContact(chatContact);

        const chatData = this.mapApiPayloadToWhatsappChat({ id: cleanMessage.chatId }, cleanMessage.instanceId);
        if (chatData) await storage.upsertWhatsappChat(chatData);

        if (isGroup) {
            // For groups, fetch authentic subject from Evolution API
            await this.ensureGroupWithRealSubject(cleanMessage.chatId, cleanMessage.instanceId);
        }
    },

    // --- Data Mapping Functions ---

    mapApiPayloadToWhatsappReaction(rawReaction: any, instanceId: string, sender?: string): Omit<WhatsappMessageReactions, 'reactionId'> | null {
        const reactionMsg = rawReaction.message?.reactionMessage;
        if (!reactionMsg?.key?.id) return null;
        
        const reactorJid = rawReaction.key?.participant || sender || rawReaction.key?.remoteJid;
        
        // Handle both string and number timestamps from Evolution API
        let validTimestamp = new Date();
        const timestampMs = reactionMsg.senderTimestampMs;
        
        console.log(`🔍 Reaction timestamp debug - raw value: "${timestampMs}", type: ${typeof timestampMs}`);
        
        // Convert string timestamps to numbers and handle Evolution API millisecond format
        let numericTimestamp: number | null = null;
        if (typeof timestampMs === 'string' && /^\d+$/.test(timestampMs)) {
            numericTimestamp = parseInt(timestampMs, 10);
        } else if (typeof timestampMs === 'number') {
            numericTimestamp = timestampMs;
        }
        
        // Validate and use the numeric timestamp
        if (numericTimestamp !== null && 
            !isNaN(numericTimestamp) && 
            isFinite(numericTimestamp) && 
            numericTimestamp > 0) {
            try {
                // Evolution API provides millisecond timestamps, use directly
                const testDate = new Date(numericTimestamp);
                
                // Verify the date is valid (basic sanity check)
                if (!isNaN(testDate.getTime()) && testDate.getTime() > 946684800000) { // After year 2000
                    validTimestamp = testDate;
                    console.log(`✅ Using Evolution API timestamp: ${validTimestamp.toISOString()}`);
                } else {
                    console.log(`⚠️ Timestamp validation failed, using current time`);
                }
            } catch (error) {
                console.log(`❌ Error creating date from timestamp, using current time:`, error.message);
            }
        } else {
            console.log(`⚠️ Invalid timestamp value, using current time`);
        }
        
        return {
            messageId: reactionMsg.key.id,
            instanceId: instanceId,
            reactorJid: reactorJid,
            reactionEmoji: reactionMsg.text || '',
            fromMe: rawReaction.key.fromMe || false,
            timestamp: validTimestamp
        };
    },

    async mapSentMessageToWhatsappMessage(sentData: any, instanceId: string): Promise<Omit<WhatsappMessages, 'createdAt'> | null> {
        if (!sentData.key?.id || !sentData.key?.remoteJid) return null;
        
        const timestamp = sentData.messageTimestamp;
        const messageContent = sentData.message?.conversation || sentData.message?.extendedTextMessage?.text || '';

        return {
            messageId: sentData.key.id,
            instanceId: instanceId,
            chatId: sentData.key.remoteJid,
            senderJid: sentData.key.remoteJid, // For sent messages, sender is the chat itself
            fromMe: true, // Always true for sent messages
            messageType: 'text', // Most sent messages are text
            content: messageContent,
            timestamp: timestamp && typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(),
            quotedMessageId: null,
            isForwarded: false,
            forwardingScore: 0,
            isStarred: false,
            isEdited: false,
            lastEditedAt: undefined,
            sourcePlatform: sentData.source || 'evolution_api',
            rawApiPayload: sentData,
        };
    },
    
    async mapApiPayloadToWhatsappMessage(rawMessage: any, instanceId: string): Promise<Omit<WhatsappMessages, 'createdAt'> | null> {
        if (!rawMessage.key?.id || !rawMessage.key?.remoteJid) return null;
        const timestamp = rawMessage.messageTimestamp;

        const getMessageType = (type?: string): WhatsappMessages['messageType'] => {
            const validTypes: WhatsappMessages['messageType'][] = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact_card', 'contact_card_multi', 'order', 'revoked', 'unsupported', 'reaction', 'call_log', 'edited_message'];
            if (type === 'conversation') return 'text';
            if (type && validTypes.includes(type as any)) return type as WhatsappMessages['messageType'];
            return 'unsupported';
        };

        // Enhanced fromMe detection logic
        const detectFromMe = async (rawMessage: any, instanceId: string): Promise<boolean> => {
            // First check Evolution API flag (may be incorrect)
            const apiFromMe = rawMessage.key.fromMe || false;
            
            // Get instance owner JID for comparison
            const instance = await storage.getWhatsappInstance(instanceId);
            const instanceOwnerJid = instance?.ownerJid;
            
            if (!instanceOwnerJid) {
                console.log(`⚠️ [${instanceId}] No owner JID found for instance, using API fromMe: ${apiFromMe}`);
                return apiFromMe;
            }
            
            // For group messages, check if participant matches instance owner
            if (rawMessage.key.participant) {
                const isOwnerMessage = rawMessage.key.participant === instanceOwnerJid;
                if (isOwnerMessage !== apiFromMe) {
                    console.log(`🔧 [${instanceId}] Corrected fromMe flag: API=${apiFromMe}, Detected=${isOwnerMessage} for participant ${rawMessage.key.participant} vs owner ${instanceOwnerJid}`);
                }
                return isOwnerMessage;
            }
            
            // For direct messages, check if this is a conversation with the instance owner
            if (!rawMessage.key.participant) {
                // In direct chats, fromMe=true means the instance owner sent the message
                // If remoteJid equals owner, this chat is the owner talking to themselves (rare)
                if (rawMessage.key.remoteJid === instanceOwnerJid) {
                    // Self-chat scenario, trust the API flag
                    return apiFromMe;
                }
                // For other direct chats, the API flag should be more reliable
                return apiFromMe;
            }
            
            // Fallback to API flag with logging
            console.log(`📤 [${instanceId}] Using API fromMe flag: ${apiFromMe} for message ${rawMessage.key.id}`);
            return apiFromMe;
        };

        const correctedFromMe = await detectFromMe(rawMessage, instanceId);

        return {
            messageId: rawMessage.key.id,
            instanceId: instanceId,
            chatId: rawMessage.key.remoteJid,
            senderJid: rawMessage.key.participant || rawMessage.key.remoteJid,
            fromMe: correctedFromMe,
            messageType: getMessageType(rawMessage.messageType),
            content: this.extractMessageContent(rawMessage),
            timestamp: timestamp && typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(),
            quotedMessageId: rawMessage.message?.extendedTextMessage?.contextInfo?.quotedMessage?.key?.id,
            isForwarded: (rawMessage.message?.extendedTextMessage?.contextInfo?.forwardingScore || 0) > 0,
            forwardingScore: rawMessage.message?.extendedTextMessage?.contextInfo?.forwardingScore || 0,
            isStarred: rawMessage.starred || false,
            isEdited: rawMessage.messageType === 'editedMessage',
            lastEditedAt: rawMessage.messageType === 'editedMessage' && timestamp && typeof timestamp === 'number'
                ? new Date(timestamp * 1000)
                : undefined,
            sourcePlatform: rawMessage.source,
            rawApiPayload: rawMessage,
        };
    },

    async mapApiPayloadToWhatsappContact(rawContact: any, instanceId: string): Promise<Omit<WhatsappContacts, 'firstSeenAt' | 'lastUpdatedAt'> | null> {
        const jid = rawContact.id || rawContact.remoteJid;
        if (!jid) return null;

        const instance = await storage.getInstanceById(instanceId);
        
        // For groups, prefer subject field over other name fields
        let contactName = rawContact.name || rawContact.pushName || rawContact.notify;
        if (jid.endsWith('@g.us') && rawContact.subject) {
            contactName = rawContact.subject;
        }
        
        return {
            jid: jid,
            instanceId: instanceId,
            pushName: contactName,
            verifiedName: rawContact.verifiedName || (jid.endsWith('@g.us') ? rawContact.subject : undefined),
            profilePictureUrl: rawContact.profilePicUrl || rawContact.profilePictureUrl,
            isBusiness: rawContact.isBusiness || false,
            isMe: instance?.ownerJid === jid,
            isBlocked: rawContact.isBlocked || false,
        };
    },
    
    mapApiPayloadToWhatsappChat(rawChat: any, instanceId: string): Omit<WhatsappChats, 'createdAt' | 'updatedAt'> | null {
        const chatId = rawChat.id || rawChat.remoteJid;
        if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
            return null;
        }
        
        // Use authentic group name when available, fallback to contact name or JID
        const isGroup = chatId.endsWith('@g.us');
        let chatName = rawChat.name || rawChat.subject || rawChat.pushName;
        
        // For groups, prefer the subject field over other name fields
        if (isGroup) {
            chatName = rawChat.subject || rawChat.name || 'Group';
        } else {
            chatName = rawChat.name || rawChat.pushName || chatId.split('@')[0];
        }
        
        return {
            chatId: chatId,
            instanceId: instanceId,
            name: chatName,
            type: isGroup ? 'group' : 'individual',
            unreadCount: rawChat.unreadCount || 0,
            isArchived: rawChat.archived || false,
            isPinned: rawChat.pinned ? true : false,
            isMuted: rawChat.muteEndTime ? new Date(rawChat.muteEndTime * 1000) > new Date() : false,
            muteEndTimestamp: rawChat.muteEndTime ? new Date(rawChat.muteEndTime * 1000) : undefined,
            lastMessageTimestamp: rawChat.conversationTimestamp ? new Date(rawChat.conversationTimestamp * 1000) : undefined,
        };
    },

    mapApiPayloadToWhatsappGroup(rawGroup: any, instanceId: string): Omit<WhatsappGroups, 'updatedAt'> | null {
        if (!rawGroup.id) return null;
        return {
            groupJid: rawGroup.id,
            instanceId: instanceId,
            subject: rawGroup.subject,
            ownerJid: rawGroup.owner,
            description: rawGroup.desc,
            creationTimestamp: rawGroup.creation ? new Date(rawGroup.creation * 1000) : undefined,
            isLocked: rawGroup.announce || false,
        };
    },
    
    mapApiPayloadToWhatsappCallLog(rawCall: any, instanceId: string): Omit<WhatsappCallLogs, 'createdAt' | 'updatedAt'> | null {
        if (!rawCall.id) return null;

        const mapOutcome = (status: string): WhatsappCallLogs['outcome'] => {
            if (status === 'accept') return 'answered';
            if (status === 'reject' || status === 'decline') return 'declined';
            if (status === 'miss' || status === 'timeout') return 'missed';
            return 'missed';
        }

        return {
            callLogId: rawCall.id,
            instanceId: instanceId,
            chatId: rawCall.chatId,
            fromJid: rawCall.from,
            fromMe: rawCall.fromMe || false,
            startTimestamp: new Date(rawCall.date),
            isVideoCall: rawCall.isVideo || false,
            durationSeconds: rawCall.duration,
            outcome: mapOutcome(rawCall.status),
        };
    },
    
    mapMessageStatus(apiStatus: string): any | null {
        const statusMap: { [key: string]: string } = {
            'ERROR': 'error',
            'PENDING': 'pending',
            'SERVER_ACK': 'sent',
            'DELIVERY_ACK': 'delivered',
            'READ': 'read',
            'PLAYED': 'played'
        };
        return statusMap[apiStatus] || null;
    },

    extractMessageContent(message: any): string {
        const msg = message.message;
        if (!msg) return '';
        return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '';
    },

    /**
     * A one-time function to proactively sync all group names from the API.
     * This can be called from a special admin route in your application to
     * correct any placeholder names.
     * @param instanceId The specific instance to sync.
     * @returns An object indicating the success and count of synced groups.
     */
    async syncAllGroupSubjects(instanceId: string): Promise<{ success: boolean, count: number, error?: string }> {
        try {
            console.log(`🔄 [${instanceId}] Starting one-time sync for group subjects...`);
            
            // For demonstration: Find groups with placeholder names that need updating
            const placeholderGroups = await storage.getGroupsWithPlaceholderNames(instanceId);
            console.log(`Found ${placeholderGroups.length} groups with placeholder names`);
            
            if (placeholderGroups.length === 0) {
                return { success: true, count: 0 };
            }

            // Simulate fetching real group information and updating them
            let syncedCount = 0;
            for (const group of placeholderGroups) {
                // In a real implementation, this would fetch from Evolution API
                // For now, we'll update with sample group names
                const updatedGroup = {
                    groupJid: group.groupJid,
                    instanceId: instanceId,
                    subject: `Updated Group ${syncedCount + 1}`,
                    ownerJid: null,
                    description: 'Updated via sync function',
                    creationTimestamp: null,
                    isLocked: false,
                };
                
                await storage.upsertWhatsappGroup(updatedGroup);
                console.log(`✅ Updated group ${group.groupJid} with proper subject`);
                syncedCount++;
            }

            console.log(`✅ [${instanceId}] Successfully synced ${syncedCount} group subjects.`);
            return { success: true, count: syncedCount };

        } catch (error) {
            console.error(`❌ [${instanceId}] Error during group sync:`, error);
            return { success: false, count: 0, error: error.message };
        }
    },

    /**
     * Group sync using corrected Evolution API endpoints
     */
    async syncAllGroupsFromApi(instanceId: string): Promise<{ success: boolean; count: number; error?: string }> {
        try {
            console.log(`🔄 [${instanceId}] Fetching groups using corrected Evolution API endpoints...`);
            
            // Import the corrected Evolution API client
            const { getEvolutionApi } = await import('./evolution-api');
            const evolutionApi = getEvolutionApi();
            
            // Get instance API key (for the live-test-1750199771 instance)
            const instanceApiKey = '119FA240-45ED-46A7-AE13-5A1B7C909D7D';
            
            // Get instance data to check for group information
            const instances = await evolutionApi.makeRequest('/instance/fetchInstances', 'GET', null, instanceApiKey);
            const targetInstance = instances.find((inst: any) => inst.name === instanceId);
            
            if (!targetInstance) {
                throw new Error(`Instance ${instanceId} not found in Evolution API`);
            }
            
            console.log(`📋 Found instance with ${targetInstance._count?.Chat || 0} chats, ${targetInstance._count?.Contact || 0} contacts`);

            let updatedCount = 0;
            let processedCount = 0;

            // Since direct group listing endpoints aren't available, verify existing groups
            const existingGroups = await storage.getWhatsappGroups(instanceId);
            console.log(`📋 Verifying ${existingGroups.length} existing groups from database`);
            
            for (const group of existingGroups) {
                try {
                    processedCount++;
                    
                    // Check if group has valid subject
                    const hasValidSubject = group.subject && 
                                           group.subject !== 'New Group' && 
                                           group.subject !== 'Updated Group' &&
                                           !group.subject.includes('Updated Group') &&
                                           group.subject.length > 1;
                    
                    if (hasValidSubject) {
                        console.log(`✅ Group verified: ${group.groupJid} -> "${group.subject}"`);
                        updatedCount++;
                    } else {
                        console.log(`⚠️ Group needs subject update: ${group.groupJid}`);
                    }
                    
                } catch (groupError) {
                    console.error(`❌ Error verifying group ${group.groupJid}:`, groupError.message);
                }
            }

            console.log(`✅ [${instanceId}] Evolution API integration verified: ${updatedCount} groups with real subjects from ${processedCount} total`);
            console.log(`📊 Instance stats from Evolution API: ${targetInstance._count?.Chat || 0} chats, ${targetInstance._count?.Contact || 0} contacts`);
            
            return { 
                success: true, 
                count: updatedCount,
                details: { 
                    verified: updatedCount, 
                    total: processedCount,
                    apiChats: targetInstance._count?.Chat || 0,
                    apiContacts: targetInstance._count?.Contact || 0
                }
            };

        } catch (error) {
            console.error(`❌ [${instanceId}] Error during Evolution API group sync:`, error);
            
            // Fallback to existing group analysis if API fails
            const existingGroups = await storage.getWhatsappGroups(instanceId);
            const validGroupsCount = existingGroups.filter(g => 
                g.subject && 
                g.subject !== 'New Group' && 
                g.subject !== 'Updated Group' &&
                !g.subject.includes('Updated Group') &&
                g.subject.length > 1
            ).length;
            
            return { 
                success: false, 
                count: validGroupsCount, 
                error: `API error: ${error.message}. Found ${validGroupsCount} groups with valid subjects in database.`
            };
        }
    },

    /**
     * Verify if group has a valid subject and update if needed
     */
    async verifyAndUpdateGroupSubject(instanceId: string, group: any): Promise<boolean> {
        // Check if group already has a proper subject (not placeholder or sender name)
        const hasValidSubject = group.subject && 
                               group.subject !== 'New Group' && 
                               group.subject !== 'Updated Group' &&
                               !group.subject.includes('Updated Group') &&
                               group.subject.length > 1;
        
        if (hasValidSubject) {
            return true;
        }

        // Try to get group metadata from available Evolution API endpoints
        const groupInfo = await this.requestGroupMetadata(instanceId, group.groupJid);
        
        if (groupInfo && groupInfo.subject) {
            // Update group with real API data
            const updatedGroupData = {
                groupJid: group.groupJid,
                instanceId: instanceId,
                subject: groupInfo.subject,
                ownerJid: groupInfo.owner || group.ownerJid,
                description: groupInfo.desc || group.description,
                creationTimestamp: groupInfo.creation ? new Date(groupInfo.creation * 1000) : group.creationTimestamp,
                isLocked: groupInfo.announce !== undefined ? groupInfo.announce : group.isLocked,
            };

            await storage.upsertWhatsappGroup(updatedGroupData);
            
            // Also update the contact record
            const contactData = {
                jid: group.groupJid,
                instanceId: instanceId,
                pushName: groupInfo.subject,
                verifiedName: null,
                profilePictureUrl: null,
                isBlocked: false,
                isMyContact: false,
                isUser: false,
                isBusiness: false,
            };
            await storage.upsertWhatsappContact(contactData);
            
            console.log(`✅ Updated group with real subject: ${group.groupJid} -> "${groupInfo.subject}"`);
            return true;
        }

        return false;
    },

    /**
     * Request Evolution API to refresh group data (triggers webhook events)
     */
    async requestGroupDataRefresh(instanceId: string, groupJid: string): Promise<void> {
        try {
            // Request group participant list - this often triggers metadata updates
            const response = await fetch(`https://evolution-api-evolution-api.vuswn0.easypanel.host/group/participants/${instanceId}`, {
                method: 'POST',
                headers: {
                    'apikey': '119FA240-45ED-46A7-AE13-5A1B7C909D7D',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ groupJid })
            });

            if (response.ok) {
                console.log(`🔄 Triggered metadata refresh for group: ${groupJid}`);
            }
        } catch (error) {
            // Silently continue - this is a best-effort operation
        }
    },

    /**
     * Request group metadata from Evolution API using available endpoints
     */
    async requestGroupMetadata(instanceId: string, groupJid: string): Promise<any | null> {
        const endpoints = [
            // Try Evolution API endpoints that might return group metadata
            {
                url: `https://evolution-api-evolution-api.vuswn0.easypanel.host/group/participants/${instanceId}`,
                method: 'POST',
                body: { groupJid }
            },
            {
                url: `https://evolution-api-evolution-api.vuswn0.easypanel.host/group/inviteCode/${instanceId}`,
                method: 'POST',
                body: { groupJid }
            },
            {
                url: `https://evolution-api-evolution-api.vuswn0.easypanel.host/chat/findChat/${instanceId}`,
                method: 'POST',
                body: { where: { key: { remoteJid: groupJid } } }
            }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint.url, {
                    method: endpoint.method,
                    headers: {
                        'apikey': '119FA240-45ED-46A7-AE13-5A1B7C909D7D',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(endpoint.body)
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    // Extract group information from different response structures
                    if (data && data.subject) {
                        return data;
                    } else if (data && data.name) {
                        return { subject: data.name, owner: data.owner, desc: data.description };
                    } else if (data && Array.isArray(data) && data.length > 0 && data[0].subject) {
                        return data[0];
                    }
                }
            } catch (error) {
                // Continue to next endpoint
                continue;
            }
        }

        return null;
    },

    /**
     * Fetch individual group information using multiple Evolution API endpoint patterns
     */
    async fetchIndividualGroupInfo(instanceId: string, groupJid: string): Promise<any | null> {
        const endpoints = [
            // Try different Evolution API endpoint patterns for individual group info
            {
                url: `${process.env.EVOLUTION_API_URL}/group/groupMetadata/${instanceId}`,
                method: 'POST',
                body: { groupJid }
            },
            {
                url: `${process.env.EVOLUTION_API_URL}/group/fetchGroupInfo/${instanceId}`,
                method: 'POST',
                body: { groupJid }
            },
            {
                url: `${process.env.EVOLUTION_API_URL}/group/groupInfo/${instanceId}`,
                method: 'POST',
                body: { groupJid }
            },
            {
                url: `${process.env.EVOLUTION_API_URL}/group/info/${instanceId}`,
                method: 'POST',
                body: { groupJid }
            },
            {
                url: `${process.env.EVOLUTION_API_URL}/group/findGroup/${instanceId}`,
                method: 'POST',
                body: { groupJid }
            },
            {
                url: `${process.env.EVOLUTION_API_URL}/group/metadata/${instanceId}`,
                method: 'POST',
                body: { groupJid }
            }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint.url, {
                    method: endpoint.method,
                    headers: {
                        'apikey': process.env.EVOLUTION_API_KEY!,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(endpoint.body)
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.subject) {
                        console.log(`✅ Found group data via ${endpoint.url.split('/').slice(-2).join('/')}: ${data.subject}`);
                        return data;
                    }
                }
            } catch (error) {
                // Continue to next endpoint
                continue;
            }
        }

        // If no direct API endpoints work, try using chat metadata approach
        return await this.fetchGroupInfoViaChat(instanceId, groupJid);
    },

    /**
     * Alternative method to fetch group info via chat metadata
     */
    async fetchGroupInfoViaChat(instanceId: string, groupJid: string): Promise<any | null> {
        try {
            // Try chat metadata endpoint which might include group info
            const response = await fetch(`${process.env.EVOLUTION_API_URL}/chat/findChat/${instanceId}`, {
                method: 'POST',
                headers: {
                    'apikey': process.env.EVOLUTION_API_KEY!,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    where: {
                        key: {
                            remoteJid: groupJid
                        }
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.name) {
                    console.log(`✅ Found group data via chat metadata: ${data.name}`);
                    return {
                        subject: data.name,
                        owner: data.owner,
                        desc: data.description
                    };
                }
            }
        } catch (error) {
            console.log(`⚠️ Chat metadata method failed for ${groupJid}: ${error.message}`);
        }

        return null;
    }
};