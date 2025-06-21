import { ActionService } from './action-service';
import { storage } from './storage';
import { 
    whatsappMessages,
    whatsappContacts, 
    whatsappChats,
    type InsertWhatsappMessage,
    type InsertWhatsappContact,
    type InsertWhatsappChat,
    type InsertWhatsappMessageReaction
} from '@shared/schema';

/**
 * @class WhatsAppApiAdapter
 * @description The "Translator" layer. Its only job is to take raw API payloads
 * and map them into the clean, consistent data objects that our application uses internally.
 * It then passes these clean objects to the ActionService or StorageLayer.
 */
export const WhatsAppApiAdapter = {

    async processIncomingEvent(instanceId: string, event: any): Promise<void> {
        const { event: eventType, data, sender } = event;
        console.log(`📨 [${instanceId}] Translating event: ${eventType}`);

        switch (eventType) {
            case 'messages.upsert':
                const messages = Array.isArray(data.messages) ? data.messages : [data];
                for (const rawMessage of messages) {
                    if (!rawMessage.key) continue;
                    // First ensure contact/chat exist to prevent foreign key errors
                    await this.ensureContactAndChatExist(rawMessage, instanceId);
                    const cleanMessage = this.mapApiPayloadToWhatsappMessage(rawMessage, instanceId);
                    if (cleanMessage) {
                        ActionService.processNewMessage(cleanMessage);
                    }
                }
                break;

            case 'messages.update':
                 // This logic would be expanded to handle status updates properly
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
                        storage.upsertWhatsappContact(cleanContact);
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
                        storage.upsertWhatsappChat(cleanChat);
                    }
                 }
                break;

            // Add other event handlers here...
            default:
                console.log(`⚠️ Unhandled event type in adapter: ${eventType}`);
        }
    },
    
    async ensureContactAndChatExist(rawMessage: any, instanceId: string) {
        const senderJid = rawMessage.key.participant || rawMessage.key.remoteJid;
        const chatId = rawMessage.key.remoteJid;
        if (!senderJid || !chatId) return;
        
        const senderContact = this.mapApiPayloadToWhatsappContact({ id: senderJid, pushName: rawMessage.pushName }, instanceId);
        if(senderContact) await storage.upsertWhatsappContact(senderContact);
        
        if (chatId.endsWith('@g.us') && chatId !== senderJid) {
             const groupContact = this.mapApiPayloadToWhatsappContact({ id: chatId }, instanceId);
             if(groupContact) await storage.upsertWhatsappContact(groupContact);
        }

        const chatData = this.mapApiPayloadToWhatsappChat({ id: chatId, name: rawMessage.pushName }, instanceId);
        if(chatData) await storage.upsertWhatsappChat(chatData);
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
        if (!rawReaction.messageId && !rawReaction.key?.id) return null;
        
        return {
            messageId: rawReaction.messageId || rawReaction.key?.id,
            instanceId: instanceId,
            reactorJid: rawReaction.reactorJid || rawReaction.key?.participant || rawReaction.key?.remoteJid,
            reactionEmoji: rawReaction.reaction || rawReaction.reactionEmoji || '',
            fromMe: rawReaction.fromMe || false,
            timestamp: rawReaction.timestamp ? new Date(rawReaction.timestamp * 1000) : new Date()
        };
    },
    
    extractMessageContent(message: any): string {
        const msg = message.message;
        if (!msg) return '';
        return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '';
    }
};