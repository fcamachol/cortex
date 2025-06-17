import { io, Socket } from 'socket.io-client';
import { storage } from './storage';
import { 
  type InsertWhatsappMessage,
  type InsertWhatsappContact,
  type InsertWhatsappConversation
} from '@shared/schema';

interface EvolutionConfig {
  apiUrl: string;
  instanceName: string;
  apiKey: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class EvolutionAPIWebSocket {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;
  private userId: string;
  private instanceId: string;

  constructor(private config: EvolutionConfig, userId: string, instanceId: string) {
    this.userId = userId;
    this.instanceId = instanceId;
    this.config.reconnectInterval = config.reconnectInterval || 5000;
    this.config.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    
    this.init();
  }

  private async init() {
    try {
      await this.connect();
    } catch (error) {
      console.error('Evolution WebSocket initialization failed:', error);
    }
  }

  private async connect() {
    try {
      console.log(`🔗 Connecting to Evolution API WebSocket: ${this.config.apiUrl}`);
      console.log(`📱 Instance: ${this.config.instanceName}`);
      
      // Connect to Evolution API WebSocket with proper namespace
      console.log(`🔑 Using instance API key: ${this.config.apiKey.substring(0, 8)}...`);
      
      this.socket = io(this.config.apiUrl, {
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.config.maxReconnectAttempts,
        reconnectionDelay: this.config.reconnectInterval,
        query: {
          apikey: this.config.apiKey,
          instanceName: this.config.instanceName
        },
        extraHeaders: {
          'apikey': this.config.apiKey
        }
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error('Socket.IO connection failed:', error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log(`Evolution Socket.IO connected for ${this.config.instanceName}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`Evolution Socket.IO disconnected: ${reason}`);
      this.isConnected = false;
      this.scheduleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Evolution Socket.IO connection error:', error);
    });

    // Evolution API event handlers for authentic WhatsApp data
    this.socket.on('messages.upsert', async (data) => {
      await this.handleMessagesUpsert(data);
    });

    this.socket.on('messages.update', async (data) => {
      await this.handleMessagesUpdate(data);
    });

    this.socket.on('contacts.upsert', async (data) => {
      await this.handleContactsUpsert(data);
    });

    this.socket.on('chats.upsert', async (data) => {
      await this.handleChatsUpsert(data);
    });

    this.socket.on('connection.update', async (data) => {
      await this.handleConnectionUpdate(data);
    });

    this.socket.on('presence.update', async (data) => {
      await this.handlePresenceUpdate(data);
    });
  }

  private async processEvent(event: any) {
    const { event: eventType, data } = event;
    
    console.log(`Processing Evolution event: ${eventType}`);
    
    switch (eventType) {
      case 'messages.upsert':
        await this.handleMessagesUpsert(data);
        break;
      case 'messages.update':
        await this.handleMessagesUpdate(data);
        break;
      case 'contacts.upsert':
        await this.handleContactsUpsert(data);
        break;
      case 'chats.upsert':
        await this.handleChatsUpsert(data);
        break;
      case 'connection.update':
        await this.handleConnectionUpdate(data);
        break;
      case 'presence.update':
        await this.handlePresenceUpdate(data);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }
  }

  private async handleMessagesUpsert(data: any) {
    const { messages } = data;
    
    if (!messages || !Array.isArray(messages)) return;
    
    for (const message of messages) {
      try {
        await this.saveMessage(message);
      } catch (error) {
        console.error('Error saving message:', error);
      }
    }
  }

  private async saveMessage(message: any) {
    const { key, message: messageContent, messageTimestamp, status, pushName, participant } = message;
    
    const contentData = this.extractMessageContent(messageContent);
    
    const messageData: InsertWhatsappMessage = {
      userId: this.userId,
      instanceId: this.instanceId,
      conversationId: await this.getOrCreateConversationId(key.remoteJid),
      evolutionMessageId: key.id,
      remoteJid: key.remoteJid,
      fromMe: key.fromMe,
      participant: participant || null,
      messageContent: messageContent,
      messageType: contentData.type as any,
      textContent: contentData.text || null,
      mediaUrl: contentData.mediaUrl || null,
      mediaMimetype: contentData.mimetype || null,
      mediaSize: contentData.fileLength || null,
      mediaFilename: contentData.fileName || null,
      mediaCaption: contentData.caption || null,
      timestamp: messageTimestamp,
      pushName: pushName || null,
      status: status || 'pending'
    };
    
    await storage.createWhatsappMessage(messageData);
    console.log(`Message saved: ${key.id}`);
  }

  private extractMessageContent(messageContent: any) {
    if (messageContent.conversation) {
      return {
        type: 'conversation',
        text: messageContent.conversation
      };
    }
    
    if (messageContent.extendedTextMessage) {
      const ext = messageContent.extendedTextMessage;
      return {
        type: 'extendedTextMessage',
        text: ext.text,
        quotedMessageId: ext.contextInfo?.stanzaId,
        quotedContent: ext.contextInfo?.quotedMessage,
        contextInfo: ext.contextInfo
      };
    }
    
    if (messageContent.imageMessage) {
      const img = messageContent.imageMessage;
      return {
        type: 'imageMessage',
        caption: img.caption,
        mediaUrl: img.url,
        mimetype: img.mimetype,
        fileLength: img.fileLength,
        fileName: img.fileName
      };
    }
    
    if (messageContent.videoMessage) {
      const vid = messageContent.videoMessage;
      return {
        type: 'videoMessage',
        caption: vid.caption,
        mediaUrl: vid.url,
        mimetype: vid.mimetype,
        fileLength: vid.fileLength,
        fileName: vid.fileName
      };
    }
    
    if (messageContent.audioMessage) {
      const audio = messageContent.audioMessage;
      return {
        type: 'audioMessage',
        mediaUrl: audio.url,
        mimetype: audio.mimetype,
        fileLength: audio.fileLength
      };
    }
    
    if (messageContent.documentMessage) {
      const doc = messageContent.documentMessage;
      return {
        type: 'documentMessage',
        mediaUrl: doc.url,
        mimetype: doc.mimetype,
        fileLength: doc.fileLength,
        fileName: doc.fileName,
        caption: doc.caption
      };
    }
    
    return {
      type: 'unknown',
      text: JSON.stringify(messageContent)
    };
  }

  private async getOrCreateConversationId(remoteJid: string): Promise<string> {
    const conversations = await storage.getWhatsappConversations(this.userId);
    const existing = conversations.find(conv => conv.remoteJid === remoteJid);
    
    if (existing) {
      return existing.id;
    }
    
    const conversationData: InsertWhatsappConversation = {
      userId: this.userId,
      instanceId: this.instanceId,
      remoteJid: remoteJid,
      chatName: this.getChatName(remoteJid),
      chatType: this.getChatType(remoteJid),
      unreadCount: 0,
      lastMessageContent: '',
      lastMessageTimestamp: Date.now(),
      lastMessageFromMe: false
    };
    
    const newConversation = await storage.createWhatsappConversation(conversationData);
    return newConversation.id;
  }

  private getChatName(remoteJid: string): string {
    if (remoteJid.includes('@g.us')) {
      return 'Group Chat';
    } else if (remoteJid === 'status@broadcast') {
      return 'Status Updates';
    } else {
      return remoteJid.split('@')[0];
    }
  }

  private getChatType(remoteJid: string): 'individual' | 'group' | 'broadcast' {
    if (remoteJid.includes('@g.us')) {
      return 'group';
    } else if (remoteJid === 'status@broadcast') {
      return 'broadcast';
    } else {
      return 'individual';
    }
  }

  private async handleMessagesUpdate(data: any) {
    console.log('Messages update received');
  }

  private async handleContactsUpsert(data: any) {
    const { contacts } = data;
    
    if (!contacts || !Array.isArray(contacts)) return;
    
    for (const contact of contacts) {
      try {
        await this.saveContact(contact);
      } catch (error) {
        console.error('Error saving contact:', error);
      }
    }
  }

  private async saveContact(contact: any) {
    const contactData: InsertWhatsappContact = {
      userId: this.userId,
      instanceId: this.instanceId,
      remoteJid: contact.id,
      pushName: contact.notify || null,
      phoneNumber: contact.id.split('@')[0],
      profileName: contact.name || null,
      profilePictureUrl: contact.imgUrl || null,
      isMyContact: contact.isMyContact || false,
      isWaContact: contact.isWAContact || false,
      isBusiness: contact.isBusiness || false
    };
    
    await storage.createWhatsappContact(contactData);
    console.log(`Contact saved: ${contact.id}`);
  }

  private async handleChatsUpsert(data: any) {
    const { chats } = data;
    
    if (!chats || !Array.isArray(chats)) return;
    
    for (const chat of chats) {
      try {
        await this.saveChat(chat);
      } catch (error) {
        console.error('Error saving chat:', error);
      }
    }
  }

  private async saveChat(chat: any) {
    const conversationData: InsertWhatsappConversation = {
      userId: this.userId,
      instanceId: this.instanceId,
      remoteJid: chat.id,
      chatName: chat.name || this.getChatName(chat.id),
      chatType: this.getChatType(chat.id),
      unreadCount: chat.unreadCount || 0,
      lastMessageContent: chat.lastMessage?.message || '',
      lastMessageTimestamp: chat.lastMessageTimestamp || Date.now(),
      lastMessageFromMe: chat.lastMessage?.fromMe || false,
      isArchived: chat.archived || false,
      isPinned: chat.pinned || false,
      isMuted: chat.mute || false
    };
    
    await storage.createWhatsappConversation(conversationData);
    console.log(`Chat saved: ${chat.id}`);
  }

  private async handleConnectionUpdate(data: any) {
    console.log('Connection update:', data);
  }

  private async handlePresenceUpdate(data: any) {
    console.log('Presence update:', data);
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < (this.config.maxReconnectAttempts || 10)) {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts} in ${this.config.reconnectInterval}ms`);
      
      setTimeout(() => {
        this.connect();
      }, this.config.reconnectInterval);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  public async shutdown() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  public async sendMessage(to: string, message: string, options?: any) {
    if (this.socket && this.isConnected) {
      this.socket.emit('sendMessage', {
        instanceName: this.config.instanceName,
        to: to,
        message: message,
        ...options
      });
    }
  }

  public isSocketConnected(): boolean {
    return this.isConnected;
  }
}