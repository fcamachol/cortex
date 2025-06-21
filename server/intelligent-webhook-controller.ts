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
        console.log(`🔍 Full event structure:`, JSON.stringify({ eventType, dataType: typeof data, dataKeys: data ? Object.keys(data) : 'null', hasArray: Array.isArray(data) }, null, 2));

        switch (eventType) {
            case 'messages.upsert':
                // Extract message data from nested Evolution API structure
                let messageData = data;
                if (data.data && !data.key) {
                    messageData = Array.isArray(data.data) ? data.data[0] : data.data;
                }
                

                // Check for reactions first
                if (messageData.key && messageData.message?.reactionMessage) {
                    console.log(`🎯 Detected reaction in messages.upsert`);
                    
                    // Extract reactor JID with proper fallback logic
                    let reactorJid = messageData.key.participant || messageData.key.remoteJid || sender;
                    
                    // If still no reactor JID, use a reasonable default based on the chat type
                    if (!reactorJid) {
                        reactorJid = messageData.key.fromMe ? 
                            (messageData.key.remoteJid || sender || `${instanceId}@owner`) :
                            (messageData.key.remoteJid || sender || `${instanceId}@participant`);
                    }
                    
                    await this.handleReaction(instanceId, messageData, reactorJid);
                } else {
                    await this.handleMessageUpsert(instanceId, data);
                }
                break;
            case 'messages.update':
                // Extract update data from nested Evolution API structure
                let updateData = data;
                if (data.data && !data.updates && !data.messageId) {
                    updateData = data.data;
                }
                
                // Check for reactions in updates
                if (updateData.updates && updateData.updates[0]?.message?.reactionMessage) {
                    console.log(`🎯 Detected reaction in messages.update (updates array)`);
                    let reactorJid = updateData.updates[0].key?.participant || updateData.updates[0].key?.remoteJid || sender;
                    
                    // If still no reactor JID, use a reasonable default
                    if (!reactorJid) {
                        reactorJid = updateData.updates[0].key?.fromMe ? 
                            (updateData.updates[0].key?.remoteJid || sender || `${instanceId}@owner`) :
                            (updateData.updates[0].key?.remoteJid || sender || `${instanceId}@participant`);
                    }
                    
                    await this.handleReaction(instanceId, updateData.updates[0], reactorJid);
                } else if (updateData.message?.reactionMessage) {
                    console.log(`🎯 Detected direct reaction in messages.update`);
                    
                    // Extract reactor JID with same logic as messages.upsert
                    let reactorJid = updateData.key?.participant || updateData.key?.remoteJid || sender;
                    
                    // If still no reactor JID, use a reasonable default based on the chat type
                    if (!reactorJid) {
                        reactorJid = updateData.key?.fromMe ? 
                            (updateData.key?.remoteJid || sender || `${instanceId}@owner`) :
                            (updateData.key?.remoteJid || sender || `${instanceId}@participant`);
                    }
                    
                    await this.handleReaction(instanceId, updateData, reactorJid);
                } else {
                    await this.handleMessageUpdate(instanceId, data);
                }
                break;
            case 'messages.edit':
                await this.handleMessageEdit(instanceId, data);
                break;
            case 'messages.delete':
                await this.handleMessageDeletion(instanceId, data);
                break;
            case 'contacts.upsert':
            case 'contacts.update':
                console.log(`👤 Contact event data:`, JSON.stringify(data, null, 2));
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
            case 'group.participants.update':
                await this.handleGroupParticipantsUpdate(instanceId, data);
                break;
            case 'labels.edit':
            case 'labels.association':
                await this.handleLabelsUpdate(instanceId, data);
                break;
            case 'chats.set':
            case 'chats.delete':
                await this.handleChatLabelsUpdate(instanceId, data);
                break;
            case 'call':
                await this.handleCallLogs(instanceId, data);
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
        
        // Extract message data from nested Evolution API structure
        let messageData = data;
        if (data.data && !data.key) {
            messageData = Array.isArray(data.data) ? data.data[0] : data.data;
        }
        
        if (!messageData || !messageData.key || !messageData.key.id) {
            console.log('⚠️ No valid message data found in webhook payload');
            console.log('🔍 Available data keys:', data ? Object.keys(data) : 'none');
            return;
        }
        
        const chatId = messageData.key.remoteJid;
        const senderJid = messageData.key.fromMe ? instanceId : (messageData.key.participant || messageData.key.remoteJid);
        
        try {
            // 1. First ensure contact exists for the sender
            const contactData = {
                jid: senderJid,
                instanceId: instanceId,
                pushName: messageData.key.fromMe ? 'Me' : (messageData.pushName || ''),
                profilePictureUrl: null,
                isBusiness: false,
                isMe: messageData.key.fromMe,
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
                lastMessageTimestamp: new Date(messageData.messageTimestamp * 1000)
            };
            
            try {
                await storage.createWhatsappChat(chatData);
                console.log(`✅ [${instanceId}] Created chat: ${chatId}`);
            } catch (error) {
                // Chat might already exist
                console.log(`📝 Chat ${chatId} already exists`);
            }
            
            // 3. Finally create the message with all dependencies satisfied
            const messageForDb = this.mapApiPayloadToWhatsappMessage(messageData, instanceId);
            if (messageForDb) {
                await storage.upsertWhatsappMessage(messageForDb);
                console.log(`✅ [${instanceId}] Saved/Updated message: ${messageForDb.message_id}`);
                
                // 4. Process actions engine for this message
                await this.processMessageForActions(messageForDb, instanceId);
                
                if (messageForDb.quoted_message_id) {
                    await this.handleReplyToContextMessage(instanceId, messageForDb);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error processing message ${messageData.key.id}:`, error);
        }
    },

    /**
     * Process message for automated actions
     */
    async processMessageForActions(message: any, instanceId?: string) {
        try {
            const { ActionsEngine } = await import('./actions-engine');
            const { hashtags, keywords } = ActionsEngine.extractHashtagsAndKeywords(message.content || '');
            
            const triggerContext = {
                messageId: message.message_id,
                instanceId: instanceId || message.instance_id,
                chatId: message.chat_id,
                senderJid: message.sender_jid,
                content: message.content || '',
                hashtags,
                keywords,
                timestamp: new Date(message.timestamp),
                fromMe: message.from_me || false
            };

            await ActionsEngine.processMessageForActions(triggerContext);
            console.log(`🔍 Processed message for automated actions`);
        } catch (error) {
            console.error('Error processing message for actions:', error);
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
        
        // Evolution API can send contacts in different formats
        let contacts = [];
        
        // Debug the data structure
        console.log(`🔍 Contact data structure: hasData=${!!data.data}, isDataArray=${Array.isArray(data.data)}, dataType=${typeof data.data}`);
        
        if (data.data && Array.isArray(data.data)) {
            // Array of contacts in data.data
            contacts = data.data;
            console.log(`📋 Found ${contacts.length} contacts in data.data array`);
        } else if (data.data && typeof data.data === 'object' && (data.data.remoteJid || data.data.id || data.data.jid)) {
            // Single contact object in data.data
            contacts = [data.data];
            console.log(`📄 Found single contact in data.data: ${data.data.remoteJid || data.data.id || data.data.jid}`);
        } else if (Array.isArray(data)) {
            // Direct array of contacts
            contacts = data;
            console.log(`📋 Found ${contacts.length} contacts in root array`);
        } else if (data.data && data.data.contacts) {
            // Contacts nested in data.data.contacts
            contacts = Array.isArray(data.data.contacts) ? data.data.contacts : [data.data.contacts];
            console.log(`📋 Found contacts in data.data.contacts`);
        } else if (data.contacts) {
            // Contacts nested in data.contacts
            contacts = Array.isArray(data.contacts) ? data.contacts : [data.contacts];
            console.log(`📋 Found contacts in data.contacts`);
        } else if (data.id || data.jid || data.pushName || data.remoteJid) {
            // Single contact at root level
            contacts = [data];
            console.log(`📄 Found single contact at root level`);
        } else {
            console.log('⚠️ No valid contact data found in webhook payload');
            console.log('🔍 Available keys:', Object.keys(data || {}));
            if (data.data) {
                console.log('🔍 data.data keys:', Object.keys(data.data || {}));
            }
            return;
        }
        
        for (const rawContact of contacts) {
            try {
                // Extract contact JID from different possible fields
                const jid = rawContact.remoteJid || rawContact.id || rawContact.jid;
                if (!jid) {
                    console.log('⚠️ Contact missing required JID');
                    continue;
                }
                
                const contactData = {
                    jid: jid,
                    instanceId: instanceId,
                    pushName: rawContact.pushName || rawContact.push_name || rawContact.name || rawContact.notify || null,
                    verifiedName: rawContact.verifiedName || rawContact.verified_name || null,
                    profilePictureUrl: rawContact.profilePicUrl || rawContact.profilePictureUrl || rawContact.profile_picture_url || null,
                    isBusiness: rawContact.isBusiness || rawContact.is_business || false,
                    isMe: rawContact.isMe || rawContact.is_me || false,
                    isBlocked: rawContact.isBlocked || rawContact.is_blocked || false
                };
                
                await storage.createWhatsappContact(contactData);
                console.log(`✅ [${instanceId}] Created/Updated contact: ${contactData.jid} (${contactData.pushName || 'No name'})`);
                
            } catch (error) {
                console.log(`❌ Contact processing error:`, error);
            }
        }
    },

    /**
     * Handles chat/conversation updates from the webhook.
     */
    async handleChatsUpsert(instanceId: string, data: any) {
        console.log(`💬 Processing chats upsert for instance ${instanceId}:`, data);
        
        // Extract chat data from nested Evolution API structure
        let chats = [];
        if (data && data.data && Array.isArray(data.data)) {
            chats = data.data;
        } else if (Array.isArray(data)) {
            chats = data;
        } else if (data && data.data && !Array.isArray(data.data)) {
            chats = [data.data];
        } else if (data && (data.remoteJid || data.id)) {
            chats = [data];
        }
        
        console.log(`🔍 Extracted ${chats.length} chats from payload`);
        
        if (chats.length === 0) {
            console.log('⚠️ No valid chat data found in webhook payload');
            console.log('🔍 Available data keys:', data ? Object.keys(data) : 'none');
            return;
        }
        
        for (const rawChat of chats) {
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
            
            const editTimestamp = new Date(editData.editTimestamp * 1000 || Date.now());
            
            // Step 1: Store the original content in edit history for audit trail
            const editRecord = {
                messageId,
                instanceId,
                oldContent: originalContent,
                editTimestamp
            };
            
            await storage.createWhatsappMessageEditHistory(editRecord);
            
            // Step 2: Update the actual message content with the new edited content
            if (editedContent) {
                try {
                    await storage.updateWhatsappMessageContent({
                        messageId,
                        instanceId,
                        newContent: editedContent,
                        isEdited: true,
                        lastEditedAt: editTimestamp
                    });
                    console.log(`✅ [${instanceId}] Updated message content and stored edit history: ${messageId}`);
                    console.log(`📝 Content updated to: "${editedContent}"`);
                } catch (updateError) {
                    console.log(`❌ Error updating message content:`, updateError);
                    console.log(`✅ [${instanceId}] Stored edit history only: ${messageId}`);
                }
            } else {
                console.log(`✅ [${instanceId}] Stored message edit history: ${messageId} (no new content provided)`);
            }
            
        } catch (error) {
            console.log(`❌ Error storing message edit:`, error);
        }
    },

    /**
     * Handles message deletions from Evolution API
     */
    async handleMessageDeletion(instanceId: string, data: any) {
        console.log(`🗑️ Processing message deletion for instance ${instanceId}`, JSON.stringify(data, null, 2));
        
        // Extract deletion data from different possible formats
        let deletionData = null;
        
        if (data.data) {
            deletionData = data.data;
        } else if (data.keyId || data.messageId || data.key) {
            deletionData = data;
        }
        
        if (!deletionData) {
            console.log('⚠️ No valid message deletion data found in webhook payload');
            return;
        }
        
        try {
            // Extract message ID from different formats
            let messageId = null;
            if (deletionData.key?.id) {
                messageId = deletionData.key.id;
            } else if (deletionData.keyId) {
                messageId = deletionData.keyId;
            } else if (deletionData.messageId) {
                messageId = deletionData.messageId;
            }
            
            if (!messageId) {
                console.log('⚠️ Message deletion missing required message ID');
                return;
            }
            
            // Extract chat ID
            const chatId = deletionData.remoteJid || deletionData.key?.remoteJid || deletionData.chatId;
            if (!chatId) {
                console.log('⚠️ Message deletion missing required chat ID');
                return;
            }
            
            // Extract who deleted the message
            const deletedBy = deletionData.participant || deletionData.deletedBy || deletionData.key?.participant || 'unknown';
            
            // Determine deletion type
            let deletionType = 'sender'; // default
            if (deletionData.deletionType) {
                deletionType = deletionData.deletionType;
            } else if (deletionData.key?.fromMe) {
                deletionType = 'sender';
            } else {
                deletionType = 'everyone';
            }
            
            // Get original content if available
            const originalContent = deletionData.originalContent || deletionData.content || null;
            
            const deletionRecord = {
                deletionId: `${messageId}_${Date.now()}`,
                messageId,
                instanceId,
                chatId,
                deletedBy,
                deletionType,
                originalContent,
                originalTimestamp: deletionData.messageTimestamp ? new Date(deletionData.messageTimestamp * 1000) : null,
                deletedAt: new Date(),
                rawApiPayload: deletionData
            };
            
            await storage.createWhatsappMessageDeletion(deletionRecord);
            console.log(`✅ [${instanceId}] Stored message deletion: ${messageId} by ${deletedBy}`);
            
        } catch (error) {
            console.log(`❌ Error storing message deletion:`, error);
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

        // Also trigger any configured actions with rich context
        const actionContext = {
            messageId: targetMessageId,
            reactorJid: reactorJid,
            chatId: targetChatId,
            messageContent: '', // Will be populated if available
            reactionEmoji: reactionEmoji,
            timestamp: reactionRecord.timestamp
        };
        await this.triggerAction(instanceId, 'reaction', reactionEmoji, actionContext);
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
     * Handles group participant updates from the webhook.
     */
    async handleGroupParticipantsUpdate(instanceId: string, data: any) {
        console.log(`👥 Processing group participants update for instance ${instanceId}`);
        
        // Extract participant data from nested structure
        let participantData = data;
        if (data.data && !data.participants) {
            participantData = data.data;
        }
        
        if (!participantData.participants || !participantData.groupId) {
            console.log('⚠️ No valid group participant data found');
            return;
        }
        
        // Store group participant changes in database
        for (const participant of participantData.participants) {
            try {
                const groupParticipantData = {
                    groupJid: participantData.groupId,
                    participantJid: participant,
                    instanceId: instanceId,
                    isAdmin: false,
                    isSuperAdmin: false,
                    action: participantData.action || 'unknown',
                    timestamp: new Date(),
                    rawPayload: JSON.stringify(data)
                };
                
                await storage.createWhatsappGroupParticipant(groupParticipantData);
                console.log(`✅ [${instanceId}] Stored group participant update: ${participant} ${participantData.action} in ${participantData.groupId}`);
            } catch (error) {
                console.log(`❌ Error storing group participant update:`, error);
            }
        }
    },

    /**
     * Handles label updates from the webhook.
     */
    async handleLabelsUpdate(instanceId: string, data: any) {
        console.log(`🏷️ Processing labels update for instance ${instanceId}`);
        
        // Extract label data from nested structure
        let labelData = data;
        if (data.data && !data.labelId) {
            labelData = data.data;
        }
        
        if (!labelData.labelId) {
            console.log('⚠️ No valid label data found');
            return;
        }
        
        try {
            const labelUpdateData = {
                labelId: labelData.labelId,
                instanceId: instanceId,
                name: labelData.name || '',
                color: labelData.color || null,
                action: labelData.action || 'update',
                timestamp: new Date(),
                rawPayload: JSON.stringify(data)
            };
            
            await storage.createWhatsappLabel(labelUpdateData);
            console.log(`✅ [${instanceId}] Stored label update: ${labelData.labelId}`);
        } catch (error) {
            console.log(`❌ Error storing label update:`, error);
        }
    },

    /**
     * Handles chat label updates from the webhook.
     */
    async handleChatLabelsUpdate(instanceId: string, data: any) {
        console.log(`🏷️💬 Processing chat labels update for instance ${instanceId}`);
        
        // Extract chat label data from nested structure
        let chatLabelData = data;
        if (data.data && !data.chatId) {
            chatLabelData = data.data;
        }
        
        if (!chatLabelData.chatId) {
            console.log('⚠️ No valid chat label data found');
            return;
        }
        
        try {
            const chatLabelUpdateData = {
                chatId: chatLabelData.chatId,
                instanceId: instanceId,
                labelIds: chatLabelData.labelIds || [],
                action: chatLabelData.action || 'set',
                timestamp: new Date(),
                rawPayload: JSON.stringify(data)
            };
            
            await storage.createWhatsappChatLabel(chatLabelUpdateData);
            console.log(`✅ [${instanceId}] Stored chat label update: ${chatLabelData.chatId}`);
        } catch (error) {
            console.log(`❌ Error storing chat label update:`, error);
        }
    },

    /**
     * Handles call logs from the webhook.
     */
    async handleCallLogs(instanceId: string, data: any) {
        console.log(`📞 Processing call logs for instance ${instanceId}`);
        
        // Extract call data from nested structure
        let callData = data;
        if (data.data && !data.callId) {
            callData = data.data;
        }
        
        if (!callData.callId && !callData.id) {
            console.log('⚠️ No valid call data found');
            return;
        }
        
        try {
            const callLogData = {
                callId: callData.callId || callData.id,
                instanceId: instanceId,
                fromJid: callData.from || callData.fromJid,
                toJid: callData.to || callData.toJid,
                status: callData.status || 'unknown',
                duration: callData.duration || 0,
                timestamp: callData.timestamp ? new Date(callData.timestamp * 1000) : new Date(),
                isVideo: callData.isVideo || false,
                rawPayload: JSON.stringify(data)
            };
            
            await storage.createWhatsappCallLog(callLogData);
            console.log(`✅ [${instanceId}] Stored call log: ${callLogData.callId}`);
        } catch (error) {
            console.log(`❌ Error storing call log:`, error);
        }
    },

    /**
     * Central action trigger logic.
     */
    async triggerAction(instanceId: string, triggerType: 'reaction' | 'hashtag', triggerValue: string, context: { messageId: string, reactorJid: string }) {
        console.log(`🔄 Trigger action: ${triggerType} -> ${triggerValue}`);
        
        try {
            // Query active action rules that match the trigger type
            const matchingRules = await storage.getMatchingActionRules(triggerType, triggerValue, instanceId);
            
            if (matchingRules.length === 0) {
                console.log(`📭 No matching action rules found for ${triggerType}: ${triggerValue}`);
                return;
            }
            
            console.log(`🎯 Found ${matchingRules.length} matching action rule(s)`);
            
            // Execute each matching rule
            for (const rule of matchingRules) {
                await this.executeActionRule(rule, triggerType, triggerValue, context, instanceId);
            }
        } catch (error) {
            console.log(`❌ Error processing action triggers:`, error);
        }
    },

    /**
     * Execute a specific action rule
     */
    async executeActionRule(rule: any, triggerType: string, triggerValue: string, context: any, instanceId: string) {
        const startTime = Date.now();
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`⚡ Executing action rule: "${rule.ruleName}" (${rule.actionType})`);
        
        try {
            // Check cooldown period
            if (rule.cooldownMinutes > 0 && rule.lastExecutedAt) {
                const cooldownEnd = new Date(rule.lastExecutedAt.getTime() + (rule.cooldownMinutes * 60 * 1000));
                if (new Date() < cooldownEnd) {
                    console.log(`⏰ Rule "${rule.ruleName}" is in cooldown period`);
                    return;
                }
            }
            
            // Check daily execution limit
            const today = new Date().toDateString();
            const todayExecutions = await storage.getActionExecutionsToday(rule.ruleId);
            if (todayExecutions >= rule.maxExecutionsPerDay) {
                console.log(`📊 Rule "${rule.ruleName}" has reached daily execution limit`);
                return;
            }
            
            // Prepare trigger data
            const triggerData = {
                triggerType,
                triggerValue,
                context,
                instanceId,
                timestamp: new Date().toISOString()
            };
            
            // Execute the action based on type
            let result;
            switch (rule.actionType) {
                case 'create_task':
                    result = await this.executeCreateTask(rule.actionConfig, triggerData);
                    break;
                case 'create_calendar_event':
                    result = await this.executeCreateCalendarEvent(rule.actionConfig, triggerData);
                    break;
                case 'send_message':
                    result = await this.executeSendMessage(rule.actionConfig, triggerData);
                    break;
                case 'add_label':
                    result = await this.executeAddLabel(rule.actionConfig, triggerData);
                    break;
                case 'send_notification':
                    result = await this.executeSendNotification(rule.actionConfig, triggerData);
                    break;
                case 'webhook':
                    result = await this.executeWebhook(rule.actionConfig, triggerData);
                    break;
                default:
                    throw new Error(`Unknown action type: ${rule.actionType}`);
            }
            
            const processingTime = Date.now() - startTime;
            
            // Log successful execution
            await storage.createActionExecution({
                ruleId: rule.ruleId,
                triggeredBy: context.messageId || context.reactorJid,
                triggerData,
                status: 'success',
                result,
                executedAt: new Date(),
                processingTimeMs: processingTime
            });
            
            // Update rule statistics
            await storage.updateActionRuleStats(rule.ruleId);
            
            console.log(`✅ Action rule "${rule.ruleName}" executed successfully in ${processingTime}ms`);
            
        } catch (error) {
            const processingTime = Date.now() - startTime;
            
            // Log failed execution
            await storage.createActionExecution({
                ruleId: rule.ruleId,
                triggeredBy: context.messageId || context.reactorJid,
                triggerData: {
                    triggerType,
                    triggerValue,
                    context,
                    instanceId,
                    timestamp: new Date().toISOString()
                },
                status: 'failed',
                errorMessage: error.message,
                executedAt: new Date(),
                processingTimeMs: processingTime
            });
            
            console.log(`❌ Action rule "${rule.ruleName}" failed:`, error.message);
        }
    },

    /**
     * Execute create task action
     */
    async executeCreateTask(config: any, triggerData: any) {
        console.log(`📝 Creating task from reaction trigger`);
        
        // Process template variables in the config with debugging
        const processTemplate = (template: string) => {
            if (!template) return template;
            
            console.log(`🔄 Processing template: "${template}"`);
            console.log(`📊 Available context:`, JSON.stringify(triggerData.context, null, 2));
            
            const processed = template
                .replace(/\{\{sender\}\}/g, triggerData.context?.reactorJid || 'Unknown')
                .replace(/\{\{content\}\}/g, triggerData.context?.messageContent || 'No content')
                .replace(/\{\{chatId\}\}/g, triggerData.context?.chatId || 'Unknown chat')
                .replace(/\{\{messageId\}\}/g, triggerData.context?.messageId || 'Unknown message')
                .replace(/\{\{instanceId\}\}/g, triggerData.instanceId || 'Unknown instance')
                .replace(/\{\{reaction\}\}/g, triggerData.triggerValue || 'Unknown reaction')
                .replace(/\{\{triggerType\}\}/g, triggerData.triggerType || 'Unknown trigger');
                
            console.log(`✅ Processed template: "${processed}"`);
            return processed;
        };
        
        const taskData = {
            instanceId: triggerData.instanceId,
            title: processTemplate(config.title) || `Task from ${triggerData.triggerType}: ${triggerData.triggerValue}`,
            description: processTemplate(config.description) || `Automatically created from WhatsApp ${triggerData.triggerType}`,
            priority: config.priority || 'medium',
            dueDate: config.dueDate ? new Date(config.dueDate) : null,
            // Map additional config fields if present
            sourceChatId: processTemplate(config.sourceChatId),
            sourceMessageId: processTemplate(config.sourceMessageId),
            sourceInstanceId: processTemplate(config.sourceInstanceId)
        };
        
        const task = await storage.createTask(taskData);
        
        return { taskId: task.task_id || task.taskId, title: task.title };
    },

    /**
     * Execute create calendar event action  
     */
    async executeCreateCalendarEvent(config: any, triggerData: any) {
        console.log(`📅 Creating calendar event from reaction trigger`);
        
        const eventData = {
            title: config.title || `Event from ${triggerData.triggerType}: ${triggerData.triggerValue}`,
            startTime: config.startTime ? new Date(config.startTime) : new Date(),
            endTime: config.endTime ? new Date(config.endTime) : new Date(Date.now() + 60 * 60 * 1000), // 1 hour default
            attendees: config.attendees || []
        };
        
        // Create calendar event using storage method
        const event = await storage.createCalendarEvent({
            title: eventData.title,
            description: `Automated event from WhatsApp reaction`,
            startTime: eventData.startTime,
            endTime: eventData.endTime,
            calendarId: 1, // Default calendar
            isAllDay: false,
            timezone: 'UTC',
            providerEventId: `whatsapp-${Date.now()}` // Generate unique provider event ID
        });
        
        return { eventId: event.eventId, title: event.title };
    },

    /**
     * Execute send message action
     */
    async executeSendMessage(config: any, triggerData: any) {
        console.log(`💬 Sending message from reaction trigger`);
        
        const message = config.message || `Automated response to ${triggerData.triggerType}: ${triggerData.triggerValue}`;
        const targetJid = config.targetJid || triggerData.context.reactorJid;
        
        // Send message via Evolution API (would need to implement actual sending)
        const result = { 
            message, 
            targetJid, 
            sent: true,
            timestamp: new Date().toISOString() 
        };
        
        return result;
    },

    /**
     * Execute add label action
     */
    async executeAddLabel(config: any, triggerData: any) {
        console.log(`🏷️ Adding label from reaction trigger`);
        
        const labelData = {
            name: config.labelName || `${triggerData.triggerType}_${triggerData.triggerValue}`,
            color: config.color || '#007bff',
            messageId: triggerData.context.messageId,
            instanceId: triggerData.instanceId
        };
        
        // Add label to message/chat (assuming we have label methods)
        const result = { labelName: labelData.name, applied: true };
        
        return result;
    },

    /**
     * Execute send notification action
     */
    async executeSendNotification(config: any, triggerData: any) {
        console.log(`🔔 Sending notification from reaction trigger`);
        
        const notification = {
            title: config.title || 'WhatsApp Action Triggered',
            message: config.message || `${triggerData.triggerType}: ${triggerData.triggerValue}`,
            type: config.type || 'info'
        };
        
        // Send notification (would integrate with notification service)
        const result = { notificationSent: true, title: notification.title };
        
        return result;
    },

    /**
     * Execute webhook action
     */
    async executeWebhook(config: any, triggerData: any) {
        console.log(`🔗 Calling webhook from reaction trigger`);
        
        const webhookData = {
            trigger: triggerData,
            config: config,
            timestamp: new Date().toISOString()
        };
        
        // Call external webhook (would need actual HTTP implementation)
        const result = { 
            webhookUrl: config.url, 
            called: true,
            data: webhookData
        };
        
        return result;
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