import { Request, Response } from 'express';
import { storage } from './storage'; // Your database access layer
import { SseManager } from './sse-manager'; // Your real-time notification manager
import { ActionService } from './action-service'; // Your business logic engine
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

        switch (eventType) {
            case 'messages.upsert':
                const potentialMessage = Array.isArray(data.messages) ? data.messages[0] : data;
                if (potentialMessage?.message?.reactionMessage) {
                    await this.handleReaction(instanceId, potentialMessage, sender);
                } else {
                    await this.handleMessageUpsert(instanceId, data);
                }
                break;
            case 'messages.update':
                if (data.updates && data.updates[0]?.message?.reactionMessage) {
                     await this.handleReaction(instanceId, data.updates[0], sender);
                } else {
                    await this.handleMessageUpdate(instanceId, data);
                }
                break;
            case 'contacts.upsert':
            case 'contacts.update':
                await this.handleContactsUpsert(instanceId, data);
                break;
            case 'chats.upsert':
            case 'chats.update':
                await this.handleChatsUpsert(instanceId, data);
                break;
            case 'groups.upsert':
            case 'groups.update':
                 await this.handleGroupsUpsert(instanceId, data);
                 break;
            case 'group.participants.update':
                 await this.handleGroupParticipantsUpdate(instanceId, data);
                 break;
            case 'call':
                await this.handleCall(instanceId, data);
                break;
            default:
                console.log(`- Unhandled event type in adapter: ${eventType}`);
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
            }
        }
    },

    /**
     * Handles chat creation and updates, now with proactive group creation.
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

                // If it's a group, ensure the group record exists
                if (cleanChat.type === 'group') {
                    const groupData = {
                        groupJid: cleanChat.chatId,
                        instanceId: instanceId,
                        // Always use placeholder for groups created via chat events
                        // Actual group subjects should come from dedicated group.upsert events
                        subject: 'New Group',
                        ownerJid: null,
                        description: null,
                        creationTimestamp: null,
                        isLocked: false,
                    };
                    await storage.upsertWhatsappGroup(groupData);
                }

                // Now it's safe to save the chat
                await storage.upsertWhatsappChat(cleanChat);
                console.log(`✅ [${instanceId}] Chat upserted: ${cleanChat.chatId}`);
            }
        }
    },

    async handleGroupsUpsert(instanceId: string, data: any[]): Promise<void> {
        if (!Array.isArray(data)) return;
        for (const rawGroup of data) {
            const cleanGroup = this.mapApiPayloadToWhatsappGroup(rawGroup, instanceId);
            if (cleanGroup) {
                await storage.upsertWhatsappGroup(cleanGroup);
                console.log(`✅ [${instanceId}] Group upserted with correct subject: ${cleanGroup.subject}`);
            }
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
            // ** FIX: Use a generic name for the placeholder, not the sender's pushName **
            const groupData = {
                groupJid: cleanMessage.chatId,
                instanceId: cleanMessage.instanceId,
                subject: 'New Group', // A safe placeholder
                ownerJid: null,
                description: null,
                creationTimestamp: null,
                isLocked: false,
            };
            await storage.upsertWhatsappGroup(groupData);
        }
    },

    // --- Data Mapping Functions ---

    mapApiPayloadToWhatsappReaction(rawReaction: any, instanceId: string, sender?: string): Omit<WhatsappMessageReactions, 'reactionId'> | null {
        const reactionMsg = rawReaction.message?.reactionMessage;
        if (!reactionMsg?.key?.id) return null;
        
        const reactorJid = rawReaction.key?.participant || sender || rawReaction.key?.remoteJid;
        
        // Comprehensive timestamp validation to prevent RangeError: Invalid time value
        let validTimestamp = new Date();
        const timestampMs = reactionMsg.senderTimestampMs;
        
        console.log(`🔍 Reaction timestamp debug - raw value: "${timestampMs}", type: ${typeof timestampMs}`);
        
        // Only process if it's actually a valid number
        if (typeof timestampMs === 'number' && 
            !isNaN(timestampMs) && 
            isFinite(timestampMs) && 
            timestampMs > 0 && 
            timestampMs < Number.MAX_SAFE_INTEGER) {
            try {
                const testDate = new Date(timestampMs);
                // Verify the date is valid and reasonable (not before 2000, not too far in future)
                const minDate = new Date('2000-01-01').getTime();
                const maxDate = new Date().getTime() + (365 * 24 * 60 * 60 * 1000); // 1 year from now
                
                if (!isNaN(testDate.getTime()) && 
                    testDate.getTime() >= minDate && 
                    testDate.getTime() <= maxDate) {
                    validTimestamp = testDate;
                    console.log(`✅ Using valid timestamp: ${validTimestamp.toISOString()}`);
                } else {
                    console.log(`⚠️ Timestamp out of reasonable range, using current time`);
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
    
    async mapApiPayloadToWhatsappMessage(rawMessage: any, instanceId: string): Promise<Omit<WhatsappMessages, 'createdAt'> | null> {
        if (!rawMessage.key?.id || !rawMessage.key?.remoteJid) return null;
        const timestamp = rawMessage.messageTimestamp;

        const getMessageType = (type?: string): WhatsappMessages['messageType'] => {
            const validTypes: WhatsappMessages['messageType'][] = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact_card', 'contact_card_multi', 'order', 'revoked', 'unsupported', 'reaction', 'call_log', 'edited_message'];
            if (type === 'conversation') return 'text';
            if (type && validTypes.includes(type as any)) return type as WhatsappMessages['messageType'];
            return 'unsupported';
        };

        return {
            messageId: rawMessage.key.id,
            instanceId: instanceId,
            chatId: rawMessage.key.remoteJid,
            senderJid: rawMessage.key.participant || rawMessage.key.remoteJid,
            fromMe: rawMessage.key.fromMe || false,
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
        
        return {
            jid: jid,
            instanceId: instanceId,
            pushName: rawContact.name || rawContact.pushName || rawContact.notify,
            verifiedName: rawContact.verifiedName,
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
        
        return {
            chatId: chatId,
            instanceId: instanceId,
            type: chatId.endsWith('@g.us') ? 'group' : 'individual',
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
     * Comprehensive group sync - fetches group info individually for each existing group
     */
    async syncAllGroupsFromApi(instanceId: string): Promise<{ success: boolean; count: number; error?: string }> {
        try {
            console.log(`🔄 [${instanceId}] Starting comprehensive group sync from Evolution API...`);
            
            // Get all existing groups from database
            const existingGroups = await storage.getWhatsappGroups(instanceId);
            console.log(`📋 Found ${existingGroups.length} groups in database to sync`);

            let syncedCount = 0;
            let updatedCount = 0;
            let errorCount = 0;

            for (const group of existingGroups) {
                try {
                    // Fetch individual group info from Evolution API
                    const response = await fetch(`${process.env.EVOLUTION_API_URL}/group/fetchGroupInfo/${instanceId}`, {
                        method: 'POST',
                        headers: {
                            'apikey': process.env.EVOLUTION_API_KEY!,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            groupJid: group.groupJid
                        })
                    });

                    if (response.ok) {
                        const apiGroupInfo = await response.json();
                        
                        // Update group with real API data
                        const updatedGroupData = {
                            groupJid: group.groupJid,
                            instanceId: instanceId,
                            subject: apiGroupInfo.subject || group.subject,
                            ownerJid: apiGroupInfo.owner || group.ownerJid,
                            description: apiGroupInfo.desc || group.description,
                            creationTimestamp: apiGroupInfo.creation ? new Date(apiGroupInfo.creation * 1000) : group.creationTimestamp,
                            isLocked: apiGroupInfo.announce !== undefined ? apiGroupInfo.announce : group.isLocked,
                        };

                        await storage.upsertWhatsappGroup(updatedGroupData);
                        
                        // Also update the contact record
                        const contactData = {
                            jid: group.groupJid,
                            instanceId: instanceId,
                            pushName: apiGroupInfo.subject || group.subject,
                            verifiedName: null,
                            profilePictureUrl: null,
                            isBlocked: false,
                            isMyContact: false,
                            isUser: false,
                            isBusiness: false,
                        };
                        await storage.upsertWhatsappContact(contactData);
                        
                        console.log(`✅ Updated group: ${group.groupJid} -> "${apiGroupInfo.subject}"`);
                        updatedCount++;
                    } else {
                        console.log(`⚠️ Could not fetch info for group: ${group.groupJid} (${response.status})`);
                        errorCount++;
                    }
                    
                    syncedCount++;
                } catch (groupError) {
                    console.error(`❌ Error syncing group ${group.groupJid}:`, groupError.message);
                    errorCount++;
                }
            }

            console.log(`✅ [${instanceId}] Group sync complete: ${updatedCount} updated, ${errorCount} errors, ${syncedCount} total processed`);
            return { 
                success: true, 
                count: updatedCount,
                details: { updated: updatedCount, errors: errorCount, total: syncedCount }
            };

        } catch (error) {
            console.error(`❌ [${instanceId}] Error during comprehensive group sync:`, error);
            return { success: false, count: 0, error: error.message };
        }
    }
};