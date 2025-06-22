import { Request, Response } from 'express';
import { storage } from './storage'; // Your database access layer
import { SseManager } from './sse-manager'; // Your real-time notification manager
import { ActionService } from './action-service'; // Your business logic engine
import {
    type WhatsappMessages,
    type WhatsappContacts,
    type WhatsappChats,
    type WhatsappGroups,
    type WhatsappCallLogs
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
            case 'group.participants.update': // NEW: Handle participant changes
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
     * Handles new messages with a robust, sequential process to prevent race conditions.
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
    
    /**
     * Handles message status updates (sent, delivered, read).
     */
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

    /**
     * Handles contact creation and updates.
     */
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
     * Handles chat creation and updates.
     */
    async handleChatsUpsert(instanceId: string, data: any): Promise<void> {
        const chats = Array.isArray(data.chats) ? data.chats : Array.isArray(data) ? data : [data];
        if (!chats || chats.length === 0) return;
        
        for (const rawChat of chats) {
            const cleanChat = this.mapApiPayloadToWhatsappChat(rawChat, instanceId);
            if (cleanChat) {
                await storage.upsertWhatsappChat(cleanChat);
                console.log(`✅ [${instanceId}] Chat upserted: ${cleanChat.chatId}`);
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
     * NEW: Handles changes in group participants (add, remove, promote, demote).
     */
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
                        isAdmin: false, // Default to non-admin
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
    
    /**
     * Handles incoming call events.
     */
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

    /**
     * Guarantees that the contact, chat, AND group (if applicable) records exist
     * before a message is inserted. This prevents all foreign key violations.
     */
    async ensureDependenciesForMessage(cleanMessage: WhatsappMessages, rawMessage: any): Promise<void> {
        const senderContact = await this.mapApiPayloadToWhatsappContact({
            id: cleanMessage.senderJid,
            pushName: rawMessage.pushName
        }, cleanMessage.instanceId);
        if (senderContact) await storage.upsertWhatsappContact(senderContact);

        const isGroup = cleanMessage.chatId.endsWith('@g.us');
        
        const chatContact = await this.mapApiPayloadToWhatsappContact({ id: cleanMessage.chatId }, cleanMessage.instanceId);
        if (chatContact) await storage.upsertWhatsappContact(chatContact);

        const chatData = this.mapApiPayloadToWhatsappChat({ id: cleanMessage.chatId, name: rawMessage.pushName }, cleanMessage.instanceId);
        if (chatData) await storage.upsertWhatsappChat(chatData);

        if (isGroup) {
            const groupData = {
                groupJid: cleanMessage.chatId,
                instanceId: cleanMessage.instanceId,
                subject: rawMessage.pushName || 'Group',
                ownerJid: null,
                description: null,
                creationTimestamp: null,
                isLocked: false,
            };
            await storage.upsertWhatsappGroup(groupData);
        }
    },

    // --- Data Mapping Functions ---

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
    }
};