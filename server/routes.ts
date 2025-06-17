import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
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
      res.json(instance);
    } catch (error) {
      res.status(400).json({ error: "Failed to update instance" });
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

  return httpServer;
}
