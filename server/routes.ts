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
import { BillToTaskService } from './bill-task-service';
import { ScheduledJobsService } from './scheduled-jobs';
import { db } from './db';
import {
  insertFinanceTransactionSchema,
  insertFinancePayableSchema,
  insertFinanceRecurringBillSchema,
  insertFinanceLoanSchema,
  insertFinanceAccountSchema,
  insertCrmCompanySchema,
  insertCreditCardDetailsSchema,
  insertStatementSchema,
} from "@shared/schema";
import fs from 'fs';
import path from 'path';
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
      const contacts = await storage.getWhatsappContacts(userId);
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
      const { instanceId, chatId, message, quotedMessageId, isForwarded } = req.body;
      
      if (!instanceId || !chatId || !message) {
        return res.status(400).json({ error: 'instanceId, chatId, and message are required' });
      }

      const { WhatsAppAPIAdapter } = await import('./whatsapp-api-adapter');
      const result = await WhatsAppAPIAdapter.sendMessage(instanceId, chatId, message, quotedMessageId, isForwarded);
      
      if (result.success) {
        // Automatically delete draft when message is sent successfully
        await storage.deleteDraft(chatId, instanceId);
        
        // Create an immediate local message record for the sent message
        // This ensures the sender sees their message immediately
        try {
          console.log(`📝 [${instanceId}] Creating local record for sent message`);
          
          // First, ensure sender contact exists or find an existing valid sender
          let senderJid = result.data?.key?.participant || `${instanceId}@bot`;
          
          // Create a system contact for this instance to avoid FK constraint issues
          try {
            const systemContactJid = `system@${instanceId}`;
            await storage.upsertWhatsappContact({
              jid: systemContactJid,
              instanceId,
              pushName: 'System',
              isGroup: false,
              profilePictureUrl: null,
              isMe: false
            });
            senderJid = systemContactJid;
          } catch (contactError) {
            console.warn(`Could not create system contact, falling back to webhook: ${contactError}`);
            // Fall back to webhook processing - continue without immediate storage
            res.json(result.data);
            return;
          }
          
          const sentMessage = {
            messageId: result.data?.key?.id || `SENT_${Date.now()}`,
            instanceId,
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
          
          console.log(`📝 [${instanceId}] Storing message with sender: ${sentMessage.senderJid}`);
          
          // Store the sent message immediately
          const storedMessage = await storage.upsertWhatsappMessage(sentMessage);
          console.log(`✅ [${instanceId}] Sent message stored locally: ${storedMessage.messageId}`);
          
          // Notify connected clients via SSE
          const { SseManager } = await import('./sse-manager');
          SseManager.notifyClientsOfNewMessage(storedMessage);
          console.log(`📡 [${instanceId}] SSE notification sent for message: ${storedMessage.messageId}`);
        } catch (localStorageError) {
          console.error(`⚠️ [${instanceId}] Failed to store sent message locally:`, localStorageError);
          // Continue anyway - the webhook will eventually catch it
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

  // Draft management endpoints
  app.get('/api/whatsapp/drafts/:instanceId', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.params;
      const drafts = await storage.getAllDrafts(instanceId);
      res.json(drafts);
    } catch (error) {
      console.error('Error fetching drafts:', error);
      res.status(500).json({ error: 'Failed to fetch drafts' });
    }
  });

  app.post('/api/whatsapp/drafts', async (req: Request, res: Response) => {
    try {
      let data = req.body;
      
      // Handle sendBeacon blob data if content-type is application/json
      if (req.headers['content-type'] === 'application/json' && typeof req.body === 'string') {
        data = JSON.parse(req.body);
      }
      
      const { chatId, instanceId, content, replyToMessageId } = data;
      
      if (!chatId || !instanceId || content === undefined) {
        return res.status(400).json({ error: 'chatId, instanceId, and content are required' });
      }

      const draft = await storage.upsertDraft({
        chatId,
        instanceId,
        content,
        replyToMessageId: replyToMessageId || null
      });
      
      // Notify all connected clients about the draft change
      const { SseManager } = await import('./sse-manager');
      SseManager.notifyClients('draft_updated', {
        chatId,
        instanceId,
        content,
        messageId: draft.messageId
      });
      
      res.json(draft);
    } catch (error) {
      console.error('Error saving draft:', error);
      res.status(500).json({ error: 'Failed to save draft' });
    }
  });

  app.delete('/api/whatsapp/drafts/:instanceId/:chatId', async (req: Request, res: Response) => {
    try {
      const { instanceId, chatId } = req.params;
      await storage.deleteDraft(chatId, instanceId);
      
      // Notify all connected clients about the draft deletion
      const { SseManager } = await import('./sse-manager');
      SseManager.notifyClients('draft_deleted', {
        chatId,
        instanceId
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting draft:', error);
      res.status(500).json({ error: 'Failed to delete draft' });
    }
  });

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
      spaceData.creatorUserId = spaceData.creatorUserId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';

      console.log('Creating space with data:', spaceData);
      const space = await storage.createSpace(spaceData);
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
      
      const { instanceId } = req.query;
      const tasks = await storage.getTasks(instanceId as string);
      
      // Transform snake_case field names to camelCase for frontend compatibility
      const transformedTasks = tasks.map(task => ({
        id: task.task_id || task.taskId,
        taskId: task.task_id || task.taskId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date || task.dueDate,
        projectId: task.project_id || task.projectId,
        parentTaskId: task.parent_task_id || task.parentTaskId,
        assignedToUserId: task.assigned_to_user_id || task.assignedToUserId,
        relatedChatJid: task.related_chat_jid || task.relatedChatJid,
        createdAt: task.created_at || task.createdAt,
        updatedAt: task.updated_at || task.updatedAt,
        subtasks: task.subtasks || [],
        checklistItems: task.checklist_items || task.checklistItems || [],
        triggeringMessageId: task.triggering_message_id || task.triggeringMessageId,
        instanceId: task.instance_id || task.instanceId,
        senderJid: task.sender_jid || task.senderJid,
        taskType: task.task_type || task.taskType
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
      
      // Transform field names from snake_case to camelCase for frontend compatibility
      const transformedProjects = projects.map(project => ({
        projectId: project.projectId || project.project_id,
        projectName: project.projectName || project.project_name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate || project.start_date,
        dueDate: project.dueDate || project.due_date,
        completedDate: project.completedDate || project.completed_date,
        assignedToUserId: project.assignedToUserId || project.assigned_to_user_id,
        createdByUserId: project.createdByUserId || project.created_by_user_id,
        createdAt: project.createdAt || project.created_at,
        updatedAt: project.updatedAt || project.updated_at,
        spaceId: project.spaceId || project.space_id
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
      
      const project = await storage.createProject(projectData);
      
      // Transform response for frontend
      const transformedProject = {
        projectId: project.projectId,
        projectName: project.projectName,
        description: project.description,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate,
        dueDate: project.dueDate,
        assignedToUserId: project.assignedToUserId,
        createdByUserId: project.createdByUserId,
        spaceId: project.spaceId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
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
      
      const updatedProject = await storage.updateProject(parseInt(projectId), updates);
      res.json(updatedProject);
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  app.delete('/api/crm/projects/:projectId', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      await storage.deleteProject(parseInt(projectId));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  app.post('/api/crm/tasks', async (req: Request, res: Response) => {
    try {
      const taskData = req.body;
      console.log('Creating task with data:', taskData);
      
      const task = await storage.createTask(taskData);
      
      // Transform response for frontend
      const transformedTask = {
        taskId: task.taskId || task.task_id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate || task.due_date,
        projectId: task.projectId || task.project_id,
        parentTaskId: task.parentTaskId || task.parent_task_id,
        assignedToUserId: task.assignedToUserId || task.assigned_to_user_id,
        createdByUserId: task.createdByUserId || task.created_by_user_id,
        spaceId: task.spaceId || task.space_id,
        instanceId: task.instanceId || task.instance_id,
        createdAt: task.createdAt || task.created_at,
        updatedAt: task.updatedAt || task.updated_at
      };
      
      res.json(transformedTask);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
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
      const rules = await storage.getActionRules(userId);
      res.json(rules);
    } catch (error) {
      console.error('Error fetching action rules:', error);
      res.status(500).json({ error: 'Failed to fetch action rules' });
    }
  });

  app.get('/api/actions/stats', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const rules = await storage.getActionRules(userId);
      const stats = {
        totalRules: rules.length,
        activeRules: rules.filter(r => r.isActive).length,
        totalExecutions: rules.reduce((sum, rule) => sum + (rule.totalExecutions || 0), 0),
        recentExecutions: 0 // Would need separate query for recent executions
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
      const ruleData = {
        ...req.body,
        userId: userId
      };
      const rule = await storage.createActionRule(ruleData);
      res.status(201).json(rule);
    } catch (error) {
      console.error('Error creating action rule:', error);
      res.status(500).json({ error: 'Failed to create action rule' });
    }
  });

  app.patch('/api/actions/rules/:ruleId/toggle', async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.userId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const { ruleId } = req.params;
      const rule = await storage.getActionRule(userId, ruleId);
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      const updatedRule = await storage.updateActionRule(userId, ruleId, { 
        isActive: !rule.isActive 
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

  // GTD Templates endpoint
  app.get('/api/actions/gtd-templates', async (req: Request, res: Response) => {
    try {
      const { GTD_TEMPLATES } = await import('./gtd-templates');
      res.json(GTD_TEMPLATES);
    } catch (error) {
      console.error('Error fetching GTD templates:', error);
      res.status(500).json({ error: 'Failed to fetch GTD templates' });
    }
  });

  // Initialize GTD templates in database
  app.post('/api/actions/init-gtd-templates', async (req: Request, res: Response) => {
    try {
      const { GTD_TEMPLATES } = await import('./gtd-templates');
      
      for (const template of GTD_TEMPLATES) {
        try {
          await storage.createActionTemplate(template);
          console.log(`✅ Created GTD template: ${template.templateName}`);
        } catch (error) {
          // Template might already exist, skip
          console.log(`ℹ️ GTD template already exists: ${template.templateName}`);
        }
      }
      
      res.json({ success: true, message: 'GTD templates initialized' });
    } catch (error) {
      console.error('Error initializing GTD templates:', error);
      res.status(500).json({ error: 'Failed to initialize GTD templates' });
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

  // Media serving endpoint - fetch from Evolution API in real-time
  app.get('/api/whatsapp/media/:instanceId/:messageId', async (req: Request, res: Response) => {
    try {
      const { instanceId, messageId } = req.params;
      
      // Get instance credentials for Evolution API
      const instance = await storage.getWhatsappInstance(instanceId);
      if (!instance?.apiKey) {
        return res.status(404).json({ error: 'Instance not found or missing API key' });
      }

      // Get the original message with raw API payload for media download
      const message = await storage.getWhatsappMessageById(messageId, instanceId);
      if (!message?.rawApiPayload) {
        return res.status(404).json({ error: 'Original message data not found' });
      }

      console.log(`📥 Fetching media from Evolution API for message: ${messageId}`);
      
      // For this test case, let's check if the webhook already included base64 data
      const { getEvolutionApi } = await import('./evolution-api');
      const evolutionApi = getEvolutionApi();
      
      let rawPayload;
      if (typeof message.rawApiPayload === 'string') {
        rawPayload = JSON.parse(message.rawApiPayload);
      } else {
        rawPayload = message.rawApiPayload;
      }
      
      // First, check for Evolution API downloaded media files
      const mediaStoragePath = path.resolve(process.cwd(), 'media_storage', instanceId);
      try {
        const mediaFiles = await fsPromises.readdir(mediaStoragePath);
        const mediaFile = mediaFiles.find(file => file.startsWith(messageId));
        
        if (mediaFile) {
          const filePath = path.join(mediaStoragePath, mediaFile);
          const stats = await fsPromises.stat(filePath);
          const mimeType = lookup(path.extname(mediaFile)) || 'audio/ogg; codecs=opus';
          
          console.log(`✅ Found Evolution API media file: ${mediaFile}`);
          
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
          
          console.log(`✅ Serving Evolution API media: ${messageId} from ${filePath}`);
          return res.sendFile(filePath);
        }
      } catch (err) {
        // Directory doesn't exist or other error - continue to fallback
      }
      
      // Second, try to download from Evolution API if not cached
      try {
        console.log(`📥 Downloading audio from Evolution API for message: ${messageId}`);
        
        // Get the message data to construct proper payload for downloadMedia
        const messages = await storage.getWhatsappMessages(instanceId);
        const messageData = messages.find(msg => msg.messageId === messageId);
        if (!messageData || !messageData.rawApiPayload) {
          throw new Error('Message data not found or invalid');
        }
        
        const downloadedMedia = await evolutionApi.downloadMedia(instanceId, process.env.EVOLUTION_API_KEY!, messageData.rawApiPayload);
        
        if (downloadedMedia) {
          // Determine file extension from mimetype
          const extension = downloadedMedia.mimetype.split('/')[1] || 'ogg';
          const fileName = `${messageId}.${extension}`;
          const storagePath = path.resolve(currentDir, '../media_storage', instanceId);
          
          // Save the buffer to file
          await fsPromises.mkdir(storagePath, { recursive: true });
          await fsPromises.writeFile(path.join(storagePath, fileName), downloadedMedia.buffer);
          
          console.log(`✅ Playable audio file saved: ${fileName}`);
          
          // Serve the downloaded file
          res.setHeader('Content-Type', downloadedMedia.mimetype);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
          res.setHeader('Content-Length', downloadedMedia.buffer.length.toString());
          
          console.log(`✅ Serving fresh Evolution API download: ${messageId}`);
          return res.send(downloadedMedia.buffer);
        }
      } catch (downloadError) {
        console.error(`❌ Error downloading from Evolution API:`, downloadError);
      }
      
      // Second, check if base64 data is in the webhook payload
      const audioMessage = rawPayload?.message?.audioMessage;
      if (audioMessage?.base64) {
        console.log(`✅ Found base64 data in webhook payload for ${messageId}`);
        const fileBuffer = Buffer.from(audioMessage.base64, 'base64');
        
        // Serve the OGG file directly - modern browsers support this format natively
        const mimeType = audioMessage.mimetype || 'audio/ogg; codecs=opus';
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', fileBuffer.length.toString());
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
        
        console.log(`✅ Serving base64 OGG media from webhook: ${messageId} (${fileBuffer.length} bytes)`);
        return res.send(fileBuffer);
      }
      
      // No media available
      console.log(`❌ Media not available for ${messageId} - no cached file or base64 data`);
      return res.status(404).json({ 
        error: 'Media not available', 
        message: 'This audio file was not cached during webhook processing.' 
      });
      
    } catch (error) {
      console.error(`❌ Error fetching media for ${req.params.messageId}:`, error.message);
      res.status(500).json({ 
        error: 'Failed to fetch media',
        message: 'Unable to download media from Evolution API'
      });
    }
  });

  // CRM Tasks API
  app.get('/api/crm/tasks', async (req: Request, res: Response) => {
    try {
      const { instanceId } = req.query;
      const tasks = await storage.getTasks(instanceId as string);
      
      // Transform snake_case field names to camelCase for frontend compatibility
      const transformedTasks = tasks.map(task => ({
        taskId: task.task_id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date,
        projectId: task.project_id,
        parentTaskId: task.parent_task_id,
        assignedToUserId: task.assigned_to_user_id,
        relatedChatJid: task.related_chat_jid,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        subtasks: task.subtasks || [],
        checklistItems: task.checklist_items || [],
        triggeringMessageId: task.triggering_message_id,
        instanceId: task.instance_id,
        senderJid: task.sender_jid,
        taskType: task.task_type
      }));
      
      res.json(transformedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.get('/api/crm/tasks/:taskId', async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const task = await storage.getTaskById(parseInt(taskId));
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
      const [
        totalIncome,
        totalExpenses,
        pendingBills,
        activeLoans,
        recentTransactions
      ] = await Promise.all([
        storage.getFinancialSummary('income'),
        storage.getFinancialSummary('expense'),
        storage.getPendingPayables(),
        storage.getActiveLoans(),
        storage.getRecentTransactions(10)
      ]);

      res.json({
        totalIncome: totalIncome.total || 0,
        incomeChange: totalIncome.change || 0,
        totalExpenses: totalExpenses.total || 0,
        expenseChange: totalExpenses.change || 0,
        pendingBills: pendingBills.count || 0,
        pendingAmount: pendingBills.total || 0,
        activeLoans: activeLoans.count || 0,
        totalLoanBalance: activeLoans.total || 0,
        recentTransactions: recentTransactions || []
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
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
      const payable = await storage.createPayable(req.body);
      
      // Automatically create a companion task for the bill
      try {
        await BillToTaskService.createTaskForBill(payable.payableId, {
          instanceId: req.body.instanceId || 'default-instance',
          spaceId: payable.spaceId,
          createdByUserId: req.body.createdByUserId,
        });
      } catch (taskError) {
        console.error('Error creating companion task for bill:', taskError);
        // Don't fail the bill creation if task creation fails
      }
      
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
      
      const result = await BillToTaskService.applyPaymentToBill(payableId, parseFloat(paymentAmount));
      res.json(result);
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
      
      // Update the companion task
      try {
        await BillToTaskService.updateTaskForBill(payableId);
      } catch (taskError) {
        console.error('Error updating companion task for bill:', taskError);
        // Don't fail the payable update if task update fails
      }
      
      res.json(payable);
    } catch (error) {
      console.error('Error updating payable:', error);
      res.status(500).json({ error: 'Failed to update payable' });
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

  // Get accounts
  app.get('/api/finance/accounts', async (req: Request, res: Response) => {
    try {
      const spaceId = parseInt(req.query.spaceId as string);
      if (!spaceId) {
        return res.status(400).json({ error: 'Space ID is required' });
      }
      
      const accounts = await storage.getFinanceAccounts(spaceId);
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
      const spaceId = parseInt(req.query.spaceId as string);
      if (!spaceId) {
        return res.status(400).json({ error: 'spaceId is required' });
      }

      const companies = await storage.getCrmCompanies(spaceId);
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
      const spaceId = parseInt(req.query.spaceId as string);
      if (!spaceId) {
        return res.status(400).json({ error: 'spaceId is required' });
      }

      const groups = await storage.getContactGroups(spaceId);
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

  // Core Contact Routes
  app.get('/api/crm/contacts', async (req: Request, res: Response) => {
    try {
      const { ownerUserId } = req.query;
      if (!ownerUserId) {
        return res.status(400).json({ error: 'ownerUserId is required' });
      }
      const contacts = await storage.getCrmContacts(ownerUserId as string);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching CRM contacts:', error);
      res.status(500).json({ error: 'Failed to fetch CRM contacts' });
    }
  });

  app.get('/api/crm/contacts/:contactId/details', async (req: Request, res: Response) => {
    try {
      const { contactId } = req.params;
      const contact = await storage.getCrmContactWithFullDetails(parseInt(contactId));
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      res.json(contact);
    } catch (error) {
      console.error('Error fetching contact details:', error);
      res.status(500).json({ error: 'Failed to fetch contact details' });
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
      const companyId = parseInt(req.params.companyId);
      const contacts = await storage.getContactsByCompany(companyId);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching company contacts:', error);
      res.status(500).json({ error: 'Failed to fetch company contacts' });
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

  // Create credit card details for an account
  app.post('/api/finance/credit-cards', async (req: Request, res: Response) => {
    try {
      const creditCardData = insertCreditCardDetailsSchema.parse(req.body);
      const creditCard = await storage.createCreditCardDetails(creditCardData);
      res.json(creditCard);
    } catch (error) {
      console.error('Error creating credit card:', error);
      res.status(500).json({ error: 'Failed to create credit card' });
    }
  });

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
  app.post('/api/finance/statements', async (req: Request, res: Response) => {
    try {
      const statementData = insertStatementSchema.parse(req.body);
      const statement = await storage.createStatement(statementData);
      res.json(statement);
    } catch (error) {
      console.error('Error creating statement:', error);
      res.status(500).json({ error: 'Failed to create statement' });
    }
  });

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

  // Enhanced Spaces API endpoints
  app.patch('/api/spaces/:spaceId', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      const updates = req.body;
      
      const updatedSpace = await storage.updateSpace(parseInt(spaceId), updates);
      res.json(updatedSpace);
    } catch (error) {
      console.error('Error updating space:', error);
      res.status(500).json({ error: 'Failed to update space' });
    }
  });

  app.delete('/api/spaces/:spaceId', async (req: Request, res: Response) => {
    try {
      const { spaceId } = req.params;
      await storage.deleteSpace(parseInt(spaceId));
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

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
}