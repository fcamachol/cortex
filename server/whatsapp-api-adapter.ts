import { Request, Response } from 'express';
import { storage } from './storage'; // Your database access layer
import { SseManager } from './sse-manager'; // Your real-time notification manager
import { ActionService } from './action-service'; // Your business logic engine
import {
    type WhatsappMessages,
    type WhatsappContacts,
    type WhatsappChats,
    type WhatsappGroups,
    type WhatsappMessageUpdates
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
                await this.handleMessageUpsert(instanceId, data, sender);
                break;
            case 'messages.update':
                await this.handleMessageUpdate(instanceId, data);
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
            default:
                console.log(`- Unhandled event type in adapter: ${eventType}`);
        }
    },

    /**
     * Handles new messages with a robust, sequential process to prevent race conditions.
     */
    async handleMessageUpsert(instanceId: string, data: any, sender?: string): Promise<void> {
        // Handle webhook payload structure based on your mapping
        let messages = [];
        
        // Check for direct message data structure from Evolution API
        if (data.key && data.messageType) {
            // Single message format - the data object itself contains the message
            messages = [data];
        } else if (data.messages && Array.isArray(data.messages)) {
            // Old format with messages array
            messages = data.messages;
        } else {
            console.warn(`[${instanceId}] No valid message structure found, skipping processing`);
            return;
        }

        if (!messages[0]?.key) {
            console.warn(`[${instanceId}] Message missing key field, skipping processing`);
            return;
        }

        console.log(`📨 [${instanceId}] Processing ${messages.length} message(s), type: ${messages[0].messageType}`);
        
        // Debug reaction messages
        if (messages[0].messageType === 'reactionMessage') {
            console.log(`🎭 [${instanceId}] Reaction message details:`, JSON.stringify(messages[0].message, null, 2));
        }

        for (const rawMessage of messages) {
            try {
                // Handle reaction messages specially
                if (rawMessage.messageType === 'reactionMessage' && rawMessage.message?.reactionMessage) {
                    const reactionData = {
                        messageId: rawMessage.message.reactionMessage.key?.id,
                        instanceId: instanceId,
                        reactorJid: rawMessage.key.participant || rawMessage.key.remoteJid,
                        reactionEmoji: rawMessage.message.reactionMessage.text,
                        timestamp: new Date(rawMessage.messageTimestamp * 1000),
                        fromMe: rawMessage.key.fromMe || false
                    };
                    
                    console.log(`🎭 [${instanceId}] Processing reaction: ${reactionData.reactionEmoji} on message ${reactionData.messageId}`);
                    
                    // Create contact if needed for reaction sender
                    const senderContactData = {
                        jid: reactionData.reactorJid,
                        instanceId: instanceId,
                        pushName: rawMessage.pushName || null,
                        verifiedName: null,
                        profilePictureUrl: null,
                        isBusiness: false,
                        isMe: reactionData.fromMe,
                        isBlocked: false,
                        firstSeenAt: new Date(),
                        lastUpdatedAt: new Date()
                    };
                    
                    try {
                        await storage.upsertWhatsappContact(senderContactData);
                    } catch (error) {
                        console.error(`❌ [${instanceId}] Error creating contact for reaction:`, error);
                    }
                    
                    // Process reaction through action service
                    ActionService.processReaction(reactionData);
                    return; // Skip regular message processing for reactions
                }

                // Regular message processing
                const cleanMessage = await this.mapApiPayloadToWhatsappMessage(rawMessage, instanceId);
                console.log(`🔍 [${instanceId}] Mapped message data:`, JSON.stringify(cleanMessage, null, 2));
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
    
    /**
     * Handles message status updates (sent, delivered, read).
     */
    async handleMessageUpdate(instanceId: string, data: any): Promise<void> {
        console.log('📝 Translating message update...');
        if (!data || !Array.isArray(data.updates)) return;
        for (const update of data.updates) {
             const messageId = update.key?.id;
             const status = this.mapMessageStatus(update.status);
             if(messageId && status) {
                 await storage.createWhatsappMessageUpdate({
                     message_id: messageId,
                     instance_id: instanceId,
                     status: status,
                     timestamp: new Date()
                 });
                 console.log(`✅ [${instanceId}] Logged message status update: ${messageId} to ${status}`);
             }
        }
    },

    /**
     * Handles contact creation and updates.
     */
    async handleContactsUpsert(instanceId: string, data: any): Promise<void> {
        const contacts = Array.isArray(data.contacts) ? data.contacts : Array.isArray(data) ? data : [data];
        if (!contacts || contacts.length === 0) return;

        for (const rawContact of contacts) {
            try {
                const cleanContact = await this.mapApiPayloadToWhatsappContact(rawContact, instanceId);
                if (cleanContact && cleanContact.jid) {
                    await storage.upsertWhatsappContact(cleanContact);
                    console.log(`✅ [${instanceId}] Contact upserted: ${cleanContact.jid}`);
                } else {
                    console.warn(`⚠️ [${instanceId}] Skipping contact with missing JID:`, rawContact);
                }
            } catch (error) {
                console.error(`❌ [${instanceId}] Error processing contact:`, error);
            }
        }
    },

    /**
     * Handles chat creation and updates with robust payload parsing.
     */
    async handleChatsUpsert(instanceId: string, data: any): Promise<void> {
        // Robustly find the array of chats from inconsistent API payloads
        let chats: any[] = [];
        if (Array.isArray(data)) {
            chats = data;
        } else if (data && Array.isArray(data.chats)) {
            chats = data.chats;
        } else if (data && (data.id || data.remoteJid)) {
            // Handle cases where a single chat object is sent directly
            chats = [data];
        }

        if (chats.length === 0) {
            console.warn(`[${instanceId}] No valid chats found in chats.upsert/update payload.`);
            return;
        }
        
        for (const rawChat of chats) {
            try {
                const cleanChat = this.mapApiPayloadToWhatsappChat(rawChat, instanceId);
                if (cleanChat && cleanChat.chatId) {
                    await storage.upsertWhatsappChat(cleanChat);
                    console.log(`✅ [${instanceId}] Chat upserted: ${cleanChat.chatId}`);
                } else {
                    console.warn(`⚠️ [${instanceId}] Skipping chat with missing or invalid ID:`, rawChat);
                }
            } catch (error) {
                console.error(`❌ [${instanceId}] Error processing chat:`, error);
            }
        }
    },

    /**
     * Handles group creation and updates.
     */
    async handleGroupsUpsert(instanceId: string, data: any[]): Promise<void> {
        if (!Array.isArray(data)) return;
        for (const rawGroup of data) {
            const cleanGroup = this.mapApiPayloadToWhatsappGroup(rawGroup, instanceId);
            if (cleanGroup) {
                await storage.upsertWhatsappGroup(cleanGroup);
                console.log(`✅ [${instanceId}] Group upserted: ${cleanGroup.groupJid}`);
            }
        }
    },

    /**
     * Guarantees that the contact and chat related to a message exist in the DB.
     */
    async ensureDependenciesForMessage(cleanMessage: WhatsappMessages, rawMessage: any): Promise<void> {
        // Create contact for message sender using proper field structure
        const senderContactData = {
            jid: cleanMessage.senderJid,
            instanceId: cleanMessage.instanceId,
            pushName: rawMessage.pushName || null,
            verifiedName: null,
            profilePictureUrl: null,
            isBusiness: false,
            isMe: cleanMessage.fromMe,
            isBlocked: false,
            firstSeenAt: new Date(),
            lastUpdatedAt: new Date()
        };
        
        try {
            await storage.upsertWhatsappContact(senderContactData);
            console.log(`✅ [${cleanMessage.instanceId}] Auto-created contact: ${cleanMessage.senderJid}`);
        } catch (error) {
            console.error(`❌ [${cleanMessage.instanceId}] Error creating contact:`, error);
        }

        // Create chat if it doesn't exist
        if (cleanMessage.chatId) {
            const chatData = this.mapApiPayloadToWhatsappChat({ id: cleanMessage.chatId }, cleanMessage.instanceId);
            if (chatData && chatData.chatId) {
                try {
                    const newChat = await storage.upsertWhatsappChat(chatData);
                    console.log(`✅ [${cleanMessage.instanceId}] Auto-created chat: ${cleanMessage.chatId}`);
                    
                    // Proactively create group placeholder if this is a group chat
                    if (newChat.type === 'group') {
                        try {
                            await storage.upsertWhatsappGroup({
                                groupJid: newChat.chatId,
                                instanceId: newChat.instanceId,
                                subject: 'New Group', // Temporary placeholder name
                                description: null,
                                ownerJid: null,
                                creationTimestamp: new Date(),
                                isLocked: false
                            });
                            console.log(`✅ [${cleanMessage.instanceId}] Auto-created group placeholder: ${newChat.chatId}`);
                        } catch (groupError) {
                            console.error(`❌ [${cleanMessage.instanceId}] Error creating group placeholder:`, groupError);
                        }
                    }
                } catch (error) {
                    console.error(`❌ [${cleanMessage.instanceId}] Error creating chat:`, error);
                }
            }
        }
    },
    


    // --- Data Mapping Functions ---

    async mapApiPayloadToWhatsappMessage(rawMessage: any, instanceId: string): Promise<Omit<WhatsappMessages, 'created_at'> | null> {
        console.log(`🔍 [${instanceId}] Raw message structure:`, JSON.stringify(rawMessage, null, 2));
        if (!rawMessage.key?.id || !rawMessage.key?.remoteJid) {
            console.warn(`Missing required fields - id: ${rawMessage.key?.id}, remoteJid: ${rawMessage.key?.remoteJid}`);
            return null;
        }
        const timestamp = rawMessage.messageTimestamp;

        const getMessageType = (type?: string): WhatsappMessages['message_type'] => {
            // Direct message type mappings
            if (type === 'conversation') return 'text';
            if (type === 'reactionMessage') return 'reaction';
            if (type === 'audioMessage') return 'audio';
            if (type === 'imageMessage') return 'image';
            if (type === 'videoMessage') return 'video';
            if (type === 'documentMessage') return 'document';
            if (type === 'stickerMessage') return 'sticker';
            if (type === 'locationMessage') return 'location';
            if (type === 'contactMessage') return 'contact_card';
            
            return 'unsupported';
        };

        // Determine the correct sender JID
        const getSenderJid = (): string => {
            // For group messages, participant field contains the actual sender
            if (rawMessage.key.participant) {
                return rawMessage.key.participant;
            }
            // For direct messages, use remoteJid
            return rawMessage.key.remoteJid;
        };

        return {
            messageId: rawMessage.key.id,
            instanceId: instanceId,
            chatId: rawMessage.key.remoteJid,
            senderJid: getSenderJid(),
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

    async mapApiPayloadToWhatsappContact(rawContact: any, instanceId: string): Promise<Omit<WhatsappContacts, 'first_seen_at' | 'last_updated_at'> | null> {
        const jid = rawContact.id || rawContact.remoteJid;
        if (!jid) {
            console.warn(`⚠️ [${instanceId}] Contact missing JID - id: ${rawContact.id}, remoteJid: ${rawContact.remoteJid}`);
            return null;
        }

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
            firstSeenAt: new Date(),
            lastUpdatedAt: new Date()
        };
    },
    
    mapApiPayloadToWhatsappChat(rawChat: any, instanceId: string): Omit<WhatsappChats, 'created_at' | 'updated_at'> | null {
        const chatId = rawChat.id || rawChat.remoteJid;
        // Add guard against empty or null chatIds
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

    mapApiPayloadToWhatsappGroup(rawGroup: any, instanceId: string): any | null {
        if (!rawGroup.id) return null;
        return {
            groupJid: rawGroup.id,
            instanceId: instanceId,
            subject: rawGroup.subject,
            ownerJid: rawGroup.owner,
            description: rawGroup.desc,
            creationTimestamp: rawGroup.creation ? new Date(rawGroup.creation * 1000) : new Date(),
            isLocked: rawGroup.locked || false,
        };
    },
    
    mapMessageStatus(apiStatus: string): WhatsappMessageUpdates['status'] | null {
        const statusMap: { [key: string]: WhatsappMessageUpdates['status'] } = {
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
        
        // Handle reaction messages
        if (msg.reactionMessage) {
            return `[Reaction: ${msg.reactionMessage.text}]`;
        }
        
        // Handle media messages with specific content
        if (msg.audioMessage) return '[Audio]';
        if (msg.imageMessage) return msg.imageMessage.caption || '[Image]';
        if (msg.videoMessage) return msg.videoMessage.caption || '[Video]';
        if (msg.documentMessage) return msg.documentMessage.title || '[Document]';
        if (msg.stickerMessage) return '[Sticker]';
        if (msg.locationMessage) return '[Location]';
        if (msg.contactMessage) return '[Contact]';
        
        return msg.conversation || msg.extendedTextMessage?.text || '[Media]';
    }
};