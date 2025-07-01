import { Express, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, sql } from 'drizzle-orm';
import { appUsers } from '../shared/schema';
import { nanoid } from 'nanoid';
import { WebhookController } from './webhook-controller';
import { SseManager } from './sse-manager';
import { getEvolutionApi } from './evolution-api';
// DISABLED: BillToTaskService temporarily disabled after finance schema cleanup
// import { BillToTaskService } from './bill-task-service';
import { ScheduledJobsService } from './scheduled-jobs';
import { webhookReliability } from './webhook-reliability';
import { messageRecovery } from './message-recovery-system';
import { db } from './db';
import fs from 'fs/promises';
import path from 'path';
import {
  insertCrmCompanySchema,
} from "@shared/schema";
import {
  insertCortexBillSchema,
} from "@shared/cortex-schema";
import cortexRoutes from './cortex-routes';
import { cortexFoundationStorage } from './cortex-foundation-storage';
import { spawn } from 'child_process';
import { promises as fsPromises } from 'fs';
import { lookup } from 'mime-types';



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
  app.get('/api/events', SseManager.handleNewConnection);

  // Authentication routes
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const { email, password, fullName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const newUser = await storage.createAppUser({
        email,
        passwordHash: hashedPassword,
        fullName: fullName || null
      });

      const token = jwt.sign(
        { userId: newUser.userId },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        token,
        user: {
          userId: newUser.userId,
          email: newUser.email,
          fullName: newUser.fullName
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
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
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
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
          fullName: user.fullName
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
          fullName: user.fullName
        }
      });
    } catch (error) {
      console.error('Auth me error:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Notes API endpoint for testing
  app.get('/api/crm/notes', async (req: Request, res: Response) => {
    try {
      const notes = await storage.getCrmNotes();
      res.json(notes);
    } catch (error) {
      console.error('Error fetching notes:', error);
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  });

  // WhatsApp routes
  app.get('/api/whatsapp/conversations/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const conversations = await storage.getConversationsWithLatestMessages(userId);
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

  app.patch('/api/whatsapp/instances/:instanceId', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      const { displayName, customColor, customLetter } = req.body;
      
      const updatedInstance = await storage.updateWhatsappInstance(instanceId, {
        displayName,
        customColor,
        customLetter
      });
      
      res.json(updatedInstance);
    } catch (error) {
      console.error('Error updating instance:', error);
      res.status(500).json({ error: 'Failed to update instance' });
    }
  });

  app.delete('/api/whatsapp/instances/:instanceId', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      await storage.deleteWhatsappInstance(instanceId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting instance:', error);
      res.status(500).json({ error: 'Failed to delete instance' });
    }
  });

  // Instance Management Routes
  app.post('/api/whatsapp/instances/create', async (req: Request, res: Response) => {
    try {
      const { instanceName, webhookUrl, displayName, qrcode, number } = req.body;
      
      if (!instanceName) {
        return res.status(400).json({ error: 'Instance name is required' });
      }

      const { InstanceManager } = await import('./instance-manager');
      const result = await InstanceManager.createInstanceWithWebhook(instanceName, {
        webhookUrl,
        displayName,
        qrcode,
        number
      });

      if (result.success) {
        res.json(result.instance);
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Error creating instance:', error);
      res.status(500).json({ error: 'Failed to create instance' });
    }
  });

  app.get('/api/whatsapp/instances/:instanceName/status', async (req: Request, res: Response) => {
    try {
      const { instanceName } = req.params;
      
      const { InstanceManager } = await import('./instance-manager');
      const result = await InstanceManager.getInstanceStatus(instanceName);

      if (result.success) {
        res.json({ status: result.status, qrcode: result.qrcode });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Error getting instance status:', error);
      res.status(500).json({ error: 'Failed to get instance status' });
    }
  });

  app.post('/api/whatsapp/instances/:instanceName/configure-webhook', async (req: Request, res: Response) => {
    try {
      const { instanceName } = req.params;
      const { webhookUrl } = req.body;
      
      if (!webhookUrl) {
        return res.status(400).json({ error: 'Webhook URL is required' });
      }

      const { InstanceManager } = await import('./instance-manager');
      const success = await InstanceManager.configureInstanceWebhook(instanceName, webhookUrl);

      if (success) {
        res.json({ success: true, message: 'Webhook configured successfully' });
      } else {
        res.status(400).json({ error: 'Failed to configure webhook' });
      }
    } catch (error) {
      console.error('Error configuring webhook:', error);
      res.status(500).json({ error: 'Failed to configure webhook' });
    }
  });

  app.delete('/api/whatsapp/instances/:instanceName', async (req: Request, res: Response) => {
    try {
      const { instanceName } = req.params;
      
      const { InstanceManager } = await import('./instance-manager');
      const result = await InstanceManager.deleteInstance(instanceName);

      if (result.success) {
        res.json({ success: true, message: 'Instance deleted successfully' });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Error deleting instance:', error);
      res.status(500).json({ error: 'Failed to delete instance' });
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
      // Return CRM contacts for forms that need contact selection (like loans)
      const contacts = await storage.getCortexPersons();
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  // Removed conflicting group endpoint - consolidated into main Evolution API endpoint below

  app.post('/api/whatsapp/groups/:instanceId/refresh-names', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      const { WebhookApiAdapter } = await import('./whatsapp-api-adapter');
      
      await WebhookApiAdapter.refreshAllGroupNames(instanceId);
      res.json({ success: true, message: 'Group names refresh initiated' });
    } catch (error) {
      console.error('Error refreshing group names:', error);
      res.status(500).json({ error: 'Failed to refresh group names' });
    }
  });

  app.post('/api/whatsapp/groups/:instanceId/sync-from-api', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      const { WebhookApiAdapter } = await import('./whatsapp-api-adapter');
      
      console.log(`🔄 Starting group sync from Evolution API for instance: ${instanceId}`);
      const result = await WebhookApiAdapter.syncAllGroupsFromApi(instanceId);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `Successfully synced ${result.count} groups from Evolution API`,
          count: result.count 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error || 'Failed to sync groups from API' 
        });
      }
    } catch (error) {
      console.error('Error syncing groups from API:', error);
      res.status(500).json({ error: 'Failed to sync groups from API' });
    }
  });

  app.post('/api/whatsapp/groups/:instanceId/cleanup-contact-data', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      const { WebhookApiAdapter } = await import('./whatsapp-api-adapter');
      
      console.log(`🧹 Starting cleanup of incorrect group contact data for instance: ${instanceId}`);
      const result = await WebhookApiAdapter.cleanupIncorrectGroupContactData(instanceId);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `Successfully cleaned ${result.cleaned} contact records`,
          cleaned: result.cleaned 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error || 'Unknown error occurred' 
        });
      }
    } catch (error) {
      console.error('Error cleaning up contact data:', error);
      res.status(500).json({ error: 'Failed to cleanup contact data' });
    }
  });

  app.get('/api/whatsapp/groups/:groupJid/participants', async (req: Request, res: Response) => {
    try {
      const { groupJid } = req.params;
      const { instanceId } = req.query;
      
      if (!instanceId) {
        return res.status(400).json({ error: 'instanceId is required' });
      }

      const participants = await storage.getGroupParticipants(groupJid, instanceId as string);
      res.json(participants);
    } catch (error) {
      console.error('Error fetching group participants:', error);
      res.status(500).json({ error: 'Failed to fetch participants' });
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

  // Get specific message content by message ID
  app.get('/api/whatsapp/message-content', async (req: Request, res: Response) => {
    try {
      const { messageId, instanceId, userId } = req.query;
      
      if (!messageId || !instanceId) {
        return res.status(400).json({ error: 'messageId and instanceId are required' });
      }

      const message = await storage.getWhatsappMessageById(
        messageId as string,
        instanceId as string
      );
      
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      res.json(message);
    } catch (error) {
      console.error('Error fetching message content:', error);
      res.status(500).json({ error: 'Failed to fetch message content' });
    }
  });

  // Send WhatsApp message (with optional reply)
  app.post('/api/whatsapp/send-message', async (req: Request, res: Response) => {
    try {
      const { instanceName, instanceId, chatId, message, quotedMessageId, isForwarded } = req.body;
      const finalInstanceName = instanceName || instanceId; // Support both field names for compatibility
      
      if (!finalInstanceName || !chatId || !message) {
        return res.status(400).json({ error: 'instanceName, chatId, and message are required' });
      }

      const { WhatsAppAPIAdapter } = await import('./whatsapp-api-adapter');
      const result = await WhatsAppAPIAdapter.sendMessage(finalInstanceName, chatId, message, quotedMessageId, isForwarded);
      
      if (result.success) {
        // Draft functionality removed for system optimization
        
        // Create an immediate local message record for the sent message
        // This ensures the sender sees their message immediately
        try {
          console.log(`📝 [${finalInstanceName}] Creating local record for sent message`);
          
          // First, ensure sender contact exists or find an existing valid sender
          let senderJid = result.data?.key?.participant || `${finalInstanceName}@bot`;
          
          // Create a system contact for this instance to avoid FK constraint issues
          try {
            const systemContactJid = `system@${finalInstanceName}`;
            await storage.upsertWhatsappContact({
              jid: systemContactJid,
              instanceName: finalInstanceName,
              pushName: 'System',
              isBusiness: false,
              isMe: false,
              isBlocked: false
            });
            senderJid = systemContactJid;
          } catch (contactError) {
            console.warn(`Could not create system contact, falling back to webhook: ${contactError}`);
            
            // Even without local storage, trigger conversation refresh for immediate UI update
            try {
              const { SseManager } = await import('./sse-manager');
              SseManager.notifyClientsOfChatUpdate({
                chatId,
                instanceId: finalInstanceName,
                lastMessage: {
                  content: message,
                  timestamp: new Date(),
                  fromMe: true
                }
              });
              console.log(`📡 [${finalInstanceName}] SSE conversation refresh sent (webhook fallback)`);
              
              // Force immediate refresh of conversation data
              SseManager.notifyClients('conversation_list_refresh', { instanceId: finalInstanceName });
              
            } catch (sseError) {
              console.error(`📡 [${finalInstanceName}] Failed to send SSE update:`, sseError);
            }
            
            // Fall back to webhook processing - continue without immediate storage
            res.json(result.data);
            return;
          }
          
          const sentMessage = {
            messageId: result.data?.key?.id || `SENT_${Date.now()}`,
            instanceName: finalInstanceName,
            chatId,
            senderJid,
            fromMe: true,
            messageType: 'text' as const,
            content: message,
            timestamp: new Date(),
            quotedMessageId: quotedMessageId || null,
            isForwarded: isForwarded || false,
            forwardingScore: isForwarded ? 1 : 0,
            isStarred: false,
            isEdited: false,
            lastEditedAt: null,
            sourcePlatform: 'web' as const,
            rawApiPayload: result.data || {}
          };
          
          console.log(`📝 [${finalInstanceName}] Storing message with sender: ${sentMessage.senderJid}`);
          
          // Store the sent message immediately
          const storedMessage = await storage.upsertWhatsappMessage(sentMessage);
          console.log(`✅ [${finalInstanceName}] Sent message stored locally: ${storedMessage.messageId}`);
          
          // Immediately trigger conversation list refresh via SSE
          const { SseManager } = await import('./sse-manager');
          SseManager.notifyClientsOfNewMessage(storedMessage);
          SseManager.notifyClientsOfChatUpdate({
            chatId,
            instanceId: finalInstanceName,
            lastMessage: {
              content: message,
              timestamp: new Date(),
              fromMe: true
            }
          });
          console.log(`📡 [${finalInstanceName}] SSE notifications sent for message: ${storedMessage.messageId}`);
          
        } catch (localStorageError) {
          console.error(`⚠️ [${finalInstanceName}] Failed to store sent message locally:`, localStorageError);
          
          // Even if local storage fails, still trigger conversation refresh
          try {
            const { SseManager } = await import('./sse-manager');
            SseManager.notifyClientsOfChatUpdate({
              chatId,
              instanceId: finalInstanceName,
              lastMessage: {
                content: message,
                timestamp: new Date(),
                fromMe: true
              }
            });
            
            // Force immediate refresh of conversation data
            SseManager.notifyClients('conversation_list_refresh', { instanceId: finalInstanceName });
            console.log(`📡 [${finalInstanceName}] SSE conversation refresh sent despite storage failure`);
            
          } catch (sseError) {
            console.error(`📡 [${finalInstanceName}] Failed to send SSE update:`, sseError);
          }
        }
        
        res.json(result.data);
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Get message replies for a specific message
  app.get('/api/whatsapp/message-replies', async (req: Request, res: Response) => {
    try {
      const { originalMessageId, instanceId, userId } = req.query;
      
      if (!originalMessageId || !instanceId) {
        return res.status(400).json({ error: 'originalMessageId and instanceId are required' });
      }

      const replies = await storage.getMessageReplies(
        originalMessageId as string,
        instanceId as string
      );
      
      res.json(replies);
    } catch (error) {
      console.error('Error fetching message replies:', error);
      res.status(500).json({ error: 'Failed to fetch message replies' });
    }
  });

  // Drafts functionality removed for system optimization

  app.get('/api/spaces', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const spaces = await storage.getSpaces(userId);
      res.json(spaces);
    } catch (error) {
      console.error('Error fetching spaces:', error);
      res.status(500).json({ error: 'Failed to fetch spaces' });
    }
  });

  app.post('/api/spaces', async (req: Request, res: Response) => {
    try {
      const spaceData = req.body;
      console.log('Received space data:', spaceData);
      
      // Accept both spaceName and name for flexibility
      const spaceName = spaceData.spaceName || spaceData.name;
      if (!spaceName) {
        console.log('Missing space name in request:', spaceData);
        return res.status(400).json({ error: 'Space name is required' });
      }

      // Normalize the data
      spaceData.spaceName = spaceName;
      
      // In a real app, get userId from authentication
      spaceData.creatorUserId = spaceData.creatorUserId || 'cu_181de66a23864b2fac56779a82189691';

      console.log('Creating space with data:', spaceData);
      
      // Map the data to Cortex Foundation format
      const cortexSpaceData = {
        name: spaceData.spaceName,
        description: spaceData.description || '',
        parentSpaceId: null, // Root level space
        spaceType: spaceData.spaceType || 'project',
        category: spaceData.category || 'work',
        privacy: spaceData.privacy || 'private',
        ownerUserId: spaceData.creatorUserId,
        color: spaceData.color || '#6366F1',
        icon: spaceData.icon || '📁',
        isStarred: spaceData.isFavorite || false,
        isPinned: false,
        isArchived: false,
        sortOrder: 0,
        level: 0,
        path: null,
        templateId: null,
        isTemplate: false,
        customFields: {}
      };
      
      // Use Cortex Foundation storage for space creation
      const space = await cortexFoundationStorage.createSpace(cortexSpaceData);
      res.status(201).json(space);
    } catch (error) {
      console.error('Error creating space:', error);
      res.status(500).json({ error: 'Failed to create space' });
    }
  });

  app.get('/api/crm/tasks', async (req: Request, res: Response) => {
    try {
      // Force no-cache headers to prevent 304 responses
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      // Use userId instead of instanceId for unified entity architecture
      const { userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42' } = req.query;
      const tasks = await storage.getTasks(userId as string);
      
      // Tasks now come with correct field mapping from storage
      const transformedTasks = tasks.map(task => ({
        ...task,
        subtasks: task.subtasks || [],
        checklistItems: task.checklistItems || []
      }));
      
      res.json(transformedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.patch('/api/crm/tasks/:taskId', async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const updates = req.body;
      
      const updatedTask = await storage.updateTask(parseInt(taskId), updates);
      res.json(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  app.get('/api/crm/projects', async (req: Request, res: Response) => {
    try {
      const projects = await storage.getProjects();
      
      // Map database fields to frontend expected format
      const transformedProjects = projects.map(project => ({
        id: project.id, // Unified entity ID (cj_ prefixed)
        projectId: project.project_id, // Legacy integer ID
        name: project.project_name, // Map project_name to name
        description: project.description,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        userId: project.user_id, // Link to authenticated users instead of spaces
        createdAt: project.created_at,
        updatedAt: project.updated_at
      }));
      
      res.json(transformedProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.post('/api/crm/projects', async (req: Request, res: Response) => {
    try {
      const projectData = req.body;
      console.log('Creating project with data:', projectData);
      
      // Get userId from authenticated session (or use first user for now)
      const users = await storage.getUsers();
      let userId = users.length > 0 ? users[0].userId : null;
      
      // If no users exist, create a development user
      if (!userId) {
        console.log('No users found, creating development user...');
        const devUser = await storage.createAppUser({
          email: 'dev@test.com',
          passwordHash: 'dev-hash',
          fullName: 'Development User'
        });
        userId = devUser.userId;
        console.log('Created development user:', userId);
      }
      
      // Add userId to project data
      const projectDataWithUser = { ...projectData, userId };
      
      const project = await storage.createProject(projectDataWithUser);
      
      // Transform response for frontend (unified entity system format)
      const transformedProject = {
        id: project.id, // Unified entity ID (cj_ prefixed)
        name: project.name, // Direct field mapping
        description: project.description,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        userId: project.user_id,
        createdAt: project.created_at,
        updatedAt: project.updated_at
      };
      
      res.json(transformedProject);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  app.patch('/api/crm/projects/:projectId', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const updates = req.body;
      
      const updatedProject = await storage.updateProject(projectId, updates);
      res.json(updatedProject);
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  app.delete('/api/crm/projects/:projectId', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      await storage.deleteProject(projectId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  // Get project detail with associated content
  app.get('/api/crm/projects/:projectId/detail', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      
      // Get project by unified entity ID (cj_ prefixed)
      const project = await storage.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get associated tasks
      const tasks = await storage.getTasksByProjectId(projectId);
      
      // Get project files - will be implemented through unified entity system
      let projectFiles = [];

      // Transform project data
      const projectDetail = {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate,
        endDate: project.endDate,
        budget: project.budget,
        spentAmount: project.spentAmount,
        progress: project.progress,
        tags: project.tags,
        color: project.color,
        parentProjectId: project.parentProjectId,

        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        // Associated content
        tasks: tasks || [],
        files: projectFiles,
        taskCount: tasks?.length || 0,
        completedTasks: tasks?.filter(task => task.status === 'done').length || 0,
        taskProgress: tasks?.length > 0 ? Math.round((tasks.filter(task => task.status === 'done').length / tasks.length) * 100) : 0
      };

      res.json(projectDetail);
    } catch (error) {
      console.error('Error fetching project detail:', error);
      res.status(500).json({ error: 'Failed to fetch project detail' });
    }
  });

  // WhatsApp-CRM Contact Linking endpoints
  app.post('/api/contacts/:contactId/link-whatsapp', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
      }
      
      await storage.linkContactToWhatsApp(parseInt(contactId), phoneNumber);
      res.json({ success: true, message: 'WhatsApp linking checked' });
    } catch (error) {
      console.error('Error linking contact to WhatsApp:', error);
      res.status(500).json({ error: 'Failed to link contact to WhatsApp' });
    }
  });

  app.get('/api/contacts/:contactId/whatsapp-status', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const contact = await storage.getCrmContactById(parseInt(contactId));
      
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      res.json({
        isWhatsappLinked: contact.isWhatsappLinked || false,
        whatsappJid: contact.whatsappJid || null,
        whatsappInstanceId: contact.whatsappInstanceId || null,
        whatsappLinkedAt: contact.whatsappLinkedAt || null
      });
    } catch (error) {
      console.error('Error getting WhatsApp status:', error);
      res.status(500).json({ error: 'Failed to get WhatsApp status' });
    }
  });

  // Create CRM contact from WhatsApp chat
  app.post('/api/crm/contacts/from-whatsapp', async (req: Request, res: Response) => {
    try {
      const { senderJid, pushName, instanceId, relationship, notes } = req.body;
      
      if (!senderJid) {
        return res.status(400).json({ error: 'Sender JID is required' });
      }

      // Extract phone number from JID
      const phoneNumber = senderJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      
      // Check if contact already exists by phone number or WhatsApp JID
      const existingContacts = await storage.getCrmContactsByPhoneOrJid(phoneNumber, senderJid);
      
      if (existingContacts.length > 0) {
        // Update existing contact to link WhatsApp
        const existingContact = existingContacts[0];
        const updatedContact = await storage.updateCrmContact(existingContact.contactId, {
          whatsappJid: senderJid,
          whatsappInstanceId: instanceId,
          isWhatsappLinked: true,
          whatsappLinkedAt: new Date()
        });
        
        return res.json({ 
          success: true, 
          contact: updatedContact,
          action: 'linked_existing'
        });
      }

      // Create new CRM contact
      const fullName = pushName || `Contact ${phoneNumber}`;
      const userId = req.headers['x-user-id'] || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user for now
      
      const newContact = await storage.createCrmContact({
        ownerUserId: userId as string,
        fullName,
        relationship: relationship || null,
        notes: notes || `Added from WhatsApp chat`,
        whatsappJid: senderJid,
        whatsappInstanceId: instanceId,
        isWhatsappLinked: true,
        whatsappLinkedAt: new Date()
      });

      // Add phone number record
      await storage.createCrmContactPhone({
        contactId: newContact.contactId,
        phoneNumber,
        label: 'Mobile',
        isWhatsappLinked: true,
        isPrimary: true
      });

      res.json({
        success: true,
        contact: newContact,
        action: 'created_new'
      });

    } catch (error) {
      console.error('Error creating CRM contact from WhatsApp:', error);
      res.status(500).json({ error: 'Failed to create CRM contact' });
    }
  });

  // Check if WhatsApp contact is linked to CRM
  app.get('/api/crm/contacts/whatsapp-link-status/:jid', async (req: Request, res: Response) => {
    try {
      const { jid } = req.params;
      const phoneNumber = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      
      const linkedContacts = await storage.getCrmContactsByPhoneOrJid(phoneNumber, jid);
      
      res.json({
        isLinked: linkedContacts.length > 0,
        contacts: linkedContacts
      });
      
    } catch (error) {
      console.error('Error checking WhatsApp link status:', error);
      res.status(500).json({ error: 'Failed to check link status' });
    }
  });

  app.post('/api/crm/tasks', async (req: Request, res: Response) => {
    try {
      const taskData = req.body;
      console.log('Creating task with data:', taskData);
      
      const task = await storage.createTask(taskData);
      
      // Transform response for frontend
      const transformedTask = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        parentTaskId: task.parentTaskId,
        userId: task.userId, // Link to authenticated users
        tags: task.tags,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      };
      
      res.json(transformedTask);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Link tasks to entities (projects, contacts, etc.)
  app.post('/api/crm/task-entities', async (req: Request, res: Response) => {
    try {
      const { taskId, entityId, relationshipType } = req.body;
      console.log('Linking task to entity:', { taskId, entityId, relationshipType });
      
      const link = await storage.createTaskEntityLink(taskId, entityId, relationshipType);
      
      res.json({
        success: true,
        link: link,
        message: 'Task successfully linked to entity'
      });
    } catch (error) {
      console.error('Error linking task to entity:', error);
      res.status(500).json({ error: 'Failed to link task to entity' });
    }
  });

  // ===================================================================
  // TASK-MESSAGE LINKING ENDPOINTS - Clean Junction Table Architecture
  // ===================================================================

  // Create a new task-message link
  app.post('/api/crm/task-message-links', async (req: Request, res: Response) => {
    try {
      const { taskId, messageId, instanceId, linkType } = req.body;
      
      if (!taskId || !messageId || !instanceId || !linkType) {
        return res.status(400).json({ 
          error: 'taskId, messageId, instanceId, and linkType are required' 
        });
      }

      console.log('Creating task-message link:', { taskId, messageId, instanceId, linkType });
      
      const link = await storage.createTaskMessageLink({
        taskId,
        messageId,
        instanceId,
        linkType
      });
      
      res.status(201).json({
        success: true,
        link,
        message: 'Task-message link created successfully'
      });
    } catch (error) {
      console.error('Error creating task-message link:', error);
      res.status(500).json({ error: 'Failed to create task-message link' });
    }
  });

  // Get all message links for a specific task
  app.get('/api/crm/task-message-links/:taskId', async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      
      console.log('Fetching message links for task:', taskId);
      
      const links = await storage.getTaskMessageLinks(taskId);
      
      res.json(links);
    } catch (error) {
      console.error('Error fetching task message links:', error);
      res.status(500).json({ error: 'Failed to fetch task message links' });
    }
  });

  // Get all task links for a specific message (reverse lookup)
  app.get('/api/crm/message-task-links/:messageId/:instanceId', async (req: Request, res: Response) => {
    try {
      const { messageId, instanceId } = req.params;
      
      console.log('Fetching task links for message:', { messageId, instanceId });
      
      const links = await storage.getMessageTaskLinks(messageId, instanceId);
      
      res.json(links);
    } catch (error) {
      console.error('Error fetching message task links:', error);
      res.status(500).json({ error: 'Failed to fetch message task links' });
    }
  });

  // Delete a specific task-message link
  app.delete('/api/crm/task-message-links', async (req: Request, res: Response) => {
    try {
      const { taskId, messageId, instanceId, linkType } = req.body;
      
      if (!taskId || !messageId || !instanceId || !linkType) {
        return res.status(400).json({ 
          error: 'taskId, messageId, instanceId, and linkType are required' 
        });
      }

      console.log('Deleting task-message link:', { taskId, messageId, instanceId, linkType });
      
      await storage.deleteTaskMessageLink(taskId, messageId, instanceId, linkType);
      
      res.json({
        success: true,
        message: 'Task-message link deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting task-message link:', error);
      res.status(500).json({ error: 'Failed to delete task-message link' });
    }
  });

  // Delete all message links for a specific task
  app.delete('/api/crm/task-message-links/:taskId', async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      
      console.log('Deleting all message links for task:', taskId);
      
      await storage.deleteAllTaskMessageLinks(taskId);
      
      res.json({
        success: true,
        message: 'All task message links deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting all task message links:', error);
      res.status(500).json({ error: 'Failed to delete all task message links' });
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

  // Database overview endpoints
  app.get('/api/database/overview', async (req, res) => {
    try {
      const tableData = await db.execute(sql`
        SELECT 
          schemaname as schema, 
          tablename as table, 
          schemaname || '.' || tablename as full_name
        FROM pg_tables 
        WHERE schemaname IN ('app', 'whatsapp', 'crm') 
        ORDER BY schemaname, tablename
      `);
      res.json(tableData.rows);
    } catch (error) {
      console.error('Error fetching database overview:', error);
      res.status(500).json({ error: 'Failed to fetch database overview' });
    }
  });

  app.get('/api/database/whatsapp-summary', async (req, res) => {
    try {
      const instances = await db.execute(sql`
        SELECT instance_id, display_name, is_connected, created_at 
        FROM whatsapp.instances 
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      
      const messageCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM whatsapp.messages
      `);
      
      const contactCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM whatsapp.contacts
      `);

      const tableCount = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM pg_tables 
        WHERE schemaname = 'whatsapp'
      `);

      res.json({
        instances: instances.rows,
        message_count: messageCount.rows[0]?.count || 0,
        contact_count: contactCount.rows[0]?.count || 0,
        total_tables: tableCount.rows[0]?.count || 0,
        total_records: (parseInt(messageCount.rows[0]?.count || '0') + parseInt(contactCount.rows[0]?.count || '0'))
      });
    } catch (error) {
      console.error('Error fetching WhatsApp summary:', error);
      res.status(500).json({ error: 'Failed to fetch WhatsApp summary' });
    }
  });

  app.get('/api/database/crm-summary', async (req, res) => {
    try {
      const taskCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM crm.tasks
      `);
      
      const projectCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM crm.projects
      `);

      const tableCount = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM pg_tables 
        WHERE schemaname = 'crm'
      `);

      res.json({
        task_count: taskCount.rows[0]?.count || 0,
        project_count: projectCount.rows[0]?.count || 0,
        total_tables: tableCount.rows[0]?.count || 0,
        total_records: (parseInt(taskCount.rows[0]?.count || '0') + parseInt(projectCount.rows[0]?.count || '0'))
      });
    } catch (error) {
      console.error('Error fetching CRM summary:', error);
      res.status(500).json({ error: 'Failed to fetch CRM summary' });
    }
  });

  app.get('/api/database/app-summary', async (req, res) => {
    try {
      const users = await db.execute(sql`
        SELECT user_id, email, full_name, created_at 
        FROM app.users 
        ORDER BY created_at DESC
      `);
      
      const userCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.users
      `);

      const workspaceCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.workspaces
      `);

      const tableCount = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM pg_tables 
        WHERE schemaname = 'app'
      `);

      res.json({
        users: users.rows,
        user_count: userCount.rows[0]?.count || 0,
        workspace_count: workspaceCount.rows[0]?.count || 0,
        total_tables: tableCount.rows[0]?.count || 0,
        total_records: (parseInt(userCount.rows[0]?.count || '0') + parseInt(workspaceCount.rows[0]?.count || '0'))
      });
    } catch (error) {
      console.error('Error fetching App summary:', error);
      res.status(500).json({ error: 'Failed to fetch App summary' });
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

  // Actions API routes
  app.get('/api/actions/rules', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      
      // Use actual database storage method instead of hardcoded data
      const rules = await storage.getActionRules(userId);
      
      res.json(rules);
    } catch (error) {
      console.error('Error fetching action rules:', error);
      res.status(500).json({ error: 'Failed to fetch action rules' });
    }
  });

  // Get individual action rule
  app.get('/api/actions/rules/:ruleId', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const { ruleId } = req.params;
      const rule = await storage.getActionRule(ruleId);
      
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      
      res.json(rule);
    } catch (error) {
      console.error('Error fetching action rule:', error);
      res.status(500).json({ error: 'Failed to fetch action rule' });
    }
  });

  // Create new action rule
  app.post('/api/actions/rules', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      
      // Map frontend camelCase to database snake_case
      const ruleData = {
        name: req.body.ruleName,
        description: req.body.description,
        is_active: req.body.isActive,
        trigger_type: req.body.triggerType === 'reaction' ? 'whatsapp_message' : req.body.triggerType,
        priority: req.body.priority || 0,
        created_by: userId,
        space_id: req.body.spaceId || null,
        whatsapp_instance_id: req.body.whatsappInstanceId || null,
        trigger_permission: req.body.performerFilter || 'me',
        allowed_user_ids: req.body.allowedUserIds || []
      };
      
      const rule = await storage.createActionRule(ruleData);
      res.status(201).json(rule);
    } catch (error) {
      console.error('Error creating action rule:', error);
      res.status(500).json({ error: 'Failed to create action rule' });
    }
  });

  // Update action rule
  app.put('/api/actions/rules/:ruleId', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const { ruleId } = req.params;
      
      // Map frontend fields to database fields
      const {
        ruleName,
        description,
        isActive,
        triggerType,
        performerFilter,
        instanceFilterType,
        selectedInstances,
        triggerConditions,
        actionConfig,
        performerFilters
      } = req.body;

      // Handle WhatsApp instance logic
      let whatsappInstanceId = null;
      if (instanceFilterType === 'specific' && selectedInstances && selectedInstances.length > 0) {
        // For specific instances, use the first selected instance
        // TODO: In the future, we might want to support multiple instances per rule
        whatsappInstanceId = selectedInstances[0];
      } else if (instanceFilterType === 'all') {
        // For "all instances", set to null (applies to all)
        whatsappInstanceId = null;
      }

      // Map performer filter to trigger permission
      let triggerPermission = 'anyone';
      if (performerFilter === 'user_only') {
        triggerPermission = 'me';
      }

      // Map frontend trigger types to database enum values
      let dbTriggerType = triggerType;
      if (triggerType === 'reaction' || triggerType === 'keyword' || triggerType === 'hashtag') {
        dbTriggerType = 'whatsapp_message';
      } else if (triggerType === 'time_based') {
        dbTriggerType = 'schedule';
      }

      const updateData = {
        name: ruleName,
        description,
        is_active: isActive,
        trigger_type: dbTriggerType,
        priority: 1, // Default priority
        whatsapp_instance_id: whatsappInstanceId,
        trigger_permission: triggerPermission,
        allowed_user_ids: []
      };
      
      const updatedRule = await storage.updateActionRule(ruleId, updateData);
      
      if (!updatedRule) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      
      res.json(updatedRule);
    } catch (error) {
      console.error('Error updating action rule:', error);
      res.status(500).json({ error: 'Failed to update action rule' });
    }
  });

  app.get('/api/actions/executions', async (req: AuthRequest, res: Response) => {
    try {
      const { ruleId, status, limit } = req.query;
      const executions = await storage.getActionExecutions(
        ruleId as string,
        status as string, 
        parseInt(limit as string) || 100
      );
      res.json(executions);
    } catch (error) {
      console.error('Error fetching action executions:', error);
      res.status(500).json({ error: 'Failed to fetch action executions' });
    }
  });

  app.get('/api/actions/stats', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const rules = await storage.getActionRules(userId);
      const recentExecutions = await storage.getActionExecutions(undefined, undefined, 100);
      const stats = {
        totalRules: rules.length,
        activeRules: rules.filter(r => r.isActive).length,
        totalExecutions: recentExecutions.length,
        recentExecutions: recentExecutions.filter(e => 
          new Date(e.executedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length
      };
      res.json(stats);
    } catch (error) {
      console.error('Error fetching action stats:', error);
      res.status(500).json({ error: 'Failed to fetch action stats' });
    }
  });

  app.post('/api/actions/rules', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      
      // Helper function to map frontend trigger types to backend enum values
      function mapTriggerType(frontendType: string): string {
        const mapping: Record<string, string> = {
          'reaction': 'whatsapp_message',
          'hashtag': 'whatsapp_message', 
          'keyword': 'whatsapp_message',
          'time_based': 'schedule',
          'location': 'whatsapp_message',
          'contact_group': 'whatsapp_message',
          'whatsapp_message': 'whatsapp_message',
          'schedule': 'schedule',
          'entity_change': 'entity_change',
          'manual': 'manual',
          'webhook': 'webhook'
        };
        return mapping[frontendType] || 'whatsapp_message';
      }
      
      const ruleData = {
        name: req.body.ruleName || req.body.name,
        description: req.body.description,
        is_active: req.body.isActive !== undefined ? req.body.isActive : true,
        trigger_type: mapTriggerType(req.body.triggerType || 'reaction'),
        trigger_permission: req.body.performerFilter === 'user_only' ? 'me' : 'anyone',
        priority: req.body.priority || 0,
        whatsapp_instance_id: req.body.whatsapp_instance_id || null,
        allowed_user_ids: req.body.allowed_user_ids || [],
        created_by: userId
      };
      
      console.log('POST /api/actions/rules - creating rule:', ruleData);
      const rule = await storage.createActionRule(ruleData);
      res.status(201).json(rule);
    } catch (error) {
      console.error('Error creating action rule:', error);
      res.status(500).json({ error: 'Failed to create action rule' });
    }
  });

  app.put('/api/actions/rules/:ruleId', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const { ruleId } = req.params;
      
      if (!ruleId || ruleId === 'undefined') {
        return res.status(400).json({ error: 'Valid rule ID is required' });
      }
      
      console.log('PUT /api/actions/rules/:ruleId - ruleId:', ruleId);
      console.log('PUT /api/actions/rules/:ruleId - body:', req.body);
      
      // Helper function to map frontend trigger types to backend enum values
      const mapTriggerType = (frontendType: string): string => {
        const mapping: Record<string, string> = {
          'reaction': 'whatsapp_message',
          'hashtag': 'whatsapp_message', 
          'keyword': 'whatsapp_message',
          'time_based': 'schedule',
          'location': 'whatsapp_message',
          'contact_group': 'whatsapp_message',
          'whatsapp_message': 'whatsapp_message',
          'schedule': 'schedule',
          'entity_change': 'entity_change',
          'manual': 'manual',
          'webhook': 'webhook'
        };
        return mapping[frontendType] || 'whatsapp_message';
      };
      
      // Map frontend field names to backend field names
      const mappedBody = {
        name: req.body.ruleName || req.body.name,
        description: req.body.description,
        is_active: req.body.isActive !== undefined ? req.body.isActive : req.body.is_active,
        trigger_type: mapTriggerType(req.body.triggerType || req.body.trigger_type || 'reaction'),
        trigger_permission: req.body.performerFilter === 'user_only' ? 'me' : 'anyone',
        priority: req.body.priority || 0,
        whatsapp_instance_id: req.body.whatsapp_instance_id || null,
        allowed_user_ids: req.body.allowed_user_ids || []
      };
      
      console.log('PUT /api/actions/rules/:ruleId - mapped body:', mappedBody);
      const updatedRule = await storage.updateActionRule(ruleId, mappedBody);
      console.log('PUT /api/actions/rules/:ruleId - result:', updatedRule);
      res.json(updatedRule);
    } catch (error) {
      console.error('Error updating action rule:', error);
      res.status(500).json({ error: 'Failed to update action rule' });
    }
  });

  app.patch('/api/actions/rules/:ruleId/toggle', async (req: AuthRequest, res: Response) => {
    try {
      const { ruleId } = req.params;
      const rule = await storage.getActionRule(ruleId);
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      const updatedRule = await storage.updateActionRule(ruleId, { 
        is_active: !rule.is_active 
      });
      res.json(updatedRule);
    } catch (error) {
      console.error('Error toggling action rule:', error);
      res.status(500).json({ error: 'Failed to toggle action rule' });
    }
  });

  app.delete('/api/actions/rules/:ruleId', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const { ruleId } = req.params;
      await storage.deleteActionRule(userId, ruleId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting action rule:', error);
      res.status(500).json({ error: 'Failed to delete action rule' });
    }
  });

  app.get('/api/actions/templates', async (req: Request, res: Response) => {
    try {
      const templates = await storage.getActionTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching action templates:', error);
      res.status(500).json({ error: 'Failed to fetch action templates' });
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

  // Waiting Reply API endpoints
  app.post('/api/whatsapp/waiting-reply', async (req: Request, res: Response) => {
    try {
      const { messageId, instanceId, chatId } = req.body;
      
      if (!messageId || !instanceId || !chatId) {
        return res.status(400).json({ error: 'messageId, instanceId, and chatId are required' });
      }

      await db.execute(sql`
        INSERT INTO whatsapp.waiting_reply (message_id, instance_id, chat_id)
        VALUES (${messageId}, ${instanceId}, ${chatId})
        ON CONFLICT (message_id) DO NOTHING
      `);
      
      // Notify all connected clients about the new waiting reply
      const { SseManager } = await import('./sse-manager');
      SseManager.notifyClients('waiting_reply_added', {
        messageId,
        chatId,
        instanceId
      });
      
      res.json({ success: true, message: 'Message marked as awaiting reply' });
    } catch (error) {
      console.error('Error marking message as awaiting reply:', error);
      res.status(500).json({ error: 'Failed to mark message as awaiting reply' });
    }
  });

  app.delete('/api/whatsapp/waiting-reply/:messageId', async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;
      
      // Get the waiting reply record before deletion to notify clients
      const existingRecord = await db.execute(sql`
        SELECT message_id, chat_id, instance_id 
        FROM whatsapp.waiting_reply 
        WHERE message_id = ${messageId}
      `);
      
      await db.execute(sql`
        DELETE FROM whatsapp.waiting_reply 
        WHERE message_id = ${messageId}
      `);
      
      // Notify all connected clients about the waiting reply removal
      if (existingRecord.rows.length > 0) {
        const { SseManager } = await import('./sse-manager');
        SseManager.notifyClients('waiting_reply_removed', {
          messageId,
          chatId: existingRecord.rows[0].chat_id,
          instanceId: existingRecord.rows[0].instance_id
        });
      }
      
      res.json({ success: true, message: 'Message unmarked from awaiting reply' });
    } catch (error) {
      console.error('Error unmarking message from awaiting reply:', error);
      res.status(500).json({ error: 'Failed to unmark message from awaiting reply' });
    }
  });

  app.get('/api/whatsapp/waiting-reply/:instanceId', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      
      const result = await db.execute(sql`
        SELECT message_id, chat_id, created_at 
        FROM whatsapp.waiting_reply 
        WHERE instance_id = ${instanceId}
        ORDER BY created_at DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching waiting reply messages:', error);
      res.status(500).json({ error: 'Failed to fetch waiting reply messages' });
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

  // Legacy SSE route - redirect to main events endpoint
  app.get('/api/whatsapp/messages/stream', SseManager.handleNewConnection);

  // REMOVED: bulk group sync - use individual group fetch only

  // REMOVED: bulk group sync - use individual group fetch only

  // Main group management endpoint - Fetch groups from Evolution API with live participant data
  app.get('/api/whatsapp/groups/:spaceId', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      console.log(`Fetching groups from Evolution API for space: ${spaceId}`);
      
      const instanceId = 'instance-1750433520122';
      const instanceApiKey = process.env.EVOLUTION_API_KEY;
      const baseUrl = process.env.EVOLUTION_API_URL;
      
      // First get groups from database (webhook-captured authentic data)
      const pg = await import('pg');
      const { Client } = pg.default;
      
      const client = new Client({
        connectionString: process.env.DATABASE_URL
      });
      
      await client.connect();
      
      const result = await client.query(`
        SELECT 
          g.group_jid,
          g.instance_id,
          g.subject,
          g.description,
          g.is_locked,
          g.creation_timestamp,
          COALESCE(m.recent_message_count, 0) as recent_message_count,
          m.last_message_timestamp
        FROM whatsapp.groups g
        LEFT JOIN (
          SELECT 
            chat_id,
            instance_id,
            COUNT(*) as recent_message_count,
            MAX(timestamp) as last_message_timestamp
          FROM whatsapp.messages 
          WHERE timestamp > NOW() - INTERVAL '30 days'
          GROUP BY chat_id, instance_id
        ) m ON g.group_jid = m.chat_id AND g.instance_id = m.instance_id
        WHERE g.subject IS NOT NULL 
          AND g.subject != ''
        ORDER BY 
          recent_message_count DESC,
          g.creation_timestamp DESC NULLS LAST,
          g.subject ASC
      `);
      
      await client.end();
      
      console.log(`Found ${result.rows.length} groups in database`);
      
      if (result.rows.length === 0) {
        console.log('No groups found in database, returning empty array');
        return res.json([]);
      }
      
      // Optimize: Process groups in batches for better performance
      const batchSize = 10;
      const enhancedGroups = [];
      
      for (let i = 0; i < result.rows.length; i += batchSize) {
        const batch = result.rows.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (group: any) => {
            try {
              // Fetch live participant count from Evolution API
              const participantsResponse = await fetch(`${baseUrl}/group/participants/${instanceId}?groupJid=${group.group_jid}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': instanceApiKey
                },
                timeout: 3000 // Reduced timeout for better performance
              });
              
              let liveParticipantCount = 0;
              let participants = [];
              
              if (participantsResponse.ok) {
                const participantsData = await participantsResponse.json();
                participants = participantsData.participants || [];
                liveParticipantCount = participants.length;
              }
              
              return {
                jid: group.group_jid,
                instanceId: group.instance_id,
                subject: group.subject, // Authentic Evolution API subject from webhooks
                description: group.description,
                participantCount: liveParticipantCount, // Live count from Evolution API
                recentMessageCount: parseInt(group.recent_message_count) || 0,
                lastMessageAt: group.last_message_timestamp ? new Date(group.last_message_timestamp).toISOString() : null,
                isLocked: group.is_locked || false,
                createdAt: group.creation_timestamp ? new Date(group.creation_timestamp).toISOString() : new Date().toISOString(),
                source: 'evolution_api_enhanced', // Database + live API data
                participants: participants.slice(0, 3) // Limited sample for performance
              };
            } catch (apiError) {
              // Fallback to database data only
              return {
                jid: group.group_jid,
                instanceId: group.instance_id,
                subject: group.subject,
                description: group.description,
                participantCount: 0,
                recentMessageCount: parseInt(group.recent_message_count) || 0,
                lastMessageAt: group.last_message_timestamp ? new Date(group.last_message_timestamp).toISOString() : null,
                isLocked: group.is_locked || false,
                createdAt: group.creation_timestamp ? new Date(group.creation_timestamp).toISOString() : new Date().toISOString(),
                source: 'database_authentic',
                participants: []
              };
            }
          })
        );
        
        enhancedGroups.push(...batchResults);
        
        // Small delay between batches to avoid overwhelming the API
        if (i + batchSize < result.rows.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`Successfully enhanced ${enhancedGroups.length} groups with Evolution API data`);
      res.json(enhancedGroups);
      
    } catch (error) {
      console.error('Error fetching groups with Evolution API enhancement:', error);
      res.status(500).json({ 
        error: 'Failed to fetch groups',
        details: error.message 
      });
    }
  });

  // Force group metadata refresh using the "Forced Update" trigger method
  app.post('/api/whatsapp/groups/:instanceId/force-metadata/:groupJid', async (req: Request, res: Response) => {
    try {
      const { instanceId, groupJid } = req.params;
      console.log(`🔄 Force metadata refresh requested for group: ${groupJid}`);
      
      const { createGroupMetadataFetcher } = await import('./group-metadata-fetcher');
      const instanceApiKey = process.env.EVOLUTION_API_KEY;
      
      const fetcher = createGroupMetadataFetcher(instanceId, instanceApiKey);
      const result = await fetcher.populateGroupInfo(groupJid);
      
      if (result.success) {
        res.json({
          success: true,
          method: result.method,
          message: result.method === 'forced_update_trigger' 
            ? 'Forced update trigger sent - waiting for webhook to populate metadata'
            : 'Group metadata retrieved directly',
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to populate group metadata using any available method'
        });
      }
      
    } catch (error) {
      console.error('Error in force metadata refresh:', error);
      res.status(500).json({ 
        error: 'Failed to force group metadata refresh',
        details: error.message 
      });
    }
  });

  // Direct database test endpoint
  app.get('/api/test/groups', async (req: Request, res: Response) => {
    try {
      const { db } = await import('./db');
      const { whatsappGroups } = await import('../shared/schema');
      
      const result = await db.select().from(whatsappGroups).limit(5);
      res.json({
        count: result.length,
        sample: result
      });
    } catch (error) {
      console.error('Database test error:', error);
      res.status(500).json({ error: 'Database test failed' });
    }
  });

  // Group sync endpoint
  app.post('/api/whatsapp/groups/:instanceId/sync-from-api', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      const { WebhookApiAdapter } = await import('./whatsapp-api-adapter.js');
      
      const result = await WebhookApiAdapter.syncAllGroupsFromApi(instanceId);
      
      res.json({
        success: result.success,
        message: `Successfully synced ${result.count} groups from Evolution API`,
        count: result.count
      });
    } catch (error) {
      console.error('Group sync error:', error);
      res.status(500).json({ error: 'Failed to sync groups from Evolution API' });
    }
  });

  // Sync group contact names with authentic subjects
  app.post('/api/whatsapp/groups/:instanceId/sync-contact-names', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      const { WebhookApiAdapter } = await import('./whatsapp-api-adapter.js');
      
      await WebhookApiAdapter.syncGroupContactNames(instanceId);
      
      res.json({
        success: true,
        message: 'Group contact names synchronized with authentic subjects'
      });
    } catch (error) {
      console.error('Group contact name sync error:', error);
      res.status(500).json({ error: 'Failed to sync group contact names' });
    }
  });

  // Update group settings
  app.patch('/api/whatsapp/groups/:instanceId/:groupJid', async (req: Request, res: Response) => {
    try {
      const { instanceId, groupJid } = req.params;
      const updates = req.body;
      
      // Use Evolution API to update group settings
      const evolutionApi = getEvolutionApi();
      const instanceApiKey = process.env.EVOLUTION_API_KEY;
      
      if (updates.subject) {
        await evolutionApi.updateGroupSubject(instanceId, instanceApiKey, groupJid, updates.subject);
      }
      
      if (updates.description !== undefined) {
        await evolutionApi.updateGroupDescription(instanceId, instanceApiKey, groupJid, updates.description);
      }
      
      if (updates.isAnnounce !== undefined || updates.isLocked !== undefined) {
        const settings: any = {};
        if (updates.isAnnounce !== undefined) settings.announce = updates.isAnnounce ? 'true' : 'false';
        if (updates.isLocked !== undefined) settings.locked = updates.isLocked ? 'true' : 'false';
        
        await evolutionApi.updateGroupSettings(instanceId, instanceApiKey, groupJid, settings);
      }
      
      // Update in database
      await storage.upsertGroup({
        instanceId,
        jid: groupJid,
        ...updates,
      });
      
      res.json({ success: true, message: 'Group updated successfully' });
    } catch (error) {
      console.error('Error updating group:', error);
      res.status(500).json({ error: 'Failed to update group' });
    }
  });

  // Chat management endpoints
  app.patch('/api/whatsapp/conversations/:conversationId/archive', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const { instanceId, archived = true } = req.body;
      
      await storage.updateConversation(conversationId, instanceId, { isArchived: archived });
      res.json({ success: true, message: archived ? 'Chat archived' : 'Chat unarchived' });
    } catch (error) {
      console.error('Error archiving chat:', error);
      res.status(500).json({ error: 'Failed to archive chat' });
    }
  });

  app.patch('/api/whatsapp/conversations/:conversationId/mute', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const { instanceId, muted = true } = req.body;
      
      await storage.updateConversation(conversationId, instanceId, { isMuted: muted });
      res.json({ success: true, message: muted ? 'Chat muted' : 'Chat unmuted' });
    } catch (error) {
      console.error('Error muting chat:', error);
      res.status(500).json({ error: 'Failed to mute chat' });
    }
  });

  app.patch('/api/whatsapp/conversations/:conversationId/pin', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const { instanceId, pinned = true } = req.body;
      
      await storage.updateConversation(conversationId, instanceId, { isPinned: pinned });
      res.json({ success: true, message: pinned ? 'Chat pinned' : 'Chat unpinned' });
    } catch (error) {
      console.error('Error pinning chat:', error);
      res.status(500).json({ error: 'Failed to pin chat' });
    }
  });

  app.patch('/api/whatsapp/conversations/read-status', async (req: Request, res: Response) => {
    try {
      const { chatId, instanceId, unread = true, silent = false } = req.body;
      
      if (!chatId || !instanceId) {
        return res.status(400).json({ error: 'chatId and instanceId are required' });
      }
      
      // Update local database
      await storage.updateConversation(chatId, instanceId, { 
        unreadCount: unread ? 1 : 0 
      });
      
      // If marking as read (unread=false), notify Evolution API
      console.log(`🔍 Read status debug: unread=${unread}, silent=${silent}, should notify=${!unread && !silent}`);
      if (!unread && !silent) {
        try {
          const evolutionApi = getEvolutionApi();
          const instanceApiKey = process.env.EVOLUTION_API_KEY;
          
          console.log(`📖 [${instanceId}] Marking conversation as read via Evolution API: ${chatId}`);
          
          // Mark all messages in this chat as read via Evolution API
          await evolutionApi.markChatAsRead(instanceId, instanceApiKey, chatId);
          
          console.log(`✅ [${instanceId}] Successfully notified Evolution API that chat is read: ${chatId}`);
        } catch (evolutionError) {
          console.warn(`⚠️ [${instanceId}] Failed to notify Evolution API about read status:`, evolutionError.message);
          // Don't fail the request if Evolution API call fails
        }
      }
      
      res.json({ success: true, message: unread ? 'Marked as unread' : 'Marked as read' });
    } catch (error) {
      console.error('Error updating read status:', error);
      res.status(500).json({ error: 'Failed to update read status' });
    }
  });

  app.patch('/api/whatsapp/conversations/favorite', async (req: Request, res: Response) => {
    try {
      const { chatId, instanceId, favorite = true } = req.body;
      
      if (!chatId || !instanceId) {
        return res.status(400).json({ error: 'chatId and instanceId are required' });
      }
      
      await storage.updateConversation(chatId, instanceId, { isFavorite: favorite });
      res.json({ success: true, message: favorite ? 'Added to favorites' : 'Removed from favorites' });
    } catch (error) {
      console.error('Error updating favorite status:', error);
      res.status(500).json({ error: 'Failed to update favorite status' });
    }
  });

  app.patch('/api/whatsapp/conversations/:conversationId/block', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const { instanceId, blocked = true } = req.body;
      
      await storage.updateConversation(conversationId, instanceId, { isBlocked: blocked });
      res.json({ success: true, message: blocked ? 'Contact blocked' : 'Contact unblocked' });
    } catch (error) {
      console.error('Error blocking contact:', error);
      res.status(500).json({ error: 'Failed to block contact' });
    }
  });

  app.patch('/api/whatsapp/conversations/:conversationId/close', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const { instanceId } = req.body;
      
      await storage.updateConversation(conversationId, instanceId, { 
        isClosed: true,
        closedAt: new Date()
      });
      res.json({ success: true, message: 'Chat closed' });
    } catch (error) {
      console.error('Error closing chat:', error);
      res.status(500).json({ error: 'Failed to close chat' });
    }
  });

  app.delete('/api/whatsapp/conversations/delete', async (req: Request, res: Response) => {
    try {
      const { chatId, instanceId } = req.body;
      
      if (!chatId || !instanceId) {
        return res.status(400).json({ error: 'chatId and instanceId are required' });
      }
      
      await storage.deleteConversation(chatId, instanceId);
      res.json({ success: true, message: 'Chat deleted' });
    } catch (error) {
      console.error('Error deleting chat:', error);
      res.status(500).json({ error: 'Failed to delete chat' });
    }
  });

  // Media serving endpoint - serve from database file_local_path
  app.get('/api/whatsapp/media/:instanceName/:messageId', async (req: Request, res: Response) => {
    try {
      const { instanceName, messageId } = req.params;
      
      console.log(`📥 Fetching media from database for message: ${messageId}`);
      
      let mediaInfo = null;
      
      // If instanceName is 'undefined', search across all instances
      if (instanceName === 'undefined') {
        console.log(`🔍 Searching for media file across all instances for message: ${messageId}`);
        mediaInfo = await storage.getWhatsappMessageMediaAnyInstance(messageId);
      } else {
        // Verify instance exists first
        const instance = await storage.getWhatsappInstance(instanceName);
        if (!instance) {
          console.log(`❌ Instance not found: ${instanceName}, searching across all instances`);
          mediaInfo = await storage.getWhatsappMessageMediaAnyInstance(messageId);
        } else {
          // Get media info from database for specific instance
          mediaInfo = await storage.getWhatsappMessageMedia(messageId, instanceName);
        }
      }
      
      if (!mediaInfo || (!mediaInfo.fileLocalPath && !mediaInfo.fileUrl)) {
        return res.status(404).json({ error: 'Media file not found in database' });
      }

      // If cloud URL is available, redirect to it for better performance
      if (mediaInfo.fileUrl && process.env.ENABLE_GCS_STORAGE === 'true') {
        console.log(`☁️ Redirecting to cloud storage: ${mediaInfo.fileUrl}`);
        return res.redirect(302, mediaInfo.fileUrl);
      }

      // Fallback to local file serving
      if (!mediaInfo.fileLocalPath) {
        return res.status(404).json({ error: 'No local file path available' });
      }

      // Check if the file exists at the stored path
      const filePath = path.resolve(process.cwd(), mediaInfo.fileLocalPath);
      
      try {
        const stats = await fsPromises.stat(filePath);
        const mimeType = mediaInfo.mimetype || lookup(path.extname(filePath)) || 'audio/ogg; codecs=opus';
        
        console.log(`✅ Found media file: ${filePath}`);
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
        res.setHeader('Content-Length', stats.size.toString());
        
        // For PDFs, add headers to allow inline viewing and fix cross-origin issues
        if (mimeType === 'application/pdf') {
          res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
          res.setHeader('X-Frame-Options', 'SAMEORIGIN');
          res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; object-src 'self'; embed-src 'self';");
        }
        
        console.log(`✅ Serving media: ${messageId} from ${filePath}`);
        return res.sendFile(filePath);
      } catch (fileError) {
        console.error(`❌ File not found at path: ${filePath}`);
        return res.status(404).json({ error: 'Media file not found on filesystem' });
      }
      
    } catch (error) {
      console.error(`❌ Error fetching media for ${req.params.messageId}:`, error.message);
      res.status(500).json({ 
        error: 'Failed to fetch media',
        message: 'Unable to download media from Evolution API'
      });
    }
  });



  app.get('/api/crm/tasks/:taskId', async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const task = await storage.getTaskById(taskId); // Use string directly, not parseInt
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (error) {
      console.error('Error fetching task:', error);
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  // Create task from WhatsApp message
  app.post('/api/whatsapp/create-task-from-message', async (req: Request, res: Response) => {
    try {
      const {
        messageId,
        messageContent,
        description,
        chatId,
        instanceId,
        senderJid,
        title,
        priority,
        dueDate,
        taskType,
        contactName
      } = req.body;

      if (!messageId || !title || !instanceId || !chatId) {
        return res.status(400).json({ error: 'Missing required fields: messageId, title, instanceId, chatId' });
      }

      // Create task with proper WhatsApp message linking
      const task = await storage.createTask({
        title,
        description: description || messageContent,
        priority: priority || 'medium',
        status: 'to_do',
        taskType: taskType || 'task',
        dueDate: dueDate ? new Date(dueDate) : null,
        // Link to WhatsApp message metadata
        triggeringMessageId: messageId,
        instanceId,
        relatedChatJid: chatId,
        senderJid: senderJid || null,
        contactName: contactName || null,
        // Store original message content for reference
        originalMessageContent: messageContent
      });

      res.json({ success: true, task });
    } catch (error) {
      console.error('Error creating task from message:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Finance API routes
  
  // Get financial dashboard data
  app.get('/api/finance/dashboard', async (req: Request, res: Response) => {
    try {
      console.log('🏦 Fetching finance dashboard data...');
      
      const totalIncome = await storage.getFinancialSummary('income');
      console.log('✅ Got income data:', totalIncome);
      
      const totalExpenses = await storage.getFinancialSummary('expense');
      console.log('✅ Got expense data:', totalExpenses);
      
      const pendingBills = await storage.getPendingPayables();
      console.log('✅ Got pending bills:', pendingBills);
      
      const activeLoans = await storage.getActiveLoans();
      console.log('✅ Got active loans:', activeLoans);
      
      const recentTransactions = await storage.getRecentTransactions(10);
      console.log('✅ Got recent transactions:', recentTransactions.length);

      const dashboardData = {
        totalIncome: totalIncome.total || 0,
        incomeChange: totalIncome.change || 0,
        totalExpenses: totalExpenses.total || 0,
        expenseChange: totalExpenses.change || 0,
        pendingBills: pendingBills.count || 0,
        pendingAmount: pendingBills.total || 0,
        activeLoans: activeLoans.count || 0,
        totalLoanBalance: activeLoans.total || 0,
        recentTransactions: recentTransactions || []
      };
      
      console.log('🎯 Sending dashboard data:', Object.keys(dashboardData));
      res.json(dashboardData);
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
    }
  });

  // Get finance categories
  app.get('/api/finance/categories', async (req: Request, res: Response) => {
    try {
      const categories = await storage.getFinanceCategories();
      res.json(categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Create finance category
  app.post('/api/finance/categories', async (req: Request, res: Response) => {
    try {
      const category = await storage.createFinanceCategory(req.body);
      res.json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  // =============================
  // CORTEX FINANCE ROUTES
  // =============================

  // Get cortex finance accounts
  app.get('/api/cortex/finance/accounts', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const accounts = await storage.getFinanceAccounts(userId);
      res.json(accounts || []);
    } catch (error) {
      console.error('Error fetching cortex finance accounts:', error);
      res.status(500).json({ error: 'Failed to fetch cortex finance accounts' });
    }
  });

  // Create cortex finance account
  app.post('/api/cortex/finance/accounts', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const accountData = { 
        ...req.body, 
        createdByEntityId: userId,
        currency: req.body.currency || 'MXN' // Default to MXN
      };
      const account = await storage.createFinanceAccount(accountData);
      res.json(account);
    } catch (error) {
      console.error('Error creating cortex finance account:', error);
      res.status(500).json({ error: 'Failed to create cortex finance account' });
    }
  });

  // Get cortex finance transactions
  app.get('/api/cortex/finance/transactions', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const transactions = await storage.getCortexFinanceTransactions(userId);
      res.json(transactions || []);
    } catch (error) {
      console.error('Error fetching cortex finance transactions:', error);
      res.status(500).json({ error: 'Failed to fetch cortex finance transactions' });
    }
  });

  // Create cortex finance transaction
  app.post('/api/cortex/finance/transactions', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const transactionData = { 
        ...req.body, 
        createdByEntityId: userId 
      };
      const transaction = await storage.createCortexFinanceTransaction(transactionData);
      res.json(transaction);
    } catch (error) {
      console.error('Error creating cortex finance transaction:', error);
      res.status(500).json({ error: 'Failed to create cortex finance transaction' });
    }
  });

  // Get transactions
  app.get('/api/finance/transactions', async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  // Create transaction
  app.post('/api/finance/transactions', async (req: Request, res: Response) => {
    try {
      const transaction = await storage.createTransaction(req.body);
      res.json(transaction);
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  });

  // Get payables
  app.get('/api/finance/payables', async (req: Request, res: Response) => {
    try {
      const payables = await storage.getPayables();
      res.json(payables || []);
    } catch (error) {
      console.error('Error fetching payables:', error);
      res.status(500).json({ error: 'Failed to fetch payables' });
    }
  });

  // Create payable
  app.post('/api/finance/payables', async (req: Request, res: Response) => {
    try {
      // Auto-generate bill number if not provided
      const billData = {
        ...req.body,
        bill_number: req.body.bill_number || `BILL-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
      };
      
      const payable = await storage.createPayable(billData);
      
      // DISABLED: Companion task creation temporarily disabled after finance schema cleanup
      // try {
      //   await BillToTaskService.createTaskForBill(payable.payableId, {
      //     instanceId: req.body.instanceId || 'default-instance',
      //     userId: payable.userId,
      //     createdByUserId: req.body.createdByUserId,
      //   });
      // } catch (taskError) {
      //   console.error('Error creating companion task for bill:', taskError);
      // }
      
      res.json(payable);
    } catch (error) {
      console.error('Error creating payable:', error);
      res.status(500).json({ error: 'Failed to create payable' });
    }
  });

  // Apply payment to bill (with penalty priority)
  app.post('/api/finance/payables/:payableId/payment', async (req: Request, res: Response) => {
    try {
      const payableId = parseInt(req.params.payableId);
      const { paymentAmount } = req.body;
      
      if (!paymentAmount || paymentAmount <= 0) {
        return res.status(400).json({ error: 'Payment amount must be greater than 0' });
      }
      
      // DISABLED: Payment processing temporarily disabled after finance schema cleanup
      // const result = await BillToTaskService.applyPaymentToBill(payableId, parseFloat(paymentAmount));
      res.status(501).json({ error: 'Payment processing temporarily disabled' });
    } catch (error) {
      console.error('Error applying payment to bill:', error);
      res.status(500).json({ error: 'Failed to apply payment to bill' });
    }
  });

  // Manual trigger for overdue bills processing
  app.post('/api/finance/process-overdue-bills', async (req: Request, res: Response) => {
    try {
      const result = await ScheduledJobsService.triggerOverdueBillsProcessing();
      res.json(result);
    } catch (error) {
      console.error('Error processing overdue bills:', error);
      res.status(500).json({ error: 'Failed to process overdue bills' });
    }
  });

  // Update payable (with task sync)
  app.put('/api/finance/payables/:payableId', async (req: Request, res: Response) => {
    try {
      const payableId = parseInt(req.params.payableId);
      const payable = await storage.updatePayable(payableId, req.body);
      
      // DISABLED: Companion task update temporarily disabled after finance schema cleanup
      // try {
      //   await BillToTaskService.updateTaskForBill(payableId);
      // } catch (taskError) {
      //   console.error('Error updating companion task for bill:', taskError);
      // }
      
      res.json(payable);
    } catch (error) {
      console.error('Error updating payable:', error);
      res.status(500).json({ error: 'Failed to update payable' });
    }
  });

  // =============================================================================
  // RECEIVABLES API ROUTES - Money owed to you
  // =============================================================================

  // Get receivables
  app.get('/api/finance/receivables', async (req: Request, res: Response) => {
    try {
      const receivables = await storage.getReceivables();
      res.json(receivables || []);
    } catch (error) {
      console.error('Error fetching receivables:', error);
      res.status(500).json({ error: 'Failed to fetch receivables' });
    }
  });

  // Create receivable
  app.post('/api/finance/receivables', async (req: Request, res: Response) => {
    try {
      const receivableData = insertFinanceReceivableSchema.parse(req.body);
      const receivable = await storage.createReceivable(receivableData);
      res.json(receivable);
    } catch (error) {
      console.error('Error creating receivable:', error);
      res.status(500).json({ error: 'Failed to create receivable' });
    }
  });

  // Update receivable
  app.put('/api/finance/receivables/:receivableId', async (req: Request, res: Response) => {
    try {
      const receivableId = parseInt(req.params.receivableId);
      const receivable = await storage.updateReceivable(receivableId, req.body);
      res.json(receivable);
    } catch (error) {
      console.error('Error updating receivable:', error);
      res.status(500).json({ error: 'Failed to update receivable' });
    }
  });

  // Delete receivable
  app.delete('/api/finance/receivables/:receivableId', async (req: Request, res: Response) => {
    try {
      const receivableId = parseInt(req.params.receivableId);
      await storage.deleteReceivable(receivableId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting receivable:', error);
      res.status(500).json({ error: 'Failed to delete receivable' });
    }
  });

  // Get vendors (contacts and companies for bill forms)
  app.get('/api/finance/vendors', async (req: Request, res: Response) => {
    try {
      const [contacts, companies] = await Promise.all([
        storage.getCortexPersons(),
        storage.getCompanies()
      ]);
      
      // Transform contacts to vendor format
      const contactVendors = contacts.map(contact => ({
        id: contact.id,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed Contact',
        type: 'contact',
        description: contact.profession || contact.company || '',
        email: contact.primary_email || '',
        phone: contact.primary_phone || ''
      }));
      
      // Transform companies to vendor format
      const companyVendors = companies.map(company => ({
        id: company.id,
        name: company.company_name || 'Unnamed Company',
        type: 'company',
        description: company.business_type || '',
        email: company.email || '',
        phone: company.phone || ''
      }));
      
      // Combine and sort by name
      const allVendors = [...contactVendors, ...companyVendors]
        .filter(vendor => vendor.name && vendor.name !== 'Unnamed Contact' && vendor.name !== 'Unnamed Company')
        .sort((a, b) => a.name.localeCompare(b.name));
      
      res.json(allVendors);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      res.status(500).json({ error: 'Failed to fetch vendors' });
    }
  });

  // Get loans
  app.get('/api/finance/loans', async (req: Request, res: Response) => {
    try {
      const loans = await storage.getLoans();
      res.json(loans || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
      res.status(500).json({ error: 'Failed to fetch loans' });
    }
  });

  // Create loan
  app.post('/api/finance/loans', async (req: Request, res: Response) => {
    try {
      const loan = await storage.createLoan(req.body);
      res.json(loan);
    } catch (error) {
      console.error('Error creating loan:', error);
      res.status(500).json({ error: 'Failed to create loan' });
    }
  });

  // Update loan
  app.put('/api/finance/loans/:id', async (req: Request, res: Response) => {
    try {
      const loan = await storage.updateLoan(req.params.id, req.body);
      res.json(loan);
    } catch (error) {
      console.error('Error updating loan:', error);
      res.status(500).json({ error: 'Failed to update loan' });
    }
  });

  // Get accounts
  app.get('/api/finance/accounts', async (req: Request, res: Response) => {
    try {
      // TODO: Add proper user authentication middleware
      const userId = 'default-user-id'; // Temporary for development
      
      const accounts = await storage.getFinanceAccounts(userId);
      res.json(accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      res.status(500).json({ error: 'Failed to fetch accounts' });
    }
  });

  // Create account
  app.post('/api/finance/accounts', async (req: Request, res: Response) => {
    try {
      const account = await storage.createFinanceAccount(req.body);
      res.json(account);
    } catch (error) {
      console.error('Error creating account:', error);
      res.status(500).json({ error: 'Failed to create account' });
    }
  });

  // Update account
  app.put('/api/finance/accounts/:accountId', async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const account = await storage.updateFinanceAccount(accountId, req.body);
      res.json(account);
    } catch (error) {
      console.error('Error updating account:', error);
      res.status(500).json({ error: 'Failed to update account' });
    }
  });

  // Delete account
  app.delete('/api/finance/accounts/:accountId', async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      await storage.deleteFinanceAccount(accountId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  });

  // =============================================================================
  // CREDIT CARDS API ROUTES - Dedicated credit card management
  // =============================================================================

  // Get credit cards
  app.get('/api/finance/credit-cards', async (req: Request, res: Response) => {
    try {
      const creditCards = await storage.getCreditCards();
      res.json(creditCards || []);
    } catch (error) {
      console.error('Error fetching credit cards:', error);
      res.status(500).json({ error: 'Failed to fetch credit cards' });
    }
  });

  // Create credit card
  app.post('/api/finance/credit-cards', async (req: Request, res: Response) => {
    try {
      const creditCard = await storage.createCreditCard(req.body);
      res.json(creditCard);
    } catch (error) {
      console.error('Error creating credit card:', error);
      res.status(500).json({ error: 'Failed to create credit card' });
    }
  });

  // Update credit card
  app.put('/api/finance/credit-cards/:id', async (req: Request, res: Response) => {
    try {
      const creditCard = await storage.updateCreditCard(req.params.id, req.body);
      res.json(creditCard);
    } catch (error) {
      console.error('Error updating credit card:', error);
      res.status(500).json({ error: 'Failed to update credit card' });
    }
  });

  // Delete credit card
  app.delete('/api/finance/credit-cards/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteCreditCard(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting credit card:', error);
      res.status(500).json({ error: 'Failed to delete credit card' });
    }
  });

  // Get credit card by ID
  app.get('/api/finance/credit-cards/:id', async (req: Request, res: Response) => {
    try {
      const creditCard = await storage.getCreditCardById(req.params.id);
      if (!creditCard) {
        return res.status(404).json({ error: 'Credit card not found' });
      }
      res.json(creditCard);
    } catch (error) {
      console.error('Error fetching credit card:', error);
      res.status(500).json({ error: 'Failed to fetch credit card' });
    }
  });

  // =============================================================================
  // RECURRING BILLS API ROUTES - Automated recurring bill management
  // =============================================================================

  // Get recurring bill templates
  app.get('/api/finance/recurring-bills', async (req: Request, res: Response) => {
    try {
      const templates = await storage.getRecurringBillTemplates();
      res.json(templates || []);
    } catch (error) {
      console.error('Error fetching recurring bill templates:', error);
      res.status(500).json({ error: 'Failed to fetch recurring bill templates' });
    }
  });

  // Get upcoming recurring bills (next due bills)
  app.get('/api/finance/recurring-bills/upcoming', async (req: Request, res: Response) => {
    try {
      const upcomingBills = await storage.getUpcomingRecurringBills();
      res.json(upcomingBills || []);
    } catch (error) {
      console.error('Error fetching upcoming recurring bills:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming recurring bills' });
    }
  });

  // Get all bills with recurrence information
  app.get('/api/finance/bills-with-recurrence', async (req: Request, res: Response) => {
    try {
      const allBills = await storage.getAllBillsWithRecurrence();
      res.json(allBills || []);
    } catch (error) {
      console.error('Error fetching bills with recurrence:', error);
      res.status(500).json({ error: 'Failed to fetch bills with recurrence' });
    }
  });

  // Create recurring payable
  app.post('/api/finance/recurring-payables', async (req: Request, res: Response) => {
    try {
      const payableData = {
        ...req.body,
        createdByEntityId: req.body.createdByEntityId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
        isRecurring: true
      };
      const payable = await storage.createRecurringPayable(payableData);
      res.json(payable);
    } catch (error) {
      console.error('Error creating recurring payable:', error);
      res.status(500).json({ error: 'Failed to create recurring payable' });
    }
  });

  // Create recurring receivable
  app.post('/api/finance/recurring-receivables', async (req: Request, res: Response) => {
    try {
      const receivableData = {
        ...req.body,
        createdByEntityId: req.body.createdByEntityId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
        isRecurring: true
      };
      const receivable = await storage.createRecurringReceivable(receivableData);
      res.json(receivable);
    } catch (error) {
      console.error('Error creating recurring receivable:', error);
      res.status(500).json({ error: 'Failed to create recurring receivable' });
    }
  });

  // Generate next instance of a recurring bill
  app.post('/api/finance/recurring-bills/:parentBillId/generate', async (req: Request, res: Response) => {
    try {
      const { parentBillId } = req.params;
      const newBill = await storage.generateNextRecurringBill(parentBillId);
      res.json(newBill);
    } catch (error) {
      console.error('Error generating next recurring bill:', error);
      res.status(500).json({ error: 'Failed to generate next recurring bill' });
    }
  });

  // Process all due recurring bills (manual trigger)
  app.post('/api/finance/recurring-bills/process', async (req: Request, res: Response) => {
    try {
      const billsGenerated = await storage.processRecurringBills();
      res.json({ 
        success: true, 
        billsGenerated,
        message: `Successfully generated ${billsGenerated} bills from recurring templates`
      });
    } catch (error) {
      console.error('Error processing recurring bills:', error);
      res.status(500).json({ error: 'Failed to process recurring bills' });
    }
  });

  // CRM Calendar Events - CRUD operations for CRM calendar events
  app.get('/api/crm/calendar-events', async (req, res) => {
    try {
      console.log('📅 Fetching CRM calendar events...');
      const result = await db.execute(sql`
        SELECT * FROM crm.calendar_events 
        ORDER BY created_at DESC
      `);
      const events = result.rows || result;
      console.log('📅 Found events:', events.length);
      res.json(events);
    } catch (error) {
      console.error('❌ Error fetching CRM calendar events:', error);
      res.status(500).json({ error: 'Failed to fetch CRM calendar events' });
    }
  });

  app.post('/api/crm/calendar-events', async (req, res) => {
    try {
      const eventData = req.body;
      const createdEvent = await storage.createCalendarEvent(eventData);
      res.json(createdEvent);
    } catch (error) {
      console.error('Error creating CRM calendar event:', error);
      res.status(500).json({ error: 'Failed to create CRM calendar event' });
    }
  });

  // WhatsApp number validation endpoint
  app.post('/api/whatsapp/validate-number', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      // Check if phone number exists in our WhatsApp contacts
      const contact = await storage.getWhatsAppContactByPhone(phoneNumber);
      
      res.json({ 
        hasWhatsApp: !!contact,
        contactData: contact || null
      });
    } catch (error) {
      console.error('WhatsApp validation error:', error);
      res.status(500).json({ error: 'Failed to validate WhatsApp number' });
    }
  });

  // ============================================
  // CRM COMPANIES ENDPOINTS - For polymorphic creditor relationships
  // ============================================

  // Get companies
  app.get('/api/crm/companies', async (req: Request, res: Response) => {
    try {
      // TODO: Add proper user authentication middleware
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Temporary for development
      const companies = await storage.getCrmCompanies(userId);
      res.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ error: 'Failed to fetch companies' });
    }
  });

  // Create company
  app.post('/api/crm/companies', async (req: Request, res: Response) => {
    try {
      const companyData = req.body;
      const company = await storage.createCrmCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      console.error('Error creating company:', error);
      res.status(500).json({ error: 'Failed to create company' });
    }
  });

  // Update company
  app.put('/api/crm/companies/:companyId', async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const updates = req.body;
      const company = await storage.updateCrmCompany(companyId, updates);
      res.json(company);
    } catch (error) {
      console.error('Error updating company:', error);
      res.status(500).json({ error: 'Failed to update company' });
    }
  });

  // Delete company
  app.delete('/api/crm/companies/:companyId', async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      await storage.deleteCrmCompany(companyId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting company:', error);
      res.status(500).json({ error: 'Failed to delete company' });
    }
  });

  // ============================================
  // CRM CONTACT GROUPS ENDPOINTS - Flexible contact organization
  // ============================================

  // Get contact groups for a space
  app.get('/api/crm/contact-groups', async (req: Request, res: Response) => {
    try {
      // TODO: Add proper user authentication middleware
      const userId = 'default-user-id'; // Temporary for development

      const groups = await storage.getContactGroups(userId);
      res.json(groups);
    } catch (error) {
      console.error('Error fetching contact groups:', error);
      res.status(500).json({ error: 'Failed to fetch contact groups' });
    }
  });

  // Get contact group with members
  app.get('/api/crm/contact-groups/:groupId', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const group = await storage.getContactGroupWithMembers(groupId);
      
      if (!group) {
        return res.status(404).json({ error: 'Contact group not found' });
      }

      res.json(group);
    } catch (error) {
      console.error('Error fetching contact group:', error);
      res.status(500).json({ error: 'Failed to fetch contact group' });
    }
  });

  // Create contact group
  app.post('/api/crm/contact-groups', async (req: Request, res: Response) => {
    try {
      const groupData = req.body;
      const group = await storage.createContactGroup(groupData);
      res.status(201).json(group);
    } catch (error) {
      console.error('Error creating contact group:', error);
      res.status(500).json({ error: 'Failed to create contact group' });
    }
  });

  // Update contact group
  app.put('/api/crm/contact-groups/:groupId', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const updates = req.body;
      const group = await storage.updateContactGroup(groupId, updates);
      res.json(group);
    } catch (error) {
      console.error('Error updating contact group:', error);
      res.status(500).json({ error: 'Failed to update contact group' });
    }
  });

  // Delete contact group
  app.delete('/api/crm/contact-groups/:groupId', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      await storage.deleteContactGroup(groupId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting contact group:', error);
      res.status(500).json({ error: 'Failed to delete contact group' });
    }
  });

  // Add contact to group
  app.post('/api/crm/contact-groups/:groupId/members', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const { contactId, addedBy, roleInGroup } = req.body;
      
      const member = await storage.addContactToGroup(groupId, contactId, addedBy, roleInGroup);
      res.status(201).json(member);
    } catch (error) {
      console.error('Error adding contact to group:', error);
      res.status(500).json({ error: 'Failed to add contact to group' });
    }
  });

  // Remove contact from group
  app.delete('/api/crm/contact-groups/:groupId/members/:contactId', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const contactId = parseInt(req.params.contactId);
      
      await storage.removeContactFromGroup(groupId, contactId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing contact from group:', error);
      res.status(500).json({ error: 'Failed to remove contact from group' });
    }
  });

  // Update contact role in group
  app.put('/api/crm/contact-groups/:groupId/members/:contactId', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const contactId = parseInt(req.params.contactId);
      const { roleInGroup } = req.body;
      
      const member = await storage.updateContactRoleInGroup(groupId, contactId, roleInGroup);
      res.json(member);
    } catch (error) {
      console.error('Error updating contact role in group:', error);
      res.status(500).json({ error: 'Failed to update contact role in group' });
    }
  });

  // Get groups for a specific contact
  app.get('/api/crm/contacts/:contactId/groups', async (req: Request, res: Response) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const groups = await storage.getContactGroupsByContact(contactId);
      res.json(groups);
    } catch (error) {
      console.error('Error fetching contact groups for contact:', error);
      res.status(500).json({ error: 'Failed to fetch contact groups for contact' });
    }
  });

  // =========================================================================
  // COMPREHENSIVE CONTACTS & CRM API ROUTES - 360-Degree Network Intelligence
  // =========================================================================

  // Core Contact Routes - Using Cortex entities schema
  app.get('/api/crm/contacts', async (req: Request, res: Response) => {
    try {
      const { ownerUserId } = req.query;
      const userId = ownerUserId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      
      // Fetch contacts from Cortex entities schema using SQL query
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.full_name,
          p.first_name,
          p.last_name,
          p.profession,
          p.company_name,
          p.notes,
          p.relationship,
          p.is_whatsapp_linked,
          p.primary_whatsapp_jid,
          p.whatsapp_instance_name,
          p.whatsapp_linked_at,
          p.profile_picture_url,
          p.created_at,
          p.updated_at,
          p.date_of_birth,
          p.gender,
          p.title,
          p.nickname,
          -- Get primary phone
          (SELECT phone_number FROM cortex_entities.contact_phones WHERE person_id = p.id AND is_primary = true LIMIT 1) as primary_phone,
          -- Get primary email  
          (SELECT email_address FROM cortex_entities.contact_emails WHERE person_id = p.id AND is_primary = true LIMIT 1) as primary_email
        FROM cortex_entities.persons p
        WHERE p.created_by = ${userId} AND p.is_active = true
        ORDER BY p.created_at DESC
      `);
      
      // Map to frontend expected format with proper camelCase field names
      const contacts = result.rows.map(row => ({
        contactId: row.id,
        fullName: row.full_name,
        firstName: row.first_name,
        lastName: row.last_name,
        profession: row.profession,
        company: row.company_name,
        notes: row.notes,
        relationship: row.relationship,
        isWhatsappLinked: row.is_whatsapp_linked,
        whatsappJid: row.primary_whatsapp_jid,
        whatsappInstanceId: row.whatsapp_instance_name,
        whatsappLinkedAt: row.whatsapp_linked_at,
        profilePictureUrl: row.profile_picture_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        dateOfBirth: row.date_of_birth,
        gender: row.gender,
        title: row.title,
        nickname: row.nickname,
        phone: row.primary_phone,
        email: row.primary_email,
        tags: []
      }));
      
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching Cortex contacts:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Failed to fetch contacts', details: error.message });
    }
  });

  app.get('/api/crm/contacts/:contactId/details', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      console.log('Fetching contact details for ID:', contactId);
      
      // Fetch contact details from Cortex entities schema
      const result = await db.execute(sql`
        SELECT 
          p.*,
          -- Get phones
          COALESCE(
            (SELECT json_agg(json_build_object(
              'id', id,
              'phoneNumber', phone_number,
              'label', label,
              'isPrimary', is_primary,
              'isWhatsappEnabled', is_whatsapp_enabled
            )) FROM cortex_entities.contact_phones WHERE person_id = p.id),
            '[]'::json
          ) as phones,
          -- Get emails
          COALESCE(
            (SELECT json_agg(json_build_object(
              'id', id,
              'emailAddress', email_address,
              'label', label,
              'isPrimary', is_primary
            )) FROM cortex_entities.contact_emails WHERE person_id = p.id),
            '[]'::json
          ) as emails,
          -- Get addresses
          COALESCE(
            (SELECT json_agg(json_build_object(
              'id', id,
              'street', street_address,
              'city', city,
              'state', state,
              'zipCode', postal_code,
              'country', country,
              'label', label,
              'isPrimary', is_primary
            )) FROM cortex_entities.contact_addresses WHERE person_id = p.id),
            '[]'::json
          ) as addresses,
          -- Get special dates
          COALESCE(
            (SELECT json_agg(json_build_object(
              'id', id,
              'eventName', event_name,
              'eventDay', event_day,
              'eventMonth', event_month,
              'originalYear', original_year,
              'category', category
            )) FROM cortex_entities.special_dates WHERE person_id = p.id),
            '[]'::json
          ) as specialDates
        FROM cortex_entities.persons p
        WHERE p.id = ${contactId}
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      const contact = result.rows[0];
      
      // Transform to expected format
      const transformedContact = {
        contactId: contact.id,
        id: contact.id,
        fullName: contact.full_name,
        firstName: contact.first_name,
        middleName: contact.middle_name,
        lastName: contact.last_name,
        nickname: contact.nickname,
        title: contact.title,
        profession: contact.profession,
        companyName: contact.company_name,
        dateOfBirth: contact.date_of_birth,
        gender: contact.gender,
        relationship: contact.relationship,
        notes: contact.notes,
        profilePictureUrl: contact.profile_picture_url,
        isActive: contact.is_active,
        primaryWhatsappJid: contact.primary_whatsapp_jid,
        whatsappInstanceName: contact.whatsapp_instance_name,
        isWhatsappLinked: contact.is_whatsapp_linked,
        whatsappLinkedAt: contact.whatsapp_linked_at,
        createdAt: contact.created_at,
        updatedAt: contact.updated_at,
        createdBy: contact.created_by,
        phones: contact.phones,
        emails: contact.emails,
        addresses: contact.addresses,
        specialDates: contact.specialdates ? contact.specialdates : [],
        tags: [],
        companies: [],
        groups: [],
        relationships: [],
        interests: []
      };
      

      res.json(transformedContact);
    } catch (error) {
      console.error('Error fetching contact details:', error);
      console.error('Error details:', error.message);
      res.status(500).json({ error: 'Failed to fetch contact details', details: error.message });
    }
  });

  // Activity-related endpoints for contacts
  app.get('/api/crm/contacts/:contactId/tasks', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const parsedContactId = contactId.startsWith('cp_') ? contactId : parseInt(contactId);
      const tasks = await storage.getRelatedTasksForContact(parsedContactId);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching related tasks for contact:', error);
      res.status(500).json({ error: 'Failed to fetch related tasks for contact' });
    }
  });

  app.get('/api/crm/contacts/:contactId/events', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const parsedContactId = contactId.startsWith('cp_') ? contactId : parseInt(contactId);
      const events = await storage.getRelatedEventsForContact(parsedContactId);
      res.json(events);
    } catch (error) {
      console.error('Error fetching related events for contact:', error);
      res.status(500).json({ error: 'Failed to fetch related events for contact' });
    }
  });

  app.get('/api/crm/contacts/:contactId/finance', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const parsedContactId = contactId.startsWith('cp_') ? contactId : parseInt(contactId);
      const financeRecords = await storage.getRelatedFinanceForContact(parsedContactId);
      res.json(financeRecords);
    } catch (error) {
      console.error('Error fetching related finance records for contact:', error);
      res.status(500).json({ error: 'Failed to fetch related finance records for contact' });
    }
  });

  app.get('/api/crm/contacts/:contactId/notes', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const notes = await storage.getRelatedNotesForContact(parseInt(contactId));
      res.json(notes);
    } catch (error) {
      console.error('Error fetching related notes for contact:', error);
      res.status(500).json({ error: 'Failed to fetch related notes for contact' });
    }
  });

  app.post('/api/crm/contacts', async (req: Request, res: Response) => {
    try {
      const contact = await storage.createCrmContact(req.body);
      res.json(contact);
    } catch (error) {
      console.error('Error creating CRM contact:', error);
      res.status(500).json({ error: 'Failed to create CRM contact' });
    }
  });

  app.put('/api/crm/contacts/:contactId', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const contact = await storage.updateCrmContact(parseInt(contactId), req.body);
      res.json(contact);
    } catch (error) {
      console.error('Error updating CRM contact:', error);
      res.status(500).json({ error: 'Failed to update CRM contact' });
    }
  });

  app.delete('/api/crm/contacts/:contactId', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      await storage.deleteCrmContact(parseInt(contactId));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting CRM contact:', error);
      res.status(500).json({ error: 'Failed to delete CRM contact' });
    }
  });

  // Complete Contact Routes (handles all block data)
  app.post('/api/crm/contacts/complete', async (req: Request, res: Response) => {
    try {
      const contactData = req.body;
      console.log('Complete contact creation - data:', JSON.stringify(contactData, null, 2));
      const contact = await storage.createCompleteContact(contactData);
      console.log('Complete contact created:', contact);
      res.json(contact);
    } catch (error) {
      console.error('Error creating complete contact:', error);
      res.status(500).json({ error: 'Failed to create complete contact' });
    }
  });

  app.put('/api/crm/contacts/:contactId/complete', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const contactData = req.body;
      console.log('Complete contact update - contactId:', contactId, 'data:', contactData);
      const contact = await storage.updateCompleteContact(contactId, contactData);
      res.json(contact);
    } catch (error) {
      console.error('Error updating complete contact:', error);
      res.status(500).json({ error: 'Failed to update complete contact' });
    }
  });

  // =============================
  // CRM COMPANIES ROUTES
  // =============================

  app.get('/api/crm/companies', async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Development fallback
      const companies = await storage.getCrmCompanies(userId);
      res.json(companies);
    } catch (error) {
      console.error('Error fetching CRM companies:', error);
      res.status(500).json({ error: 'Failed to fetch companies' });
    }
  });

  app.post('/api/crm/companies', async (req: Request, res: Response) => {
    try {
      const companyData = req.body;
      const company = await storage.createCrmCompany(companyData);
      res.json(company);
    } catch (error) {
      console.error('Error creating CRM company:', error);
      res.status(500).json({ error: 'Failed to create company' });
    }
  });

  // Get complete company details (phones, emails, addresses, relationships)
  app.get('/api/crm/companies/:companyId/details', async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      console.log('Fetching company details for ID:', companyId);
      const company = await storage.getCompleteCompany(companyId);
      res.json(company);
    } catch (error) {
      console.error('Error fetching complete company:', error);
      res.status(500).json({ error: 'Failed to fetch complete company' });
    }
  });

  // Create complete company (with blocks data)
  app.post('/api/crm/companies/complete', async (req: Request, res: Response) => {
    try {
      const companyData = req.body;
      console.log('Complete company creation - data:', companyData);
      const company = await storage.createCompleteCompany(companyData);
      res.json(company);
    } catch (error) {
      console.error('Error creating complete company:', error);
      res.status(500).json({ error: 'Failed to create complete company' });
    }
  });

  // Update complete company (with blocks data)
  app.put('/api/crm/companies/:companyId/complete', async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const companyData = req.body;
      console.log('Complete company update - companyId:', companyId, 'data:', companyData);
      const company = await storage.updateCompleteCompany(companyId, companyData);
      res.json(company);
    } catch (error) {
      console.error('Error updating complete company:', error);
      res.status(500).json({ error: 'Failed to update complete company' });
    }
  });

  // Delete company
  app.delete('/api/crm/companies/:companyId', async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      await storage.deleteCrmCompany(companyId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting company:', error);
      res.status(500).json({ error: 'Failed to delete company' });
    }
  });

  // =============================
  // CRM GROUPS ROUTES
  // =============================

  app.get('/api/crm/groups', async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Development fallback
      const groups = await storage.getCrmGroups(userId);
      res.json(groups);
    } catch (error) {
      console.error('Error fetching CRM groups:', error);
      res.status(500).json({ error: 'Failed to fetch groups' });
    }
  });

  app.post('/api/crm/groups', async (req: Request, res: Response) => {
    try {
      const groupData = req.body;
      const group = await storage.createCrmGroup(groupData);
      res.json(group);
    } catch (error) {
      console.error('Error creating CRM group:', error);
      res.status(500).json({ error: 'Failed to create group' });
    }
  });

  // =============================
  // CRM OBJECTS ROUTES
  // =============================

  app.get('/api/crm/objects', async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Development fallback
      const objects = await storage.getCrmObjects(userId);
      res.json(objects);
    } catch (error) {
      console.error('Error fetching CRM objects:', error);
      res.status(500).json({ error: 'Failed to fetch objects' });
    }
  });

  app.post('/api/crm/objects', async (req: Request, res: Response) => {
    try {
      const objectData = req.body;
      const object = await storage.createCrmObject(objectData);
      res.json(object);
    } catch (error) {
      console.error('Error creating CRM object:', error);
      res.status(500).json({ error: 'Failed to create object' });
    }
  });

  // Contact Phone Routes
  app.get('/api/crm/contacts/:contactId/phones', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const phones = await storage.getContactPhones(parseInt(contactId));
      res.json(phones);
    } catch (error) {
      console.error('Error fetching contact phones:', error);
      res.status(500).json({ error: 'Failed to fetch contact phones' });
    }
  });

  app.post('/api/crm/contacts/:contactId/phones', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const phone = await storage.addContactPhone({ ...req.body, contactId: parseInt(contactId) });
      res.json(phone);
    } catch (error) {
      console.error('Error adding contact phone:', error);
      res.status(500).json({ error: 'Failed to add contact phone' });
    }
  });

  app.put('/api/crm/contacts/phones/:phoneId', async (req: Request, res: Response) => {
    try {
      const { phoneId } = req.params;
      const phone = await storage.updateContactPhone(parseInt(phoneId), req.body);
      res.json(phone);
    } catch (error) {
      console.error('Error updating contact phone:', error);
      res.status(500).json({ error: 'Failed to update contact phone' });
    }
  });

  app.delete('/api/crm/contacts/phones/:phoneId', async (req: Request, res: Response) => {
    try {
      const { phoneId } = req.params;
      await storage.deleteContactPhone(parseInt(phoneId));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting contact phone:', error);
      res.status(500).json({ error: 'Failed to delete contact phone' });
    }
  });

  // Contact Email Routes  
  app.post('/api/crm/contacts/:contactId/emails', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const email = await storage.addContactEmail({ ...req.body, contactId: parseInt(contactId) });
      res.json(email);
    } catch (error) {
      console.error('Error adding contact email:', error);
      res.status(500).json({ error: 'Failed to add contact email' });
    }
  });

  // Contact Address Routes
  app.post('/api/crm/contacts/:contactId/addresses', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const address = await storage.addContactAddress({ ...req.body, contactId: parseInt(contactId) });
      res.json(address);
    } catch (error) {
      console.error('Error adding contact address:', error);
      res.status(500).json({ error: 'Failed to add contact address' });
    }
  });

  // Interest Routes
  app.get('/api/crm/interests', async (req: Request, res: Response) => {
    try {
      const interests = await storage.getAllInterests();
      res.json(interests);
    } catch (error) {
      console.error('Error fetching interests:', error);
      res.status(500).json({ error: 'Failed to fetch interests' });
    }
  });

  app.post('/api/crm/interests', async (req: Request, res: Response) => {
    try {
      const interest = await storage.createInterest(req.body);
      res.json(interest);
    } catch (error) {
      console.error('Error creating interest:', error);
      res.status(500).json({ error: 'Failed to create interest' });
    }
  });

  // Intelligence & Search Routes
  app.get('/api/crm/contacts/search', async (req: Request, res: Response) => {
    try {
      const { ownerUserId, q } = req.query;
      if (!ownerUserId || !q) {
        return res.status(400).json({ error: 'ownerUserId and q parameters are required' });
      }
      const contacts = await storage.searchCrmContacts(ownerUserId as string, q as string);
      res.json(contacts);
    } catch (error) {
      console.error('Error searching CRM contacts:', error);
      res.status(500).json({ error: 'Failed to search CRM contacts' });
    }
  });

  app.get('/api/crm/contacts/upcoming-dates', async (req: Request, res: Response) => {
    try {
      const { ownerUserId, days = '30' } = req.query;
      if (!ownerUserId) {
        return res.status(400).json({ error: 'ownerUserId is required' });
      }
      const upcomingDates = await storage.getUpcomingSpecialDates(ownerUserId as string, parseInt(days as string));
      res.json(upcomingDates);
    } catch (error) {
      console.error('Error fetching upcoming special dates:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming special dates' });
    }
  });

  // Company Management Routes
  app.get('/api/crm/companies', async (req: Request, res: Response) => {
    try {
      const spaceId = parseInt(req.query.spaceId as string);
      if (!spaceId) {
        return res.status(400).json({ error: 'Space ID is required' });
      }

      const searchTerm = req.query.search as string;
      const companies = searchTerm 
        ? await storage.searchCompanies(spaceId, searchTerm)
        : await storage.getAllCompanies(spaceId);
      
      res.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ error: 'Failed to fetch companies' });
    }
  });

  app.get('/api/crm/companies/:companyId', async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const company = await storage.getCompanyWithDetails(companyId);
      
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }
      
      res.json(company);
    } catch (error) {
      console.error('Error fetching company:', error);
      res.status(500).json({ error: 'Failed to fetch company' });
    }
  });

  app.post('/api/crm/companies', async (req: Request, res: Response) => {
    try {
      const company = await storage.createCompany(req.body);
      res.status(201).json(company);
    } catch (error) {
      console.error('Error creating company:', error);
      res.status(500).json({ error: 'Failed to create company' });
    }
  });

  app.put('/api/crm/companies/:companyId', async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const company = await storage.updateCompany(companyId, req.body);
      res.json(company);
    } catch (error) {
      console.error('Error updating company:', error);
      res.status(500).json({ error: 'Failed to update company' });
    }
  });

  app.delete('/api/crm/companies/:companyId', async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      await storage.deleteCompany(companyId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting company:', error);
      res.status(500).json({ error: 'Failed to delete company' });
    }
  });

  app.get('/api/crm/company-contacts/:companyId', async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const contacts = await storage.getContactsByCompany(companyId);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching company contacts:', error);
      res.status(500).json({ error: 'Failed to fetch company contacts' });
    }
  });

  app.post('/api/crm/companies/:companyId/contacts', async (req: Request, res: Response) => {
    try {
      const { companyId } = req.params;
      const { contactId } = req.body;
      
      if (!contactId) {
        return res.status(400).json({ error: 'Contact ID is required' });
      }
      
      // Create the association by adding the contact to the company
      const association = await storage.associateContactWithCompany(contactId, companyId);
      res.status(201).json(association);
    } catch (error) {
      console.error('Error associating contact with company:', error);
      res.status(500).json({ error: 'Failed to associate contact with company' });
    }
  });

  app.post('/api/crm/company-members', async (req: Request, res: Response) => {
    try {
      const member = await storage.addCompanyMember(req.body);
      res.status(201).json(member);
    } catch (error) {
      console.error('Error adding company member:', error);
      res.status(500).json({ error: 'Failed to add company member' });
    }
  });

  app.delete('/api/crm/company-members/:companyId/:contactId', async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const contactId = parseInt(req.params.contactId);
      await storage.removeCompanyMember(companyId, contactId);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing company member:', error);
      res.status(500).json({ error: 'Failed to remove company member' });
    }
  });

  // =============================================================================
  // CREDIT CARD MANAGEMENT ENDPOINTS
  // =============================================================================

  // DISABLED: Credit card routes temporarily disabled after finance schema cleanup
  // app.post('/api/finance/credit-cards', async (req: Request, res: Response) => {
  //   try {
  //     const creditCardData = insertCreditCardDetailsSchema.parse(req.body);
  //     const creditCard = await storage.createCreditCardDetails(creditCardData);
  //     res.json(creditCard);
  //   } catch (error) {
  //     console.error('Error creating credit card:', error);
  //     res.status(500).json({ error: 'Failed to create credit card' });
  //   }
  // });

  // Get credit card details for an account
  app.get('/api/finance/credit-cards/:accountId', async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const creditCard = await storage.getCreditCardDetails(accountId);
      res.json(creditCard);
    } catch (error) {
      console.error('Error fetching credit card:', error);
      res.status(500).json({ error: 'Failed to fetch credit card' });
    }
  });

  // Update credit card details
  app.put('/api/finance/credit-cards/:accountId', async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const updates = req.body;
      const creditCard = await storage.updateCreditCardDetails(accountId, updates);
      res.json(creditCard);
    } catch (error) {
      console.error('Error updating credit card:', error);
      res.status(500).json({ error: 'Failed to update credit card' });
    }
  });

  // Get statements for a credit card account
  app.get('/api/finance/statements/:accountId', async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const statements = await storage.getStatements(accountId);
      res.json(statements);
    } catch (error) {
      console.error('Error fetching statements:', error);
      res.status(500).json({ error: 'Failed to fetch statements' });
    }
  });

  // Create a new statement (for monthly statement generation)
  // DISABLED: Statement routes temporarily disabled after finance schema cleanup
  // app.post('/api/finance/statements', async (req: Request, res: Response) => {
  //   try {
  //     const statementData = insertStatementSchema.parse(req.body);
  //     const statement = await storage.createStatement(statementData);
  //     res.json(statement);
  //   } catch (error) {
  //     console.error('Error creating statement:', error);
  //     res.status(500).json({ error: 'Failed to create statement' });
  //   }
  // });

  // Get latest statement for a credit card
  app.get('/api/finance/statements/:accountId/latest', async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const statement = await storage.getLatestStatement(accountId);
      res.json(statement);
    } catch (error) {
      console.error('Error fetching latest statement:', error);
      res.status(500).json({ error: 'Failed to fetch latest statement' });
    }
  });

  // Evolution API webhook handlers - Use the new layered webhook controller
  app.post('/api/evolution/webhook/:instanceName/:eventType', async (req: Request, res: Response) => {
    await WebhookController.handleIncomingEvent(req, res);
  });

  // Alternative webhook route for Evolution API format (single endpoint for all events)
  app.post('/api/evolution/webhook/:instanceName', async (req: Request, res: Response) => {
    const { instanceName } = req.params;
    const body = req.body;
    
    // Extract event type from the request body
    const eventType = body.event || 'unknown';
    
    console.log(`🎯 [${instanceName}] Received webhook event: ${eventType}`);
    console.log(`📋 Webhook payload:`, JSON.stringify(body, null, 2));
    
    // Create a modified request object for the webhook controller
    const modifiedReq = {
      ...req,
      params: {
        ...req.params,
        eventType: eventType
      }
    };
    
    await WebhookController.handleIncomingEvent(modifiedReq as Request, res);
  });

  // Webhook Reliability Monitoring Endpoints
  app.get('/api/webhook-health', async (req: Request, res: Response) => {
    try {
      const status = webhookReliability.getStatus();
      res.json({
        ...status,
        healthy: status.queueLength < 100 && status.processingCount < 10,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting webhook health:', error);
      res.status(500).json({ error: 'Failed to get webhook health' });
    }
  });

  app.post('/api/webhook-cleanup', async (req: Request, res: Response) => {
    try {
      const { hoursOld = 24 } = req.body;
      await webhookReliability.cleanupCompletedEvents(hoursOld);
      res.json({ success: true, message: `Cleaned up events older than ${hoursOld} hours` });
    } catch (error) {
      console.error('Error cleaning up webhook events:', error);
      res.status(500).json({ error: 'Failed to cleanup webhook events' });
    }
  });

  app.post('/api/webhook-force-retry', async (req: Request, res: Response) => {
    try {
      // This endpoint can be used to manually trigger retry of failed events
      // Implementation would depend on specific requirements
      res.json({ success: true, message: 'Force retry initiated' });
    } catch (error) {
      console.error('Error forcing webhook retry:', error);
      res.status(500).json({ error: 'Failed to force retry' });
    }
  });

  // Message Recovery System Status
  app.get('/api/message-recovery/status', async (req: Request, res: Response) => {
    try {
      const status = await messageRecovery.getStatus();
      res.json({
        ...status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting message recovery status:', error);
      res.status(500).json({ error: 'Failed to get message recovery status' });
    }
  });

  // Enhanced Spaces API endpoints
  app.patch('/api/spaces/:spaceId', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const updates = req.body;
      
      // Use Cortex Foundation storage for space updates
      const updatedSpace = await cortexFoundationStorage.updateSpace(spaceId, updates);
      res.json(updatedSpace);
    } catch (error) {
      console.error('Error updating space:', error);
      res.status(500).json({ error: 'Failed to update space' });
    }
  });

  app.delete('/api/spaces/:spaceId', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      // Use Cortex Foundation storage for space deletion
      await cortexFoundationStorage.deleteSpace(spaceId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting space:', error);
      res.status(500).json({ error: 'Failed to delete space' });
    }
  });

  app.get('/api/space-templates', async (req: Request, res: Response) => {
    try {
      const templates = await storage.getSpaceTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching space templates:', error);
      res.status(500).json({ error: 'Failed to fetch space templates' });
    }
  });

  app.post('/api/spaces/from-template', async (req: Request, res: Response) => {
    try {
      const { templateId, spaceData } = req.body;
      
      if (!templateId) {
        return res.status(400).json({ error: 'Template ID is required' });
      }

      spaceData.creatorUserId = spaceData.creatorUserId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';

      const space = await storage.createSpaceFromTemplate(templateId, spaceData);
      res.status(201).json(space);
    } catch (error) {
      console.error('Error creating space from template:', error);
      res.status(500).json({ error: 'Failed to create space from template' });
    }
  });

  // Space Items API endpoints - for projects, tasks, notes, documents, events, finance
  app.post('/api/spaces/:spaceId/items', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const itemData = { ...req.body, spaceId: parseInt(spaceId) };
      
      const item = await storage.createSpaceItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating space item:', error);
      res.status(500).json({ error: 'Failed to create space item' });
    }
  });

  app.get('/api/spaces/:spaceId/items', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const { itemType } = req.query;
      
      // Check if this is a Cortex Foundation space (starts with cs_)
      if (spaceId.startsWith('cs_')) {
        // For now, return empty array for Cortex Foundation spaces
        // TODO: Implement proper Cortex Foundation space items
        res.json([]);
        return;
      }
      
      // Legacy app schema space items (integer IDs)
      const items = await storage.getSpaceItems(parseInt(spaceId), itemType as string);
      res.json(items);
    } catch (error) {
      console.error('Error fetching space items:', error);
      res.status(500).json({ error: 'Failed to fetch space items' });
    }
  });

  app.get('/api/spaces/:spaceId/hierarchy', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      
      // Check if this is a Cortex Foundation space (starts with cs_)
      if (spaceId.startsWith('cs_')) {
        // Use Cortex Foundation storage for hierarchy
        const hierarchy = await cortexFoundationStorage.getSpaceHierarchy(spaceId);
        res.json(hierarchy);
        return;
      }
      
      // Legacy app schema space hierarchy (integer IDs)
      const hierarchy = await storage.getSpaceHierarchy(parseInt(spaceId));
      if (!hierarchy) {
        return res.status(404).json({ error: 'Space not found' });
      }
      
      res.json(hierarchy);
    } catch (error) {
      console.error('Error fetching space hierarchy:', error);
      res.status(500).json({ error: 'Failed to fetch space hierarchy' });
    }
  });

  app.patch('/api/spaces/items/:itemId', async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const updates = req.body;
      
      const updatedItem = await storage.updateSpaceItem(parseInt(itemId), updates);
      res.json(updatedItem);
    } catch (error) {
      console.error('Error updating space item:', error);
      res.status(500).json({ error: 'Failed to update space item' });
    }
  });

  app.delete('/api/spaces/items/:itemId', async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      
      await storage.deleteSpaceItem(parseInt(itemId));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting space item:', error);
      res.status(500).json({ error: 'Failed to delete space item' });
    }
  });

  // Test media download in deployed environment
  app.post('/api/admin/test-media-download', async (req: Request, res: Response) => {
    try {
      console.log('🧪 Testing media download in deployed environment...');
      
      // Check if media directory exists and create if needed
      const mediaDir = path.resolve(process.cwd(), 'media');
      await fs.mkdir(mediaDir, { recursive: true });
      
      // Check if we have any instances to test with
      const instances = await storage.getAllWhatsappInstances();
      if (instances.length === 0) {
        return res.status(400).json({ error: 'No WhatsApp instances found' });
      }
      
      const testInstance = instances[0];
      console.log(`📱 Testing with instance: ${testInstance.instanceName}`);
      
      // Create test media file to verify file system works
      const testFileName = `test-${Date.now()}.txt`;
      const testFilePath = path.join(mediaDir, testInstance.instanceName);
      await fs.mkdir(testFilePath, { recursive: true });
      
      const fullTestPath = path.join(testFilePath, testFileName);
      await fs.writeFile(fullTestPath, 'Test media file created on deployed server');
      
      // Verify file was created
      const fileExists = await fs.access(fullTestPath).then(() => true).catch(() => false);
      
      res.json({
        success: true,
        message: 'Media download system operational',
        details: {
          mediaDirectory: mediaDir,
          testInstance: testInstance.instanceName,
          testFileCreated: fileExists,
          testFilePath: fullTestPath,
          environment: process.env.NODE_ENV || 'development'
        }
      });
      
    } catch (error) {
      console.error('Error testing media download:', error);
      res.status(500).json({ 
        error: 'Media download test failed', 
        details: error.message,
        stack: error.stack 
      });
    }
  });

  // Google Cloud Storage management endpoints
  app.post('/api/admin/gcs/initialize', async (req: Request, res: Response) => {
    try {
      const { gcsMediaStorage } = await import('./gcs-media-storage');
      await gcsMediaStorage.initializeBucket();
      res.json({ success: true, message: 'GCS bucket initialized successfully' });
    } catch (error) {
      console.error('Error initializing GCS bucket:', error);
      res.status(500).json({ error: 'Failed to initialize GCS bucket', details: error.message });
    }
  });

  app.post('/api/admin/gcs/migrate', async (req: Request, res: Response) => {
    try {
      const { gcsMediaStorage } = await import('./gcs-media-storage');
      const { localMediaDir } = req.body;
      
      const mediaDir = localMediaDir || path.resolve(process.cwd(), 'media');
      console.log(`🔄 Starting migration from ${mediaDir} to Google Cloud Storage...`);
      
      const results = await gcsMediaStorage.migrateLocalFilesToGCS(mediaDir);
      
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      
      res.json({ 
        success: true, 
        message: `Migration completed: ${successCount}/${totalCount} files uploaded`,
        results: results.slice(0, 10), // Show first 10 results
        summary: {
          total: totalCount,
          successful: successCount,
          failed: totalCount - successCount
        }
      });
    } catch (error) {
      console.error('Error during GCS migration:', error);
      res.status(500).json({ error: 'Migration failed', details: error.message });
    }
  });

  app.get('/api/admin/gcs/status', async (req: Request, res: Response) => {
    try {
      const enabled = process.env.ENABLE_GCS_STORAGE === 'true';
      const hasCredentials = !!(process.env.GCP_PROJECT_ID && (process.env.GCP_SERVICE_ACCOUNT_KEY_PATH || process.env.GCP_SERVICE_ACCOUNT_KEY));
      const bucketName = process.env.GCS_BUCKET_NAME || 'whatsapp-media-storage';
      
      res.json({
        enabled,
        hasCredentials,
        bucketName,
        projectId: process.env.GCP_PROJECT_ID || 'Not configured'
      });
    } catch (error) {
      console.error('Error checking GCS status:', error);
      res.status(500).json({ error: 'Failed to check GCS status' });
    }
  });

  // =============================================================================
  // GOOGLE DRIVE-LIKE SPACES API ROUTES
  // =============================================================================

  // Get all drive spaces (with optional creator filter)
  app.get('/api/drive-spaces', async (req: Request, res: Response) => {
    try {
      const { createdBy } = req.query;
      const spaces = await storage.getDriveSpaces(createdBy as string);
      res.json(spaces);
    } catch (error) {
      console.error('Error fetching drive spaces:', error);
      res.status(500).json({ error: 'Failed to fetch drive spaces' });
    }
  });

  // Create a new drive space
  app.post('/api/drive-spaces', async (req: Request, res: Response) => {
    try {
      const spaceData = req.body;
      const space = await storage.createDriveSpace(spaceData);
      res.status(201).json(space);
    } catch (error) {
      console.error('Error creating drive space:', error);
      res.status(500).json({ error: 'Failed to create drive space' });
    }
  });

  // Get a specific drive space
  app.get('/api/drive-spaces/:spaceId', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const space = await storage.getDriveSpace(spaceId);
      
      if (!space) {
        return res.status(404).json({ error: 'Drive space not found' });
      }
      
      res.json(space);
    } catch (error) {
      console.error('Error fetching drive space:', error);
      res.status(500).json({ error: 'Failed to fetch drive space' });
    }
  });

  // Update a drive space
  app.put('/api/drive-spaces/:spaceId', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const updates = req.body;
      const space = await storage.updateDriveSpace(spaceId, updates);
      
      if (!space) {
        return res.status(404).json({ error: 'Drive space not found' });
      }
      
      res.json(space);
    } catch (error) {
      console.error('Error updating drive space:', error);
      res.status(500).json({ error: 'Failed to update drive space' });
    }
  });

  // Delete a drive space
  app.delete('/api/drive-spaces/:spaceId', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      await storage.deleteDriveSpace(spaceId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting drive space:', error);
      res.status(500).json({ error: 'Failed to delete drive space' });
    }
  });

  // Get items in a space
  app.get('/api/drive-spaces/:spaceId/items', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const items = await storage.getDriveSpaceItems(spaceId);
      res.json(items);
    } catch (error) {
      console.error('Error fetching space items:', error);
      res.status(500).json({ error: 'Failed to fetch space items' });
    }
  });

  // Add item to space
  app.post('/api/drive-spaces/:spaceId/items', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const itemData = { ...req.body, spaceId };
      const item = await storage.addItemToSpace(itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error('Error adding item to space:', error);
      res.status(500).json({ error: 'Failed to add item to space' });
    }
  });

  // Move item between spaces
  app.post('/api/drive-spaces/:fromSpaceId/items/:itemId/move', async (req: Request, res: Response) => {
    try {
      const { fromSpaceId, itemId } = req.params;
      const { toSpaceId, movedBy } = req.body;
      
      await storage.moveItemToSpace(itemId, fromSpaceId, toSpaceId, movedBy);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error moving item:', error);
      res.status(500).json({ error: 'Failed to move item' });
    }
  });

  // Remove item from space
  app.delete('/api/drive-spaces/:spaceId/items/:itemId', async (req: Request, res: Response) => {
    try {
      const { spaceId, itemId } = req.params;
      await storage.removeItemFromSpace(spaceId, itemId);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing item from space:', error);
      res.status(500).json({ error: 'Failed to remove item from space' });
    }
  });

  // Toggle item star/favorite
  app.post('/api/drive-spaces/:spaceId/items/:itemId/star', async (req: Request, res: Response) => {
    try {
      const { spaceId, itemId } = req.params;
      const { starred } = req.body;
      
      await storage.toggleItemStar(spaceId, itemId, starred);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error toggling item star:', error);
      res.status(500).json({ error: 'Failed to toggle item star' });
    }
  });

  // Get space members
  app.get('/api/drive-spaces/:spaceId/members', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const members = await storage.getDriveSpaceMembers(spaceId);
      res.json(members);
    } catch (error) {
      console.error('Error fetching space members:', error);
      res.status(500).json({ error: 'Failed to fetch space members' });
    }
  });

  // Add member to space
  app.post('/api/drive-spaces/:spaceId/members', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const memberData = { ...req.body, spaceId };
      const member = await storage.addSpaceMember(memberData);
      res.status(201).json(member);
    } catch (error) {
      console.error('Error adding space member:', error);
      res.status(500).json({ error: 'Failed to add space member' });
    }
  });

  // Update member role/permissions
  app.put('/api/drive-spaces/:spaceId/members/:entityId', async (req: Request, res: Response) => {
    try {
      const { spaceId, entityId } = req.params;
      const { role, ...permissions } = req.body;
      
      await storage.updateSpaceMemberRole(spaceId, entityId, role, permissions);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating member role:', error);
      res.status(500).json({ error: 'Failed to update member role' });
    }
  });

  // Remove member from space
  app.delete('/api/drive-spaces/:spaceId/members/:entityId', async (req: Request, res: Response) => {
    try {
      const { spaceId, entityId } = req.params;
      await storage.removeSpaceMember(spaceId, entityId);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing space member:', error);
      res.status(500).json({ error: 'Failed to remove space member' });
    }
  });

  // Get space activity
  app.get('/api/drive-spaces/:spaceId/activity', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const { limit } = req.query;
      const activity = await storage.getDriveSpaceActivity(spaceId, limit ? parseInt(limit as string) : 50);
      res.json(activity);
    } catch (error) {
      console.error('Error fetching space activity:', error);
      res.status(500).json({ error: 'Failed to fetch space activity' });
    }
  });

  // Search spaces and items
  app.get('/api/drive-spaces/search', async (req: Request, res: Response) => {
    try {
      const { q, entityId } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      const results = await storage.searchDriveSpaces(q as string, entityId as string);
      res.json(results);
    } catch (error) {
      console.error('Error searching drive spaces:', error);
      res.status(500).json({ error: 'Failed to search drive spaces' });
    }
  });

  // Get starred items for an entity
  app.get('/api/drive-spaces/starred/:entityId', async (req: Request, res: Response) => {
    try {
      const { entityId } = req.params;
      const starredItems = await storage.getStarredItems(entityId);
      res.json(starredItems);
    } catch (error) {
      console.error('Error fetching starred items:', error);
      res.status(500).json({ error: 'Failed to fetch starred items' });
    }
  });

  // Get recent items for an entity
  app.get('/api/drive-spaces/recent/:entityId', async (req: Request, res: Response) => {
    try {
      const { entityId } = req.params;
      const { limit } = req.query;
      const recentItems = await storage.getRecentItems(entityId, limit ? parseInt(limit as string) : 20);
      res.json(recentItems);
    } catch (error) {
      console.error('Error fetching recent items:', error);
      res.status(500).json({ error: 'Failed to fetch recent items' });
    }
  });

  // CRM Groups Routes for Unified Entity System
  app.get('/api/crm/groups', async (req: Request, res: Response) => {
    try {
      const groups = await storage.getCrmGroups();
      res.json(groups);
    } catch (error) {
      console.error('Error fetching CRM groups:', error);
      res.status(500).json({ error: 'Failed to fetch CRM groups' });
    }
  });

  app.post('/api/crm/groups', async (req: Request, res: Response) => {
    try {
      // Process tags - convert comma-separated string to array
      const groupData = { ...req.body };
      if (groupData.tags && typeof groupData.tags === 'string') {
        groupData.tags = groupData.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
      }
      
      const group = await storage.createCrmGroup(groupData);
      res.status(201).json(group);
    } catch (error) {
      console.error('Error creating CRM group:', error);
      res.status(500).json({ error: 'Failed to create CRM group' });
    }
  });

  app.get('/api/crm/groups/:groupId', async (req: Request, res: Response) => {
    try {
      const group = await storage.getCrmGroupByWhatsappJid(req.params.groupId);
      if (!group) {
        return res.status(404).json({ error: 'CRM group not found' });
      }
      res.json(group);
    } catch (error) {
      console.error('Error fetching CRM group:', error);
      res.status(500).json({ error: 'Failed to fetch CRM group' });
    }
  });

  app.put('/api/crm/groups/:groupId', async (req: Request, res: Response) => {
    try {
      // Process tags - convert comma-separated string to array
      const updateData = { ...req.body };
      if (updateData.tags && typeof updateData.tags === 'string') {
        updateData.tags = updateData.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
      }
      
      const group = await storage.updateCrmGroup(req.params.groupId, updateData);
      res.json(group);
    } catch (error) {
      console.error('Error updating CRM group:', error);
      res.status(500).json({ error: 'Failed to update CRM group' });
    }
  });

  app.delete('/api/crm/groups/:groupId', async (req: Request, res: Response) => {
    try {
      await storage.deleteCrmGroup(req.params.groupId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting CRM group:', error);
      res.status(500).json({ error: 'Failed to delete CRM group' });
    }
  });

  // Check WhatsApp group link status
  app.get('/api/crm/groups/whatsapp-link-status/:groupJid', async (req: Request, res: Response) => {
    try {
      const { groupJid } = req.params;
      const group = await storage.getCrmGroupByWhatsappJid(groupJid);
      res.json({ 
        isLinked: !!group,
        crmGroup: group || null
      });
    } catch (error) {
      console.error('Error checking WhatsApp group link status:', error);
      res.status(500).json({ error: 'Failed to check link status' });
    }
  });

  // Test endpoint for cortex_automation integration
  app.post('/api/test-reaction-automation', async (req: Request, res: Response) => {
    try {
      const { instanceId, messageId, emoji, reactorJid, content } = req.body;
      
      console.log('🧪 Testing cortex_automation integration...');
      
      // Import ActionService here to avoid circular dependencies
      const { ActionService } = await import('./action-service');
      
      // Simulate a reaction event
      const reactionData = {
        messageId,
        instanceName: instanceId,
        reactorJid,
        reactionEmoji: emoji,
        timestamp: new Date()
      };
      
      console.log('🧪 Simulating reaction:', reactionData);
      
      // Process the reaction through ActionService
      await ActionService.processReaction(reactionData);
      
      res.json({ 
        success: true, 
        message: 'Reaction automation test completed',
        testData: {
          instanceId,
          messageId,
          emoji,
          reactorJid,
          content
        }
      });
    } catch (error) {
      console.error('Error in reaction automation test:', error);
      res.status(500).json({ 
        error: 'Test failed', 
        message: error.message 
      });
    }
  });

  // Mount Cortex API routes
  app.use('/api/cortex', cortexRoutes);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
}