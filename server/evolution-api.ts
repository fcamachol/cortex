import { storage } from './storage';

export class EvolutionApiService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL!;
    this.apiKey = process.env.EVOLUTION_API_KEY!;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async createInstance(instanceName: string, webhookUrl: string) {
    try {
      const response = await this.makeRequest('/instance/create', {
        method: 'POST',
        body: JSON.stringify({
          instanceName,
          integration: 'WHATSAPP-BAILEYS',
          webhook: webhookUrl,
          webhook_by_events: true,
          events: [
            "APPLICATION_STARTUP",
            "QRCODE_UPDATED", 
            "CONNECTION_UPDATE",
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "SEND_MESSAGE",
            "CONTACTS_UPSERT",
            "CONTACTS_UPDATE",
            "PRESENCE_UPDATE",
            "CHATS_UPSERT",
            "CHATS_UPDATE",
            "CHATS_DELETE",
            "GROUPS_UPSERT",
            "GROUP_UPDATE",
            "GROUP_PARTICIPANTS_UPDATE"
          ]
        }),
      });

      return response;
    } catch (error) {
      console.error('Failed to create Evolution API instance:', error);
      throw error;
    }
  }

  async connectInstance(instanceName: string) {
    try {
      const response = await this.makeRequest(`/instance/connect/${instanceName}`, {
        method: 'GET',
      });

      return response;
    } catch (error) {
      console.error('Failed to connect Evolution API instance:', error);
      throw error;
    }
  }

  async getConnectionState(instanceName: string) {
    try {
      const response = await this.makeRequest(`/instance/connectionState/${instanceName}`, {
        method: 'GET',
      });

      return response;
    } catch (error) {
      console.error('Failed to get Evolution API connection state:', error);
      throw error;
    }
  }

  async deleteInstance(instanceName: string) {
    try {
      const response = await this.makeRequest(`/instance/delete/${instanceName}`, {
        method: 'DELETE',
      });

      return response;
    } catch (error) {
      console.error('Failed to delete Evolution API instance:', error);
      throw error;
    }
  }

  async sendMessage(instanceName: string, to: string, message: string) {
    try {
      const response = await this.makeRequest(`/message/sendText/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({
          number: to,
          text: message,
        }),
      });

      return response;
    } catch (error) {
      console.error('Failed to send message via Evolution API:', error);
      throw error;
    }
  }

  async handleWebhook(payload: any) {
    try {
      const { event, instance, data } = payload;

      console.log(`📥 Webhook received: ${event} for instance ${instance}`);

      switch (event) {
        case 'QRCODE_UPDATED':
          await this.handleQrCodeUpdate(instance, data);
          break;
        case 'CONNECTION_UPDATE':
          await this.handleConnectionUpdate(instance, data);
          break;
        case 'MESSAGES_UPSERT':
          await this.handleMessageUpsert(instance, data);
          break;
        case 'CONTACTS_UPSERT':
          await this.handleContactsUpsert(instance, data);
          break;
        case 'CHATS_UPSERT':
          await this.handleChatsUpsert(instance, data);
          break;
        default:
          console.log(`Unhandled webhook event: ${event}`);
      }
    } catch (error) {
      console.error('Failed to handle webhook:', error);
    }
  }

  private async handleQrCodeUpdate(instanceName: string, data: any) {
    try {
      // Update instance status to qr_pending and store QR code
      const instances = await storage.getWhatsappInstances("7804247f-3ae8-4eb2-8c6d-2c44f967ad42");
      const instance = instances.find(i => i.instanceName === instanceName);
      
      if (instance) {
        await storage.updateWhatsappInstance(instance.id, {
          status: 'qr_pending'
        });
      }
    } catch (error) {
      console.error('Failed to handle QR code update:', error);
    }
  }

  private async handleConnectionUpdate(instanceName: string, data: any) {
    try {
      const instances = await storage.getWhatsappInstances("7804247f-3ae8-4eb2-8c6d-2c44f967ad42");
      const instance = instances.find(i => i.instanceName === instanceName);
      
      if (instance) {
        let status = 'disconnected';
        
        if (data.state === 'open') {
          status = 'connected';
        } else if (data.state === 'connecting') {
          status = 'connecting';
        } else if (data.state === 'close') {
          status = 'disconnected';
        }

        await storage.updateWhatsappInstance(instance.id, {
          status,
          phoneNumber: data.phoneNumber || null,
          profileName: data.profileName || null
        });

        console.log(`📱 Instance ${instanceName} status updated to: ${status}`);
      }
    } catch (error) {
      console.error('Failed to handle connection update:', error);
    }
  }

  private async handleMessageUpsert(instanceName: string, data: any) {
    // Handle incoming messages and save to database
    try {
      const instances = await storage.getWhatsappInstances("7804247f-3ae8-4eb2-8c6d-2c44f967ad42");
      const instance = instances.find(i => i.instanceName === instanceName);
      
      if (!instance) return;

      for (const message of data.messages || []) {
        // Process and save message to database
        const messageData = this.processMessageData(message, instance.id, "7804247f-3ae8-4eb2-8c6d-2c44f967ad42");
        if (messageData) {
          await storage.createWhatsappMessage(messageData);
        }
      }
    } catch (error) {
      console.error('Failed to handle message upsert:', error);
    }
  }

  private async handleContactsUpsert(instanceName: string, data: any) {
    // Handle contact updates
    try {
      const instances = await storage.getWhatsappInstances("7804247f-3ae8-4eb2-8c6d-2c44f967ad42");
      const instance = instances.find(i => i.instanceName === instanceName);
      
      if (!instance) return;

      for (const contact of data.contacts || []) {
        const contactData = this.processContactData(contact, instance.id, "7804247f-3ae8-4eb2-8c6d-2c44f967ad42");
        if (contactData) {
          await storage.createWhatsappContact(contactData);
        }
      }
    } catch (error) {
      console.error('Failed to handle contacts upsert:', error);
    }
  }

  private async handleChatsUpsert(instanceName: string, data: any) {
    // Handle chat/conversation updates
    try {
      const instances = await storage.getWhatsappInstances("7804247f-3ae8-4eb2-8c6d-2c44f967ad42");
      const instance = instances.find(i => i.instanceName === instanceName);
      
      if (!instance) return;

      for (const chat of data.chats || []) {
        const conversationData = this.processConversationData(chat, instance.id, "7804247f-3ae8-4eb2-8c6d-2c44f967ad42");
        if (conversationData) {
          await storage.createWhatsappConversation(conversationData);
        }
      }
    } catch (error) {
      console.error('Failed to handle chats upsert:', error);
    }
  }

  private processMessageData(message: any, instanceId: string, userId: string) {
    // Convert Evolution API message format to our database format
    try {
      return {
        userId,
        instanceId,
        conversationId: message.key?.remoteJid || 'unknown',
        messageId: message.key?.id || `msg_${Date.now()}`,
        fromNumber: message.key?.participant || message.key?.remoteJid || 'unknown',
        toNumber: message.pushName || 'unknown',
        messageType: message.messageType || 'text',
        content: this.extractMessageContent(message),
        timestamp: message.messageTimestamp || Date.now(),
        isFromMe: message.key?.fromMe || false,
        status: 'delivered',
        metadata: JSON.stringify(message)
      };
    } catch (error) {
      console.error('Failed to process message data:', error);
      return null;
    }
  }

  private processContactData(contact: any, instanceId: string, userId: string) {
    try {
      return {
        userId,
        instanceId,
        contactId: contact.id || contact.jid || 'unknown',
        phoneNumber: contact.id || contact.jid || 'unknown',
        name: contact.name || contact.pushName || contact.verifiedName || 'Unknown',
        profilePictureUrl: contact.profilePictureUrl || null,
        status: contact.status || null,
        isBlocked: contact.isBlocked || false,
        metadata: JSON.stringify(contact)
      };
    } catch (error) {
      console.error('Failed to process contact data:', error);
      return null;
    }
  }

  private processConversationData(chat: any, instanceId: string, userId: string) {
    try {
      return {
        userId,
        instanceId,
        conversationId: chat.id || chat.jid || 'unknown',
        name: chat.name || chat.subject || 'Unknown',
        type: chat.isGroup ? 'group' : 'individual',
        lastMessageTime: chat.lastMessageTime || Date.now(),
        unreadCount: chat.unreadCount || 0,
        isArchived: chat.archived || false,
        metadata: JSON.stringify(chat)
      };
    } catch (error) {
      console.error('Failed to process conversation data:', error);
      return null;
    }
  }

  private extractMessageContent(message: any): string {
    try {
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
      
      return message.text || 'Media message';
    } catch (error) {
      return 'Unknown message';
    }
  }
}

export const evolutionApi = new EvolutionApiService();