import { Request, Response } from 'express';
import { storage } from './storage';
import * as chrono from 'chrono-node'; // NLP date parsing library
// Import the final table types for clarity and type safety
import {
    type WhatsappMessages,
    type WhatsappContacts,
    type WhatsappChats
} from '@shared/schema';

// =============================================================================
// MOCK EXTERNAL API (Placeholder for Google Calendar Integration)
// =============================================================================
const googleCalendarApi = {
    async createEvent({ title, startTime, endTime, attendees }: { title: string, startTime: Date, endTime: Date, attendees: string[] }) {
        console.log(`📅 Mock Google API: Creating event "${title}" for attendees: ${attendees.join(', ')}`);
        // In a real app, this would use the Google Calendar API to create an event
        // and would return the actual event details.
        return {
            success: true,
            htmlLink: `https://meet.google.com/new`, // Returns a generic link for simulation
            googleEventId: `mock_event_${Date.now()}`
        };
    }
};

// Store Server-Sent Events connections
const sseConnections = new Map<string, Response>();

function notifyClientsOfNewMessage(messageRecord: any) {
  console.log(`📡 Notifying ${sseConnections.size} connected clients of new message`);
  
  const messageData = JSON.stringify({
    type: 'new_message',
    message: messageRecord
  });

  // Send to all connected SSE clients
  for (const [clientId, res] of sseConnections) {
    try {
      res.write(`data: ${messageData}\n\n`);
      console.log(`📡 Sent message notification to client ${clientId}`);
    } catch (error) {
      console.error(`📡 Error sending to client ${clientId}:`, error);
      // Remove broken connection
      sseConnections.delete(clientId);
    }
  }
}

// =============================================================================
// WEBHOOK CONTROLLER LOGIC
// This object encapsulates all the logic for processing incoming webhooks.
// =============================================================================

export const WebhookController = {

    // ... (handleIncomingEvent remains the same)
    
    /**
     * The main entry point for all incoming webhooks from the Evolution API.
     */
    async handleIncomingEvent(req: Request, res: Response) {
        try {
            const instanceName = req.params.instanceName;
            const eventPayload = req.body;
            res.status(200).json({ status: "received", instance: instanceName });
            this.processEvolutionEvent(instanceName, eventPayload);
        } catch (error) {
            console.error('❌ Critical error in webhook handler:', error);
        }
    },
    
    /**
     * NEW: Processes the bulk data from an initial API sync.
     * This should be called from your REST API route that fetches initial data.
     */
    async processInitialChatSync(instanceId: string, chats: any[]) {
        console.log(`🔄 Processing ${chats.length} conversations from initial sync for instance ${instanceId}`);
        for (const rawChat of chats) {
            try {
                const chatForDb = this.mapApiPayloadToWhatsappChat(rawChat, instanceId);
                if (chatForDb) {
                    await storage.upsertWhatsappChat(chatForDb);
                    console.log(`✅ [${instanceId}] Synced chat: ${chatForDb.chat_id}`);
                }
            } catch (error) {
                console.error(`❌ Error syncing chat ${rawChat.id}:`, error);
            }
        }
    },

    /**
     * Routes the event to the appropriate handler based on its type.
     */
    async processEvolutionEvent(instanceId: string, event: any) {
        const { event: eventType, data, sender } = event; // `sender` is the reactor in reaction updates
        console.log(`📨 Webhook Event Received: ${eventType} for instance ${instanceId}`);

        switch (eventType) {
            case 'messages.upsert':
                // Check for reactions first
                if (data.messages && data.messages[0]?.message?.reactionMessage) {
                    await this.handleReaction(instanceId, data.messages[0], sender);
                } else if (Array.isArray(data) && data[0]?.message?.reactionMessage) {
                    await this.handleReaction(instanceId, data[0], sender);
                } else {
                    await this.handleMessageUpsert(instanceId, data);
                }
                break;
            case 'messages.update':
                 // This might contain reactions or status updates
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
            case 'connection.update':
                await this.handleConnectionUpdate(instanceId, data);
                break;
            default:
                console.log(`- Unhandled event type: ${eventType}`);
        }
    },

    /**
     * Handles incoming messages from the webhook.
     */
    async handleMessageUpsert(instanceId: string, data: any) {
        console.log(`📝 Processing message upsert for instance ${instanceId}`);
        
        try {
            const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
            const instances = await storage.getWhatsappInstances(userId);
            const instance = instances.find(inst => inst.instanceId === instanceId);
            if (!instance) {
                console.error(`❌ Instance ${instanceId} not found`);
                return;
            }

            // Handle message array from Evolution API webhook
            let messages = [];
            if (Array.isArray(data)) {
                messages = data;
            } else if (data.data && Array.isArray(data.data)) {
                messages = data.data;
            } else if (data.key) {
                messages = [data];
            } else {
                console.log('⚠️ No valid message data found in webhook payload');
                return;
            }

            // Process each message in the array
            for (const messageData of messages) {

            const key = messageData.key;
            const message = messageData.message;

            if (!key || !key.id) {
                console.log('⚠️ Skipping message without valid key structure');
                return;
            }

            // Extract message content based on message type
            let content = '';
            let messageType = 'text';

            if (message.conversation) {
                content = message.conversation;
                messageType = 'text';
            } else if (message.extendedTextMessage?.text) {
                content = message.extendedTextMessage.text;
                messageType = 'text';
            } else if (message.imageMessage?.caption) {
                content = message.imageMessage.caption || '[Image]';
                messageType = 'image';
            } else if (message.documentMessage?.caption) {
                content = message.documentMessage.caption || '[Document]';
                messageType = 'document';
            } else {
                content = '[Unsupported message type]';
                messageType = 'unknown';
            }

            const messageId = key.id;
            const chatId = key.remoteJid;
            const senderJid = key.fromMe ? instance.instanceId : (key.participant || key.remoteJid);
            const timestamp = new Date(messageData.messageTimestamp * 1000);

            // Create message record for WhatsApp schema
            const messageRecord = {
                messageId,
                instanceId,
                chatId,
                senderJid,
                fromMe: key.fromMe,
                messageType,
                content,
                timestamp: timestamp,
                quotedMessageId: null,
                isForwarded: false,
                forwardingScore: 0,
                isStarred: false,
                isEdited: false,
                lastEditedAt: null,
                sourcePlatform: messageData.source || 'android',
                rawApiPayload: messageData
            };

            console.log(`💬 Storing webhook message ${messageId} from ${chatId}: "${content.substring(0, 50)}..."`);

            // Check if message already exists to avoid duplicates by querying WhatsApp schema
            const existingMessages = await storage.getWhatsappMessages(userId, instance.instanceId, chatId);
            const messageExists = existingMessages.some(msg => msg.messageId === messageId);

            if (messageExists) {
                console.log(`📝 Message ${messageId} already exists, skipping duplicate`);
                return;
            }

            await storage.createWhatsappMessage(messageRecord);
            console.log(`✅ Webhook message stored successfully in WhatsApp schema: ${messageId}`);

            // Notify connected clients about new message
            const { notifyClientsOfNewMessage } = require('./routes');
            notifyClientsOfNewMessage(messageRecord);

            // Process for automated actions
            console.log('🔍 Processing message for automated actions');
            }

        } catch (error) {
            console.error('❌ Error processing message upsert:', error);
        }
    },

    /**
     * Handles message updates (status changes, reactions, etc.)
     */
    async handleMessageUpdate(instanceId: string, data: any) {
        console.log(`📝 Processing message update for instance ${instanceId}`);
        // Implementation for message updates
    },

    /**
     * Handles contact updates from the webhook.
     */
    async handleContactsUpsert(instanceId: string, data: any) {
        console.log(`👤 Processing contacts upsert for instance ${instanceId}`);
        // Implementation for contact updates
    },

    /**
     * Handles chat/conversation updates from the webhook.
     */
    async handleChatsUpsert(instanceId: string, data: any) {
        console.log(`💬 Processing chats upsert for instance ${instanceId}:`, data);
        // Implementation for chat updates
    },

    /**
     * Handles connection status updates.
     */
    async handleConnectionUpdate(instanceId: string, data: any) {
        console.log(`🔗 Processing connection update for instance ${instanceId}`);
        // Implementation for connection updates
    },

    /**
     * Handles a reaction event.
     */
    async handleReaction(instanceId: string, reactionData: any, reactorJid: string) {
        const reactionEmoji = reactionData.message.reactionMessage.text;
        const targetMessageId = reactionData.message.reactionMessage.key.id;

        console.log(`👍 Reaction '${reactionEmoji}' on message ${targetMessageId} by ${reactorJid}`);
        await this.triggerAction(instanceId, 'reaction', reactionEmoji, { messageId: targetMessageId, reactorJid });
    },

    /**
     * Central action trigger logic.
     */
    async triggerAction(instanceId: string, triggerType: 'reaction' | 'hashtag', triggerValue: string, context: { messageId: string, reactorJid: string }) {
        // Implementation for action triggers
        console.log(`🔄 Trigger action: ${triggerType} -> ${triggerValue}`);
    },

    /**
     * Parses message content for NLP insights
     */
    parseMessageForNlp(text: string) {
        const results = chrono.parse(text);
        return {
            date: results.length > 0 ? results[0].start.date() : null,
            location: null // Could be enhanced with location parsing
        };
    },

    /**
     * Maps API payload to WhatsApp chat structure
     */
    mapApiPayloadToWhatsappChat(rawChat: any, instanceId: string) {
        return {
            chat_id: rawChat.id,
            instance_id: instanceId,
            name: rawChat.name || '',
            is_group: rawChat.id.includes('@g.us'),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }
};

// Export SSE connections for route handlers
export { sseConnections, notifyClientsOfNewMessage };