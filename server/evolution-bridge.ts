import WebSocket from 'ws';
import { storage } from './storage';
import { 
  insertWhatsappMessageSchema,
  insertWhatsappContactSchema,
  insertWhatsappChatSchema,
  type InsertWhatsappMessage,
  type InsertWhatsappContact,
  type InsertWhatsappChat
} from '@shared/schema';

interface BridgeConfig {
  evolutionApiUrl: string;
  instanceName: string;
  apiKey: string;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  queueOfflineMessages?: boolean;
  retryFailedSaves?: boolean;
}

interface QueuedMessage {
  type: string;
  data: any;
  operation: string;
  timestamp: number;
}

export class EvolutionWebSocketBridge {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private isConnected = false;
  private messageQueue: QueuedMessage[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private userId: string;
  private instanceId: string;

  constructor(private config: BridgeConfig, userId: string, instanceId: string) {
    this.maxReconnectAttempts = config.maxReconnectAttempts || Infinity;
    this.reconnectDelay = config.reconnectDelay || 1000;
    this.userId = userId;
    this.instanceId = instanceId;
    
    this.init();
  }

  private async init() {
    try {
      await this.connectWebSocket();
      this.startHealthCheck();
      console.log(`✅ Evolution API Bridge initialized for instance: ${this.config.instanceName}`);
    } catch (error) {
      console.error('❌ Failed to initialize bridge:', error);
      this.scheduleReconnect();
    }
  }

  private async connectWebSocket() {
    try {
      const { evolutionApiUrl, instanceName, apiKey } = this.config;
      const wsUrl = `${evolutionApiUrl.replace(/^http/, 'ws')}/ws/${instanceName}`;
      
      console.log(`🔗 Connecting to Evolution API WebSocket: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'apikey': apiKey
        }
      });

      this.setupWebSocketEvents();
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      this.scheduleReconnect();
    }
  }

  private setupWebSocketEvents() {
    if (!this.ws) return;

    // Connection Events
    this.ws.on('open', () => {
      console.log(`🔗 Connected to Evolution API WebSocket for ${this.config.instanceName}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.processQueuedMessages();
      
      // Request initial data sync for authentic WhatsApp conversations
      this.requestInitialDataSync();
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.log(`🔌 Disconnected from Evolution API (${this.config.instanceName}):`, code, reason.toString());
      this.isConnected = false;
      this.scheduleReconnect();
    });

    this.ws.on('error', (error: Error) => {
      console.error(`❌ WebSocket connection error (${this.config.instanceName}):`, error);
      this.scheduleReconnect();
    });

    // Handle incoming messages from Evolution API
    this.ws.on('message', (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString());
        this.processEvolutionEvent(event);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
  }

  private processEvolutionEvent(event: any) {
    const { event: eventType, data } = event;
    
    console.log(`📨 Evolution API Event: ${eventType}`);
    
    switch (eventType) {
      case 'messages.upsert':
        this.handleMessageUpsert(data);
        break;
      case 'messages.update':
        this.handleMessageUpdate(data);
        break;
      case 'contacts.upsert':
        this.handleContactsUpsert(data);
        break;
      case 'chats.upsert':
        this.handleChatsUpsert(data);
        break;
      case 'connection.update':
        this.handleConnectionUpdate(data);
        break;
      case 'presence.update':
        this.handlePresenceUpdate(data);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }
  }

  private requestInitialDataSync() {
    if (!this.ws || !this.isConnected) return;
    
    console.log(`📥 Requesting authentic WhatsApp data sync for ${this.config.instanceName}`);
    
    // Send requests for initial data synchronization
    this.socket.emit('fetchChats', { 
      instanceName: this.config.instanceName,
      limit: 100 
    });
    
    this.socket.emit('fetchContacts', { 
      instanceName: this.config.instanceName,
      limit: 100 
    });
    
    // Set up listeners for bulk data responses
    this.socket.on('chats.bulk', (data) => this.handleChatsBulk(data));
    this.socket.on('contacts.bulk', (data) => this.handleContactsBulk(data));
  }

  private async handleChatsBulk(data: any) {
    if (!data?.chats || !Array.isArray(data.chats)) return;
    
    console.log(`📱 Processing ${data.chats.length} authentic WhatsApp conversations`);
    
    for (const chat of data.chats) {
      try {
        const conversationData = this.processConversationData(chat);
        if (conversationData) {
          await this.saveConversation(conversationData);
        }
      } catch (error) {
        console.error('Error processing chat:', error);
      }
    }
  }

  private async handleContactsBulk(data: any) {
    if (!data?.contacts || !Array.isArray(data.contacts)) return;
    
    console.log(`👥 Processing ${data.contacts.length} authentic WhatsApp contacts`);
    
    for (const contact of data.contacts) {
      try {
        const contactData = this.processContactData(contact);
        if (contactData) {
          await this.saveContact(contactData);
        }
      } catch (error) {
        console.error('Error processing contact:', error);
      }
    }
  }

  private async handleMessageUpsert(data: any) {
    try {
      if (!data.messages || !Array.isArray(data.messages)) return;

      for (const message of data.messages) {
        const processedMessage = this.processMessageData(message);
        
        if (processedMessage) {
          await this.saveMessage(processedMessage);
        }
      }
    } catch (error) {
      console.error('Error handling message upsert:', error);
      this.queueMessage('MESSAGES_UPSERT', data, 'upsert');
    }
  }

  private async handleMessageUpdate(data: any) {
    try {
      if (!data.messages || !Array.isArray(data.messages)) return;

      for (const message of data.messages) {
        const messageId = message.key?.id;
        if (messageId) {
          // Update message status or other properties
          await storage.updateWhatsappMessage(messageId, {
            status: message.status
          });
        }
      }
    } catch (error) {
      console.error('Error handling message update:', error);
      this.queueMessage('MESSAGES_UPDATE', data, 'update');
    }
  }

  private async handleContactsUpsert(data: any) {
    try {
      if (!data.contacts || !Array.isArray(data.contacts)) return;

      for (const contact of data.contacts) {
        const processedContact = this.processContactData(contact);
        
        if (processedContact) {
          await this.saveContact(processedContact);
        }
      }
    } catch (error) {
      console.error('Error handling contacts upsert:', error);
      this.queueMessage('CONTACTS_UPSERT', data, 'upsert');
    }
  }

  private async handleChatsUpsert(data: any) {
    try {
      if (!data.chats || !Array.isArray(data.chats)) return;

      for (const chat of data.chats) {
        const processedConversation = this.processConversationData(chat);
        
        if (processedConversation) {
          await this.saveConversation(processedConversation);
        }
      }
    } catch (error) {
      console.error('Error handling chats upsert:', error);
      this.queueMessage('CHATS_UPSERT', data, 'upsert');
    }
  }

  private async handleConnectionUpdate(data: any) {
    try {
      // Update instance connection status
      await storage.updateWhatsappInstance(this.instanceId, {
        status: data.state === 'open' ? 'connected' : 'disconnected',
        lastConnectedAt: data.state === 'open' ? new Date() : undefined,
        disconnectedAt: data.state === 'close' ? new Date() : undefined,
        lastError: data.state === 'close' ? data.reason : null
      });
    } catch (error) {
      console.error('Error handling connection update:', error);
    }
  }

  private async handlePresenceUpdate(data: any) {
    try {
      // Handle presence updates (online/offline status)
      // This could update contact last seen or conversation status
      console.log('Presence update:', data);
    } catch (error) {
      console.error('Error handling presence update:', error);
    }
  }

  private processMessageData(message: any): InsertWhatsappMessage | null {
    try {
      if (!message.key) return null;

      const evolutionMessageId = message.key.id;
      const remoteJid = message.key.remoteJid;
      const fromMe = message.key.fromMe || false;
      const participant = message.key.participant;
      
      let textContent = '';
      let messageType: any = 'conversation';
      let mediaUrl = '';
      let mediaCaption = '';
      let mediaMimetype = '';
      let mediaSize: number | undefined;
      let mediaFilename = '';
      
      // Extract content based on Evolution API message structure
      if (message.message) {
        if (message.message.conversation) {
          textContent = message.message.conversation;
          messageType = 'conversation';
        } else if (message.message.extendedTextMessage) {
          textContent = message.message.extendedTextMessage.text;
          messageType = 'extendedTextMessage';
        } else if (message.message.imageMessage) {
          textContent = message.message.imageMessage.caption || '';
          mediaCaption = message.message.imageMessage.caption || '';
          mediaUrl = message.message.imageMessage.url || '';
          mediaMimetype = message.message.imageMessage.mimetype || '';
          mediaSize = message.message.imageMessage.fileLength;
          messageType = 'imageMessage';
        } else if (message.message.videoMessage) {
          mediaCaption = message.message.videoMessage.caption || '';
          mediaUrl = message.message.videoMessage.url || '';
          mediaMimetype = message.message.videoMessage.mimetype || '';
          mediaSize = message.message.videoMessage.fileLength;
          messageType = 'videoMessage';
        } else if (message.message.audioMessage) {
          mediaUrl = message.message.audioMessage.url || '';
          mediaMimetype = message.message.audioMessage.mimetype || '';
          mediaSize = message.message.audioMessage.fileLength;
          messageType = 'audioMessage';
        } else if (message.message.documentMessage) {
          textContent = message.message.documentMessage.title || '';
          mediaUrl = message.message.documentMessage.url || '';
          mediaFilename = message.message.documentMessage.fileName || '';
          mediaMimetype = message.message.documentMessage.mimetype || '';
          mediaSize = message.message.documentMessage.fileLength;
          messageType = 'documentMessage';
        } else if (message.message.stickerMessage) {
          mediaUrl = message.message.stickerMessage.url || '';
          mediaMimetype = message.message.stickerMessage.mimetype || '';
          messageType = 'stickerMessage';
        } else if (message.message.locationMessage) {
          messageType = 'locationMessage';
        } else if (message.message.contactMessage) {
          messageType = 'contactMessage';
        }
      }

      return {
        instanceId: this.instanceId,
        userId: this.userId,
        conversationId: '', // Will be resolved when creating/finding conversation
        messageId: evolutionMessageId, // Map "id" field to message_id column
        evolutionMessageId,
        remoteJid,
        fromMe,
        participant,
        messageContent: message.message || {},
        messageType,
        textContent: textContent || undefined,
        mediaUrl: mediaUrl || undefined,
        mediaMimetype: mediaMimetype || undefined,
        mediaSize: mediaSize || undefined,
        mediaFilename: mediaFilename || undefined,
        mediaCaption: mediaCaption || undefined,
        timestamp: message.messageTimestamp || Date.now(),
        pushName: message.pushName,
        status: 'sent',
        quotedMessageId: message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.key?.id,
        quotedContent: message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation,
        isForwarded: message.message?.extendedTextMessage?.contextInfo?.forwardingScore > 0,
        forwardScore: message.message?.extendedTextMessage?.contextInfo?.forwardingScore || 0,
        contextInfo: message.message?.extendedTextMessage?.contextInfo || undefined
      };
    } catch (error) {
      console.error('Error processing message data:', error);
      return null;
    }
  }

  private processContactData(contact: any): InsertWhatsappContact | null {
    try {
      return {
        instanceId: this.instanceId,
        userId: this.userId,
        remoteJid: contact.id,
        phoneNumber: contact.id.split('@')[0],
        profileName: contact.name || contact.pushName || contact.notify,
        profilePictureUrl: contact.profilePictureUrl,
        isMyContact: contact.isMyContact || false,
        isWaContact: contact.isWAContact || true,
        isBlocked: contact.isBlocked || false,
        isBusiness: contact.isBusiness || false,
        businessDescription: contact.businessProfile?.description,
        lastMessageAt: contact.lastMessageReceivedTimestamp ? new Date(contact.lastMessageReceivedTimestamp) : undefined
      };
    } catch (error) {
      console.error('Error processing contact data:', error);
      return null;
    }
  }

  private processConversationData(chat: any): InsertWhatsappConversation | null {
    try {
      return {
        instanceId: this.instanceId,
        userId: this.userId,
        remoteJid: chat.id,
        chatType: chat.id.includes('@g.us') ? 'group' : 'individual',
        chatName: chat.name || chat.pushName,
        unreadCount: chat.unreadCount || 0,
        isArchived: chat.archived || false,
        isMuted: chat.muteEndTime ? new Date(chat.muteEndTime) > new Date() : false,
        muteUntil: chat.muteEndTime ? new Date(chat.muteEndTime) : undefined,
        lastMessageId: chat.lastMessage?.key?.id
      };
    } catch (error) {
      console.error('Error processing conversation data:', error);
      return null;
    }
  }

  private extractMessageContent(message: any): string {
    if (message.message?.conversation) {
      return message.message.conversation;
    }
    if (message.message?.extendedTextMessage?.text) {
      return message.message.extendedTextMessage.text;
    }
    if (message.message?.imageMessage?.caption) {
      return message.message.imageMessage.caption;
    }
    if (message.message?.videoMessage?.caption) {
      return message.message.videoMessage.caption;
    }
    
    return JSON.stringify(message.message || {});
  }

  private async saveMessage(messageData: InsertWhatsappMessage) {
    try {
      // Validate the data before saving
      const validatedData = insertWhatsappMessageSchema.parse(messageData);
      await storage.createWhatsappMessage(validatedData);
      console.log(`✅ Saved message: ${messageData.evolutionMessageId}`);
    } catch (error) {
      console.error('❌ Failed to save message:', error);
      this.queueMessage('MESSAGES_UPSERT', messageData, 'insert');
    }
  }

  private async saveContact(contactData: InsertWhatsappContact) {
    try {
      const validatedData = insertWhatsappContactSchema.parse(contactData);
      
      // Check if contact exists and update or create
      const existingContact = await storage.getWhatsappContacts(this.userId, this.instanceId)
        .then(contacts => contacts.find(c => c.remoteJid === contactData.remoteJid));
      
      if (existingContact) {
        await storage.updateWhatsappContact(existingContact.id, validatedData);
      } else {
        await storage.createWhatsappContact(validatedData);
      }
      
      console.log(`✅ Saved contact: ${contactData.profileName}`);
    } catch (error) {
      console.error('❌ Failed to save contact:', error);
      this.queueMessage('CONTACTS_UPSERT', contactData, 'upsert');
    }
  }

  private async saveConversation(conversationData: InsertWhatsappConversation) {
    try {
      const validatedData = insertWhatsappConversationSchema.parse(conversationData);
      
      // Check if conversation exists and update or create
      const existingConversations = await storage.getWhatsappConversations(this.userId, this.instanceId);
      const existingConversation = existingConversations.find(c => c.remoteJid === conversationData.remoteJid);
      
      if (existingConversation) {
        await storage.updateWhatsappConversation(existingConversation.id, validatedData);
      } else {
        await storage.createWhatsappConversation(validatedData);
      }
      
      console.log(`✅ Saved conversation: ${conversationData.chatName}`);
    } catch (error) {
      console.error('❌ Failed to save conversation:', error);
      this.queueMessage('CHATS_UPSERT', conversationData, 'upsert');
    }
  }

  private queueMessage(type: string, data: any, operation: string) {
    if (this.config.queueOfflineMessages) {
      this.messageQueue.push({ type, data, operation, timestamp: Date.now() });
    }
  }

  private async processQueuedMessages() {
    if (this.messageQueue.length === 0) return;
    
    console.log(`📤 Processing ${this.messageQueue.length} queued messages for ${this.config.instanceName}`);
    
    for (const queuedMessage of this.messageQueue) {
      try {
        switch (queuedMessage.type) {
          case 'MESSAGES_UPSERT':
            await this.handleMessageUpsert({ messages: [queuedMessage.data] });
            break;
          case 'CONTACTS_UPSERT':
            await this.handleContactsUpsert({ contacts: [queuedMessage.data] });
            break;
          case 'CHATS_UPSERT':
            await this.handleChatsUpsert({ chats: [queuedMessage.data] });
            break;
        }
      } catch (error) {
        console.error('Error processing queued message:', error);
      }
    }
    
    this.messageQueue = [];
    console.log('✅ All queued messages processed');
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ Max reconnection attempts reached for ${this.config.instanceName}`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`🔄 Reconnecting ${this.config.instanceName} in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.init();
    }, delay);
  }

  private startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      if (!this.socket?.connected) {
        console.log(`🏥 Health check failed for ${this.config.instanceName} - reconnecting...`);
        this.scheduleReconnect();
      }
    }, 30000); // Check every 30 seconds
  }

  public async shutdown() {
    console.log(`🛑 Shutting down Evolution API Bridge for ${this.config.instanceName}...`);
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    console.log(`✅ Bridge shutdown complete for ${this.config.instanceName}`);
  }

  // Public methods for sending messages
  public async sendMessage(to: string, message: string, options?: any) {
    if (!this.socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('send_message', {
        number: to,
        textMessage: {
          text: message
        },
        ...options
      }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  public isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }
}