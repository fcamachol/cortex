import { Express, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { appUsers } from '../shared/schema';
import { nanoid } from 'nanoid';
import { WebhookController } from './intelligent-webhook-controller';

// Server-Sent Events connections map
const sseClients = new Map<string, Response>();

function notifyClientsOfNewMessage(messageRecord: any) {
  const data = JSON.stringify({
    type: 'new_message',
    message: messageRecord
  });
  
  sseClients.forEach((client, clientId) => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error(`Error sending SSE to client ${clientId}:`, error);
      sseClients.delete(clientId);
    }
  });
  
  console.log(`📡 Notified ${sseClients.size} connected clients of new message`);
}

// Export the notification function for use by webhook controller
export { notifyClientsOfNewMessage };

function formatToE164(phoneNumber: string): string {
  let cleaned = phoneNumber.replace(/\D/g, '');
  if (!cleaned.startsWith('52') && cleaned.length === 10) {
    cleaned = '52' + cleaned;
  }
  return cleaned;
}

const requireAuth = (req: Request & { user?: { id: string } }, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string };
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

interface AuthRequest extends Request {
  user?: { userId: string };
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

export async function registerRoutes(app: Express): Promise<void> {
  // Basic test route
  app.get('/api/test', (req: Request, res: Response) => {
    res.json({ message: 'API is working' });
  });

  // Server-Sent Events endpoint for real-time updates
  app.get('/api/events/messages', (req: Request, res: Response) => {
    const clientId = nanoid();
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    // Store connection
    sseConnections.set(clientId, res);
    console.log(`📡 New SSE client connected: ${clientId} (${sseConnections.size} total)`);

    // Handle client disconnect
    req.on('close', () => {
      sseConnections.delete(clientId);
      console.log(`📡 SSE client disconnected: ${clientId} (${sseConnections.size} remaining)`);
    });

    req.on('error', () => {
      sseConnections.delete(clientId);
    });
  });

  // Authentication routes
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const newUser = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        role: 'user'
      });

      const token = jwt.sign(
        { userId: newUser.userId },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: {
          userId: newUser.userId,
          email: newUser.email,
          name: newUser.name
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Get user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.userId },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string };
      const user = await storage.getUserById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        user: {
          userId: user.userId,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error('Auth me error:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // WhatsApp routes
  app.get('/api/whatsapp/conversations/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const conversations = await storage.getWhatsappConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  app.get('/api/whatsapp/instances/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const instances = await storage.getWhatsappInstances(userId);
      res.json(instances);
    } catch (error) {
      console.error('Error fetching instances:', error);
      res.status(500).json({ error: 'Failed to fetch instances' });
    }
  });

  app.get('/api/whatsapp/instances/status', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.query;
      if (!instanceId) {
        return res.status(400).json({ error: 'Instance ID is required' });
      }
      
      const status = await storage.getInstanceStatus(instanceId as string);
      res.json(status);
    } catch (error) {
      console.error('Error fetching instance status:', error);
      res.status(500).json({ error: 'Failed to fetch instance status' });
    }
  });

  app.get('/api/contacts/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const contacts = await storage.getWhatsappContacts(userId);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  app.get('/api/whatsapp/chat-messages', async (req: Request, res: Response) => {
    try {
      const { chatId, instanceId, userId, limit = '100' } = req.query;
      
      if (!chatId || !instanceId) {
        return res.status(400).json({ error: 'chatId and instanceId are required' });
      }

      const messages = await storage.getWhatsappMessages(
        userId as string,
        instanceId as string,
        chatId as string,
        parseInt(limit as string)
      );
      
      res.json(messages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.get('/api/spaces/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const spaces = await storage.getSpaces(userId);
      res.json(spaces);
    } catch (error) {
      console.error('Error fetching spaces:', error);
      res.status(500).json({ error: 'Failed to fetch spaces' });
    }
  });

  app.get('/api/crm/tasks', async (req: Request, res: Response) => {
    try {
      const tasks = await storage.getTasks();
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.get('/api/crm/projects', async (req: Request, res: Response) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.get('/api/crm/checklist-items', async (req: Request, res: Response) => {
    try {
      const checklistItems = await storage.getChecklistItems();
      res.json(checklistItems);
    } catch (error) {
      console.error('Error fetching checklist items:', error);
      res.status(500).json({ error: 'Failed to fetch checklist items' });
    }
  });

  app.get('/api/events/tasks', async (req: Request, res: Response) => {
    try {
      const tasks = await storage.getTasks();
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks events:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Calendar routes
  app.get('/api/calendar/events', async (req: Request, res: Response) => {
    try {
      const events = await storage.getCalendarEvents();
      res.json(events);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  });

  app.post('/api/calendar/events', async (req: Request, res: Response) => {
    try {
      const event = await storage.createCalendarEvent(req.body);
      res.status(201).json(event);
    } catch (error) {
      console.error('Error creating calendar event:', error);
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  });

  app.put('/api/calendar/events/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const event = await storage.updateCalendarEvent(id, req.body);
      res.json(event);
    } catch (error) {
      console.error('Error updating calendar event:', error);
      res.status(500).json({ error: 'Failed to update calendar event' });
    }
  });

  app.delete('/api/calendar/events/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteCalendarEvent(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      res.status(500).json({ error: 'Failed to delete calendar event' });
    }
  });

  app.get('/api/calendar/calendars', async (req: Request, res: Response) => {
    try {
      const calendars = await storage.getCalendars();
      res.json(calendars);
    } catch (error) {
      console.error('Error fetching calendars:', error);
      res.status(500).json({ error: 'Failed to fetch calendars' });
    }
  });

  app.post('/api/calendar/calendars', async (req: Request, res: Response) => {
    try {
      const calendar = await storage.createCalendar(req.body);
      res.status(201).json(calendar);
    } catch (error) {
      console.error('Error creating calendar:', error);
      res.status(500).json({ error: 'Failed to create calendar' });
    }
  });

  app.put('/api/calendar/calendars/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const calendar = await storage.updateCalendar(id, req.body);
      res.json(calendar);
    } catch (error) {
      console.error('Error updating calendar:', error);
      res.status(500).json({ error: 'Failed to update calendar' });
    }
  });

  app.delete('/api/calendar/calendars/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteCalendar(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting calendar:', error);
      res.status(500).json({ error: 'Failed to delete calendar' });
    }
  });

  app.get('/api/calendar/providers', async (req: Request, res: Response) => {
    try {
      const providers = await storage.getCalendarProviders();
      res.json(providers);
    } catch (error) {
      console.error('Error fetching calendar providers:', error);
      res.status(500).json({ error: 'Failed to fetch calendar providers' });
    }
  });

  app.get('/api/actions/whatsapp-instances', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const instances = await storage.getWhatsappInstances(userId);
      res.json(instances);
    } catch (error) {
      console.error('Error fetching WhatsApp instances for actions:', error);
      res.status(500).json({ error: 'Failed to fetch WhatsApp instances' });
    }
  });

  app.post('/api/whatsapp/refresh-group-subjects/:instanceId', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      console.log(`🔄 Refreshing group subjects for instance ${instanceId}`);
      res.json({ success: true, message: 'Group subjects refresh initiated' });
    } catch (error) {
      console.error('Error refreshing group subjects:', error);
      res.status(500).json({ error: 'Failed to refresh group subjects' });
    }
  });

  // WhatsApp Messages API - Fetch messages with full Evolution API data
  app.get('/api/whatsapp/messages', async (req: AuthRequest, res: Response) => {
    try {
      const { chatId, instanceId, limit } = req.query;
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const finalLimit = parseInt(limit as string || '50');
      
      if (chatId && instanceId) {
        // Get messages for specific chat with full webhook data
        const messages = await storage.getWhatsappMessages(
          userId, 
          instanceId as string, 
          chatId as string, 
          finalLimit
        );
        res.json(messages);
      } else if (instanceId) {
        // Get recent messages for specific instance
        const messages = await storage.getWhatsappMessages(
          userId, 
          instanceId as string, 
          '', 
          finalLimit
        );
        res.json(messages);
      } else {
        res.status(400).json({ error: 'chatId and instanceId are required' });
      }
    } catch (error) {
      console.error('Error fetching WhatsApp messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // WhatsApp Conversations with latest messages
  app.get('/api/whatsapp/conversations', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const conversations = await storage.getConversationsWithLatestMessages(userId);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // Server-Sent Events for real-time message updates
  app.get('/api/whatsapp/messages/stream', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection confirmation
    res.write('data: {"type":"connected"}\n\n');

    // Add client to SSE connections
    const clientId = Date.now().toString();
    sseClients.set(clientId, res);

    // Handle client disconnect
    req.on('close', () => {
      sseClients.delete(clientId);
    });

    req.on('aborted', () => {
      sseClients.delete(clientId);
    });
  });

  // WhatsApp webhook handlers - Use the intelligent webhook controller
  app.post('/api/evolution/webhook/:instanceName/:eventType', async (req: Request, res: Response) => {
    await WebhookController.handleIncomingEvent(req, res);
  });

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
}