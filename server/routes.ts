import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { evolutionManager } from "./evolution-manager";
import { getEvolutionApi, updateEvolutionApiSettings, getEvolutionApiSettings, getInstanceEvolutionApi } from "./evolution-api";
import { db } from "./db";
import { 
  insertAppUserSchema,
  insertWhatsappInstanceSchema,
  insertWhatsappContactSchema,
  insertWhatsappConversationSchema,
  insertWhatsappMessageSchema,
  insertTaskSchema,
  insertContactSchema,
  insertConversationSchema,
  insertMessageSchema
} from "@shared/schema";

// Format phone number to E.164 International Format
function formatToE164(phoneNumber: string): string {
  // Remove all non-digit characters
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Handle different country codes and formats
  if (cleanNumber.startsWith('1') && cleanNumber.length === 11) {
    // US/Canada: +1 XXXXXXXXXX
    return `+1 ${cleanNumber.slice(1, 4)} ${cleanNumber.slice(4, 7)} ${cleanNumber.slice(7)}`;
  } else if (cleanNumber.startsWith('52') && cleanNumber.length === 12) {
    // Mexico: +52 XX XXXX XXXX
    return `+52 ${cleanNumber.slice(2, 4)} ${cleanNumber.slice(4, 8)} ${cleanNumber.slice(8)}`;
  } else if (cleanNumber.startsWith('34') && cleanNumber.length === 11) {
    // Spain: +34 XXX XXX XXX
    return `+34 ${cleanNumber.slice(2, 5)} ${cleanNumber.slice(5, 8)} ${cleanNumber.slice(8)}`;
  } else if (cleanNumber.startsWith('44') && cleanNumber.length >= 10) {
    // UK: +44 XXXX XXXXXX
    return `+44 ${cleanNumber.slice(2, 6)} ${cleanNumber.slice(6)}`;
  } else if (cleanNumber.startsWith('49') && cleanNumber.length >= 11) {
    // Germany: +49 XXX XXXXXXXX
    return `+49 ${cleanNumber.slice(2, 5)} ${cleanNumber.slice(5)}`;
  } else if (cleanNumber.startsWith('33') && cleanNumber.length === 11) {
    // France: +33 X XX XX XX XX
    return `+33 ${cleanNumber.slice(2, 3)} ${cleanNumber.slice(3, 5)} ${cleanNumber.slice(5, 7)} ${cleanNumber.slice(7, 9)} ${cleanNumber.slice(9)}`;
  } else if (cleanNumber.startsWith('55') && cleanNumber.length >= 12) {
    // Brazil: +55 XX XXXXX XXXX
    return `+55 ${cleanNumber.slice(2, 4)} ${cleanNumber.slice(4, 9)} ${cleanNumber.slice(9)}`;
  } else if (cleanNumber.startsWith('91') && cleanNumber.length >= 12) {
    // India: +91 XXXXX XXXXX
    return `+91 ${cleanNumber.slice(2, 7)} ${cleanNumber.slice(7)}`;
  } else {
    // Default fallback: add + and format with spaces every 3-4 digits
    const countryCode = cleanNumber.slice(0, 2);
    const remaining = cleanNumber.slice(2);
    if (remaining.length >= 8) {
      return `+${countryCode} ${remaining.slice(0, 4)} ${remaining.slice(4)}`;
    } else {
      return `+${countryCode} ${remaining}`;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Evolution API Webhook endpoint for real-time WhatsApp events
  app.post('/api/evolution/webhook/:instanceName', async (req, res) => {
    try {
      const { instanceName } = req.params;
      const webhookData = req.body;
      
      console.log(`📨 Evolution API Webhook for ${instanceName}:`, JSON.stringify(webhookData, null, 2));
      
      // Process different event types from Evolution API
      const { event, data } = webhookData;
      
      switch (event) {
        case 'messages.upsert':
          await handleWebhookMessagesUpsert(instanceName, data);
          break;
        case 'send.message':
          await handleWebhookMessagesUpsert(instanceName, data);
          break;
        case 'messages.update':
          console.log(`🔄 Messages update for ${instanceName}:`, data);
          break;
        case 'contacts.upsert':
          await handleWebhookContactsUpsert(instanceName, data);
          break;
        case 'chats.upsert':
          await handleWebhookChatsUpsert(instanceName, data);
          break;
        case 'presence.update':
          console.log(`👁️ Presence update for ${instanceName}:`, data);
          break;
        case 'connection.update':
          console.log(`🔗 Connection update for ${instanceName}:`, data);
          break;
        default:
          console.log(`🎯 Unhandled Evolution API event: ${event}`, data);
      }
      
      res.status(200).json({ status: 'received' });
    } catch (error) {
      console.error('Evolution API webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Webhook handler functions for Evolution API events
  async function handleWebhookMessagesUpsert(instanceName: string, data: any) {
    console.log(`📩 Processing messages.upsert for ${instanceName}:`, JSON.stringify(data, null, 2));
    
    try {
      // Find the instance in our database
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      if (!instance) {
        console.error(`Instance ${instanceName} not found in database`);
        return;
      }

      // Handle single message from Evolution API webhook format
      const message = data; // Evolution API sends single message object, not array
      
      if (!message || !message.key) {
        console.log('Invalid message format received');
        return;
      }

      // Determine message type from the message content
      let messageType = 'conversation';
      if (message.message) {
        const messageContent = message.message;
        if (messageContent.conversation) messageType = 'conversation';
        else if (messageContent.extendedTextMessage) messageType = 'extendedTextMessage';
        else if (messageContent.imageMessage) messageType = 'imageMessage';
        else if (messageContent.videoMessage) messageType = 'videoMessage';
        else if (messageContent.audioMessage) messageType = 'audioMessage';
        else if (messageContent.documentMessage) messageType = 'documentMessage';
        else if (messageContent.stickerMessage) messageType = 'stickerMessage';
        else if (messageContent.locationMessage) messageType = 'locationMessage';
        else if (messageContent.contactMessage) messageType = 'contactMessage';
      }

      // Extract media information
      const mediaUrl = message.message ? getMediaUrl(message.message) : null;
      const mediaMimetype = message.message ? getMediaMimetype(message.message) : null;
      const mediaSize = message.message ? getMediaSize(message.message) : null;
      const mediaFilename = message.message ? getMediaFilename(message.message) : null;
      const mediaCaption = message.message ? getMediaCaption(message.message) : null;

      // Save to evolution_messages table (no foreign key constraints)
      const evolutionMessageData = {
        userId: instance.userId, // Include user_id for RLS
        instanceName: instanceName,
        messageId: message.key.id || '', // Map "id" field to message_id column
        evolutionMessageId: message.key.id || '',
        remoteJid: message.key.remoteJid || '',
        fromMe: message.key.fromMe || false,
        participant: message.participant || null,
        pushName: message.pushName || null,
        messageContent: message.message || null,
        messageType: messageType,
        textContent: extractMessageContent(message),
        mediaUrl: mediaUrl,
        mediaMimetype: mediaMimetype,
        mediaSize: mediaSize,
        mediaFilename: mediaFilename,
        mediaCaption: mediaCaption,
        status: message.status || 'received',
        timestamp: message.messageTimestamp || Math.floor(Date.now() / 1000),
        contextInfo: message.contextInfo || null,
        rawWebhookData: data
      };

      const savedMessage = await storage.createEvolutionMessage(evolutionMessageData);
      console.log(`✅ Saved Evolution message from ${message.pushName || 'Unknown'}: "${evolutionMessageData.textContent}"`);
      
    } catch (error) {
      console.error('Error saving webhook message:', error);
      console.error('Message data:', data);
    }
  }

  async function handleWebhookContactsUpsert(instanceName: string, data: any) {
    console.log(`👤 Processing contacts.upsert for ${instanceName}:`, data);
    // Implementation for contact updates
  }

  async function handleWebhookChatsUpsert(instanceName: string, data: any) {
    console.log(`💬 Processing chats.upsert for ${instanceName}:`, data);
    // Implementation for chat/conversation updates
  }

  // Helper functions for media extraction
  function getMediaUrl(messageContent: any): string | null {
    if (!messageContent) return null;
    
    if (messageContent.imageMessage?.url) return messageContent.imageMessage.url;
    if (messageContent.videoMessage?.url) return messageContent.videoMessage.url;
    if (messageContent.audioMessage?.url) return messageContent.audioMessage.url;
    if (messageContent.documentMessage?.url) return messageContent.documentMessage.url;
    
    return null;
  }

  function getMediaMimetype(messageContent: any): string | null {
    if (!messageContent) return null;
    
    if (messageContent.imageMessage?.mimetype) return messageContent.imageMessage.mimetype;
    if (messageContent.videoMessage?.mimetype) return messageContent.videoMessage.mimetype;
    if (messageContent.audioMessage?.mimetype) return messageContent.audioMessage.mimetype;
    if (messageContent.documentMessage?.mimetype) return messageContent.documentMessage.mimetype;
    
    return null;
  }

  function getMediaSize(messageContent: any): number | null {
    if (!messageContent) return null;
    
    if (messageContent.imageMessage?.fileLength) return parseInt(messageContent.imageMessage.fileLength);
    if (messageContent.videoMessage?.fileLength) return parseInt(messageContent.videoMessage.fileLength);
    if (messageContent.audioMessage?.fileLength) return parseInt(messageContent.audioMessage.fileLength);
    if (messageContent.documentMessage?.fileLength) return parseInt(messageContent.documentMessage.fileLength);
    
    return null;
  }

  function getMediaFilename(messageContent: any): string | null {
    if (!messageContent) return null;
    
    if (messageContent.documentMessage?.fileName) return messageContent.documentMessage.fileName;
    if (messageContent.imageMessage?.fileName) return messageContent.imageMessage.fileName;
    if (messageContent.videoMessage?.fileName) return messageContent.videoMessage.fileName;
    if (messageContent.audioMessage?.fileName) return messageContent.audioMessage.fileName;
    
    return null;
  }

  function getMediaCaption(messageContent: any): string | null {
    if (!messageContent) return null;
    
    if (messageContent.imageMessage?.caption) return messageContent.imageMessage.caption;
    if (messageContent.videoMessage?.caption) return messageContent.videoMessage.caption;
    if (messageContent.documentMessage?.caption) return messageContent.documentMessage.caption;
    
    return null;
  }

  function extractMessageContent(message: any): string {
    if (message.message?.conversation) return message.message.conversation;
    if (message.message?.extendedTextMessage?.text) return message.message.extendedTextMessage.text;
    if (message.message?.imageMessage?.caption) return message.message.imageMessage.caption;
    if (message.message?.videoMessage?.caption) return message.message.videoMessage.caption;
    return '[Media message]';
  }

  async function getOrCreateConversationId(instanceId: string, remoteJid: string): Promise<string> {
    // Check if conversation exists
    const conversations = await storage.getWhatsappConversations(instanceId);
    const existing = conversations.find(c => c.remoteJid === remoteJid);
    
    if (existing) {
      return existing.id;
    }

    // Create new conversation
    const newConversation = await storage.saveWhatsappConversation({
      userId: instanceId, // Will be corrected with proper user lookup
      instanceId,
      remoteJid,
      chatName: remoteJid.includes('@g.us') ? 'Group Chat' : remoteJid.split('@')[0],
      chatType: remoteJid.includes('@g.us') ? 'group' : 'individual',
      lastMessageTimestamp: Math.floor(Date.now() / 1000),
      unreadCount: 0
    });

    return newConversation.id;
  }

  // WebSocket server for real-time messaging
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store active WebSocket connections
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth') {
          // Store authenticated connection
          clients.set(message.userId, ws);
        }

        if (message.type === 'send_message') {
          // Handle sending messages through Evolution API
          // This would integrate with Evolution API to send WhatsApp messages
          console.log('Sending message:', message.data);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Remove client from active connections
      clients.forEach((client, userId) => {
        if (client === ws) {
          clients.delete(userId);
        }
      });
      console.log('WebSocket client disconnected');
    });
  });

  // Broadcast function for real-time updates
  const broadcast = (userId: string, data: any) => {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  };

  // WebSocket connection status endpoint
  app.get('/api/whatsapp/websocket/status', async (req, res) => {
    try {
      const allStatuses = evolutionManager.getAllBridgeStatuses();
      const instances = await storage.getWhatsappInstances(req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
      
      const statusWithDetails = instances.map(instance => {
        const status = allStatuses.find(s => s.key === instance.instanceName);
        return {
          instanceId: instance.id,
          instanceName: instance.instanceName,
          phoneNumber: instance.phoneNumber,
          status: instance.status,
          websocketConnected: status?.connected || false,
          bridgeExists: !!status,
          lastConnected: instance.lastConnectedAt,
          connectionState: instance.connectionState || 'unknown'
        };
      });

      res.json(statusWithDetails);
    } catch (error) {
      console.error('Error getting WebSocket status:', error);
      res.status(500).json({ error: 'Failed to get WebSocket status' });
    }
  });

  app.get('/api/whatsapp/websocket/status/:instanceName', async (req, res) => {
    try {
      const { instanceName } = req.params;
      const status = evolutionManager.getBridgeStatus(instanceName);
      const instance = await storage.getWhatsappInstanceByName(instanceName);
      
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      res.json({
        instanceId: instance.id,
        instanceName: instance.instanceName,
        phoneNumber: instance.phoneNumber,
        status: instance.status,
        websocketConnected: status.connected,
        bridgeExists: status.bridgeExists,
        lastConnected: instance.lastConnectedAt,
        connectionState: 'open',
        serverUrl: 'https://evolution-api-evolution-api.vuswn0.easypanel.host'
      });
    } catch (error) {
      console.error('Error getting instance WebSocket status:', error);
      res.status(500).json({ error: 'Failed to get instance WebSocket status' });
    }
  });

  // User routes
  app.get("/api/user/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertAppUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  // WhatsApp instance routes
  app.get("/api/whatsapp/instances/:userId", async (req, res) => {
    try {
      const instances = await storage.getWhatsappInstances(req.params.userId);
      res.json(instances);
    } catch (error) {
      res.status(500).json({ error: "Failed to get WhatsApp instances" });
    }
  });

  app.post("/api/whatsapp/instances", async (req, res) => {
    try {
      const instanceData = insertWhatsappInstanceSchema.parse(req.body);
      
      // Create instance in Evolution API using global API key
      try {
        const evolutionApi = getEvolutionApi();
        const createResponse = await evolutionApi.createInstance({
          instanceName: instanceData.instanceName,
          integration: "WHATSAPP-BAILEYS",
          webhook_url: instanceData.webhookUrl ? instanceData.webhookUrl : undefined,
          events: [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'MESSAGES_DELETE',
            'SEND_MESSAGE',
            'CONTACTS_UPDATE',
            'CONTACTS_UPSERT',
            'PRESENCE_UPDATE',
            'CHATS_UPDATE',
            'CHATS_UPSERT',
            'CHATS_DELETE',
            'GROUPS_UPSERT',
            'GROUP_UPDATE',
            'GROUP_PARTICIPANTS_UPDATE',
            'NEW_JWT_TOKEN'
          ]
        });

        // Capture the instance-specific API key from Evolution API response
        const instanceApiKey = typeof createResponse.hash === 'object' ? createResponse.hash.apikey : createResponse.hash;
        
        // Store instance with the captured API key
        const instance = await storage.createWhatsappInstance({
          ...instanceData,
          instanceApiKey: typeof instanceApiKey === 'string' ? instanceApiKey : undefined,
          status: "created"
        });

        console.log(`✅ Created instance: ${instanceData.instanceName} with API key: ${typeof instanceApiKey === 'string' ? instanceApiKey.substring(0, 8) + '...' : 'none'}`);
        
        res.status(201).json(instance);
      } catch (evolutionError: any) {
        console.error("Evolution API creation failed:", evolutionError);
        
        // Fall back to creating instance without Evolution API
        const instance = await storage.createWhatsappInstance({
          ...instanceData,
          status: "creation_failed"
        });
        
        res.status(201).json({
          ...instance,
          warning: "Instance created locally but failed to register with Evolution API"
        });
      }
    } catch (error) {
      console.error("Instance creation error:", error);
      res.status(400).json({ error: "Invalid instance data" });
    }
  });

  app.put("/api/whatsapp/instances/:id", async (req, res) => {
    try {
      const updateData = req.body;
      const instance = await storage.updateWhatsappInstance(req.params.id, updateData);
      
      // Refresh the Evolution API bridge for this instance
      const oldInstance = await storage.getWhatsappInstance(req.params.id);
      if (oldInstance) {
        await evolutionManager.refreshInstance(oldInstance.userId, req.params.id);
      }
      
      res.json(instance);
    } catch (error) {
      res.status(400).json({ error: "Failed to update instance" });
    }
  });

  // PATCH route for partial instance updates (used by QR flow)
  app.patch("/api/whatsapp/instances/:id", async (req, res) => {
    try {
      const updateData = req.body;
      const instance = await storage.updateWhatsappInstance(req.params.id, updateData);
      res.json(instance);
    } catch (error) {
      res.status(400).json({ error: "Failed to update instance" });
    }
  });

  app.delete("/api/whatsapp/instances/:id", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      console.log(`🗑️ Deleting instance: ${instance.instanceName} (${instance.id})`);

      // Remove the Evolution WebSocket bridge first
      await evolutionManager.removeBridge(instance.instanceName);

      // Delete the instance from Evolution API if we have an instance API key
      if (instance.instanceApiKey) {
        try {
          const instanceEvolutionApi = getInstanceEvolutionApi(instance.instanceApiKey);
          await instanceEvolutionApi.deleteInstance(instance.instanceName);
          console.log(`✅ Instance ${instance.instanceName} deleted from Evolution API`);
        } catch (evolutionError: any) {
          console.error(`❌ Failed to delete instance from Evolution API:`, evolutionError);
          // Continue with database deletion even if Evolution API fails
        }
      } else if (instance.instanceName) {
        try {
          // Fallback to global API key if no instance-specific key
          const globalEvolutionApi = getEvolutionApi();
          await globalEvolutionApi.deleteInstance(instance.instanceName);
          console.log(`✅ Instance ${instance.instanceName} deleted from Evolution API (global key)`);
        } catch (evolutionError: any) {
          console.error(`❌ Failed to delete instance from Evolution API with global key:`, evolutionError);
        }
      }

      // Delete from database
      await storage.deleteWhatsappInstance(req.params.id);
      console.log(`✅ Instance ${instance.instanceName} deleted from database`);

      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete instance:", error);
      res.status(400).json({ error: "Failed to delete instance" });
    }
  });

  app.get("/api/whatsapp/instances/:id/status", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }
      
      // HTTP polling mode - disable bridge status since WebSocket is disabled
      const bridgeStatus = {
        connected: false,
        bridgeExists: false
      };
      
      // Get real-time status and QR code using HTTP polling
      try {
        let qrCodeData = null;
        let connectionState = null;
        
        if (instance.instanceApiKey) {
          // Use instance-specific API key for authenticated requests
          const instanceApi = getInstanceEvolutionApi(instance.instanceApiKey);
          
          // Get connection state
          connectionState = await instanceApi.getConnectionState(instance.instanceName);
          console.log(`📊 Connection state for ${instance.instanceName}:`, connectionState.instance.state);
          
          // Try to get QR code if connecting
          if (connectionState.instance.state === 'connecting') {
            try {
              qrCodeData = await instanceApi.getQRCode(instance.instanceName);
              console.log(`📱 QR Code retrieved for ${instance.instanceName}:`, qrCodeData ? 'Available' : 'Not available');
            } catch (qrError: any) {
              console.log(`⚠️ QR Code not ready for ${instance.instanceName}:`, qrError.message);
            }
          }
        } else {
          // Fall back to global API
          const evolutionApi = getEvolutionApi();
          connectionState = await evolutionApi.getConnectionState(instance.instanceName);
          
          if (connectionState.instance.state === 'connecting') {
            try {
              qrCodeData = await evolutionApi.getQRCode(instance.instanceName);
            } catch (qrError: any) {
              console.log(`⚠️ QR Code not ready for ${instance.instanceName}:`, qrError.message);
            }
          }
        }
        
        // Map Evolution API status to our status
        const mappedStatus = connectionState.instance.state === 'open' ? 'connected' : 
                           connectionState.instance.state === 'connecting' ? 'connecting' :
                           'disconnected';
        
        // Update database if status changed
        if (mappedStatus !== instance.status) {
          await storage.updateWhatsappInstance(req.params.id, {
            status: mappedStatus
          });
          console.log(`📱 Updated ${instance.instanceName} status: ${instance.status} -> ${mappedStatus}`);
        }
        
        res.json({
          instance: {
            id: instance.id,
            name: instance.instanceName,
            status: mappedStatus
          },
          bridge: bridgeStatus,
          qrCode: qrCodeData || connectionState.qrcode,
          evolutionStatus: {
            status: connectionState.instance.state,
            qrcode: qrCodeData || connectionState.qrcode
          }
        });
      } catch (apiError: any) {
        console.error(`❌ Evolution API error for ${instance.instanceName}:`, apiError.message);
        // Fall back to database status if API is unavailable
        res.json({
          instance: {
            id: instance.id,
            name: instance.instanceName,
            status: instance.status
          },
          bridge: bridgeStatus,
          qrCode: null,
          evolutionStatus: {
            status: 'error',
            error: apiError.message
          }
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to get instance status" });
    }
  });

  app.post("/api/whatsapp/instances/:id/connect", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      // Update instance status to connecting
      await storage.updateWhatsappInstance(req.params.id, {
        status: "connecting"
      });

      try {
        const evolutionApi = getEvolutionApi();
        
        // Create/ensure instance exists in Evolution API
        let instanceApiKey = instance.instanceApiKey;
        
        if (!instanceApiKey) {
          try {
            console.log(`Creating new instance in Evolution API: ${instance.instanceName}`);
            const createResponse = await evolutionApi.createInstance({
              instanceName: instance.instanceName,
              integration: "WHATSAPP-BAILEYS",
              webhook_url: instance.webhookUrl || undefined,
              events: [
                'APPLICATION_STARTUP',
                'QRCODE_UPDATED', 
                'CONNECTION_UPDATE',
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'CONTACTS_UPSERT',
                'CHATS_UPSERT'
              ]
            });

            if (createResponse.hash?.apikey) {
              instanceApiKey = createResponse.hash.apikey;
              await storage.updateWhatsappInstance(req.params.id, {
                instanceApiKey: instanceApiKey
              });
              console.log(`✅ Created and stored API key for instance: ${instance.instanceName}`);
            } else {
              throw new Error("No API key returned from instance creation");
            }
          } catch (createError: any) {
            console.error(`Failed to create instance ${instance.instanceName}:`, createError.message);
            return res.status(500).json({
              success: false,
              message: `Failed to create instance: ${createError.message}`,
              needsConfiguration: true
            });
          }
        }
        
        // Now connect the instance and ensure it's ready
        try {
          await evolutionApi.connectInstance(instance.instanceName);
          console.log(`✅ Instance connection initiated: ${instance.instanceName}`);
          
          // Wait a moment for instance to initialize, then try to get QR code
          setTimeout(async () => {
            try {
              const qrCode = await evolutionApi.getQRCode(instance.instanceName);
              console.log(`📱 Initial QR Code generated for ${instance.instanceName}`);
            } catch (qrError: any) {
              console.log(`⚠️ QR Code not immediately available for ${instance.instanceName}: ${qrError.message}`);
            }
          }, 2000);
          
        } catch (connectError: any) {
          console.log(`Connection attempt for ${instance.instanceName}:`, connectError.message);
        }
        
        res.json({
          success: true,
          message: "Connection initiated successfully"
        });
      } catch (apiError: any) {
        console.error("Evolution API connection error:", apiError);
        res.json({
          success: false,
          message: apiError.message || "Failed to connect to Evolution API",
          needsConfiguration: false
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate connection" });
    }
  });

  app.get("/api/whatsapp/instances/:id/qr", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      try {
        // Ensure instance has API key, create if needed
        let instanceApiKey = instance.instanceApiKey;
        
        if (!instanceApiKey) {
          console.log(`No API key found for instance ${instance.instanceName}, retrieving from Evolution API`);
          try {
            const evolutionApi = getEvolutionApi();
            
            // Try to get existing instance info first
            try {
              const instanceInfo = await evolutionApi.getInstanceInfo(instance.instanceName);
              if (instanceInfo.hash?.apikey) {
                instanceApiKey = instanceInfo.hash.apikey;
                await storage.updateWhatsappInstance(req.params.id, {
                  instanceApiKey: instanceApiKey
                });
                console.log(`✅ Retrieved and stored API key for existing instance: ${instance.instanceName}`);
              }
            } catch (getError: any) {
              // Instance doesn't exist, try to create it
              console.log(`Instance ${instance.instanceName} not found, creating new instance`);
              const createResponse = await evolutionApi.createInstance({
                instanceName: instance.instanceName,
                integration: "WHATSAPP-BAILEYS",
                webhook_url: instance.webhookUrl || undefined,
                events: [
                  'APPLICATION_STARTUP',
                  'QRCODE_UPDATED', 
                  'CONNECTION_UPDATE',
                  'MESSAGES_UPSERT',
                  'MESSAGES_UPDATE',
                  'CONTACTS_UPSERT',
                  'CHATS_UPSERT'
                ]
              });

              if (createResponse.hash?.apikey) {
                instanceApiKey = createResponse.hash.apikey;
                await storage.updateWhatsappInstance(req.params.id, {
                  instanceApiKey: instanceApiKey
                });
                console.log(`✅ Created instance and stored API key: ${instance.instanceName}`);
              }
            }

            if (!instanceApiKey) {
              throw new Error("Could not obtain API key for instance");
            }
          } catch (apiError: any) {
            console.error(`Failed to get/create instance ${instance.instanceName}:`, apiError.message);
            return res.status(500).json({
              qrCode: null,
              status: "error",
              message: `Failed to setup instance: ${apiError.message}`
            });
          }
        }

        // Use instance-specific API key
        const evolutionApi = getInstanceEvolutionApi(instanceApiKey);
        
        console.log(`Fetching QR code for instance: ${instance.instanceName} with API key: ${instanceApiKey}`);
        
        // Try to get QR code by connecting to the instance
        try {
          const qrResponse = await evolutionApi.getQRCode(instance.instanceName);
          console.log('QR response received:', Object.keys(qrResponse));
          
          if (qrResponse.base64) {
            await storage.updateWhatsappInstance(req.params.id, {
              status: "qr_pending"
            });

            return res.json({
              qrCode: qrResponse.base64.startsWith('data:') 
                ? qrResponse.base64 
                : `data:image/png;base64,${qrResponse.base64}`,
              status: "qr_pending",
              pairingCode: qrResponse.pairingCode || null
            });
          }
        } catch (qrError: any) {
          console.log("QR fetch failed, checking connection state:", qrError.message);
        }

        // Check connection state as fallback
        try {
          const connectionState = await evolutionApi.getConnectionState(instance.instanceName);
          console.log('Connection state:', connectionState);
          
          if (connectionState.instance.state === 'open') {
            await storage.updateWhatsappInstance(req.params.id, {
              status: "connected"
            });
            return res.json({
              qrCode: null,
              status: "connected",
              message: "Instance is already connected"
            });
          }
          
          if (connectionState.qrcode?.base64) {
            await storage.updateWhatsappInstance(req.params.id, {
              status: "qr_pending"
            });

            return res.json({
              qrCode: connectionState.qrcode.base64.startsWith('data:') 
                ? connectionState.qrcode.base64 
                : `data:image/png;base64,${connectionState.qrcode.base64}`,
              status: "qr_pending",
              pairingCode: connectionState.qrcode.pairingCode || null
            });
          }
        } catch (stateError: any) {
          console.log("Connection state check failed:", stateError.message);
        }

        // No QR code available
        res.json({
          qrCode: null,
          status: "disconnected",
          message: "QR code not available. Try connecting the instance first."
        });
        
      } catch (apiError: any) {
        console.error("Evolution API QR error:", apiError);
        res.status(503).json({ 
          qrCode: null,
          status: "error",
          message: apiError.message || "Failed to get QR code"
        });
      }
    } catch (error) {
      console.error("QR generation error:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // WhatsApp profile endpoint
  app.get("/api/whatsapp/instances/:id/profile", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      if (!instance.instanceApiKey) {
        return res.status(400).json({ error: "Instance not configured" });
      }

      try {
        const evolutionApi = getInstanceEvolutionApi(instance.instanceApiKey);
        
        // Try multiple approaches to get phone number
        let profileData = null;
        
        try {
          // First try: Get instance info which might contain owner details
          const instanceInfo = await evolutionApi.getInstanceInfo(instance.instanceName);
          console.log(`📱 Instance info for ${instance.instanceName}:`, instanceInfo);
          
          if (instanceInfo) {
            // Handle both array and object responses from Evolution API
            const instanceData = Array.isArray(instanceInfo) ? instanceInfo[0] : instanceInfo;
            console.log(`📱 Processing instance data:`, instanceData);
            
            if (instanceData) {
              // Extract and format phone number to E.164 International Format
              let formattedPhone = null;
              if (instanceData.ownerJid) {
                const rawNumber = instanceData.ownerJid.split('@')[0];
                formattedPhone = formatToE164(rawNumber);
              }
              
              profileData = {
                instanceName: instanceData.name || instanceData.instanceName,
                owner: instanceData.ownerJid,
                profileName: instanceData.profileName,
                profilePictureUrl: instanceData.profilePicUrl,
                status: instanceData.connectionStatus || instanceData.status,
                phoneNumber: formattedPhone
              };
              console.log(`📱 Created profile data:`, profileData);
            }
          }
        } catch (infoError) {
          console.log('Instance info fetch failed, trying contacts...');
          
          try {
            // Second try: Fetch contacts to find owner number
            const contacts = await evolutionApi.fetchContacts(instance.instanceName);
            console.log(`📱 Contacts for ${instance.instanceName}:`, contacts);
            
            if (contacts && contacts.length > 0) {
              // Look for the owner's contact (usually the first one or marked as owner)
              const ownerContact = contacts.find((c: any) => c.isMyContact || c.owner) || contacts[0];
              if (ownerContact) {
                profileData = {
                  phoneNumber: ownerContact.id?.split('@')[0] || ownerContact.number,
                  profileName: ownerContact.name || ownerContact.pushName,
                  profilePictureUrl: ownerContact.profilePictureUrl
                };
              }
            }
          } catch (contactsError) {
            console.log('Contacts fetch failed, using instance data...');
            
            // Fallback: Use any available data from database
            profileData = {
              phoneNumber: instance.phoneNumber,
              profileName: instance.profileName,
              instanceName: instance.instanceName,
              status: 'connected'
            };
          }
        }
        
        console.log(`📱 Final profile data for ${instance.instanceName}:`, profileData);
        
        // Update database with any phone number we found
        if (profileData?.phoneNumber) {
          await storage.updateWhatsappInstance(req.params.id, {
            phoneNumber: profileData.phoneNumber,
            profileName: profileData.profileName || null
          });
        }
        
        if (!profileData) {
          profileData = { error: "No profile data available" };
        }
        
        res.json(profileData);
      } catch (profileError: any) {
        console.error(`Failed to get profile for ${instance.instanceName}:`, profileError);
        res.status(503).json({ 
          error: "Failed to get profile", 
          message: profileError.message 
        });
      }
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // WhatsApp conversation routes - fetch from Evolution API
  app.get("/api/whatsapp/conversations/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { instanceId } = req.query;
      
      // Get user's active WhatsApp instances
      const instances = await storage.getWhatsappInstances(userId);
      const allConversations = [];
      
      for (const instance of instances) {
        if (instance.status === 'connected' && instance.instanceApiKey) {
          try {
            // Fetch chats from Evolution API
            const evolutionApi = getInstanceEvolutionApi(instance.instanceApiKey);
            const chats = await evolutionApi.fetchChats(instance.instanceName);
            
            if (chats && Array.isArray(chats)) {
              for (const chat of chats) {
                // Create or update conversation in database
                const conversationData = {
                  instanceId: instance.id,
                  userId: userId,
                  remoteJid: chat.id,
                  chatName: chat.name || chat.id.split('@')[0],
                  chatType: chat.id.includes('@g.us') ? 'group' as const : 'individual' as const,
                  unreadCount: chat.unreadCount || 0,
                  lastMessageContent: chat.lastMessage?.message || '',
                  lastMessageTimestamp: chat.lastMessage?.messageTimestamp || 0,
                  lastMessageFromMe: chat.lastMessage?.key?.fromMe || false,
                  title: chat.name || chat.id.split('@')[0]
                };
                
                // Check if conversation exists
                const existingConversations = await storage.getWhatsappConversations(userId, instance.id);
                const existing = existingConversations.find(c => c.remoteJid === chat.id);
                
                let conversation;
                if (existing) {
                  conversation = await storage.updateWhatsappConversation(existing.id, conversationData);
                } else {
                  conversation = await storage.createWhatsappConversation(conversationData);
                }
                
                allConversations.push(conversation);
              }
            }
          } catch (apiError) {
            console.error(`Failed to fetch chats for instance ${instance.instanceName}:`, apiError);
          }
        }
      }
      
      // Also get any existing conversations from database
      const dbConversations = await storage.getWhatsappConversations(userId, instanceId as string);
      
      // Merge and deduplicate by remoteJid
      const conversationMap = new Map();
      [...allConversations, ...dbConversations].forEach(conv => {
        const key = conv.remoteJid || conv.id;
        const currentTimestamp = conv.lastMessageTimestamp || 0;
        const existingTimestamp = conversationMap.get(key)?.lastMessageTimestamp || 0;
        if (!conversationMap.has(key) || currentTimestamp > existingTimestamp) {
          conversationMap.set(key, conv);
        }
      });
      
      const finalConversations = Array.from(conversationMap.values())
        .sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
      
      res.json(finalConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  app.get("/api/whatsapp/conversation/:id", async (req, res) => {
    try {
      const conversation = await storage.getWhatsappConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to get conversation" });
    }
  });

  app.post("/api/whatsapp/conversations", async (req, res) => {
    try {
      const conversationData = insertWhatsappConversationSchema.parse(req.body);
      const conversation = await storage.createWhatsappConversation(conversationData);
      res.status(201).json(conversation);
    } catch (error) {
      res.status(400).json({ error: "Invalid conversation data" });
    }
  });

  // Direct SQL query to retrieve authentic WhatsApp messages
  app.get("/api/whatsapp/messages/:conversationId", async (req, res) => {
    try {
      // Simple direct query for authentic messages from +1 510 316 5094
      const messages = await storage.getWhatsappMessages(req.params.conversationId);
      res.json(messages);
    } catch (error) {
      console.error('Schema error, using direct SQL query');
      try {
        // Fallback: direct SQL query bypassing ORM schema issues
        const pool = (db as any).pool || db;
        const result = await pool.query(`
          SELECT 
            id, evolution_message_id as "evolutionMessageId", 
            text_content as "textContent", from_me as "fromMe", 
            push_name as "pushName", timestamp, status, 
            message_type as "messageType", created_at as "createdAt"
          FROM whatsapp_messages 
          WHERE conversation_id = $1
          ORDER BY timestamp ASC
        `, [req.params.conversationId]);
        
        res.json(result.rows || []);
      } catch (sqlError) {
        console.error('SQL Error:', sqlError);
        res.status(500).json({ error: "Failed to get messages" });
      }
    }
  });

  app.post("/api/whatsapp/messages", async (req, res) => {
    try {
      const messageData = insertWhatsappMessageSchema.parse(req.body);
      
      // If this is an outgoing message, send it via Evolution API
      if (messageData.fromMe && messageData.instanceId && messageData.remoteJid) {
        try {
          const result = await evolutionManager.sendMessage(
            messageData.userId,
            messageData.instanceId,
            messageData.remoteJid || "",
            messageData.textContent || ""
          );
          
          // Update message with Evolution API response
          messageData.evolutionMessageId = result.key?.id || messageData.evolutionMessageId;
          messageData.status = 'sent';
        } catch (evolError) {
          console.error('Failed to send via Evolution API:', evolError);
          messageData.status = 'failed';
        }
      }
      
      const message = await storage.createWhatsappMessage(messageData);
      
      // Broadcast to connected clients
      broadcast(messageData.userId, {
        type: 'new_message',
        data: message
      });
      
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ error: "Invalid message data" });
    }
  });

  // Task routes
  app.get("/api/tasks/:userId", async (req, res) => {
    try {
      const tasks = await storage.getTasks(req.params.userId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({ error: "Invalid task data" });
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.updateTask(req.params.id, req.body);
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete task" });
    }
  });

  // Contact routes
  app.get("/api/contacts/:userId", async (req, res) => {
    try {
      const { search } = req.query;
      const contacts = await storage.getContacts(req.params.userId, search as string);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get contacts" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const contactData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      res.status(400).json({ error: "Invalid contact data" });
    }
  });

  app.put("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.updateContact(req.params.id, req.body);
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      await storage.deleteContact(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete contact" });
    }
  });

  // Evolution API webhook endpoint
  app.post("/api/whatsapp/webhook/:instanceId", async (req, res) => {
    try {
      const { instanceId } = req.params;
      const eventData = req.body;

      // Process webhook events from Evolution API
      console.log('Received webhook event:', eventData);

      // Handle different event types
      if (eventData.event === 'messages.upsert') {
        // New message received
        const message = eventData.data;
        
        // Save message to database
        const messageData = {
          instanceId,
          userId: 'user-id', // This should be determined from the instance
          conversationId: 'conversation-id', // This should be determined from the chat
          messageId: message.key.id,
          fromNumber: message.pushName || message.key.remoteJid,
          toNumber: message.key.remoteJid,
          messageType: message.messageType || 'text',
          content: message.message?.conversation || message.message?.extendedTextMessage?.text || '',
          isFromMe: message.key.fromMe,
          timestamp: message.messageTimestamp
        };

        // This would need proper mapping based on Evolution API response structure
        // await storage.createWhatsappMessage(messageData);

        // Broadcast to connected clients
        // broadcast(userId, {
        //   type: 'new_message',
        //   data: messageData
        // });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Google Calendar integration routes
  app.get("/api/calendar/events/:userId", async (req, res) => {
    try {
      // This would integrate with Google Calendar API
      // For now, return empty array
      res.json([]);
    } catch (error) {
      res.status(500).json({ error: "Failed to get calendar events" });
    }
  });

  app.post("/api/calendar/events", async (req, res) => {
    try {
      // This would create events via Google Calendar API
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to create calendar event" });
    }
  });

  // Evolution API configuration endpoints
  app.get("/api/evolution/settings", async (req, res) => {
    try {
      const settings = getEvolutionApiSettings();
      // Don't expose the API key in responses
      res.json({
        baseUrl: settings.baseUrl,
        enabled: settings.enabled,
        configured: !!(settings.baseUrl && settings.apiKey)
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get Evolution API settings" });
    }
  });

  app.post("/api/evolution/settings", async (req, res) => {
    try {
      const { baseUrl, apiKey, enabled } = req.body;
      
      if (!baseUrl || !apiKey) {
        return res.status(400).json({ error: "Base URL and API key are required" });
      }

      updateEvolutionApiSettings({
        baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
        apiKey,
        enabled: enabled !== false
      });

      res.json({
        success: true,
        message: "Evolution API settings updated successfully"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update Evolution API settings" });
    }
  });

  // Force QR code generation for stuck instances
  app.post("/api/whatsapp/instances/:id/generate-qr", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      const evolutionApi = instance.instanceApiKey 
        ? getInstanceEvolutionApi(instance.instanceApiKey)
        : getEvolutionApi();

      // First restart the instance to clear any stuck state
      try {
        await evolutionApi.restartInstance(instance.instanceName);
        console.log(`🔄 Restarted instance: ${instance.instanceName}`);
        
        // Wait for restart to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (restartError: any) {
        console.log(`⚠️ Restart failed for ${instance.instanceName}: ${restartError.message}`);
      }

      // Connect the instance
      try {
        await evolutionApi.connectInstance(instance.instanceName);
        console.log(`🔗 Connected instance: ${instance.instanceName}`);
        
        // Wait for connection to establish
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (connectError: any) {
        console.log(`⚠️ Connect failed for ${instance.instanceName}: ${connectError.message}`);
      }

      // Try to get QR code
      try {
        const qrCode = await evolutionApi.getQRCode(instance.instanceName);
        console.log(`📱 QR Code generated for ${instance.instanceName}`);
        
        res.json({
          success: true,
          qrCode: qrCode,
          message: "QR code generated successfully"
        });
      } catch (qrError: any) {
        console.error(`❌ QR Code generation failed for ${instance.instanceName}:`, qrError.message);
        res.status(400).json({
          success: false,
          error: `QR code generation failed: ${qrError.message}`,
          suggestion: "Instance may need more time to initialize. Try again in a few seconds."
        });
      }

    } catch (error: any) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ 
        error: "Failed to generate QR code",
        details: error.message 
      });
    }
  });

  app.get("/api/evolution/health", async (req, res) => {
    try {
      const evolutionApi = getEvolutionApi();
      const health = await evolutionApi.healthCheck();
      res.json(health);
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        message: "Evolution API not configured or unavailable"
      });
    }
  });

  return httpServer;
}
