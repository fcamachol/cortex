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
                        chatId: rawMessage.key.remoteJid,
                        senderJid: rawMessage.key.participant || rawMessage.key.remoteJid,
                        reactionEmoji: rawMessage.message.reactionMessage.text,
                        timestamp: new Date(rawMessage.messageTimestamp * 1000),
                        fromMe: rawMessage.key.fromMe || false
                    };
                    
                    console.log(`🎭 [${instanceId}] Processing reaction: ${reactionData.reactionEmoji} on message ${reactionData.messageId}`);
                    
                    // Create contact if needed for reaction sender
                    const senderContactData = {
                        jid: reactionData.senderJid,
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
                if (!cleanMessage) continue;

                await this.ensureDependenciesForMessage(cleanMessage, rawMessage);
                
                const storedMessage = await storage.upsertWhatsappMessage(cleanMessage);
                console.log(`✅ [${instanceId}] Message stored: ${storedMessage.message_id}`);
                
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
     * Handles chat creation and updates.
     */
    async handleChatsUpsert(instanceId: string, data: any): Promise<void> {
        const chats = Array.isArray(data.chats) ? data.chats : Array.isArray(data) ? data : [data];
        if (!chats || chats.length === 0) return;
        
        for (const rawChat of chats) {
            const cleanChat = this.mapApiPayloadToWhatsappChat(rawChat, instanceId);
            if (cleanChat) {
                await storage.upsertWhatsappChat(cleanChat);
                console.log(`✅ [${instanceId}] Chat upserted: ${cleanChat.chat_id}`);
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
                console.log(`✅ [${instanceId}] Group upserted: ${cleanGroup.group_jid}`);
            }
        }
    },

    /**
     * Guarantees that the contact and chat related to a message exist in the DB.
     */
    async ensureDependenciesForMessage(cleanMessage: WhatsappMessages, rawMessage: any): Promise<void> {
        // Create contact for message sender using proper field structure
        const senderContactData = {
            jid: cleanMessage.sender_jid,
            instanceId: cleanMessage.instance_id,
            pushName: rawMessage.pushName || null,
            verifiedName: null,
            profilePictureUrl: null,
            isBusiness: false,
            isMe: cleanMessage.from_me,
            isBlocked: false,
            firstSeenAt: new Date(),
            lastUpdatedAt: new Date()
        };
        
        try {
            await storage.upsertWhatsappContact(senderContactData);
            console.log(`✅ [${cleanMessage.instance_id}] Auto-created contact: ${cleanMessage.sender_jid}`);
        } catch (error) {
            console.error(`❌ [${cleanMessage.instance_id}] Error creating contact:`, error);
        }

        // Create chat if it doesn't exist
        if (cleanMessage.chat_id) {
            const chatData = this.mapApiPayloadToWhatsappChat({ id: cleanMessage.chat_id }, cleanMessage.instance_id);
            if (chatData && chatData.chat_id) {
                try {
                    await storage.upsertWhatsappChat(chatData);
                    console.log(`✅ [${cleanMessage.instance_id}] Auto-created chat: ${cleanMessage.chat_id}`);
                } catch (error) {
                    console.error(`❌ [${cleanMessage.instance_id}] Error creating chat:`, error);
                }
            }
        }
    },
    


    // --- Data Mapping Functions ---

    async mapApiPayloadToWhatsappMessage(rawMessage: any, instanceId: string): Promise<Omit<WhatsappMessages, 'created_at'> | null> {
        if (!rawMessage.key?.id || !rawMessage.key?.remoteJid) {
            console.warn(`Missing required fields - id: ${rawMessage.key?.id}, remoteJid: ${rawMessage.key?.remoteJid}`);
            return null;
        }
        const timestamp = rawMessage.messageTimestamp;

        const getMessageType = (type?: string): WhatsappMessages['message_type'] => {
            const validTypes: WhatsappMessages['message_type'][] = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact_card', 'contact_card_multi', 'order', 'revoked', 'unsupported', 'reaction', 'call_log', 'edited_message'];
            if (type === 'conversation') return 'text';
            if (type === 'reactionMessage') return 'reaction';
            if (type && validTypes.includes(type as any)) return type as WhatsappMessages['message_type'];
            return 'unsupported';
        };

        return {
            message_id: rawMessage.key.id,
            instance_id: instanceId,
            chat_id: rawMessage.key.remoteJid,
            sender_jid: rawMessage.key.participant || rawMessage.key.remoteJid,
            from_me: rawMessage.key.fromMe || false,
            message_type: getMessageType(rawMessage.messageType),
            content: this.extractMessageContent(rawMessage),
            timestamp: timestamp && typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(),
            quoted_message_id: rawMessage.message?.extendedTextMessage?.contextInfo?.quotedMessage?.key?.id,
            is_forwarded: (rawMessage.message?.extendedTextMessage?.contextInfo?.forwardingScore || 0) > 0,
            forwarding_score: rawMessage.message?.extendedTextMessage?.contextInfo?.forwardingScore || 0,
            is_starred: rawMessage.starred || false,
            is_edited: rawMessage.messageType === 'editedMessage',
            last_edited_at: rawMessage.messageType === 'editedMessage' && timestamp && typeof timestamp === 'number'
                ? new Date(timestamp * 1000)
                : undefined,
            source_platform: rawMessage.source,
            raw_api_payload: rawMessage,
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
            instance_id: instanceId,
            push_name: rawContact.name || rawContact.pushName || rawContact.notify,
            verified_name: rawContact.verifiedName,
            profile_picture_url: rawContact.profilePicUrl || rawContact.profilePictureUrl,
            is_business: rawContact.isBusiness || false,
            is_me: instance?.owner_jid === jid,
            is_blocked: rawContact.isBlocked || false,
        };
    },
    
    mapApiPayloadToWhatsappChat(rawChat: any, instanceId: string): Omit<WhatsappChats, 'created_at' | 'updated_at'> | null {
        const chatId = rawChat.id || rawChat.remoteJid;
        if (!chatId) return null;
        
        return {
            chat_id: chatId,
            instance_id: instanceId,
            type: chatId.endsWith('@g.us') ? 'group' : 'individual',
            unread_count: rawChat.unreadCount || 0,
            is_archived: rawChat.archived || false,
            is_pinned: rawChat.pinned ? true : false,
            is_muted: rawChat.muteEndTime ? new Date(rawChat.muteEndTime * 1000) > new Date() : false,
            mute_end_timestamp: rawChat.muteEndTime ? new Date(rawChat.muteEndTime * 1000) : undefined,
            last_message_timestamp: rawChat.conversationTimestamp ? new Date(rawChat.conversationTimestamp * 1000) : undefined,
        };
    },

    mapApiPayloadToWhatsappGroup(rawGroup: any, instanceId: string): Omit<WhatsappGroups, 'updated_at'> | null {
        if (!rawGroup.id) return null;
        return {
            group_jid: rawGroup.id,
            instance_id: instanceId,
            subject: rawGroup.subject,
            owner_jid: rawGroup.owner,
            description: rawGroup.desc,
            creation_timestamp: rawGroup.creation ? new Date(rawGroup.creation * 1000) : undefined,
            is_locked: rawGroup.announce || false,
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
        
        return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '[Media]';
    }
};