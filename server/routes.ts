import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { evolutionManager } from "./evolution-manager";
import { getEvolutionApi, updateEvolutionApiSettings, getEvolutionApiSettings } from "./evolution-api";
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

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize Evolution API bridge manager
  await evolutionManager.initialize();

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
      const instance = await storage.createWhatsappInstance(instanceData);
      res.status(201).json(instance);
    } catch (error) {
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

  app.delete("/api/whatsapp/instances/:id", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance(req.params.id);
      if (instance) {
        await evolutionManager.removeBridge(instance.userId, req.params.id);
        await storage.deleteWhatsappInstance(req.params.id);
      }
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete instance" });
    }
  });

  app.get("/api/whatsapp/instances/:id/status", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance(req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }
      
      const bridgeStatus = evolutionManager.getBridgeStatus(instance.userId, req.params.id);
      
      // Try to get real-time status from Evolution API
      try {
        const evolutionApi = getEvolutionApi();
        const apiStatus = await evolutionApi.checkInstanceStatus(instance.instanceName);
        
        // Update database with latest status
        const mappedStatus = apiStatus.status === 'open' ? 'connected' : 
                           apiStatus.status === 'connecting' ? 'connecting' :
                           'disconnected';
        
        if (mappedStatus !== instance.status) {
          await storage.updateWhatsappInstance(req.params.id, {
            status: mappedStatus
          });
        }
        
        res.json({
          instance: {
            id: instance.id,
            name: instance.instanceName,
            status: mappedStatus
          },
          bridge: bridgeStatus,
          qrCode: apiStatus.qrcode,
          evolutionStatus: apiStatus
        });
      } catch (apiError) {
        // Fall back to database status if API is unavailable
        res.json({
          instance: {
            id: instance.id,
            name: instance.instanceName,
            status: instance.status
          },
          bridge: bridgeStatus,
          evolutionApiAvailable: false
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
        
        // First create the instance in Evolution API if it doesn't exist
        try {
          await evolutionApi.createInstance({
            instanceName: instance.instanceName,
            integration: "WHATSAPP-BAILEYS",
            webhook_url: instance.webhookUrl,
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
        } catch (createError: any) {
          // Instance might already exist, continue with connection
          if (!createError.message?.includes('already exists') && !createError.message?.includes('Instance already')) {
            console.log("Instance creation result:", createError.message);
          }
        }
        
        // Now connect the instance
        await evolutionApi.connectInstance(instance.instanceName);
        
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
        const evolutionApi = getEvolutionApi();
        const connectionState = await evolutionApi.getConnectionState(instance.instanceName);
        
        if (connectionState.qrcode?.base64) {
          await storage.updateWhatsappInstance(req.params.id, {
            status: "qr_pending"
          });

          res.json({
            qrCode: connectionState.qrcode.base64,
            status: "qr_pending"
          });
        } else {
          // Try to generate QR code by connecting first
          try {
            await evolutionApi.connectInstance(instance.instanceName);
            const newConnectionState = await evolutionApi.getConnectionState(instance.instanceName);
            
            if (newConnectionState.qrcode?.base64) {
              await storage.updateWhatsappInstance(req.params.id, {
                status: "qr_pending"
              });

              res.json({
                qrCode: newConnectionState.qrcode.base64,
                status: "qr_pending"
              });
            } else {
              res.json({
                qrCode: null,
                status: newConnectionState.instance.state || "disconnected",
                message: "QR code generation in progress"
              });
            }
          } catch (connectError) {
            res.json({
              qrCode: null,
              status: connectionState.instance.state || "disconnected",
              message: "Unable to generate QR code at this time"
            });
          }
        }
      } catch (apiError: any) {
        console.error("Evolution API QR error:", apiError);
        res.status(503).json({ 
          error: "Evolution API not available",
          message: apiError.message || "Failed to get QR code",
          needsConfiguration: false
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // WhatsApp conversation routes
  app.get("/api/whatsapp/conversations/:userId", async (req, res) => {
    try {
      const { instanceId } = req.query;
      const conversations = await storage.getWhatsappConversations(
        req.params.userId, 
        instanceId as string
      );
      res.json(conversations);
    } catch (error) {
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

  // WhatsApp message routes
  app.get("/api/whatsapp/messages/:conversationId", async (req, res) => {
    try {
      const { limit } = req.query;
      const messages = await storage.getWhatsappMessages(
        req.params.conversationId,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  app.post("/api/whatsapp/messages", async (req, res) => {
    try {
      const messageData = insertWhatsappMessageSchema.parse(req.body);
      
      // If this is an outgoing message, send it via Evolution API
      if (messageData.isFromMe && messageData.instanceId && messageData.toNumber) {
        try {
          const result = await evolutionManager.sendMessage(
            messageData.userId,
            messageData.instanceId,
            messageData.toNumber || "",
            messageData.content || ""
          );
          
          // Update message with Evolution API response
          messageData.messageId = result.key?.id || messageData.messageId;
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
