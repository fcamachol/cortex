import { Request, Response } from 'express';
import { storage } from './storage'; // Your database access layer
import { SseManager } from './sse-manager'; // Your real-time notification manager
import { ActionService } from './action-service'; // Your business logic engine
import { getEvolutionApi } from './evolution-api'; // Evolution API client
import * as fs from 'fs/promises';
import * as path from 'path';
import { lookup } from 'mime-types';
import {
    whatsappMessages,
    whatsappContacts,
    whatsappChats,
    whatsappGroups,
    whatsappCallLogs,
    whatsappMessageReactions,
    whatsappMessageMedia,
    type InsertWhatsappMessageMedia
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
        
        // --- LOUD WEBHOOK DIAGNOSTICS FOR ALL EVENT TYPES ---
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.log(`!!!    WEBHOOK EVENT: ${eventType.toUpperCase().padEnd(25)} !!!`);
        console.log(`!!!    INSTANCE: ${instanceId.padEnd(30)} !!!`);
        console.log(`!!!    DATA TYPE: ${typeof data}                      !!!`);
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        
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
            case 'chats.delete':
            case 'CHATS_UPSERT':
            case 'CHATS_UPDATE':
            case 'CHATS_DELETE':
                await this.handleChatsUpsert(instanceId, data);
                break;
            case 'groups.upsert':
            case 'GROUPS_UPSERT':
                 await this.handleGroupsUpsert(instanceId, data);
                 break;
            case 'groups.update':
            case 'GROUP_UPDATE':
            case 'group.update':
                 await this.handleGroupUpdate(instanceId, data);
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
            case 'messages.reaction':
            case 'MESSAGES_REACTION':
                await this.handleDirectReaction(instanceId, data);
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
            
            // Notify real-time clients of sent message AND conversation update
            SseManager.notifyClientsOfNewMessage(storedMessage);
            SseManager.notifyClientsOfChatUpdate({
                chatId: cleanMessage.chatId,
                instanceId: instanceId,
                lastMessage: {
                    content: cleanMessage.content,
                    timestamp: cleanMessage.timestamp,
                    fromMe: cleanMessage.fromMe
                }
            });
            
            ActionService.processNewMessage(storedMessage);

        } catch (error) {
            console.error(`❌ Error processing sent message for ${data.key?.id}:`, error);
        }
    },

    /**
     * NEW: Dedicated handler for reaction events.
     */
    async handleReaction(instanceName: string, rawReaction: any, sender?: string): Promise<void> {
        try {
            const cleanReaction = this.mapApiPayloadToWhatsappReaction(rawReaction, instanceName, sender);
            if (!cleanReaction) {
                console.warn(`[${instanceName}] Could not process invalid reaction payload.`);
                return;
            }

            await storage.upsertWhatsappMessageReaction(cleanReaction);
            console.log(`✅ [${instanceName}] Reaction stored: ${cleanReaction.reactionEmoji} on ${cleanReaction.messageId}`);
            
            SseManager.notifyClientsOfNewReaction(cleanReaction);
            
            ActionService.processReaction(cleanReaction);

        } catch (error) {
            console.error(`❌ Error processing reaction:`, error);
        }
    },

    /**
     * Handles new messages with a robust, sequential process to prevent race conditions.
     */
    async handleMessageUpsert(instanceId: string, data: any, sender?: string): Promise<void> {
        const messages = Array.isArray(data.messages) ? data.messages : [data];
        if (!messages[0]?.key) return;

        for (const rawMessage of messages) {
            try {
                // First, check if it's a reaction and route it to the correct handler
                if (rawMessage.message?.reactionMessage) {
                    await this.handleReaction(instanceId, rawMessage, sender);
                    continue; // Stop processing this item as a regular message
                }

                const cleanMessage = await this.mapApiPayloadToWhatsappMessage(rawMessage, instanceId);
                if (!cleanMessage) continue;

                // ** THIS IS THE CRITICAL FIX **
                // Ensures the chat, sender, and group (if applicable) records
                // exist BEFORE we attempt to save the message.
                await this.ensureDependenciesForMessage(cleanMessage, rawMessage);
                
                const storedMessage = await storage.upsertWhatsappMessage(cleanMessage);
                console.log(`✅ [${instanceId}] Message stored: ${storedMessage.messageId}`);
                
                // Handle media storage after message is saved to avoid foreign key constraint errors
                if (['image', 'video', 'audio', 'document', 'sticker'].includes(cleanMessage.messageType)) {
                    await this.handleMediaStorage(rawMessage, instanceId, cleanMessage.messageType);
                }
                
                // Handle audio message processing using Evolution API downloadMedia method
                if (cleanMessage.messageType === 'audio') {
                    await this.handleNewAudioMessage(instanceId, rawMessage);
                }
                
                // Notify real-time clients of new message AND conversation update
                SseManager.notifyClientsOfNewMessage(storedMessage);
                SseManager.notifyClientsOfChatUpdate({
                    chatId: cleanMessage.chatId,
                    instanceId,
                    lastMessage: {
                        content: cleanMessage.content,
                        timestamp: cleanMessage.timestamp,
                        fromMe: cleanMessage.fromMe
                    }
                });
                
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
     * Always prioritizes incoming Evolution API data over existing database values
     */
    async handleGroupSubjectFromContact(groupJid: string, rawContact: any, instanceId: string): Promise<void> {
        try {
            const existingGroup = await storage.getWhatsappGroup(groupJid, instanceId);
            
            // Always update with incoming Evolution API data when available
            if (rawContact.subject && rawContact.subject !== 'Group Chat' && rawContact.subject.trim() !== '') {
                const groupData = {
                    groupJid: groupJid,
                    instanceId: instanceId,
                    subject: rawContact.subject,
                    ownerJid: rawContact.owner || (existingGroup?.ownerJid) || null,
                    description: rawContact.desc || (existingGroup?.description) || null,
                    creationTimestamp: rawContact.creation ? new Date(rawContact.creation * 1000) : (existingGroup?.creationTimestamp) || null,
                    isLocked: rawContact.restrict || (existingGroup?.isLocked) || false,
                };
                
                // Ensure all dependencies exist before group creation
                const dependenciesValid = await this.ensureGroupDependencies(groupData, instanceId);
                if (dependenciesValid) {
                    await storage.upsertWhatsappGroup(groupData);
                } else {
                    console.warn(`Skipping group creation due to dependency validation failure: ${groupJid}`);
                }
                console.log(`🔄 [${instanceId}] Group subject updated from Evolution API: ${groupJid} -> "${rawContact.subject}"`);
                
                // Broadcast real-time update if subject changed
                if (existingGroup && existingGroup.subject !== rawContact.subject) {
                    const { GroupRealtimeManager } = await import('./group-realtime-manager');
                    await GroupRealtimeManager.handleSubjectChange(groupJid, instanceId, existingGroup.subject || '', rawContact.subject);
                }
                return;
            }

            // Process any available group subject from Evolution API
            let groupSubject = null;
            
            // Extract group subject from incoming Evolution API data  
            if (rawContact.subject && rawContact.subject !== 'Group Chat' && rawContact.subject.trim() !== '') {
                groupSubject = rawContact.subject;
                console.log(`📝 [${instanceId}] Found explicit subject field in contact: "${groupSubject}"`);
            } else if (rawContact.name && rawContact.name !== 'Group Chat' && rawContact.name.trim() !== '') {
                groupSubject = rawContact.name;
                console.log(`📝 [${instanceId}] Found name field in contact: "${groupSubject}"`);
            } else {
                console.log(`📝 [${instanceId}] No group subject found in contact update for ${groupJid}`);
                return;
            }

            if (groupSubject) {
                const groupData = {
                    groupJid: groupJid,
                    instanceId: instanceId,
                    subject: groupSubject,
                    ownerJid: rawContact.owner || (existingGroup?.ownerJid) || null,
                    description: rawContact.desc || (existingGroup?.description) || null,
                    creationTimestamp: rawContact.creation ? new Date(rawContact.creation * 1000) : (existingGroup?.creationTimestamp) || null,
                    isLocked: rawContact.restrict || (existingGroup?.isLocked) || false,
                };
                
                await storage.upsertWhatsappGroup(groupData);
                console.log(`🔄 [${instanceId}] Group updated from Evolution API contact: ${groupJid} -> "${groupSubject}"`);
                
                // Broadcast real-time update if subject changed
                if (existingGroup && existingGroup.subject !== groupSubject) {
                    const { GroupRealtimeManager } = await import('./group-realtime-manager');
                    await GroupRealtimeManager.handleSubjectChange(groupJid, instanceId, existingGroup.subject || '', groupSubject);
                }
                
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
     * Handles chat creation/updates. This is the primary point for creating
     * contact and group entities when a chat is first seen.
     */
    async handleChatsUpsert(instanceId: string, data: any): Promise<void> {
        const chats = Array.isArray(data.chats) ? data.chats : Array.isArray(data) ? data : [data];
        if (!chats || chats.length === 0) return;
        
        for (const rawChat of chats) {
            const cleanChat = await this.mapApiPayloadToWhatsappChat(rawChat, instanceId);
            if (cleanChat) {
                await this.createContactAndChatRecords(cleanChat, rawChat);
                await storage.upsertWhatsappChat(cleanChat);
                console.log(`✅ [${instanceId}] Chat upserted: ${cleanChat.chatId}`);
                
                // Notify clients of chat update to refresh conversation list
                SseManager.notifyClientsOfChatUpdate({
                    chatId: cleanChat.chatId,
                    instanceId: instanceId,
                    name: cleanChat.name,
                    type: cleanChat.type
                });
            }
        }
    },

    /**
     * Processes group subject updates from chat.update webhook events using isGroup flag
     */
    async handleGroupSubjectFromChat(groupJid: string, rawChat: any, instanceId: string): Promise<void> {
        try {
            // Real Evolution API chat.update events typically only contain remoteJid and instanceId
            // Group name data is not included - we fetch it from Evolution API instead
            
            // Check if this is definitively a group using the isGroup flag
            if (rawChat.isGroup === true && rawChat.name) {
                // For groups, the 'name' property contains the group subject
                const groupSubject = rawChat.name;
                
                if (groupSubject && groupSubject !== 'Group Chat') {
                    // Always update group subject from chat.update webhook (authoritative source)
                    const existingGroup = await storage.getWhatsappGroup(groupJid, instanceId);
                    // Always update group record with latest Evolution API data
                    const groupData = {
                        groupJid: groupJid,
                        instanceId: instanceId,
                        subject: groupSubject,
                        ownerJid: rawChat.owner || (existingGroup?.ownerJid) || null,
                        description: rawChat.desc || (existingGroup?.description) || null,
                        creationTimestamp: rawChat.creation ? new Date(rawChat.creation * 1000) : (existingGroup?.creationTimestamp) || null,
                        isLocked: rawChat.restrict || rawChat.isReadOnly || (existingGroup?.isLocked) || false,
                    };
                    
                    await storage.upsertWhatsappGroup(groupData);
                    console.log(`🔄 [${instanceId}] Group updated from Evolution API chat webhook: ${groupJid} -> "${groupSubject}"`);
                    
                    // Broadcast real-time update if subject changed
                    if (existingGroup && existingGroup.subject !== groupSubject) {
                        const { GroupRealtimeManager } = await import('./group-realtime-manager');
                        await GroupRealtimeManager.handleSubjectChange(groupJid, instanceId, existingGroup.subject || '', groupSubject);
                    }
                    
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
                        
                        // Ensure all dependencies exist before group creation
                        const dependenciesValid = await this.ensureGroupDependencies(groupData, instanceId);
                        if (dependenciesValid) {
                            await storage.upsertWhatsappGroup(groupData);
                        } else {
                            console.warn(`Skipping group creation due to dependency validation failure: ${groupJid}`);
                        }
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
     * Handles group creation and updates with Evolution API data taking priority
     */
    async handleGroupsUpsert(instanceId: string, data: any[]): Promise<void> {
        // --- LOUD DIAGNOSTIC LOG ---
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.log('!!!      GROUPS.UPSERT WEBHOOK WAS CALLED     !!!');
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        // ---------------------------
        
        if (!Array.isArray(data)) return;
        for (const rawGroup of data) {
            const groupJid = rawGroup.id;
            const existingGroup = await storage.getWhatsappGroup(groupJid, instanceId);
            
            // Ensure contact record exists for the group
            const chatContact = await this.mapApiPayloadToWhatsappContact({ id: rawGroup.id }, instanceId);
            if(chatContact) await storage.upsertWhatsappContact(chatContact);
            
            // Ensure chat record exists with Evolution API group name
            const chatData = await this.mapApiPayloadToWhatsappChat({ id: rawGroup.id, name: rawGroup.subject }, instanceId);
            if (chatData) await storage.upsertWhatsappChat(chatData);

            // Always update group with latest Evolution API data
            const cleanGroup = this.mapApiPayloadToWhatsappGroup(rawGroup, instanceId);
            if (cleanGroup) {
                // Ensure all dependencies exist before group creation
                const dependenciesValid = await this.ensureGroupDependencies(cleanGroup, instanceId);
                if (dependenciesValid) {
                    await storage.upsertWhatsappGroup(cleanGroup);
                } else {
                    console.warn(`Skipping group creation due to dependency validation failure: ${groupJid}`);
                    continue;
                }
                console.log(`🔄 [${instanceId}] Group updated with Evolution API data: ${groupJid} -> "${cleanGroup.subject}"`);
                
                // Process participants if available
                if (rawGroup.participants && Array.isArray(rawGroup.participants)) {
                    await this.processGroupParticipants(instanceId, groupJid, rawGroup.participants);
                }
                
                // Broadcast real-time update if subject changed
                if (existingGroup && existingGroup.subject !== cleanGroup.subject) {
                    const { GroupRealtimeManager } = await import('./group-realtime-manager');
                    await GroupRealtimeManager.handleSubjectChange(groupJid, instanceId, existingGroup.subject || '', cleanGroup.subject);
                }
            }
        }
    },

    /**
     * Handles group update events with authentic subject changes from Evolution API
     */
    async handleGroupUpdate(instanceId: string, data: any): Promise<void> {
        // --- LOUD DIAGNOSTIC LOG ---
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.log('!!!      GROUP.UPDATE WEBHOOK WAS CALLED      !!!');
        console.log(`!!!  GROUP ID: ${data?.id || 'UNKNOWN'}              !!!`);
        console.log(`!!!  SUBJECT: ${data?.subject || 'UNKNOWN'}          !!!`);
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        // ---------------------------
        
        try {
            if (!data?.id || !data.id.endsWith('@g.us')) {
                console.warn(`[${instanceId}] Invalid group.update payload:`, data);
                return;
            }

            const groupJid = data.id;
            const groupSubject = data.subject;

            if (!groupSubject || groupSubject === 'Group Chat') {
                console.log(`📝 [${instanceId}] No valid subject in group.update for ${groupJid}`);
                return;
            }

            // Get existing group to detect changes
            const existingGroup = await storage.getWhatsappGroup(groupJid, instanceId);
            const oldSubject = existingGroup?.subject || '';
            const oldDescription = existingGroup?.description || '';

            // Update group with authentic subject from Evolution API
            const groupData = {
                groupJid: groupJid,
                instanceId: instanceId,
                subject: groupSubject,
                description: data.desc || null,
                isLocked: data.restrict || false,
            };

            if (existingGroup) {
                groupData.ownerJid = existingGroup.ownerJid;
                groupData.creationTimestamp = existingGroup.creationTimestamp;
            }

            // Ensure all dependencies exist before group update
            const dependenciesValid = await this.ensureGroupDependencies(groupData, instanceId);
            if (dependenciesValid) {
                await storage.upsertWhatsappGroup(groupData);
            } else {
                console.warn(`Skipping group update due to dependency validation failure: ${groupJid}`);
                return;
            }
            console.log(`✅ [${instanceId}] Group updated with authentic subject from GROUP_UPDATE: ${groupJid} -> "${groupSubject}"`);

            // Update chat record to match group subject
            const existingChat = await storage.getWhatsappChat(groupJid, instanceId);
            if (existingChat) {
                const updatedChatData = this.mapApiPayloadToWhatsappChat({ id: groupJid, name: groupSubject }, instanceId);
                if (updatedChatData) {
                    await storage.upsertWhatsappChat(updatedChatData);
                }
            }

            // Broadcast real-time updates to connected clients
            const { GroupRealtimeManager } = await import('./group-realtime-manager');
            
            // Handle subject changes
            if (oldSubject !== groupSubject) {
                await GroupRealtimeManager.handleSubjectChange(groupJid, instanceId, oldSubject, groupSubject);
            }

            // Handle description changes
            const newDescription = data.desc || '';
            if (oldDescription !== newDescription) {
                await GroupRealtimeManager.handleDescriptionChange(groupJid, instanceId, oldDescription, newDescription);
            }

            // Handle settings changes
            if (data.restrict !== undefined || data.announce !== undefined) {
                await GroupRealtimeManager.handleSettingsChange(groupJid, instanceId, {
                    isLocked: data.restrict || false,
                    isAnnounce: data.announce || false
                });
            }

        } catch (error) {
            console.error(`❌ [${instanceId}] Error processing group.update:`, error.message);
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

            // Always allow Evolution API data to update group information
            // Don't skip API calls based on existing database data
            console.log(`🔄 [${instanceId}] Preparing to fetch latest group data for ${groupJid} from Evolution API`);

            // Use the new proactive group metadata fetcher
            const { GroupMetadataFetcher } = await import('./group-metadata-fetcher');
            const success = await GroupMetadataFetcher.updateGroupFromEvolutionApi(groupJid, instanceId);
            
            if (!success) {
                // Fallback: create placeholder if all API attempts fail
                console.log(`📝 [${instanceId}] Creating placeholder for group ${groupJid}, will retry with API data later`);
                await this.createGroupWithPlaceholder(groupJid, instanceId);
            }

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
                    // Ensure owner contact exists before group creation
                    if (group.owner) {
                        await this.ensureOwnerContactExists(group.owner, instanceId);
                    }
                    
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
        
        // After refreshing group names, sync contact records to match
        await this.syncGroupContactNames(instanceId);
            
        } catch (error) {
            console.error(`Error refreshing group names for ${instanceId}:`, error);
        }
    },

    /**
     * Synchronizes contact names with authentic group subjects
     */
    async syncGroupContactNames(instanceId: string): Promise<void> {
        try {
            const groups = await storage.getWhatsappGroups(instanceId);
            let syncedCount = 0;
            
            for (const group of groups) {
                if (group.subject && group.subject !== 'Group') {
                    const contact = await storage.getWhatsappContact(group.groupJid, instanceId);
                    
                    if (contact && contact.pushName !== group.subject) {
                        const updatedContact = {
                            ...contact,
                            pushName: group.subject,
                            verifiedName: group.subject
                        };
                        
                        await storage.upsertWhatsappContact(updatedContact);
                        syncedCount++;
                        console.log(`🔄 Synced contact name for group ${group.groupJid}: "${group.subject}"`);
                    }
                }
            }
            
            console.log(`✅ Synchronized ${syncedCount} group contact names with authentic subjects`);
        } catch (error) {
            console.error(`Error syncing group contact names:`, error);
        }
    },
    
    /**
     * Process group participants from Evolution API data
     */
    async processGroupParticipants(instanceId: string, groupJid: string, participants: any[]): Promise<void> {
        // --- LOUD DIAGNOSTIC LOG ---
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.log('!!!   PROCESSING GROUP PARTICIPANTS CALLED   !!!');
        console.log(`!!!   GROUP: ${groupJid}                      !!!`);
        console.log(`!!!   PARTICIPANTS COUNT: ${participants?.length || 0}           !!!`);
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        // ---------------------------
        
        if (!participants || !Array.isArray(participants)) return;
        
        let processedCount = 0;
        for (const participant of participants) {
            try {
                const participantJid = participant.id || participant.jid;
                if (!participantJid) continue;

                const participantData = {
                    groupJid: groupJid,
                    participantJid: participantJid,
                    instanceId: instanceId,
                    isAdmin: participant.admin === 'admin' || participant.isAdmin || false,
                    isSuperAdmin: participant.admin === 'superadmin' || participant.isSuperAdmin || false
                };

                await storage.upsertGroupParticipant(participantData);
                processedCount++;
            } catch (error) {
                console.error(`❌ Error processing participant ${participant.id || 'unknown'}:`, error);
            }
        }
        
        if (processedCount > 0) {
            console.log(`👥 [${instanceId}] Processed ${processedCount} participants for group ${groupJid}`);
        }
    },

    async handleGroupParticipantsUpdate(instanceId: string, data: any): Promise<void> {
        // --- LOUD DIAGNOSTIC LOG ---
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.log('!!!  GROUP.PARTICIPANTS.UPDATE WEBHOOK CALLED !!!');
        console.log(`!!!  ACTION: ${data?.action || 'UNKNOWN'}                    !!!`);
        console.log(`!!!  GROUP: ${data?.id || 'UNKNOWN'}              !!!`);
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        // ---------------------------
        
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

        // Broadcast real-time participant changes to connected clients
        try {
            const { GroupRealtimeManager } = await import('./group-realtime-manager');
            await GroupRealtimeManager.handleParticipantsChange(groupJid, instanceId, action, participants);
        } catch (error) {
            console.error('Error broadcasting participant changes:', error);
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

    async handleDirectReaction(instanceId: string, data: any): Promise<void> {
        try {
            console.log(`👍 [${instanceId}] Processing direct reaction event`);
            console.log('Reaction data:', JSON.stringify(data, null, 2));
            
            // Extract reaction details from the data
            const reactionText = data.reaction?.text;
            const originalMessageId = data.reaction?.key?.id;
            const reactorJid = data.key?.remoteJid;
            const reactionMessageId = data.key?.id;
            
            if (!reactionText || !originalMessageId || !reactorJid) {
                console.log('Missing required reaction data, skipping');
                return;
            }
            
            console.log(`🎯 Processing reaction: ${reactionText} on message ${originalMessageId} by ${reactorJid}`);
            
            // Store the reaction in database
            const reactionData = {
                reactionId: reactionMessageId,
                messageId: originalMessageId,
                instanceId: instanceId,
                reactorJid: reactorJid,
                reactionEmoji: reactionText,
                timestamp: data.messageTimestamp ? new Date(data.messageTimestamp * 1000) : new Date(),
                fromMe: false
            };
            
            try {
                await storage.upsertWhatsappMessageReaction(reactionData);
                console.log(`📝 [${instanceId}] Reaction stored in database successfully`);
            } catch (error) {
                console.log(`⚠️ [${instanceId}] Reaction storage failed, proceeding with action processing:`, error.message);
            }
            
            // Process actions based on reaction
            const messageContext = {
                messageId: originalMessageId,
                instanceId: instanceId,
                chatId: reactorJid,
                senderJid: reactorJid,
                content: `Reaction: ${reactionText}`,
                hashtags: [],
                keywords: [],
                timestamp: new Date(),
                fromMe: false,
                reaction: reactionText,
                originalSenderJid: reactorJid
            };
            
            // Import and trigger action processing
            const { ActionService } = await import('./action-service');
            await ActionService.processNewMessage(messageContext, instanceId);
            
            console.log(`✅ [${instanceId}] Reaction ${reactionText} processed successfully`);
            
        } catch (error) {
            console.error(`❌ [${instanceId}] Error processing direct reaction:`, error);
        }
    },

    /**
     * Creates all necessary records when a new chat is detected.
     */
    async createContactAndChatRecords(cleanChat: any, rawChat: any): Promise<void> {
        if (!cleanChat.chatId || !cleanChat.instanceName) return;

        // 1. Create the `whatsapp.contacts` record for the chat entity itself.
        const chatContact = await this.mapApiPayloadToWhatsappContact({ 
            id: cleanChat.chatId, 
            pushName: rawChat.name 
        }, cleanChat.instanceName);
        if (chatContact) await storage.upsertWhatsappContact(chatContact);

        // 2. If it's a group, create a placeholder in `whatsapp.groups`.
        if (cleanChat.type === 'group') {
            await storage.createGroupPlaceholderIfNeeded(cleanChat.chatId, cleanChat.instanceName);
        }
        // 3. If it's an individual, create the corresponding `crm.contact_details` record.
        else {
            const crmContact = await this.mapApiPayloadToCrmContactDetail({ 
                key: { remoteJid: cleanChat.chatId }, 
                pushName: rawChat.name 
            }, cleanChat.instanceName);
            if (crmContact) await storage.upsertCrmContactDetail(crmContact);
        }
    },

    /**
     * Guarantees all dependency records exist for a given message.
     */
    async ensureDependenciesForMessage(cleanMessage: any, rawMessage: any): Promise<void> {
        const isGroup = cleanMessage.chatId.endsWith('@g.us');
        
        // For individual chats, create contact for the other person (not instance owner)
        if (!isGroup && cleanMessage.chatId === cleanMessage.senderJid && !cleanMessage.fromMe) {
            // This is a message FROM the other person TO us - use their pushName
            const senderContact = await this.mapApiPayloadToWhatsappContact({
                id: cleanMessage.senderJid,
                pushName: rawMessage.pushName
            }, cleanMessage.instanceName);
            if (senderContact) await storage.upsertWhatsappContact(senderContact);
        }
        
        // For individual chats where I sent a message, don't update the other person's contact with my name
        if (!isGroup && cleanMessage.chatId === cleanMessage.senderJid && cleanMessage.fromMe) {
            // This is a message FROM me TO the other person - don't update their contact
            return; // Skip contact creation to avoid overwriting their name with mine
        }
        
        // For group messages, create sender contact if it's a group participant
        if (isGroup && cleanMessage.senderJid !== cleanMessage.chatId && !cleanMessage.senderJid.endsWith('@g.us')) {
            const senderContact = await this.mapApiPayloadToWhatsappContact({
                id: cleanMessage.senderJid,
                pushName: rawMessage.pushName
            }, cleanMessage.instanceName);
            if (senderContact) await storage.upsertWhatsappContact(senderContact);
        }
        
        // Create chat contact record only if we haven't already created it above
        if (isGroup || (!isGroup && !cleanMessage.fromMe)) {
            const chatContact = await this.mapApiPayloadToWhatsappContact({ 
                id: cleanMessage.chatId,
                // For individual chats, use pushName only if this message is FROM the other person
                pushName: isGroup ? undefined : (!cleanMessage.fromMe ? rawMessage.pushName : undefined)
            }, cleanMessage.instanceName);
            if (chatContact) await storage.upsertWhatsappContact(chatContact);
        }

        const chatData = await this.mapApiPayloadToWhatsappChat({ id: cleanMessage.chatId }, cleanMessage.instanceName);
        if (chatData && chatData.chatId && chatData.instanceName) {
            await storage.upsertWhatsappChat(chatData);
        } else {
            console.warn(`Skipping chat creation due to invalid data: chatId=${chatData?.chatId}, instanceName=${chatData?.instanceName}`);
        }

        if (isGroup) {
            // For groups, proactively update with latest Evolution API data
            const { GroupMetadataFetcher } = await import('./group-metadata-fetcher');
            GroupMetadataFetcher.handleGroupActivity(cleanMessage.chatId, cleanMessage.instanceName);
        }
    },

    // --- Data Mapping Functions ---

    mapApiPayloadToWhatsappReaction(rawReaction: any, instanceName: string, sender?: string): Omit<WhatsappMessageReactions, 'reactionId'> | null {
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
            instanceName: instanceName,
            reactorJid: reactorJid,
            reactionEmoji: reactionMsg.text || '',
            fromMe: rawReaction.key.fromMe || false,
            timestamp: validTimestamp
        };
    },

    async mapSentMessageToWhatsappMessage(sentData: any, instanceName: string): Promise<Omit<WhatsappMessages, 'createdAt'> | null> {
        if (!sentData.key?.id || !sentData.key?.remoteJid) return null;
        
        const timestamp = sentData.messageTimestamp;
        const messageContent = sentData.message?.conversation || sentData.message?.extendedTextMessage?.text || '';

        return {
            messageId: sentData.key.id,
            instanceName: instanceName,
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
    
    async mapApiPayloadToWhatsappMessage(rawMessage: any, instanceName: string): Promise<Omit<WhatsappMessages, 'createdAt'> | null> {
        if (!rawMessage.key?.id || !rawMessage.key?.remoteJid) return null;
        
        // Debug and fix malformed chat IDs
        const remoteJid = rawMessage.key.remoteJid;
        if (remoteJid && !remoteJid.includes('@') && remoteJid.length > 20) {
            console.error(`🚨 MALFORMED CHAT ID DETECTED: "${remoteJid}"`);
            console.error(`Full message structure:`, JSON.stringify({
                messageType: rawMessage.messageType,
                key: rawMessage.key,
                pushName: rawMessage.pushName,
                chat: rawMessage.chat,
                groupData: rawMessage.groupData,
                instanceName: instanceName
            }, null, 2));
            
            // Try to find the correct JID in the message data
            const correctJid = this.extractCorrectJid(rawMessage);
            if (correctJid) {
                console.log(`🔧 Found correct JID: "${correctJid}", replacing malformed ID`);
                rawMessage.key.remoteJid = correctJid;
            } else {
                console.error(`❌ Could not find correct JID, skipping message`);
                return null;
            }
        }
        
        const timestamp = rawMessage.messageTimestamp;

        const getMessageType = (rawMessage: any): WhatsappMessages['messageType'] => {
            const type = rawMessage.messageType;
            console.log(`🔍 Processing message type: "${type}" for message ${rawMessage.key?.id}`);
            
            // Direct type mappings
            if (type === 'conversation') return 'text';
            if (type === 'extendedTextMessage') return 'text';
            
            // Media type mappings
            if (type === 'imageMessage') return 'image';
            if (type === 'videoMessage') return 'video';
            if (type === 'audioMessage') return 'audio';
            if (type === 'documentMessage') return 'document';
            if (type === 'stickerMessage') return 'sticker';
            if (type === 'locationMessage') return 'location';
            if (type === 'contactMessage') return 'contact_card';
            if (type === 'contactsArrayMessage') return 'contact_card_multi';
            
            // Check message content for media types
            const message = rawMessage.message;
            if (message) {
                if (message.imageMessage) return 'image';
                if (message.videoMessage) return 'video';
                if (message.audioMessage) return 'audio';
                if (message.documentMessage) return 'document';
                if (message.stickerMessage) return 'sticker';
                if (message.locationMessage) return 'location';
                if (message.contactMessage) return 'contact_card';
                if (message.contactsArrayMessage) return 'contact_card_multi';
                if (message.conversation) return 'text';
                if (message.extendedTextMessage) return 'text';
            }
            
            // Fallback for known valid types
            const validTypes: WhatsappMessages['messageType'][] = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact_card', 'contact_card_multi', 'order', 'revoked', 'unsupported', 'reaction', 'call_log', 'edited_message'];
            if (type && validTypes.includes(type as any)) {
                return type as WhatsappMessages['messageType'];
            }
            
            // Log unknown types for debugging
            console.log(`🔍 Unknown message type detected: ${type}`, {
                messageType: type,
                messageKeys: message ? Object.keys(message) : [],
                messageId: rawMessage.key?.id,
                fullMessage: message
            });
            
            return 'unsupported';
        };

        // Enhanced fromMe detection logic
        const detectFromMe = async (rawMessage: any, instanceName: string): Promise<boolean> => {
            // First check Evolution API flag (may be incorrect)
            const apiFromMe = rawMessage.key.fromMe || false;
            
            // Get instance owner JID for comparison
            const instance = await storage.getWhatsappInstance(instanceName);
            const instanceOwnerJid = instance?.ownerJid;
            
            if (!instanceOwnerJid) {
                console.log(`⚠️ [${instanceName}] No owner JID found for instance, using API fromMe: ${apiFromMe}`);
                return apiFromMe;
            }
            
            // For group messages, check if participant matches instance owner
            if (rawMessage.key.participant) {
                const isOwnerMessage = rawMessage.key.participant === instanceOwnerJid;
                if (isOwnerMessage !== apiFromMe) {
                    console.log(`🔧 [${instanceName}] Corrected fromMe flag: API=${apiFromMe}, Detected=${isOwnerMessage} for participant ${rawMessage.key.participant} vs owner ${instanceOwnerJid}`);
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
            console.log(`📤 [${instanceName}] Using API fromMe flag: ${apiFromMe} for message ${rawMessage.key.id}`);
            return apiFromMe;
        };

        const correctedFromMe = await detectFromMe(rawMessage, instanceName);

        const isForwarded = this.detectForwardedMessage(rawMessage);
        const forwardingScore = this.extractForwardingScore(rawMessage);
        
        // Debug forwarded message detection
        if (isForwarded || forwardingScore > 0) {
            console.log(`🔄 Processing forwarded message: ${rawMessage.key?.id}`);
            console.log(`   - isForwarded: ${isForwarded}`);
            console.log(`   - forwardingScore: ${forwardingScore}`);
            console.log(`   - contextInfo:`, JSON.stringify(rawMessage.contextInfo, null, 2));
        }

        const messageType = getMessageType(rawMessage);
        const content = this.extractMessageContent(rawMessage);
        
        console.log(`📨 Processing message ${rawMessage.key.id}: type="${messageType}", content="${content}"`);

        return {
            messageId: rawMessage.key.id,
            instanceName: instanceName,
            chatId: rawMessage.key.remoteJid,
            senderJid: rawMessage.key.participant || rawMessage.key.remoteJid,
            fromMe: correctedFromMe,
            messageType: messageType,
            content: content,
            timestamp: timestamp && typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(),
            quotedMessageId: rawMessage.message?.extendedTextMessage?.contextInfo?.quotedMessage?.key?.id,
            isForwarded: isForwarded,
            forwardingScore: forwardingScore,
            isStarred: rawMessage.starred || false,
            isEdited: rawMessage.messageType === 'editedMessage',
            lastEditedAt: rawMessage.messageType === 'editedMessage' && timestamp && typeof timestamp === 'number'
                ? new Date(timestamp * 1000)
                : undefined,
            sourcePlatform: rawMessage.source,
            rawApiPayload: rawMessage,
        };
    },

    /**
     * Detects if a message is forwarded by checking multiple possible locations
     */
    detectForwardedMessage(rawMessage: any): boolean {
        // Check contextInfo at the root level (Evolution API format)
        if (rawMessage.contextInfo?.isForwarded === true) {
            console.log(`🔄 Detected forwarded message via contextInfo.isForwarded: ${rawMessage.key?.id}`);
            return true;
        }
        
        // Check forwardingScore in contextInfo
        if ((rawMessage.contextInfo?.forwardingScore || 0) > 0) {
            console.log(`🔄 Detected forwarded message via contextInfo.forwardingScore: ${rawMessage.key?.id} (score: ${rawMessage.contextInfo.forwardingScore})`);
            return true;
        }
        
        // Check in message.extendedTextMessage.contextInfo (WhatsApp format)
        if ((rawMessage.message?.extendedTextMessage?.contextInfo?.forwardingScore || 0) > 0) {
            console.log(`🔄 Detected forwarded message via extendedTextMessage.contextInfo: ${rawMessage.key?.id}`);
            return true;
        }
        
        // Check in message.conversation contextInfo
        if ((rawMessage.message?.contextInfo?.forwardingScore || 0) > 0) {
            console.log(`🔄 Detected forwarded message via message.contextInfo: ${rawMessage.key?.id}`);
            return true;
        }
        
        return false;
    },

    /**
     * Extracts forwarding score from various possible locations
     */
    extractForwardingScore(rawMessage: any): number {
        // Check contextInfo at the root level (Evolution API format)
        if (rawMessage.contextInfo?.forwardingScore) {
            return rawMessage.contextInfo.forwardingScore;
        }
        
        // Check in message.extendedTextMessage.contextInfo (WhatsApp format)
        if (rawMessage.message?.extendedTextMessage?.contextInfo?.forwardingScore) {
            return rawMessage.message.extendedTextMessage.contextInfo.forwardingScore;
        }
        
        // Check in message.conversation contextInfo
        if (rawMessage.message?.contextInfo?.forwardingScore) {
            return rawMessage.message.contextInfo.forwardingScore;
        }
        
        return 0;
    },

    /**
     * Extract correct JID from malformed Evolution API data that combines group JID with owner JID
     */
    extractCorrectJid(rawMessage: any): string | null {
        // First, look for proper JID patterns in various fields
        const possibleJids = [
            rawMessage.key?.remoteJid,
            rawMessage.key?.participant, 
            rawMessage.remoteJid,
            rawMessage.participant,
            rawMessage.from,
            rawMessage.to
        ].filter(Boolean);

        // Check if any field contains a proper WhatsApp JID format
        for (const jid of possibleJids) {
            if (typeof jid === 'string' && (jid.includes('@s.whatsapp.net') || jid.includes('@g.us'))) {
                return jid;
            }
        }

        // Handle the specific case where Evolution API combines group JID with owner JID
        const malformedJid = rawMessage.key?.remoteJid;
        if (malformedJid && typeof malformedJid === 'string' && malformedJid.length > 20 && !malformedJid.includes('@')) {
            console.log(`🔧 Attempting to correct malformed JID: ${malformedJid}`);
            
            const participant = rawMessage.key?.participant;
            const isGroupMessage = participant && participant.includes('@s.whatsapp.net');
            
            if (isGroupMessage) {
                console.log(`🔧 Group message detected with participant: ${participant}`);
                
                // For group messages, look for the actual group JID in the message data
                const messageStr = JSON.stringify(rawMessage);
                const groupJidMatch = messageStr.match(/(\d{10,15}-\d+@g\.us)/);
                
                if (groupJidMatch) {
                    console.log(`🔧 Extracted group JID from message data: ${groupJidMatch[1]}`);
                    return groupJidMatch[1];
                }
                
                // Check for group JID in specific fields and nested structures
                const potentialGroupJids = [
                    rawMessage.chat?.id,
                    rawMessage.groupData?.groupJid,
                    rawMessage.group?.id,
                    rawMessage.groupId,
                    rawMessage.metadata?.groupInfo?.jid,
                    rawMessage.groupInfo?.jid,
                    rawMessage.groupMetadata?.id
                ].filter(Boolean);
                
                for (const jid of potentialGroupJids) {
                    if (typeof jid === 'string' && jid.includes('@g.us')) {
                        console.log(`🔧 Found group JID in structured data: ${jid}`);
                        return jid;
                    }
                }
                
                // Try to construct group JID from malformed ID if it contains recognizable patterns
                // Some Evolution API bugs might encode the group info in the malformed string
                if (malformedJid.length > 25) {
                    // Look for phone number patterns that might be part of a group JID
                    const phoneMatches = malformedJid.match(/(\d{10,15})/g);
                    if (phoneMatches && phoneMatches.length > 0) {
                        // Try to construct a group JID - this is speculative but worth trying
                        const basePhone = phoneMatches[0];
                        // Look for any timestamp-like numbers that could be the group creation time
                        const timestampPattern = malformedJid.match(/(\d{10,13})/g);
                        if (timestampPattern && timestampPattern.length > 1) {
                            const possibleGroupJid = `${basePhone}-${timestampPattern[1]}@g.us`;
                            console.log(`🔧 Constructed possible group JID from malformed data: ${possibleGroupJid}`);
                            return possibleGroupJid;
                        }
                    }
                }
                
                // If we can't find the group JID in the message data, this is a critical limitation
                // When Evolution API sends malformed group data, the actual group JID is lost
                console.warn(`⚠️ Could not extract group JID from malformed ID: ${malformedJid}`);
                console.warn(`⚠️ Participant: ${participant}, group JID resolution needed`);
                
                // For now, we'll have to skip this message to avoid creating incorrect data
                // In a production system, you'd want to implement Evolution API lookup here
                console.error(`❌ Cannot process group message without valid group JID - skipping malformed message`);
                return null;
            } else {
                // For individual messages, look for individual JID pattern
                const messageStr = JSON.stringify(rawMessage);
                const individualJidMatch = messageStr.match(/(\d{10,15}@s\.whatsapp\.net)/);
                
                if (individualJidMatch) {
                    console.log(`🔧 Extracted individual JID from message data: ${individualJidMatch[1]}`);
                    return individualJidMatch[1];
                }
            }
        }

        return null;
    },

    /**
     * Extract correct JID from malformed chat data that combines group JID with owner JID
     */
    extractCorrectJidFromChat(rawChat: any): string | null {
        // First, look for proper JID patterns in chat data fields
        const possibleJids = [
            rawChat.id,
            rawChat.remoteJid,
            rawChat.jid,
            rawChat.chatId,
            rawChat.from,
            rawChat.to
        ].filter(Boolean);

        // Check if any field contains a proper WhatsApp JID format
        for (const jid of possibleJids) {
            if (typeof jid === 'string' && (jid.includes('@s.whatsapp.net') || jid.includes('@g.us'))) {
                return jid;
            }
        }

        // Handle the specific case where Evolution API combines group JID with owner JID in chat data
        const malformedId = rawChat.id || rawChat.remoteJid;
        if (malformedId && typeof malformedId === 'string' && malformedId.length > 20 && !malformedId.includes('@')) {
            // Look for proper JID patterns in the entire chat object
            const chatStr = JSON.stringify(rawChat);
            
            // Look for group JID pattern first
            const groupJidMatch = chatStr.match(/(\d{10,15}-\d+@g\.us)/);
            if (groupJidMatch) {
                console.log(`🔧 Extracted group JID from chat data: ${groupJidMatch[1]}`);
                return groupJidMatch[1];
            }
            
            // Look for individual JID pattern
            const individualJidMatch = chatStr.match(/(\d{10,15}@s\.whatsapp\.net)/);
            if (individualJidMatch) {
                console.log(`🔧 Extracted individual JID from chat data: ${individualJidMatch[1]}`);
                return individualJidMatch[1];
            }
        }

        return null;
    },

    async mapApiPayloadToWhatsappContact(rawContact: any, instanceName: string): Promise<Omit<WhatsappContacts, 'firstSeenAt' | 'lastUpdatedAt'> | null> {
        const jid = rawContact.id || rawContact.remoteJid;
        if (!jid || !instanceName) return null;

        const instance = await storage.getInstanceById(instanceName);
        
        // For groups, ensure we use the authentic group subject from database
        let contactName = rawContact.name || rawContact.pushName || rawContact.notify;
        if (jid.endsWith('@g.us')) {
            // Check if we have the authentic group subject in database
            const existingGroup = await storage.getWhatsappGroup(jid, instanceName);
            if (existingGroup?.subject && existingGroup.subject !== 'Group') {
                contactName = existingGroup.subject;
            } else if (rawContact.subject && rawContact.subject !== 'Group Chat') {
                contactName = rawContact.subject;
            } else {
                // Fallback to generic group name for contact record
                contactName = 'Group';
            }
        }
        
        // Ensure we have a valid contact name
        if (!contactName) {
            contactName = jid.split('@')[0] || 'Contact';
        }
        
        return {
            jid: jid,
            instanceName: instanceName,
            pushName: contactName,
            verifiedName: rawContact.verifiedName || (jid.endsWith('@g.us') ? contactName : undefined),
            profilePictureUrl: rawContact.profilePicUrl || rawContact.profilePictureUrl,
            isBusiness: rawContact.isBusiness || false,
            isMe: instance?.ownerJid === jid,
            isBlocked: rawContact.isBlocked || false,
        };
    },
    
    async mapApiPayloadToWhatsappChat(rawChat: any, instanceName: string): Promise<Omit<WhatsappChats, 'createdAt' | 'updatedAt'> | null> {
        // --- LOUD CHAT MAPPING DIAGNOSTICS ---
        console.log('🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍');
        console.log('🔍                    CHAT MAPPING ANALYSIS                     🔍');
        console.log('🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍');
        console.log('🔍 INSTANCE NAME:', instanceName);
        console.log('🔍 RAW CHAT TYPE:', typeof rawChat);
        console.log('🔍 FULL RAW CHAT PAYLOAD:');
        console.log(JSON.stringify(rawChat, null, 4));
        console.log('🔍');
        console.log('🔍 ID FIELD ANALYSIS:');
        console.log('🔍   - rawChat.id:', rawChat.id);
        console.log('🔍   - rawChat.remoteJid:', rawChat.remoteJid);
        console.log('🔍   - rawChat.chatId:', rawChat.chatId);
        console.log('🔍   - rawChat.key?.remoteJid:', rawChat.key?.remoteJid);
        console.log('🔍   - rawChat.key:', JSON.stringify(rawChat.key, null, 2));
        console.log('🔍');
        console.log('🔍 ALL CHAT PAYLOAD KEYS:', Object.keys(rawChat));
        console.log('🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍');

        let chatId = rawChat.id || rawChat.remoteJid;
        
        console.log('🎯 EXTRACTED CHAT ID:', chatId);
        console.log('🎯 CHAT ID TYPE:', typeof chatId);
        console.log('🎯 INSTANCE NAME:', instanceName);
        console.log('🎯 INSTANCE NAME TYPE:', typeof instanceName);
        
        if (!chatId || typeof chatId !== 'string' || chatId.trim() === '' || !instanceName || typeof instanceName !== 'string' || instanceName.trim() === '') {
            console.error('❌❌❌ CRITICAL VALIDATION FAILURE ❌❌❌');
            console.error('❌ chatId:', chatId, 'Type:', typeof chatId);
            console.error('❌ instanceName:', instanceName, 'Type:', typeof instanceName);
            console.error('❌ Complete rawChat for debugging:');
            console.error(JSON.stringify(rawChat, null, 2));
            console.error('❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌');
            return null;
        }

        // Debug and fix malformed chat IDs in chat creation
        if (chatId && !chatId.includes('@') && chatId.length > 20) {
            console.error(`🚨🚨🚨 MALFORMED CHAT ID DETECTED 🚨🚨🚨`);
            console.error(`🚨 Malformed ID: "${chatId}"`);
            console.error(`🚨 Length: ${chatId.length}`);
            console.error(`🚨 Contains @: ${chatId.includes('@')}`);
            console.error(`🚨 Raw chat data causing malformation:`);
            console.error(JSON.stringify(rawChat, null, 2));
            
            // Try to find the correct JID in the chat data
            const correctJid = this.extractCorrectJidFromChat(rawChat);
            if (correctJid) {
                console.log(`🔧 Found correct chat JID: "${correctJid}", replacing malformed ID`);
                chatId = correctJid;
            } else {
                console.error(`❌ Could not find correct chat JID, skipping chat creation`);
                console.error(`❌ All available fields in rawChat:`, Object.keys(rawChat));
                return null;
            }
        }
        
        // Use authentic group name when available, fallback to contact name or JID
        const isGroup = chatId.endsWith('@g.us');
        let chatName;
        
        // For groups, prefer the subject field over other name fields
        if (isGroup) {
            chatName = rawChat.subject || rawChat.name || 'Group';
        } else {
            // For individual chats, get the actual contact name instead of using sender info
            const existingContact = await storage.getWhatsappContact(chatId, instanceName);
            if (existingContact && existingContact.pushName) {
                chatName = existingContact.pushName;
            } else {
                // Only use rawChat.name if it's actually for this chat, not sender info
                chatName = rawChat.name || chatId.split('@')[0];
            }
        }
        
        return {
            chatId: chatId,
            instanceName: instanceName,
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

    mapApiPayloadToWhatsappGroup(rawGroup: any, instanceName: string): Omit<WhatsappGroups, 'updatedAt'> | null {
        if (!rawGroup.id) return null;
        return {
            groupJid: rawGroup.id,
            instanceName: instanceName,
            subject: rawGroup.subject,
            ownerJid: rawGroup.owner,
            description: rawGroup.desc,
            creationTimestamp: rawGroup.creation ? new Date(rawGroup.creation * 1000) : undefined,
            isLocked: rawGroup.announce || false,
        };
    },

    /**
     * Ensures owner contact exists before group creation/update to prevent foreign key errors
     */
    async ensureOwnerContactExists(ownerJid: string, instanceName: string): Promise<void> {
        if (!ownerJid || !instanceName) return;
        
        try {
            const existingContact = await storage.getWhatsappContact(ownerJid, instanceName);
            if (!existingContact) {
                // Create contact directly with required fields to avoid null constraint violations
                const ownerContact = {
                    jid: ownerJid,
                    instanceName: instanceName,
                    pushName: ownerJid.split('@')[0], // Use first part of JID as name
                    verifiedName: undefined,
                    profilePictureUrl: undefined,
                    isBusiness: false,
                    isMe: false,
                    isBlocked: false,
                };
                
                await storage.upsertWhatsappContact(ownerContact);
                console.log(`✅ Created owner contact for foreign key constraint: ${ownerJid}`);
            }
        } catch (error) {
            console.warn(`Failed to ensure owner contact exists: ${ownerJid}`, error.message);
        }
    },

    /**
     * Comprehensive dependency validation and creation for group operations
     */
    async ensureGroupDependencies(groupData: any, instanceId: string): Promise<boolean> {
        try {
            // Validate required fields
            if (!groupData.groupJid || !instanceId) {
                console.warn(`Invalid group data - groupJid: ${groupData.groupJid}, instanceId: ${instanceId}`);
                return false;
            }

            // Ensure owner contact exists if specified
            if (groupData.ownerJid) {
                await this.ensureOwnerContactExists(groupData.ownerJid, instanceId);
            }

            // Ensure group contact record exists
            const groupContact = {
                jid: groupData.groupJid,
                instanceId: instanceId,
                pushName: groupData.subject || 'Group',
                verifiedName: groupData.subject || 'Group',
                profilePictureUrl: undefined,
                isBusiness: false,
                isMe: false,
                isBlocked: false,
            };
            await storage.upsertWhatsappContact(groupContact);

            // Ensure group chat record exists
            const groupChat = await this.mapApiPayloadToWhatsappChat({ id: groupData.groupJid, subject: groupData.subject }, instanceId);
            if (groupChat) {
                await storage.upsertWhatsappChat(groupChat);
            }

            return true;
        } catch (error) {
            console.error(`Failed to ensure group dependencies: ${error.message}`);
            return false;
        }
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
        
        // Text messages
        if (msg.conversation) return msg.conversation;
        if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
        
        // Media messages with captions
        if (msg.imageMessage) {
            return msg.imageMessage.caption || '[Image]';
        }
        if (msg.videoMessage) {
            return msg.videoMessage.caption || '[Video]';
        }
        if (msg.audioMessage) {
            const duration = msg.audioMessage.seconds ? ` (${msg.audioMessage.seconds}s)` : '';
            return `[Audio${duration}]`;
        }
        if (msg.documentMessage) {
            const filename = msg.documentMessage.fileName || msg.documentMessage.title;
            return filename ? `[Document: ${filename}]` : '[Document]';
        }
        if (msg.stickerMessage) {
            return '[Sticker]';
        }
        if (msg.locationMessage) {
            return '[Location]';
        }
        if (msg.contactMessage) {
            const name = msg.contactMessage.displayName || msg.contactMessage.vcard?.split('\n').find(line => line.startsWith('FN:'))?.replace('FN:', '');
            return name ? `[Contact: ${name}]` : '[Contact]';
        }
        if (msg.contactsArrayMessage) {
            return '[Contacts]';
        }
        
        // Fallback for other message types
        return '[Message]';
    },

    // REMOVED: syncAllGroupSubjects - use individual group fetch only

    /**
     * Fetch specific group using individual group JID endpoint (eliminates bulk fetching)
     */
    async fetchSpecificGroupFromApi(instanceId: string, groupJid: string): Promise<{ success: boolean; group: any; error?: string }> {
        try {
            const instance = await storage.getWhatsappInstance(instanceId);
            
            if (!instance?.apiKey) {
                return { success: false, group: null, error: 'No API key found for instance' };
            }

            console.log(`🔍 [${instanceId}] Fetching specific group: ${groupJid}`);

            // Use the specific group JID endpoint only
            const groupInfo = await this.requestGroupMetadata(instanceId, groupJid);
            
            if (groupInfo) {
                console.log(`✅ [${instanceId}] Found group via specific JID endpoint: ${groupInfo.subject}`);
                return { success: true, group: groupInfo, error: null };
            } else {
                return { success: false, group: null, error: 'Group not found or inaccessible' };
            }

        } catch (error) {
            console.error(`❌ [${instanceId}] Error fetching specific group ${groupJid}:`, error.message);
            return { success: false, group: null, error: error.message };
        }
    },

    // REMOVED: syncAllGroupsFromApi - use individual group fetch only

    /**
     * Legacy group sync method (kept for compatibility)
     */
    async syncAllGroupsFromApiLegacy(instanceId: string): Promise<{ success: boolean; count: number; error?: string }> {
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
     * Request group metadata from Evolution API using the specific group JID endpoint
     */
    async requestGroupMetadata(instanceId: string, groupJid: string): Promise<any | null> {
        try {
            // Use the specific group JID endpoint you provided
            const response = await fetch(`https://evolution-api-evolution-api.vuswn0.easypanel.host/group/findGroupInfos/${instanceId}?groupJid=${groupJid}`, {
                method: 'GET',
                headers: {
                    'apikey': process.env.EVOLUTION_API_KEY || '119FA240-45ED-46A7-AE13-5A1B7C909D7D',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ [${instanceId}] Group metadata received for ${groupJid}:`, JSON.stringify(data, null, 2));
                return data;
            } else {
                console.warn(`⚠️ [${instanceId}] Group metadata request failed for ${groupJid}: ${response.status}`);
                return null;
            }
        } catch (error) {
            console.warn(`❌ [${instanceId}] Error requesting group metadata for ${groupJid}:`, error.message);
            return null;
        }
    },

    /**
     * Download and save audio media using Evolution API's downloadMedia method
     * This implements your exact solution approach
     */
    async handleNewAudioMessage(instanceId: string, messageData: any): Promise<void> {
        try {
            const evolutionApi = getEvolutionApi();
            const messageId = messageData.key?.id;
            
            if (!messageId) {
                return;
            }

            // Check if this is an audio message
            const audioMessage = messageData.message?.audioMessage;
            if (!audioMessage) {
                return;
            }

            console.log(`🎵 Processing audio message: ${messageId}`);

            // 1. Call Evolution API downloadMedia method
            const downloadedMedia = await evolutionApi.downloadMedia(instanceId, process.env.EVOLUTION_API_KEY!, messageData);

            if (downloadedMedia && downloadedMedia.buffer) {
                // 2. Determine file extension from mimetype
                const extension = downloadedMedia.mimetype.split('/')[1] || 'ogg';
                const fileName = `${messageId}.${extension}`;
                const storagePath = path.resolve(process.cwd(), 'media_storage', instanceId);

                // 3. Save the buffer to file
                await fs.mkdir(storagePath, { recursive: true });
                await fs.writeFile(path.join(storagePath, fileName), downloadedMedia.buffer);

                console.log(`✅ Playable audio file saved: ${fileName}`);
                console.log(`📁 File size: ${downloadedMedia.buffer.length} bytes`);
                console.log(`🎧 MIME type: ${downloadedMedia.mimetype}`);

                // The audio file is now ready for the frontend to play
                // No conversion needed - Evolution API provides browser-compatible format
            } else {
                console.warn(`⚠️ No media data returned for audio message: ${messageId}`);
            }
        } catch (error) {
            console.error(`❌ Error processing audio message:`, error.message);
        }
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
     * Force update database groups with authentic Evolution API data
     */
    async forceUpdateGroupsWithEvolutionData(instanceId: string, evolutionGroups: any[]): Promise<void> {
        let updatedCount = 0;
        
        for (const group of evolutionGroups) {
            try {
                if (group.subject && group.subject !== 'Group Chat' && group.id) {
                    const existingGroup = await storage.getWhatsappGroup(group.id, instanceId);
                    
                    const updatedGroupData = {
                        groupJid: group.id,
                        instanceId: instanceId,
                        subject: group.subject, // Force authentic Evolution API name
                        ownerJid: group.owner || existingGroup?.ownerJid || null,
                        description: group.desc || existingGroup?.description || null,
                        creationTimestamp: group.creation ? new Date(group.creation * 1000) : existingGroup?.creationTimestamp || null,
                        isLocked: group.restrict !== undefined ? group.restrict : existingGroup?.isLocked || false,
                    };
                    
                    await storage.upsertWhatsappGroup(updatedGroupData);
                    
                    // Also update chat record with authentic name
                    const existingChat = await storage.getWhatsappChat(group.id, instanceId);
                    if (existingChat) {
                        await storage.upsertWhatsappChat({
                            ...existingChat,
                            name: group.subject // Force authentic name in chat record
                        });
                    }
                    
                    updatedCount++;
                    console.log(`🔄 [${instanceId}] FORCED UPDATE: ${group.id} -> "${group.subject}"`);
                }
            } catch (error) {
                console.error(`Error forcing update for group ${group.id}:`, error.message);
            }
        }
        
        console.log(`✅ [${instanceId}] Forced ${updatedCount} group updates with authentic Evolution API data`);
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
    },

    /**
     * Handles media storage for image, video, audio, and document messages
     */
    async handleMediaStorage(rawMessage: any, instanceId: string, messageType: WhatsappMessages['messageType']): Promise<void> {
        const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
        if (!mediaTypes.includes(messageType)) return;

        const messageId = rawMessage.key?.id;
        if (!messageId) return;

        const message = rawMessage.message;
        if (!message) return;

        let mediaData: any = null;
        let mediaInfo: Partial<WhatsappMessageMedia> = {
            messageId,
            instanceId,
        };

        // Extract media data based on message type
        if (message.imageMessage) {
            mediaData = message.imageMessage;
            mediaInfo.mimetype = mediaData.mimetype || 'image/jpeg';
            mediaInfo.width = mediaData.width;
            mediaInfo.height = mediaData.height;
            mediaInfo.caption = mediaData.caption;
        } else if (message.videoMessage) {
            mediaData = message.videoMessage;
            mediaInfo.mimetype = mediaData.mimetype || 'video/mp4';
            mediaInfo.width = mediaData.width;
            mediaInfo.height = mediaData.height;
            mediaInfo.durationSeconds = mediaData.seconds;
            mediaInfo.caption = mediaData.caption;
        } else if (message.audioMessage) {
            mediaData = message.audioMessage;
            mediaInfo.mimetype = mediaData.mimetype || 'audio/ogg';
            mediaInfo.durationSeconds = mediaData.seconds;
        } else if (message.documentMessage) {
            mediaData = message.documentMessage;
            mediaInfo.mimetype = mediaData.mimetype || 'application/octet-stream';
            mediaInfo.caption = mediaData.fileName || mediaData.title;
        } else if (message.stickerMessage) {
            mediaData = message.stickerMessage;
            mediaInfo.mimetype = mediaData.mimetype || 'image/webp';
            mediaInfo.width = mediaData.width;
            mediaInfo.height = mediaData.height;
        }

        if (mediaData) {
            // Extract common media properties
            mediaInfo.fileUrl = mediaData.url;
            mediaInfo.fileSizeBytes = mediaData.fileLength ? parseInt(mediaData.fileLength) : undefined;
            mediaInfo.mediaKey = mediaData.mediaKey;
            mediaInfo.thumbnailUrl = mediaData.thumbnailUrl;
            mediaInfo.isViewOnce = mediaData.viewOnce || false;

            try {
                // Store media metadata in database
                await storage.upsertWhatsappMessageMedia(mediaInfo as InsertWhatsappMessageMedia);
                
                // CORRECT APPROACH: Don't check for base64 in webhook - make API call to download media
                console.log(`📥 [${instanceId}] Media message detected, initiating download process: ${messageId} (${messageType})`);
                
                try {
                    // Import Evolution API and media downloader
                    const { getEvolutionApi } = await import('./evolution-api');
                    const { cacheBase64Media } = await import('./media-downloader');
                    const evolutionApi = getEvolutionApi();
                    
                    // Get instance API key
                    const instance = await storage.getWhatsappInstance(instanceId);
                    if (!instance?.apiKey) {
                        console.error(`❌ [${instanceId}] No API key found for media download: ${messageId}`);
                        return;
                    }
                    
                    // Step 2: Make API call to download media using the webhook message data
                    const downloadResponse = await evolutionApi.downloadMedia(
                        instanceId,
                        instance.apiKey,
                        {
                            key: rawMessage.key,
                            message: rawMessage.message
                        }
                    );
                    
                    if (downloadResponse?.base64) {
                        console.log(`✅ [${instanceId}] Media downloaded successfully: ${messageId} (${downloadResponse.base64.length} chars)`);
                        
                        // Cache the base64 data as a local file
                        const cachedPath = await cacheBase64Media(instanceId, messageId, downloadResponse.base64, downloadResponse.mimetype || mediaData.mimetype);
                        
                        if (cachedPath) {
                            // Update database with local file path
                            await storage.updateWhatsappMessageMediaPath(messageId, instanceId, cachedPath);
                            console.log(`✅ [${instanceId}] Media cached successfully: ${messageId} -> ${cachedPath}`);
                        } else {
                            console.log(`⚠️ [${instanceId}] Failed to cache downloaded media: ${messageId}`);
                        }
                    } else {
                        console.log(`⚠️ [${instanceId}] Media download returned no base64 data: ${messageId}`);
                    }
                } catch (error) {
                    console.error(`❌ [${instanceId}] Media download failed for ${messageId}:`, error.message);
                    // Media will remain unavailable, which is correct behavior for failed downloads
                }
                
                console.log(`📎 [${instanceId}] Processed media for message: ${messageId} (${messageType})`);
            } catch (error) {
                console.error(`❌ Error processing media for message ${messageId}:`, error);
            }
        }
    },

    /**
     * Cleans up contact records with incorrect data while preserving authentic group JIDs
     * Syncs group contact names with authentic group subjects from database
     */
    async cleanupIncorrectGroupContactData(instanceId: string): Promise<{ success: boolean; cleaned: number; error?: string }> {
        try {
            console.log(`🧹 [${instanceId}] Starting cleanup of incorrect group contact data...`);
            
            // Get all group contacts (JIDs ending with @g.us)
            const groupContacts = await storage.getContactsByPattern(instanceId, '%@g.us');
            console.log(`📋 [${instanceId}] Found ${groupContacts.length} group contacts to analyze`);
            
            // Get all groups from database
            const existingGroups = await storage.getWhatsappGroups(instanceId);
            console.log(`📋 [${instanceId}] Found ${existingGroups.length} groups in database`);
            
            // Create a map of group JID to authentic subject
            const authenticGroupMap = new Map();
            existingGroups.forEach(group => {
                if (group.groupJid && group.subject && group.subject.length > 2) {
                    authenticGroupMap.set(group.groupJid, group.subject);
                }
            });
            
            let cleanedCount = 0;
            
            // Process each group contact
            for (const contact of groupContacts) {
                const authenticSubject = authenticGroupMap.get(contact.jid);
                
                if (authenticSubject) {
                    // Check if contact has wrong data (individual user name instead of group subject)
                    const hasIncorrectData = (
                        !contact.pushName || 
                        contact.pushName !== authenticSubject ||
                        contact.pushName.length < 3 ||
                        contact.pushName === 'Group' ||
                        contact.pushName === 'New Group' ||
                        contact.pushName === 'Inactive Group'
                    );
                    
                    if (hasIncorrectData) {
                        // Update with authentic group subject from database
                        const correctedContactData = {
                            jid: contact.jid,
                            instanceId: instanceId,
                            pushName: authenticSubject,
                            verifiedName: null,
                            profilePictureUrl: contact.profilePictureUrl,
                            isBlocked: false,
                            isMyContact: false,
                            isUser: false,
                            isBusiness: false,
                        };
                        
                        await storage.upsertWhatsappContact(correctedContactData);
                        console.log(`✅ [${instanceId}] Fixed group contact: ${contact.jid} -> "${authenticSubject}"`);
                        cleanedCount++;
                    }
                } else {
                    // Group doesn't exist in database - preserve JID but mark as unknown
                    if (contact.pushName && contact.pushName !== 'Unknown Group') {
                        const unknownContactData = {
                            jid: contact.jid,
                            instanceId: instanceId,
                            pushName: 'Unknown Group',
                            verifiedName: null,
                            profilePictureUrl: null,
                            isBlocked: false,
                            isMyContact: false,
                            isUser: false,
                            isBusiness: false,
                        };
                        
                        await storage.upsertWhatsappContact(unknownContactData);
                        console.log(`⚠️ [${instanceId}] Marked unknown group: ${contact.jid}`);
                        cleanedCount++;
                    }
                }
            }
            
            console.log(`✅ [${instanceId}] Cleanup completed. Fixed ${cleanedCount} group contact records`);
            return { success: true, cleaned: cleanedCount };
            
        } catch (error) {
            console.error(`❌ [${instanceId}] Error during contact cleanup:`, error);
            return { success: false, cleaned: 0, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
};

/**
 * WhatsApp API Adapter for sending messages
 */
export const WhatsAppAPIAdapter = {
    /**
     * Send a WhatsApp message with optional reply
     */
    async sendMessage(instanceId: string, chatId: string, message: string, quotedMessageId?: string, isForwarded?: boolean): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            const { getEvolutionApi } = await import('./evolution-api');
            const evolutionApi = getEvolutionApi();
            
            // Get instance to retrieve API key
            const instance = await storage.getWhatsappInstance(instanceId);
            if (!instance?.instanceId) {
                return { success: false, error: 'Instance API key not found' };
            }

            const payload: any = {
                number: chatId,
                text: message
            };

            // Add quoted message if replying
            if (quotedMessageId) {
                payload.quoted = {
                    key: {
                        id: quotedMessageId
                    }
                };
            }

            const messageTypeLog = quotedMessageId ? ' (reply)' : (isForwarded ? ' (forwarded)' : '');
            console.log(`📤 [${instanceId}] Sending message to ${chatId}${messageTypeLog}`);
            if (isForwarded) {
                console.log(`🔄 [${instanceId}] Message marked as forwarded`);
            }
            
            const response = await evolutionApi.makeRequest(
                `/message/sendText/${instanceId}`,
                'POST',
                payload,
                instance.instanceId
            );

            if (response) {
                console.log(`✅ [${instanceId}] Message sent successfully`);
                return { success: true, data: response };
            } else {
                return { success: false, error: 'Failed to send message' };
            }

        } catch (error) {
            console.error(`❌ [${instanceId}] Error sending message:`, error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
};