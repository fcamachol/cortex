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
            const eventType = req.params.eventType;
            const eventPayload = req.body;
            console.log(`🔍 Debug - instanceName: ${instanceName}, eventType: ${eventType}, req.path: ${req.path}`);
            res.status(200).json({ status: "received", instance: instanceName });
            
            // Extract event type from URL path if not in params
            let actualEventType = eventType;
            if (!actualEventType && req.path) {
                const pathParts = req.path.split('/');
                actualEventType = pathParts[pathParts.length - 1];
            }
            
            // Handle event type from URL parameter or path
            if (actualEventType) {
                const normalizedEventType = actualEventType.replace(/-/g, '.');
                console.log(`🔄 Converting URL event type: ${actualEventType} -> ${normalizedEventType}`);
                const wrappedEvent = {
                    event: normalizedEventType,
                    data: eventPayload
                };
                this.processEvolutionEvent(instanceName, wrappedEvent);
            } else {
                this.processEvolutionEvent(instanceName, eventPayload);
            }
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
                if (data.key && data.message?.reactionMessage) { // Reaction payloads are not in an array
                    await this.handleReaction(instanceId, data, sender || data.key.participant);
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
            case 'messages.edit':
                await this.handleMessageEdit(instanceId, data);
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
        
        // Evolution API sends message data directly, not wrapped in arrays
        if (!data || !data.key || !data.key.id) {
            console.log('⚠️ No valid message data found in webhook payload');
            return;
        }
        
        const chatId = data.key.remoteJid;
        const senderJid = data.key.fromMe ? instanceId : (data.key.participant || data.key.remoteJid);
        
        try {
            // 1. First ensure contact exists for the sender
            const contactData = {
                jid: senderJid,
                instanceId: instanceId,
                pushName: data.key.fromMe ? 'Me' : (data.pushName || ''),
                profilePictureUrl: null,
                isBusiness: false,
                isMe: data.key.fromMe,
                isBlocked: false
            };
            
            try {
                await storage.createWhatsappContact(contactData);
                console.log(`✅ [${instanceId}] Created contact: ${senderJid}`);
            } catch (error) {
                // Contact might already exist, try to update it instead
                try {
                    await storage.updateWhatsappContact(senderJid, instanceId, contactData);
                    console.log(`📝 Contact ${senderJid} updated`);
                } catch (updateError) {
                    console.log(`📝 Contact ${senderJid} exists, proceeding`);
                }
            }
            
            // 2. Then ensure chat exists
            const chatData = {
                chatId: chatId,
                instanceId: instanceId,
                type: chatId.includes('@g.us') ? 'group' : 'individual',
                unreadCount: 0,
                isArchived: false,
                isPinned: false,
                isMuted: false,
                lastMessageTimestamp: new Date(data.messageTimestamp * 1000)
            };
            
            try {
                await storage.createWhatsappChat(chatData);
                console.log(`✅ [${instanceId}] Created chat: ${chatId}`);
            } catch (error) {
                // Chat might already exist
                console.log(`📝 Chat ${chatId} already exists`);
            }
            
            // 3. Finally create the message with all dependencies satisfied
            const messageForDb = this.mapApiPayloadToWhatsappMessage(data, instanceId);
            if (messageForDb) {
                await storage.upsertWhatsappMessage(messageForDb);
                console.log(`✅ [${instanceId}] Saved/Updated message: ${messageForDb.message_id}`);
                
                if (messageForDb.quoted_message_id) {
                    await this.handleReplyToContextMessage(instanceId, messageForDb);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error processing message ${data.key.id}:`, error);
        }
    },

    /**
     * Maps Evolution API message payload to WhatsApp message structure
     */
    mapApiPayloadToWhatsappMessage(rawMessage: any, instanceId: string) {
        if (!rawMessage.key || !rawMessage.key.id) return null;

        const key = rawMessage.key;
        const message = rawMessage.message;

        // Extract message content and determine type using comprehensive mapping
        const { content, messageType } = this.extractMessageContentAndType(message);

        return {
            message_id: key.id,
            instance_id: instanceId,
            chat_id: key.remoteJid,
            sender_jid: key.fromMe ? instanceId : (key.participant || key.remoteJid),
            from_me: key.fromMe,
            message_type: messageType,
            content: content,
            timestamp: new Date(rawMessage.messageTimestamp * 1000),
            quoted_message_id: null,
            is_forwarded: false,
            forwarding_score: 0,
            is_starred: false,
            is_edited: false,
            source_platform: rawMessage.source || 'android',
            raw_api_payload: rawMessage
        };
    },

    /**
     * Handle replies to context messages
     */
    async handleReplyToContextMessage(instanceId: string, messageForDb: any) {
        // Implementation for handling replies to context messages
        console.log(`🔗 Processing reply context for message ${messageForDb.message_id}`);
    },

    /**
     * Handles message updates (status changes, reactions, etc.)
     */
    async handleMessageUpdate(instanceId: string, data: any) {
        console.log(`📝 Processing message update for instance ${instanceId}`, JSON.stringify(data, null, 2));
        
        // Evolution API can send updates in different formats
        let updates = [];
        
        if (data.update) {
            updates = Array.isArray(data.update) ? data.update : [data.update];
        } else if (data.key && data.status) {
            // Direct update format with key structure
            updates = [data];
        } else if (data.data && (data.data.keyId || data.data.messageId || data.data.status)) {
            // Evolution API wrapped format
            updates = [data.data];
        } else if (data.keyId || data.messageId || data.status) {
            // Evolution API direct format
            updates = [data];
        } else if (Array.isArray(data)) {
            // Array of updates
            updates = data;
        } else {
            console.log('⚠️ No valid message update data found in webhook payload');
            return;
        }
        
        for (const update of updates) {
            // Handle different message ID formats from Evolution API
            let messageId = null;
            if (update.key?.id) {
                messageId = update.key.id;
            } else if (update.keyId) {
                messageId = update.keyId;
            } else if (update.messageId) {
                messageId = update.messageId;
            }
            
            if (!messageId || !update.status) {
                console.log('⚠️ Message update missing required messageId or status');
                continue;
            }
            
            const status = update.status;
            
            // Map Evolution API status to our enum values
            const mappedStatus = this.mapMessageStatus(status);
            if (!mappedStatus) {
                console.log(`⚠️ Unknown message status: ${status}`);
                continue;
            }
            
            const updateRecord = {
                messageId: messageId,
                instanceId: instanceId,
                status: mappedStatus,
                timestamp: new Date(update.messageTimestamp * 1000 || Date.now())
            };
            
            try {
                await storage.createWhatsappMessageUpdate(updateRecord);
                console.log(`✅ [${instanceId}] Stored message update: ${messageId} -> ${mappedStatus}`);
            } catch (error) {
                console.log(`❌ Error storing message update:`, error);
                console.log(`❌ Update record was:`, updateRecord);
            }
        }
    },

    /**
     * Maps Evolution API message status to our database enum values
     */
    mapMessageStatus(apiStatus: string): string | null {
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

    /**
     * Handles contact updates from the webhook.
     */
    async handleContactsUpsert(instanceId: string, data: any) {
        console.log(`👤 Processing contacts upsert for instance ${instanceId}`);
        
        if (!data || !Array.isArray(data)) {
            console.log('⚠️ No valid contact data found in webhook payload');
            return;
        }
        
        for (const rawContact of data) {
            if (!rawContact.id) continue;
            
            const contactData = {
                jid: rawContact.id,
                instanceId: instanceId,
                pushName: rawContact.pushName || rawContact.name || '',
                profilePictureUrl: rawContact.profilePicUrl || null,
                isBusiness: rawContact.isBusiness || false,
                isMe: rawContact.isMe || false,
                isBlocked: rawContact.isBlocked || false
            };
            
            try {
                await storage.createWhatsappContact(contactData);
                console.log(`✅ [${instanceId}] Created/Updated contact: ${contactData.jid}`);
            } catch (error) {
                console.log(`📝 Contact ${contactData.jid} processing error:`, error.message);
            }
        }
    },

    /**
     * Handles chat/conversation updates from the webhook.
     */
    async handleChatsUpsert(instanceId: string, data: any) {
        console.log(`💬 Processing chats upsert for instance ${instanceId}:`, data);
        
        if (!data || !Array.isArray(data)) {
            console.log('⚠️ No valid chat data found in webhook payload');
            return;
        }
        
        for (const rawChat of data) {
            if (!rawChat.id && !rawChat.remoteJid) continue;
            
            const chatId = rawChat.id || rawChat.remoteJid;
            const chatData = {
                chatId: chatId,
                instanceId: instanceId,
                type: chatId.includes('@g.us') ? 'group' : 'individual',
                unreadCount: rawChat.unreadMessages || rawChat.unreadCount || 0,
                isArchived: rawChat.archived || rawChat.isArchived || false,
                isPinned: rawChat.pinned || rawChat.isPinned || false,
                isMuted: rawChat.muted || rawChat.isMuted || false,
                lastMessageTimestamp: rawChat.lastMessage?.messageTimestamp ? 
                    new Date(rawChat.lastMessage.messageTimestamp * 1000) : null
            };
            
            try {
                await storage.createWhatsappChat(chatData);
                console.log(`✅ [${instanceId}] Created/Updated chat: ${chatData.chatId}`);
            } catch (error) {
                console.log(`📝 Chat ${chatData.chatId} processing error:`, error.message);
            }
        }
    },

    /**
     * Comprehensive message content extraction with proper type mapping
     */
    extractMessageContentAndType(message: any): { content: string; messageType: string } {
        if (!message) return { content: '', messageType: 'unsupported' };

        // Text messages
        if (message.conversation) {
            return { content: message.conversation, messageType: 'text' };
        }
        if (message.extendedTextMessage?.text) {
            return { content: message.extendedTextMessage.text, messageType: 'text' };
        }

        // Media messages with captions
        if (message.imageMessage) {
            return { 
                content: message.imageMessage.caption || '[Image]', 
                messageType: 'image' 
            };
        }
        if (message.videoMessage) {
            return { 
                content: message.videoMessage.caption || '[Video]', 
                messageType: 'video' 
            };
        }
        if (message.audioMessage) {
            return { content: '[Audio]', messageType: 'audio' };
        }
        if (message.documentMessage) {
            return { 
                content: message.documentMessage.caption || `[Document: ${message.documentMessage.fileName || 'file'}]`, 
                messageType: 'document' 
            };
        }

        // Special message types
        if (message.stickerMessage) {
            return { content: '[Sticker]', messageType: 'sticker' };
        }
        if (message.locationMessage) {
            return { 
                content: `[Location: ${message.locationMessage.name || 'Unknown location'}]`, 
                messageType: 'location' 
            };
        }
        if (message.contactMessage) {
            return { 
                content: `[Contact: ${message.contactMessage.displayName || 'Unknown contact'}]`, 
                messageType: 'contact_card' 
            };
        }
        if (message.contactsArrayMessage) {
            return { 
                content: `[Contacts: ${message.contactsArrayMessage.contacts?.length || 0} contacts]`, 
                messageType: 'contact_card_multi' 
            };
        }

        // System/control messages
        if (message.protocolMessage) {
            if (message.protocolMessage.type === 'REVOKE') {
                return { content: 'This message was deleted', messageType: 'revoked' };
            }
        }
        if (message.reactionMessage) {
            return { 
                content: `Reacted with ${message.reactionMessage.text}`, 
                messageType: 'reaction' 
            };
        }

        // Fallback for unknown message types
        return { content: '[Unsupported message type]', messageType: 'unsupported' };
    },

    /**
     * Handles message edits from Evolution API
     */
    async handleMessageEdit(instanceId: string, data: any) {
        console.log(`✏️ Processing message edit for instance ${instanceId}`, JSON.stringify(data, null, 2));
        
        // Extract edit data from different possible formats
        let editData = null;
        
        if (data.data) {
            editData = data.data;
        } else if (data.keyId || data.messageId) {
            editData = data;
        }
        
        if (!editData) {
            console.log('⚠️ No valid message edit data found in webhook payload');
            return;
        }
        
        try {
            // Extract message ID
            const messageId = editData.keyId || editData.messageId;
            if (!messageId) {
                console.log('⚠️ Message edit missing required message ID');
                return;
            }
            
            // Extract edited content
            let editedContent = '';
            if (editData.editedMessage?.conversation) {
                editedContent = editData.editedMessage.conversation;
            } else if (editData.newText) {
                editedContent = editData.newText;
            } else if (editData.content) {
                editedContent = editData.content;
            }
            
            // Extract original content
            let originalContent = '';
            if (editData.originalMessage?.conversation) {
                originalContent = editData.originalMessage.conversation;
            } else if (editData.oldText) {
                originalContent = editData.oldText;
            }
            
            const editRecord = {
                messageId,
                instanceId,
                originalContent,
                editedContent,
                editTimestamp: new Date(editData.editTimestamp * 1000 || Date.now()),
                metadata: {
                    remoteJid: editData.remoteJid,
                    fromMe: editData.fromMe || false,
                    participant: editData.participant
                }
            };
            
            await storage.createWhatsappMessageEditHistory(editRecord);
            console.log(`✅ [${instanceId}] Stored message edit: ${messageId}`);
            
        } catch (error) {
            console.log(`❌ Error storing message edit:`, error);
        }
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
        const reactionMessage = reactionData.message.reactionMessage;
        const reactionEmoji = reactionMessage.text;
        const targetMessageId = reactionMessage.key.id;
        const targetChatId = reactionMessage.key.remoteJid;

        console.log(`👍 Reaction '${reactionEmoji}' on message ${targetMessageId} by ${reactorJid}`);

        // Store the reaction in the message_reactions table
        const reactionRecord = {
            messageId: targetMessageId,
            instanceId: instanceId,
            reactorJid: reactorJid,
            reactionEmoji: reactionEmoji,
            fromMe: reactionData.key.fromMe || false,
            timestamp: new Date(reactionData.messageTimestamp * 1000 || Date.now())
        };

        try {
            await storage.createWhatsappMessageReaction(reactionRecord);
            console.log(`✅ [${instanceId}] Stored reaction: ${reactionEmoji} by ${reactorJid} on ${targetMessageId}`);
        } catch (error) {
            console.log(`❌ Error storing reaction:`, error);
            console.log(`❌ Reaction record was:`, reactionRecord);
        }

        // Also trigger any configured actions
        await this.triggerAction(instanceId, 'reaction', reactionEmoji, { messageId: targetMessageId, reactorJid });
    },

    /**
     * Handles group updates from the webhook.
     */
    async handleGroupsUpsert(instanceId: string, data: any) {
        console.log(`👥 Processing groups upsert for instance ${instanceId}`);
        
        if (!data || !Array.isArray(data)) {
            console.log('⚠️ No valid group data found in webhook payload');
            return;
        }
        
        for (const rawGroup of data) {
            if (!rawGroup.id && !rawGroup.remoteJid) continue;
            
            const groupId = rawGroup.id || rawGroup.remoteJid;
            
            // First ensure the group exists as a chat
            const chatData = {
                chatId: groupId,
                instanceId: instanceId,
                type: 'group',
                unreadCount: rawGroup.unreadMessages || rawGroup.unreadCount || 0,
                isArchived: rawGroup.archived || false,
                isPinned: rawGroup.pinned || false,
                isMuted: rawGroup.muted || false,
                lastMessageTimestamp: rawGroup.lastMessage?.messageTimestamp ? 
                    new Date(rawGroup.lastMessage.messageTimestamp * 1000) : null
            };
            
            try {
                await storage.createWhatsappChat(chatData);
                console.log(`✅ [${instanceId}] Created/Updated group chat: ${groupId}`);
            } catch (error) {
                console.log(`📝 Group chat ${groupId} already exists or error:`, error.message);
            }
            
            // Create the actual group record in the groups table
            const groupData = {
                groupJid: groupId,
                instanceId: instanceId,
                subject: rawGroup.subject || rawGroup.name || '',
                description: rawGroup.desc || rawGroup.description || null,
                ownerJid: rawGroup.owner || null,
                creationTimestamp: rawGroup.creation ? new Date(rawGroup.creation * 1000) : null,
                isLocked: rawGroup.restrict || false
            };
            
            try {
                await storage.createWhatsappGroup(groupData);
                console.log(`✅ [${instanceId}] Created/Updated group: ${groupId} - ${groupData.subject}`);
            } catch (error) {
                console.log(`📝 Group ${groupId} creation error:`, error.message);
            }
            
            // Process group participants if available
            if (rawGroup.participants) {
                for (const participant of rawGroup.participants) {
                    const participantJid = participant.id || participant.jid;
                    
                    // First create contact record for participant
                    const contactData = {
                        jid: participantJid,
                        instanceId: instanceId,
                        pushName: participant.notify || participant.name || '',
                        profilePictureUrl: null,
                        isBusiness: false,
                        isMe: false,
                        isBlocked: false
                    };
                    
                    try {
                        await storage.createWhatsappContact(contactData);
                        console.log(`✅ [${instanceId}] Created group participant contact: ${participantJid}`);
                    } catch (error) {
                        // Contact might already exist
                        console.log(`📝 Group participant contact ${participantJid} already exists`);
                    }
                    
                    // Then create group participant record
                    const groupParticipantData = {
                        groupJid: groupId,
                        participantJid: participantJid,
                        instanceId: instanceId,
                        isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin',
                        isSuperAdmin: participant.admin === 'superadmin'
                    };
                    
                    try {
                        await storage.createWhatsappGroupParticipant(groupParticipantData);
                        console.log(`✅ [${instanceId}] Created group participant: ${participantJid} (${participant.admin || 'member'})`);
                    } catch (error) {
                        console.log(`📝 Group participant ${participantJid} already exists`);
                    }
                }
            }
        }
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