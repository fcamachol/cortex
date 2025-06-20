import { Request, Response } from 'express';
import { storage } from './storage';
import { connectionQueue } from './db';

// Optimized webhook controller to prevent database connection overload
export const OptimizedWebhookController = {

    /**
     * Main entry point with improved connection management
     */
    async handleIncomingEvent(req: Request, res: Response) {
        try {
            const instanceName = req.params.instanceName;
            const eventPayload = req.body;
            
            // Respond immediately to prevent timeout
            res.status(200).json({ status: "received", instance: instanceName });
            
            // Queue the processing to prevent connection overload
            await connectionQueue.add(() => this.processEvolutionEvent(instanceName, eventPayload));
        } catch (error) {
            console.error('Critical error in webhook handler:', error);
        }
    },

    /**
     * Routes events with better error handling
     */
    async processEvolutionEvent(instanceId: string, event: any) {
        const { event: eventType, data } = event;
        console.log(`📨 Processing: ${eventType} for ${instanceId}`);

        try {
            switch (eventType) {
                case 'messages.upsert':
                    await this.handleMessageUpsert(instanceId, data);
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
                case 'connection.update':
                    await this.handleConnectionUpdate(instanceId, data);
                    break;
                default:
                    console.log(`Unhandled event: ${eventType}`);
            }
        } catch (error) {
            console.error(`Error processing ${eventType}:`, error);
        }
    },

    async handleMessageUpsert(instanceId: string, data: any) {
        // Handle both array and single message formats
        const messages = Array.isArray(data) ? data : (data.messages || [data]);
        if (!Array.isArray(messages)) return;

        for (const rawMessage of messages) {
            try {
                const messageForDb = this.mapApiPayloadToWhatsappMessage(rawMessage, instanceId);
                if (messageForDb) {
                    await storage.createWhatsappMessage(messageForDb);
                    console.log(`✅ Saved message: ${messageForDb.messageId}`);
                }
            } catch (error) {
                console.error('Message save error:', error);
            }
        }
    },

    async handleMessageUpdate(instanceId: string, data: any) {
        const updates = Array.isArray(data) ? data : (data.updates || []);
        if (!Array.isArray(updates)) return;

        for (const update of updates) {
            try {
                const messageId = update.key?.id;
                const status = update.status;
                if (messageId && status) {
                    await storage.updateWhatsappMessage('system', instanceId, messageId, {
                        // Map Evolution API status to database format
                        deliveryStatus: this.mapStatusToDeliveryStatus(status)
                    });
                    console.log(`✅ Updated message ${messageId} status: ${status}`);
                }
            } catch (error) {
                console.error('Message update error:', error);
            }
        }
    },

    async handleContactsUpsert(instanceId: string, data: any) {
        // Handle both array and single contact formats
        const contacts = Array.isArray(data) ? data : (data.contacts || [data]);
        if (!Array.isArray(contacts)) return;

        for (const rawContact of contacts) {
            try {
                const contactForDb = this.mapApiPayloadToWhatsappContact(rawContact, instanceId);
                if (contactForDb) {
                    await storage.createWhatsappContact(contactForDb);
                    console.log(`✅ Saved contact: ${contactForDb.jid}`);
                }
            } catch (error) {
                console.error('Contact save error:', error);
            }
        }
    },

    async handleChatsUpsert(instanceId: string, data: any) {
        // Handle both array and single chat formats
        const chats = Array.isArray(data) ? data : (data.chats || [data]);
        if (!Array.isArray(chats)) return;

        for (const rawChat of chats) {
            try {
                const chatForDb = this.mapApiPayloadToWhatsappChat(rawChat, instanceId);
                if (chatForDb) {
                    await storage.createWhatsappChat(chatForDb);
                    console.log(`✅ Saved chat: ${chatForDb.chatId}`);
                }
            } catch (error) {
                console.error('Chat save error:', error);
            }
        }
    },

    async handleConnectionUpdate(instanceId: string, data: any) {
        try {
            const isConnected = data.state === 'open';
            await storage.updateWhatsappInstance('system', instanceId, {
                isConnected,
                lastConnectionAt: isConnected ? new Date() : undefined
            });
            console.log(`✅ Updated ${instanceId} connection: ${data.state}`);
        } catch (error) {
            console.error('Connection update error:', error);
        }
    },

    // Data mapping functions
    mapApiPayloadToWhatsappMessage(rawMessage: any, instanceId: string): any | null {
        if (!rawMessage.key?.id || !rawMessage.key?.remoteJid) return null;

        return {
            messageId: rawMessage.key.id,
            instanceId: instanceId,
            chatId: rawMessage.key.remoteJid,
            senderJid: rawMessage.key.participant || rawMessage.key.remoteJid,
            fromMe: rawMessage.key.fromMe || false,
            messageType: this.mapMessageType(rawMessage.messageType),
            content: this.extractMessageContent(rawMessage),
            timestamp: new Date(rawMessage.messageTimestamp * 1000),
            quotedMessageId: rawMessage.message?.extendedTextMessage?.contextInfo?.quotedMessage?.key?.id,
            isForwarded: (rawMessage.message?.extendedTextMessage?.contextInfo?.forwardingScore || 0) > 0,
            forwardingScore: rawMessage.message?.extendedTextMessage?.contextInfo?.forwardingScore || 0,
            isStarred: rawMessage.starred || false,
            sourcePlatform: rawMessage.source,
            rawApiPayload: rawMessage
        };
    },

    mapApiPayloadToWhatsappContact(rawContact: any, instanceId: string): any | null {
        if (!rawContact.remoteJid) return null;

        return {
            jid: rawContact.remoteJid,
            instanceId: instanceId,
            pushName: rawContact.pushName,
            profilePictureUrl: rawContact.profilePicUrl,
            isBusiness: rawContact.isBusiness || false,
            isMe: rawContact.isMe || false,
            isBlocked: rawContact.isBlocked || false,
            lastUpdatedAt: new Date()
        };
    },

    mapApiPayloadToWhatsappChat(rawChat: any, instanceId: string): any | null {
        if (!rawChat.remoteJid) return null;

        return {
            chatId: rawChat.remoteJid,
            instanceId: instanceId,
            type: rawChat.remoteJid.includes('@g.us') ? 'group' : 'individual',
            unreadCount: rawChat.unreadMessages || 0,
            isArchived: rawChat.archived || false,
            isPinned: rawChat.pinned || false,
            isMuted: rawChat.muted || false,
            lastMessageTimestamp: rawChat.lastMessage?.messageTimestamp ? 
                new Date(rawChat.lastMessage.messageTimestamp * 1000) : null
        };
    },

    extractMessageContent(rawMessage: any): string {
        const message = rawMessage.message;
        if (!message) return '';

        // Handle different message types
        if (message.conversation) return message.conversation;
        if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
        if (message.imageMessage?.caption) return message.imageMessage.caption;
        if (message.videoMessage?.caption) return message.videoMessage.caption;
        if (message.documentMessage?.caption) return message.documentMessage.caption;
        
        return '';
    },

    mapMessageType(evolutionType: string): string {
        const typeMap: { [key: string]: string } = {
            'conversation': 'text',
            'extendedTextMessage': 'text',
            'imageMessage': 'image',
            'videoMessage': 'video',
            'audioMessage': 'audio',
            'documentMessage': 'document',
            'stickerMessage': 'sticker',
            'locationMessage': 'location',
            'contactMessage': 'contact',
            'reactionMessage': 'reaction'
        };
        
        return typeMap[evolutionType] || 'text';
    },

    mapStatusToDeliveryStatus(evolutionStatus: string): string {
        const statusMap: { [key: string]: string } = {
            'PENDING': 'pending',
            'SERVER_ACK': 'sent',
            'DELIVERY_ACK': 'delivered',
            'READ': 'read',
            'PLAYED': 'read'
        };
        
        return statusMap[evolutionStatus] || 'pending';
    }
};