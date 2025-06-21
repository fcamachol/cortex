import { ActionService } from './action-service';
import { storage } from './storage';
import { SseManager } from './sse-manager';
import { 
    type WhatsappMessages,
    type WhatsappContacts,
    type WhatsappChats,
    type InsertWhatsappMessage,
    type InsertWhatsappContact,
    type InsertWhatsappChat,
    type InsertWhatsappMessageReaction
} from '@shared/schema';

/**
 * @class WhatsAppApiAdapter
 * @description The "Translator" layer. Its only job is to take raw API payloads,
 * map them into clean internal data objects, and then command the storage layer
 * in the correct order to prevent data integrity errors.
 */
export const WhatsAppApiAdapter = {

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
                console.log(`📝 Translating message update...`);
                break;
            case 'messages.reaction':
                const reactions = Array.isArray(data.reactions) ? data.reactions : [data];
                for (const rawReaction of reactions) {
                    const cleanReaction = this.mapApiPayloadToWhatsappReaction(rawReaction, instanceId);
                    if (cleanReaction) {
                        ActionService.processReaction(cleanReaction);
                    }
                }
                break;
            case 'contacts.upsert':
            case 'contacts.update':
                const contacts = Array.isArray(data.contacts) ? data.contacts : Array.isArray(data) ? data : [data];
                for (const rawContact of contacts) {
                    const cleanContact = this.mapApiPayloadToWhatsappContact(rawContact, instanceId);
                    if(cleanContact) {
                        storage.upsertWhatsappContact(cleanContact).catch(err => 
                            console.error('Contact upsert error:', err)
                        );
                    }
                }
                break;
            case 'chats.upsert':
            case 'chats.update':
                const chats = Array.isArray(data) ? data : data.chats;
                if (!Array.isArray(chats)) break;
                for (const rawChat of chats) {
                    const cleanChat = this.mapApiPayloadToWhatsappChat(rawChat, instanceId);
                    if(cleanChat) {
                        storage.upsertWhatsappChat(cleanChat).catch(err => 
                            console.error('Chat upsert error:', err)
                        );
                    }
                }
                break;
            default:
                console.log(`⚠️ Unhandled event type in adapter: ${eventType}`);
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
                // 1. Map the raw payload to our clean internal object
                const cleanMessage = this.mapApiPayloadToWhatsappMessage(rawMessage, instanceId);
                if (!cleanMessage) continue;

                // 2. Proactively ensure dependencies exist before saving the message.
                // This is the key to preventing foreign key constraint errors.
                await this.ensureDependenciesForMessage(cleanMessage, rawMessage);
                
                // 3. Now it's safe to save the message itself.
                const storedMessage = await storage.upsertWhatsappMessage(cleanMessage);
                console.log(`✅ [${instanceId}] Message stored: ${storedMessage.messageId}`);
                
                // 4. Notify frontend clients and process actions.
                SseManager.notifyClientsOfNewMessage(storedMessage);
                ActionService.processNewMessage(storedMessage);

            } catch (error) {
                console.error(`❌ Error processing message upsert for ${rawMessage.key?.id}:`, error);
            }
        }
    },

    /**
     * Guarantees that the contact and chat related to a message exist in the DB.
     * This is called BEFORE attempting to insert the message.
     */
    async ensureDependenciesForMessage(cleanMessage: InsertWhatsappMessage, rawMessage: any): Promise<void> {
        // A. Ensure the SENDER contact record exists.
        const senderContact = this.mapApiPayloadToWhatsappContact({
            id: cleanMessage.senderJid,
            pushName: rawMessage.pushName
        }, cleanMessage.instanceId);
        if (senderContact) await storage.upsertWhatsappContact(senderContact);

        // B. Ensure the CHAT contact record exists (for groups, this is different from the sender).
        if (cleanMessage.chatId.endsWith('@g.us')) {
            const chatContact = this.mapApiPayloadToWhatsappContact({ id: cleanMessage.chatId }, cleanMessage.instanceId);
            if (chatContact) await storage.upsertWhatsappContact(chatContact);
        }

        // C. Ensure the CHAT metadata record exists.
        const chatData = this.mapApiPayloadToWhatsappChat({ id: cleanMessage.chatId }, cleanMessage.instanceId);
        if (chatData) await storage.upsertWhatsappChat(chatData);
    },
    


    // --- Data Mapping Functions ---

    mapApiPayloadToWhatsappMessage(rawMessage: any, instanceId: string): InsertWhatsappMessage | null {
        if (!rawMessage.key?.id || !rawMessage.key?.remoteJid) return null;
        const timestamp = rawMessage.messageTimestamp;

        const getMessageType = (type?: string): InsertWhatsappMessage['messageType'] => {
            const validTypes = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact_card', 'contact_card_multi', 'order', 'revoked', 'unsupported', 'reaction', 'call_log', 'edited_message'];
            if (type === 'conversation') return 'text';
            if (type && validTypes.includes(type)) return type as InsertWhatsappMessage['messageType'];
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

    mapApiPayloadToWhatsappContact(rawContact: any, instanceId: string): InsertWhatsappContact | null {
        const jid = rawContact.id || rawContact.remoteJid;
        if (!jid) return null;
        
        return {
            jid: jid,
            instanceId: instanceId,
            pushName: rawContact.name || rawContact.pushName || rawContact.notify,
            verifiedName: rawContact.verifiedName,
            profilePictureUrl: rawContact.profilePicUrl || rawContact.profilePictureUrl,
            isBusiness: rawContact.isBusiness || false,
            isMe: false,
            isBlocked: rawContact.isBlocked || false,
        };
    },
    
    mapApiPayloadToWhatsappChat(rawChat: any, instanceId: string): InsertWhatsappChat | null {
        const chatId = rawChat.id || rawChat.remoteJid;
        if (!chatId) return null;
        
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

    mapApiPayloadToWhatsappReaction(rawReaction: any, instanceId: string): InsertWhatsappMessageReaction | null {
        if (!rawReaction.key?.id || !rawReaction.reaction) return null;
        
        return {
            messageId: rawReaction.key.id,
            instanceId: instanceId,
            reactorJid: rawReaction.key.participant || rawReaction.key.remoteJid,
            reactionEmoji: rawReaction.reaction.text,
            timestamp: rawReaction.reaction.senderTimestampMs ? new Date(rawReaction.reaction.senderTimestampMs) : new Date(),
        };
    },

    extractMessageContent(message: any): string {
        const msg = message.message;
        if (!msg) return '';
        return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '';
    }
};
    }
};