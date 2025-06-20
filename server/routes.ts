import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { storage } from "./storage";
import { getEvolutionApi, updateEvolutionApiSettings, getEvolutionApiSettings, getInstanceEvolutionApi } from "./evolution-api";
import { db, pool } from "./db";
import { setRLSContext } from "./rls-context";
import { ActionsEngine } from "./actions-engine";
import { sql } from "drizzle-orm";
import { OptimizedWebhookController } from "./optimized-webhook-controller";
import { 
  insertUserSchema,
  insertWhatsappInstanceSchema,
  insertWhatsappContactSchema,
  insertWhatsappChatSchema,
  insertWhatsappMessageSchema,
  whatsappInstances,
  whatsappMessageMedia,
  actionRules,
  actionExecutions,
  actionTemplates,
  insertActionRuleSchema,
  ActionRule,
  InsertActionRule,
  tasks,
  appUsers,
  insertAppUserSchema,
  AppUser,
  appSpaces,
  insertAppSpaceSchema
} from "../shared/schema";
import { 
  authenticateToken, 
  optionalAuth, 
  generateToken, 
  hashPassword, 
  comparePassword, 
  isValidEmail, 
  isValidPassword,
  AuthRequest 
} from "./auth";
import crypto from 'crypto';
import { eq, and, desc, sql } from "drizzle-orm";

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

// Simple authentication middleware
const requireAuth = (req: Request & { user?: { id: string } }, res: Response, next: NextFunction) => {
  if (req.user && req.user.id) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Evolution API Webhook endpoint - using optimized controller
  app.post('/api/evolution/webhook/:instanceName', async (req, res) => {
    await OptimizedWebhookController.handleIncomingEvent(req, res);
  });

  // Additional webhook endpoints for alternative URL patterns
  app.post('/api/evolution/webhook/:instanceName/messages-upsert', async (req, res) => {
    await OptimizedWebhookController.handleIncomingEvent(req, res);
  });

  app.post('/api/evolution/webhook/:instanceName/chats-update', async (req, res) => {
    await OptimizedWebhookController.handleIncomingEvent(req, res);
  });

  app.post('/api/evolution/webhook/:instanceName/contacts-update', async (req, res) => {
    await OptimizedWebhookController.handleIncomingEvent(req, res);
  });

  app.post('/api/evolution/webhook/:instanceName/messages-update', async (req, res) => {
    await OptimizedWebhookController.handleIncomingEvent(req, res);
  });

  app.post('/api/evolution/webhook/:instanceName/chats-upsert', async (req, res) => {
    await OptimizedWebhookController.handleIncomingEvent(req, res);
  });

  app.post('/api/evolution/webhook/:instanceName/messages-delete', async (req, res) => {
    await OptimizedWebhookController.handleIncomingEvent(req, res);
  });

  // API endpoint to view deleted messages
  app.get('/api/whatsapp/deleted-messages/:instanceId', async (req, res) => {
    try {
      const userId = req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const { instanceId } = req.params;
      const { chatId, limit = '50' } = req.query;
      const limitNum = parseInt(limit as string, 10);
      
      const deletions = await storage.getWhatsappMessageDeletions(userId, instanceId, chatId as string, limitNum);
      res.json(deletions);
    } catch (error) {
      console.error('Error fetching deleted messages:', error);
      res.status(500).json({ error: "Failed to get deleted messages" });
    }
  });

  // Test endpoint for calendar creation
  app.post('/api/test-calendar-creation', async (req, res) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const { messageContent = 'Test meeting from WhatsApp' } = req.body;
      
      console.log('Testing default calendar creation for user:', userId);
      
      // Check current calendar status
      const existingAccount = await storage.getCalendarAccount(userId);
      console.log('Existing calendar account:', existingAccount);
      
      // Import calendar service
      const { calendarService } = await import('./calendar-service');
      
      // Create test event data
      const eventData = {
        title: 'Test Meeting from WhatsApp',
        description: `Event created from WhatsApp message: "${messageContent}"`,
        startTime: new Date(Date.now() + 24*60*60*1000), // Tomorrow
        endTime: new Date(Date.now() + 24*60*60*1000 + 60*60*1000), // Tomorrow + 1 hour
        location: 'Office'
      };
      
      console.log('Creating calendar event:', eventData);
      
      // This should trigger default calendar creation
      const createdEvent = await calendarService.createEvent(userId, eventData);
      
      // Verify calendar was created
      const newAccount = await storage.getCalendarAccount(userId);
      const calendars = await storage.getCalendarCalendars(userId);
      
      res.json({
        success: true,
        message: 'Default calendar system created successfully',
        event: createdEvent,
        account: newAccount,
        calendars: calendars
      });
      
    } catch (error) {
      console.error('Calendar creation test error:', error);
      res.status(500).json({ 
        error: 'Calendar creation test failed',
        message: error.message,
        stack: error.stack
      });
    }
  });

  // Test endpoint for hashtag processing
  app.post('/api/test-hashtag-processing', async (req, res) => {
    try {
      const { messageId, instanceId } = req.body;
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      
      console.log('Testing hashtag processing for message:', messageId);
      
      // Get the message
      const message = await storage.getWhatsappMessage(userId, instanceId, messageId);
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      console.log('Message content:', message.content);
      
      // Import actions engine
      const { ActionsEngine } = await import('./actions-engine');
      
      // Extract hashtags and keywords
      const { hashtags, keywords } = ActionsEngine.extractHashtagsAndKeywords(message.content || '');
      console.log('Extracted hashtags:', hashtags);
      console.log('Extracted keywords:', keywords);
      
      // Create trigger context
      const triggerContext = {
        messageId: message.messageId,
        instanceId: message.instanceId,
        chatId: message.chatId,
        senderJid: message.senderJid,
        content: message.content || '',
        hashtags,
        keywords,
        timestamp: new Date(message.timestamp),
        fromMe: message.fromMe || false
      };
      
      console.log('Trigger context:', triggerContext);
      
      // Process message for actions
      await ActionsEngine.processMessageForActions(triggerContext);
      
      // Check if task was created
      const tasks = await storage.getCrmTasks(userId, instanceId);
      const newTask = tasks.find(task => 
        task.sourceMessageId === messageId && 
        task.sourceInstanceId === instanceId
      );
      
      res.json({
        success: true,
        message: 'Hashtag processing completed',
        extractedHashtags: hashtags,
        extractedKeywords: keywords,
        taskCreated: !!newTask,
        createdTask: newTask || null
      });
      
    } catch (error) {
      console.error('Hashtag processing test error:', error);
      res.status(500).json({ 
        error: 'Hashtag processing test failed',
        message: error.message,
        stack: error.stack
      });
    }
  });

  // Server-Sent Events endpoint for real-time task updates
  app.get('/api/events/tasks', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    res.write('data: {"type": "connected", "message": "Task updates stream connected"}\n\n');

    const { ActionsEngine } = require('./actions-engine');
    const taskCallback = (task: any) => {
      const eventData = {
        type: 'task_created',
        task: task,
        timestamp: new Date().toISOString()
      };
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    };

    ActionsEngine.onTaskCreated(taskCallback);
    console.log('📡 SSE client connected for task updates');

    const heartbeat = setInterval(() => {
      res.write('data: {"type": "heartbeat"}\n\n');
    }, 30000);

    req.on('close', () => {
      console.log('📡 SSE client disconnected');
      clearInterval(heartbeat);
    });
  });

  // Webhook handler functions for Evolution API events
  async function handleWebhookMessagesUpsert(instanceName: string, data: any) {
    // Override Evolution API's internal instance IDs IMMEDIATELY before any processing
    const correctedInstanceId = instanceName;
    
    // Recursively override instanceId in all nested objects
    const overrideInstanceIds = (obj: any) => {
      if (obj && typeof obj === 'object') {
        if (obj.instanceId) {
          obj.instanceId = correctedInstanceId;
        }
        if (Array.isArray(obj)) {
          obj.forEach(overrideInstanceIds);
        } else {
          Object.values(obj).forEach(overrideInstanceIds);
        }
      }
    };
    
    overrideInstanceIds(data);
    
    console.log(`📩 Processing messages.upsert for ${instanceName}:`, JSON.stringify(data, null, 2));
    
    try {
      // Query the WhatsApp instances table directly using the instanceName as instanceId
      const instance = await storage.getWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instanceName);
      
      if (!instance) {
        console.error(`Instance ${instanceName} not found in whatsapp.instances table`);
        return;
      }
      
      console.log(`✅ Found instance: ${instanceName} (${instance.displayName})`);
      console.log(`📱 Owner JID: ${instance.ownerJid}`);

      // Handle messages array from Evolution API webhook format
      const messages = data.messages || [data]; // Support both array and single message
      
      if (!Array.isArray(messages)) {
        console.log('Invalid messages format received');
        return;
      }

      // Helper functions for media handling
      const isMediaMessage = (messageContent: any): boolean => {
        return !!(
          messageContent.imageMessage ||
          messageContent.videoMessage ||
          messageContent.audioMessage ||
          messageContent.documentMessage ||
          messageContent.stickerMessage
        );
      };

      const downloadMediaFile = async (mediaUrl: string, messageId: string, instanceId: string, mimetype: string): Promise<string | null> => {
        try {
          console.log(`🔄 Starting download for ${messageId}: ${mediaUrl}`);
          
          // Create media storage directory if it doesn't exist
          const mediaDir = path.join(process.cwd(), 'media', instanceId);
          console.log(`📁 Creating directory: ${mediaDir}`);
          
          if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
            console.log(`✅ Created directory: ${mediaDir}`);
          }

          // Determine file extension from mimetype
          const getFileExtension = (mimetype: string): string => {
            const mimeMap: { [key: string]: string } = {
              'image/jpeg': '.jpg',
              'image/png': '.png',
              'image/gif': '.gif',
              'image/webp': '.webp',
              'video/mp4': '.mp4',
              'video/quicktime': '.mov',
              'audio/mpeg': '.mp3',
              'audio/ogg': '.ogg',
              'audio/wav': '.wav',
              'application/pdf': '.pdf',
              'application/msword': '.doc',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
              'text/plain': '.txt'
            };
            return mimeMap[mimetype] || '.bin';
          };

          const fileExtension = getFileExtension(mimetype);
          const fileName = `${messageId}${fileExtension}`;
          const localPath = path.join(mediaDir, fileName);
          console.log(`📄 Target file path: ${localPath}`);

          // Download the file
          console.log(`⬇️ Fetching URL: ${mediaUrl}`);
          const response = await fetch(mediaUrl);
          
          if (!response.ok) {
            console.error(`❌ Failed to download media: ${response.status} ${response.statusText}`);
            return null;
          }

          console.log(`✅ Fetch successful, getting buffer...`);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          fs.writeFileSync(localPath, buffer);
          
          console.log(`📥 Downloaded media file: ${fileName} (${buffer.length} bytes)`);
          return localPath;
        } catch (error) {
          console.error('❌ Error downloading media file:', error);
          return null;
        }
      };

      const extractMediaData = async (messageContent: any, messageId: string, instanceId: string) => {
        let mediaInfo = null;
        let mediaType = '';

        if (messageContent.imageMessage) {
          mediaInfo = messageContent.imageMessage;
          mediaType = 'image';
        } else if (messageContent.videoMessage) {
          mediaInfo = messageContent.videoMessage;
          mediaType = 'video';
        } else if (messageContent.audioMessage) {
          mediaInfo = messageContent.audioMessage;
          mediaType = 'audio';
        } else if (messageContent.documentMessage) {
          mediaInfo = messageContent.documentMessage;
          mediaType = 'document';
        } else if (messageContent.stickerMessage) {
          mediaInfo = messageContent.stickerMessage;
          mediaType = 'sticker';
        }

        if (!mediaInfo) return null;

        // Download the media file if URL is available
        let localPath = null;
        if (mediaInfo.url) {
          localPath = await downloadMediaFile(
            mediaInfo.url,
            messageId,
            instanceId,
            mediaInfo.mimetype || 'application/octet-stream'
          );
        }

        return {
          messageId: messageId,
          instanceId: instanceId,
          mimetype: mediaInfo.mimetype || 'application/octet-stream',
          fileSizeBytes: parseInt(mediaInfo.fileLength || '0'),
          fileUrl: mediaInfo.url || null,
          fileLocalPath: localPath,
          mediaKey: mediaInfo.mediaKey || null,
          caption: mediaInfo.caption || null,
          thumbnailUrl: null,
          width: mediaInfo.width || null,
          height: mediaInfo.height || null,
          durationSeconds: mediaInfo.seconds || null,
          isViewOnce: mediaInfo.viewOnce || false
        };
      }

      for (const message of messages) {
        if (!message || !message.key) {
          console.log('Invalid message format in array, skipping');
          continue;
        }

        // Determine message type from the message content - map to WhatsApp schema enum values
        let messageType = 'text'; // Default to text
        if (message.message) {
          const messageContent = message.message;
          if (messageContent.reactionMessage) messageType = 'reaction';
          else if (messageContent.conversation || messageContent.extendedTextMessage) messageType = 'text';
          else if (messageContent.imageMessage) messageType = 'image';
          else if (messageContent.videoMessage) messageType = 'video';
          else if (messageContent.audioMessage) messageType = 'audio';
          else if (messageContent.documentMessage) messageType = 'document';
          else if (messageContent.stickerMessage) messageType = 'sticker';
          else if (messageContent.locationMessage) messageType = 'location';
          else if (messageContent.contactMessage) messageType = 'contact_card';
        }
        
        // Also check the messageType field from Evolution API
        if (message.messageType === 'reactionMessage') {
          messageType = 'reaction';
        }

        // Ensure the contact and chat exist before saving the message
        const chatId = message.key.remoteJid || '';
        const senderJid = message.participant || message.key.remoteJid || '';
        
        // Override the instanceId from Evolution API with our database instance name
        // Evolution API sends different internal IDs but we need to use our consistent instance name
        const correctedInstanceId = instanceName; // Use the webhook URL instance name
        
        // Also override any instanceId in the message data itself
        if (message.instanceId) {
          message.instanceId = correctedInstanceId;
        }
        
        try {
          // For individual chats, the contact JID should match the chat ID
          // For group chats, we create contacts for both the chat and the sender
          const contactJid = chatId.includes('@g.us') ? senderJid : chatId;
          
          // First, ensure the main contact exists (for the chat)
          let chatContact = await storage.getWhatsappContact('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', correctedInstanceId, contactJid);
          
          if (!chatContact) {
            // Create the contact if it doesn't exist
            const newContactData = {
              instanceId: correctedInstanceId, // Maps to whatsapp.instances.instance_id
              jid: contactJid,
              pushName: message.pushName || contactJid.split('@')[0],
              verifiedName: null,
              profilePictureUrl: null,
              isBusiness: false,
              isMe: false,
              isBlocked: false
            };
            
            chatContact = await storage.createWhatsappContact(newContactData);
            console.log(`✅ Created new contact: ${contactJid}`);
          }
          
          // For group chats, also ensure the sender contact exists if different
          if (chatId.includes('@g.us') && senderJid !== contactJid) {
            let senderContact = await storage.getWhatsappContact('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', correctedInstanceId, senderJid);
            
            if (!senderContact) {
              const senderContactData = {
                instanceId: correctedInstanceId,
                jid: senderJid,
                pushName: message.pushName || senderJid.split('@')[0],
                verifiedName: null,
                profilePictureUrl: null,
                isBusiness: false,
                isMe: false,
                isBlocked: false
              };
              
              senderContact = await storage.createWhatsappContact(senderContactData);
              console.log(`✅ Created new sender contact: ${senderJid}`);
            }
          }
          
          // Then, ensure the chat exists
          let chat = await storage.getWhatsappChat('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', correctedInstanceId, chatId);
          
          if (!chat) {
            // Create the chat if it doesn't exist
            const chatType: 'individual' | 'group' = chatId.includes('@g.us') ? 'group' : 'individual';
            const newChatData = {
              instanceId: correctedInstanceId, // Maps to whatsapp.instances.instance_id
              chatId: chatId,
              type: chatType,
              unreadCount: 0,
              isArchived: false,
              isPinned: false,
              isMuted: false,
              muteEndTimestamp: null,
              lastMessageTimestamp: new Date((message.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000)
            };
            
            chat = await storage.createWhatsappChat(newChatData);
            console.log(`✅ Created new chat: ${chatId}`);
          }
        } catch (setupError) {
          console.error('Error ensuring contact/chat exists:', setupError);
        }

        // Handle reaction messages specially
        if (messageType === 'reaction' || (message.message?.reactionMessage && message.messageType === 'reactionMessage')) {
          const reactionData = message.message.reactionMessage;
          const targetMessageId = reactionData.key.id;
          const reactionEmoji = reactionData.text;
          const reactorJid = message.key.participant || message.key.remoteJid || '';

          // If emoji is empty, this is a reaction removal
          if (!reactionEmoji) {
            await storage.deleteWhatsappMessageReaction('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', correctedInstanceId, targetMessageId, reactorJid);
            console.log(`🗑️ Removed reaction from ${reactorJid} on message ${targetMessageId}`);
          } else {
            // Use the webhook's fromMe value directly - it's more accurate than database lookup
            const isInternalUser = message.key.fromMe || false;
            
            console.log(`🔍 Using webhook fromMe value for ${reactorJid}: fromMe=${isInternalUser}`);

            // Check if target message exists before saving reaction
            const targetMessage = await storage.getWhatsappMessage('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', correctedInstanceId, targetMessageId);
            
            if (!targetMessage) {
              console.log(`⚠️ Target message ${targetMessageId} not found, skipping reaction save`);
              return; // Skip saving reaction if target message doesn't exist
            }

            // Add or update reaction
            const reactionMessageData = {
              messageId: targetMessageId,
              instanceId: correctedInstanceId,
              reactorJid: reactorJid,
              reactionEmoji: reactionEmoji,
              fromMe: isInternalUser,
              timestamp: new Date((message.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000)
            };

            await storage.createWhatsappMessageReaction(reactionMessageData);
            console.log(`👍 Saved reaction ${reactionEmoji} from ${reactorJid} (fromMe=${isInternalUser}) on message ${targetMessageId}`);

            // Process actions triggers for this reaction
            try {
              console.log(`🔍 Looking for original message: ${targetMessageId} in instance: ${correctedInstanceId}`);
              const originalMessage = await storage.getWhatsappMessage('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', correctedInstanceId, targetMessageId);
              
              if (originalMessage) {
                console.log(`📨 Found original message: "${originalMessage.content?.substring(0, 50) || 'No content'}"`);
                const triggerContext = {
                  reactionId: `${targetMessageId}_${reactionEmoji}`,
                  messageId: targetMessageId,
                  instanceId: correctedInstanceId,
                  chatId: message.key.remoteJid, // Use the actual chat/group ID from webhook
                  senderJid: reactorJid,
                  content: originalMessage.content || '',
                  reaction: reactionEmoji,
                  timestamp: new Date(),
                  fromMe: isInternalUser, // Use the reaction's fromMe value, not the original message's
                };

                console.log(`🎯 Triggering actions engine for reaction: ${reactionEmoji}`);
                // Trigger actions engine for reaction
                await ActionsEngine.processMessageForActions(triggerContext);
                console.log(`✅ Processed reaction trigger for ${reactionEmoji} on message: ${originalMessage.content?.substring(0, 50) || 'No content'}`);
              } else {
                console.log(`⚠️ Original message not found for reaction: ${targetMessageId}`);
              }
            } catch (reactionError) {
              console.error(`❌ Error processing reaction trigger:`, reactionError);
            }
          }
        } else {
          // Save regular messages to WhatsApp messages table (excluding reactions)
          const whatsappMessageData = {
            instanceId: correctedInstanceId, // This maps to the whatsapp instances table instance_id
            messageId: message.key.id || '',
            chatId: chatId,
            senderJid: message.participant || message.key.remoteJid || '',
            fromMe: message.key.fromMe || false,
            messageType: messageType,
            content: extractMessageContent(message),
            timestamp: new Date((message.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000),
            quotedMessageId: extractQuotedMessageId(message)
          };

          // Save message to WhatsApp schema message table
          try {
            await db.execute(sql`
              INSERT INTO whatsapp.messages (
                message_id, instance_id, chat_id, sender_jid, from_me, 
                message_type, content, timestamp, quoted_message_id
              ) VALUES (
                ${whatsappMessageData.messageId},
                ${correctedInstanceId},
                ${whatsappMessageData.chatId},
                ${whatsappMessageData.senderJid},
                ${whatsappMessageData.fromMe},
                ${messageType}::whatsapp.message_type,
                ${whatsappMessageData.content || ''},
                ${whatsappMessageData.timestamp},
                ${whatsappMessageData.quotedMessageId}
              ) ON CONFLICT (message_id, instance_id) DO UPDATE SET
                content = EXCLUDED.content,
                message_type = EXCLUDED.message_type,
                timestamp = EXCLUDED.timestamp
            `);
            console.log(`✅ Saved WhatsApp message from ${message.pushName || 'Unknown'}: "${whatsappMessageData.content?.substring(0, 50) || 'No content'}"`);
          } catch (saveError) {
            console.error('Error saving message to WhatsApp schema:', saveError);
          }

          // Process actions triggers for this message
          const messageContent = whatsappMessageData.content || '';
          const { hashtags, keywords } = ActionsEngine.extractHashtagsAndKeywords(messageContent);
          
          if (hashtags.length > 0 || keywords.length > 0) {
            const triggerContext = {
              messageId: whatsappMessageData.messageId,
              instanceId: correctedInstanceId,
              chatId: whatsappMessageData.chatId,
              senderJid: whatsappMessageData.senderJid,
              content: messageContent,
              hashtags,
              keywords,
              timestamp: whatsappMessageData.timestamp,
              fromMe: whatsappMessageData.fromMe,
            };
            
            // Trigger actions engine for hashtags and keywords
            await ActionsEngine.processMessageForActions(triggerContext);
          }

          // Save media information if this is a media message
          if (message.message && isMediaMessage(message.message)) {
            const mediaUrl = getMediaUrl(message.message);
            const mimetype = getMediaMimetype(message.message) || 'application/octet-stream';
            const messageId = String(message.key.id || '');
            
            // Download file locally
            let localPath = null;
            if (mediaUrl) {
              try {
                console.log(`🔄 Starting download for ${messageId}: ${mediaUrl}`);
                
                // Create media directory
                const mediaDir = path.join(process.cwd(), 'media', instance.instanceId);
                if (!fs.existsSync(mediaDir)) {
                  fs.mkdirSync(mediaDir, { recursive: true });
                  console.log(`✅ Created directory: ${mediaDir}`);
                }

                // Determine file extension
                const extensionMap: { [key: string]: string } = {
                  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
                  'video/mp4': '.mp4', 'video/quicktime': '.mov',
                  'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
                  'application/pdf': '.pdf', 'text/plain': '.txt'
                };
                const fileExtension = extensionMap[mimetype] || '.bin';
                const fileName = `${messageId}${fileExtension}`;
                localPath = path.join(mediaDir, fileName);

                // Download file with proper headers for WhatsApp media
                const response = await fetch(mediaUrl, {
                  headers: {
                    'User-Agent': 'WhatsApp/2.2043.7 Mozilla/5.0 (compatible; WhatsApp)',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br'
                  }
                });
                
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  fs.writeFileSync(localPath, buffer);
                  console.log(`📥 Downloaded media file: ${fileName} (${buffer.length} bytes)`);
                } else {
                  console.error(`❌ Failed to download media: ${response.status} ${response.statusText}`);
                  localPath = null;
                }
              } catch (error) {
                console.error('❌ Error downloading media:', error);
                localPath = null;
              }
            }

            const mediaData = {
              messageId: messageId,
              instanceId: correctedInstanceId,
              mimetype: mimetype,
              fileSizeBytes: parseInt(String(getMediaSize(message.message) || '0')),
              fileUrl: mediaUrl,
              fileLocalPath: localPath,
              mediaKey: message.message.imageMessage?.mediaKey || message.message.videoMessage?.mediaKey || message.message.audioMessage?.mediaKey || message.message.documentMessage?.mediaKey || null,
              caption: getMediaCaption(message.message),
              thumbnailUrl: null,
              width: message.message.imageMessage?.width || message.message.videoMessage?.width || null,
              height: message.message.imageMessage?.height || message.message.videoMessage?.height || null,
              durationSeconds: message.message.audioMessage?.seconds || message.message.videoMessage?.seconds || null,
              isViewOnce: message.message.imageMessage?.viewOnce || message.message.videoMessage?.viewOnce || false
            };

            if (mediaData.fileUrl) {
              await storage.createWhatsappMessageMedia(mediaData);
              console.log(`💾 Saved media data for message ${messageId}: ${mediaData.mimetype} (${mediaData.fileSizeBytes} bytes)`);
              if (mediaData.fileLocalPath) {
                console.log(`📁 File stored locally: ${mediaData.fileLocalPath}`);
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error saving webhook message:', error);
      console.error('Message data:', data);
    }
  }

  async function handleWebhookContactsUpsert(instanceName: string, data: any) {
    // Override Evolution API's internal instance IDs IMMEDIATELY before any processing
    const correctedInstanceId = instanceName;
    
    // Recursively override instanceId in all nested objects
    const overrideInstanceIds = (obj: any) => {
      if (obj && typeof obj === 'object') {
        if (obj.instanceId) {
          obj.instanceId = correctedInstanceId;
        }
        if (Array.isArray(obj)) {
          obj.forEach(overrideInstanceIds);
        } else {
          Object.values(obj).forEach(overrideInstanceIds);
        }
      }
    };
    
    overrideInstanceIds(data);
    
    console.log(`👤 Processing contacts.upsert for ${instanceName}:`, data);
    
    try {
      // Query the WhatsApp instances table directly using the instanceName as instanceId
      const instance = await storage.getWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instanceName);
      
      if (!instance) {
        console.error(`Instance ${instanceName} not found in whatsapp.instances table`);
        return;
      }
      
      // Handle both single contact and array of contacts
      const contacts = Array.isArray(data) ? data : [data];
      
      for (const contact of contacts) {
        if (contact.remoteJid) {
          console.log(`📱 Processing contact: ${contact.remoteJid} for instance ${correctedInstanceId}`);
        }
      }
    } catch (error) {
      console.error('Error processing contacts webhook:', error);
    }
  }

  async function handleWebhookGroupsUpsert(instanceName: string, data: any) {
    console.log(`👥 Processing groups.upsert for ${instanceName}:`, JSON.stringify(data, null, 2));
    
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const instances = await storage.getWhatsappInstances(userId);
      const instance = instances.find(inst => inst.instanceId === instanceName);
      if (!instance) {
        console.error(`❌ Instance ${instanceName} not found`);
        return;
      }

      // Process groups array
      const groups = Array.isArray(data) ? data : [data];
      
      for (const group of groups) {
        const groupJid = group.id || group.remoteJid;
        if (!groupJid || !groupJid.endsWith('@g.us')) {
          console.log('⚠️ Skipping invalid group JID:', groupJid);
          continue;
        }

        // Create or update group record
        const groupData = {
          groupJid: groupJid,
          instanceId: instance.instanceId,
          subject: group.subject || group.name || 'Unknown Group',
          description: group.desc || group.description || null,
          ownerJid: group.owner || group.ownerJid || null,
          creationTimestamp: group.creation ? new Date(group.creation * 1000) : new Date(),
          isLocked: group.restrict || false
        };

        // Create contact record for the group
        const contactData = {
          instanceId: instance.instanceId,
          jid: groupJid,
          pushName: groupData.subject,
          verifiedName: groupData.subject,
          isGroup: true,
          profilePictureUrl: null
        };

        await storage.createWhatsappContact(contactData);
        await storage.createWhatsappGroup(groupData);
        console.log(`✅ Created/updated group: ${groupData.subject}`);

        // Process group participants if available
        if (group.participants && Array.isArray(group.participants)) {
          for (const participant of group.participants) {
            const participantJid = participant.id || participant.jid;
            if (!participantJid) continue;

            const participantData = {
              groupJid: groupJid,
              instanceId: instance.instanceId,
              participantJid: participantJid,
              isAdmin: participant.admin === 'admin' || participant.isAdmin || false,
              isSuperAdmin: participant.admin === 'superadmin' || participant.isSuperAdmin || false
            };

            await storage.createWhatsappGroupParticipant(participantData);
            console.log(`✅ Added participant: ${participantJid} (admin: ${participantData.isAdmin})`);
          }
        }
      }
    } catch (error) {
      console.error('Error processing groups.upsert:', error);
    }
  }

  async function handleWebhookGroupParticipantsUpdate(instanceName: string, data: any) {
    console.log(`👥 Processing group-participants.update for ${instanceName}:`, JSON.stringify(data, null, 2));
    
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const instances = await storage.getWhatsappInstances(userId);
      const instance = instances.find(inst => inst.instanceId === instanceName);
      if (!instance) {
        console.error(`❌ Instance ${instanceName} not found`);
        return;
      }

      const groupJid = data.id || data.remoteJid;
      if (!groupJid || !groupJid.endsWith('@g.us')) {
        console.log('⚠️ Invalid group JID for participants update:', groupJid);
        return;
      }

      // Handle different participant update actions
      const action = data.action; // 'add', 'remove', 'promote', 'demote'
      const participants = data.participants || [];

      // Ensure group exists before processing participants
      let group = await storage.getWhatsappGroup(userId, instance.instanceId, groupJid);
      if (!group) {
        console.log(`📝 Creating group record for ${groupJid}`);
        const groupData = {
          groupJid: groupJid,
          instanceId: instance.instanceId,
          subject: `Group ${groupJid.split('@')[0]}`,
          description: null,
          ownerJid: null,
          creationTimestamp: new Date(),
          isLocked: false,
          updatedAt: new Date()
        };
        group = await storage.createWhatsappGroup(groupData);
        console.log(`✅ Created group record: ${groupJid}`);
      }

      // Also ensure group chat exists
      const existingChat = await storage.getWhatsappChat(userId, instance.instanceId, groupJid);
      if (!existingChat) {
        const chatData = {
          chatId: groupJid,
          instanceId: instance.instanceId,
          type: 'group' as const,
          unreadCount: 0,
          isPinned: false,
          isArchived: false
        };
        await storage.createWhatsappChat(chatData);
        console.log(`✅ Created group chat: ${groupJid}`);
      }

      for (const participantJid of participants) {
        try {
          switch (action) {
            case 'add':
              const participantData = {
                groupJid: groupJid,
                instanceId: instance.instanceId,
                participantJid: participantJid,
                isAdmin: false,
                isSuperAdmin: false
              };
              await storage.createWhatsappGroupParticipant(participantData);
              console.log(`✅ Added participant: ${participantJid} to group ${groupJid}`);
              break;

            case 'remove':
              await storage.removeWhatsappGroupParticipant(instance.instanceId, groupJid, participantJid);
              console.log(`✅ Removed participant: ${participantJid} from group ${groupJid}`);
              break;

          case 'promote':
            await storage.updateWhatsappGroupParticipant(instance.instanceId, groupJid, participantJid, {
              isAdmin: true,
              isSuperAdmin: false
            });
            console.log(`✅ Promoted participant: ${participantJid} to admin in group ${groupJid}`);
            break;

          case 'demote':
            await storage.updateWhatsappGroupParticipant(instance.instanceId, groupJid, participantJid, {
              isAdmin: false,
              isSuperAdmin: false
            });
            console.log(`✅ Demoted participant: ${participantJid} in group ${groupJid}`);
            break;

            default:
              console.log(`⚠️ Unknown participant action: ${action} for ${participantJid}`);
          }
        } catch (participantError) {
          console.error(`❌ Error processing participant ${participantJid}:`, participantError);
        }
      }

      console.log(`✅ Completed processing ${participants.length} participants for group ${groupJid}`);

      // Note: Webhook-based system handles real-time updates via polling - no WebSocket broadcasting needed

    } catch (error) {
      console.error('Error processing group-participants.update:', error);
    }
  }

  async function handleWebhookMessageReaction(instanceName: string, data: any) {
    console.log(`⭐ Processing message reaction for ${instanceName}:`, JSON.stringify(data, null, 2));
    
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const instances = await storage.getWhatsappInstances(userId);
      const instance = instances.find(inst => inst.instanceId === instanceName);
      if (!instance) {
        console.error(`❌ Instance ${instanceName} not found`);
        return;
      }

      // Extract reaction data from webhook - handle nested reactionMessage structure
      const reactionData = data.message?.reactionMessage;
      if (!reactionData) {
        console.log('⚠️ No reactionMessage found in data');
        return;
      }

      const originalMessageId = reactionData.key?.id;
      const reactionEmoji = reactionData.text;
      const senderJid = data.key?.remoteJid;
      const chatId = data.key?.remoteJid;

      if (!originalMessageId || !reactionEmoji || !senderJid || !chatId) {
        console.log('⚠️ Missing reaction data, skipping');
        return;
      }

      console.log(`⭐ Reaction detected: ${reactionEmoji} on message ${originalMessageId} by ${senderJid}`);

      // Get the original message to extract content
      const originalMessage = await storage.getWhatsappMessage(userId, instance.instanceId, originalMessageId);
      if (!originalMessage) {
        console.log(`⚠️ Original message not found: ${originalMessageId}`);
        return;
      }

      // Process actions triggers for this reaction
      const triggerContext = {
        reactionId: `${originalMessageId}_${reactionEmoji}`,
        messageId: originalMessageId,
        instanceId: instance.instanceId,
        chatId: chatId,
        senderJid: senderJid,
        reactorJid: senderJid, // Who performed the reaction
        originalSenderJid: originalMessage.senderJid || originalMessage.fromMe ? 'me' : senderJid,
        content: originalMessage.content || '',
        hashtags: ActionsEngine.extractHashtagsAndKeywords(originalMessage.content || '').hashtags,
        keywords: ActionsEngine.extractHashtagsAndKeywords(originalMessage.content || '').keywords,
        reaction: reactionEmoji,
        timestamp: new Date(),
        fromMe: originalMessage.fromMe,
      };

      // Trigger actions engine for reaction
      await ActionsEngine.processMessageForActions(triggerContext);
      console.log(`✅ Processed reaction trigger for ${reactionEmoji} on message: ${originalMessage.content?.substring(0, 50) || 'No content'}`);

    } catch (error) {
      console.error('❌ Error processing message reaction:', error);
    }
  }

  async function handleWebhookMessagesUpdate(instanceName: string, data: any) {
    console.log(`🔄 Processing messages.update for ${instanceName}:`, JSON.stringify(data, null, 2));
    
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const instances = await storage.getWhatsappInstances(userId);
      const instance = instances.find(inst => inst.instanceId === instanceName);
      if (!instance) {
        console.error(`❌ Instance ${instanceName} not found`);
        return;
      }

      // Handle message edits first - check if this is an edit event
      if (data.message && data.message.editedMessage) {
        const editedMessage = data.message.editedMessage;
        
        // For message edits, the target message ID is in the protocolMessage.key.id
        let targetMessageId = editedMessage.message?.protocolMessage?.key?.id;
        
        // Fallback to the webhook key if protocolMessage key is not available
        if (!targetMessageId) {
          targetMessageId = data.key?.id || data.messageId || data.keyId;
        }
        
        if (!targetMessageId) {
          console.log('Missing targetMessageId for edit, skipping');
          return;
        }

        console.log(`🔄 Processing edit for message ${targetMessageId}`);
        console.log(`🔍 Protocol message key ID: ${editedMessage.message?.protocolMessage?.key?.id}`);
        console.log(`🔍 Webhook key ID: ${data.key?.id}`);

        try {
          // Get the existing message to store as old content
          const existingMessage = await storage.getWhatsappMessage(userId, instance.instanceId, targetMessageId);
          if (existingMessage) {
            const oldContent = existingMessage.content;
            
            // Extract new content from edited message - handle multiple formats
            let newContent = '[Edited message]';
            
            const protocolMessage = editedMessage.message?.protocolMessage;
            if (protocolMessage?.editedMessage) {
              const editContent = protocolMessage.editedMessage;
              
              // Text message edit
              if (editContent.conversation) {
                newContent = editContent.conversation;
              }
              // Extended text message edit
              else if (editContent.extendedTextMessage?.text) {
                newContent = editContent.extendedTextMessage.text;
              }
              // Media message edit (image, video, etc. with caption)
              else if (editContent.imageMessage?.caption) {
                newContent = editContent.imageMessage.caption;
              }
              else if (editContent.videoMessage?.caption) {
                newContent = editContent.videoMessage.caption;
              }
              else if (editContent.documentMessage?.caption) {
                newContent = editContent.documentMessage.caption;
              }
              // For media messages without caption
              else if (editContent.imageMessage) {
                newContent = '[Image caption edited]';
              }
              else if (editContent.videoMessage) {
                newContent = '[Video caption edited]';
              }
              else if (editContent.documentMessage) {
                newContent = '[Document caption edited]';
              }
            }
            // Fallback for other edit formats
            else if (editedMessage.message?.conversation) {
              newContent = editedMessage.message.conversation;
            }
            else if (editedMessage.message?.extendedTextMessage?.text) {
              newContent = editedMessage.message.extendedTextMessage.text;
            }

            // Store edit history
            const editHistoryData = {
              messageId: targetMessageId,
              instanceId: instance.instanceId,
              oldContent: oldContent,
              editTimestamp: new Date()
            };
            
            await storage.createWhatsappMessageEditHistory(editHistoryData);
            console.log(`📝 Stored edit history for message ${targetMessageId}`);

            // Update the main message with new content
            await storage.updateWhatsappMessage(userId, instance.instanceId, targetMessageId, {
              content: newContent,
              lastEditedAt: new Date()
            });
            console.log(`✅ Updated message ${targetMessageId} with edited content: "${newContent.substring(0, 50)}..."`);
            
            return; // Exit early as we handled the edit
          } else {
            console.log(`⚠️ Original message ${targetMessageId} not found for edit`);
          }
        } catch (editError) {
          console.error(`Error processing message edit for ${targetMessageId}:`, editError);
        }
      }

      // Handle status updates if not an edit
      const messageId = data.messageId || data.keyId;
      const status = data.status;
      
      if (!messageId || !status) {
        console.log('Missing messageId or status in update, skipping');
        return;
      }

      console.log(`📱 Status update for message ${messageId}: ${status}`);
      
      try {
        // Map Evolution API status to our schema enum
        let mappedStatus: "error" | "pending" | "sent" | "delivered" | "read" | "played" = 'pending';
        switch (status) {
          case 'DELIVERY_ACK':
            mappedStatus = 'delivered';
            break;
          case 'READ':
            mappedStatus = 'read';
            break;
          case 'PLAYED':
            mappedStatus = 'played';
            break;
          case 'SENT':
            mappedStatus = 'sent';
            break;
          case 'ERROR':
            mappedStatus = 'error';
            break;
          default:
            mappedStatus = 'pending';
        }

        // Create message status update record
        const messageUpdateData = {
          messageId: messageId,
          instanceId: instance.instanceId,
          status: mappedStatus,
          timestamp: new Date()
        };
        
        await storage.createWhatsappMessageUpdate(messageUpdateData);
        console.log(`✅ Saved message status update: ${messageId} -> ${status} (mapped to ${mappedStatus})`);
        
        // Try to update the main message record if it exists
        try {
          const existingMessage = await storage.getWhatsappMessage(userId, instance.instanceId, messageId);
          if (existingMessage) {
            // Update last edited timestamp for status changes
            await storage.updateWhatsappMessage(userId, instance.instanceId, messageId, {
              lastEditedAt: new Date()
            });
            console.log(`✅ Updated message ${messageId} last edited timestamp`);
          }
        } catch (updateError) {
          console.log(`⚠️ Could not update main message record for ${messageId}:`, updateError);
        }
        
      } catch (error) {
        console.error(`Error saving message status update for ${messageId}:`, error);
      }
      
    } catch (error) {
      console.error('Error processing messages.update:', error);
      console.error('Message update data:', data);
    }
  }

  async function handleWebhookChatsUpsert(instanceName: string, data: any) {
    // Override Evolution API's internal instance IDs IMMEDIATELY before any processing
    const correctedInstanceId = instanceName;
    
    // Recursively override instanceId in all nested objects
    const overrideInstanceIds = (obj: any) => {
      if (obj && typeof obj === 'object') {
        if (obj.instanceId) {
          obj.instanceId = correctedInstanceId;
        }
        if (Array.isArray(obj)) {
          obj.forEach(overrideInstanceIds);
        } else {
          Object.values(obj).forEach(overrideInstanceIds);
        }
      }
    };
    
    overrideInstanceIds(data);
    
    console.log(`💬 Processing chats.upsert for ${instanceName}:`, data);
    
    try {
      // Query the WhatsApp instances table directly using the instanceName as instanceId
      const instance = await storage.getWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instanceName);
      
      if (!instance) {
        console.error(`Instance ${instanceName} not found in whatsapp.instances table`);
        return;
      }

      // Process each chat in the data array
      for (const chat of data) {
        const chatId = chat.remoteJid || chat.id;
        if (!chatId) {
          console.log('⚠️ Skipping chat without remoteJid');
          continue;
        }

        // Determine chat type based on JID format - only 'individual' and 'group' are supported
        let chatType: 'individual' | 'group' = 'individual';
        if (chatId.endsWith('@g.us')) {
          chatType = 'group';
        }
        // Skip broadcast messages for now as they're not supported in the schema
        if (chatId.endsWith('@broadcast')) {
          console.log(`⚠️ Skipping broadcast chat: ${chatId}`);
          continue;
        }

        // Use hardcoded user ID for now (this should be improved to get actual user)
        const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
        
        const existingChat = await storage.getWhatsappChat(userId, instance.instanceId, chatId);
        
        if (!existingChat) {
          // First, ensure the contact exists for the chat (required for foreign key constraint)
          let chatContact = await storage.getWhatsappContact(userId, instance.instanceId, chatId);
          
          if (!chatContact) {
            try {
              const contactData = {
                instanceId: instance.instanceId,
                jid: chatId,
                pushName: chat.name || (chatType === 'group' ? chat.name : chatId.split('@')[0]),
                verifiedName: chat.name || null,
                isMe: false,
                isMyContact: false,
                isBlocked: false,
                profilePictureUrl: null
              };
              
              console.log(`🔄 Creating contact for ${chatType}: ${chatId} with data:`, contactData);
              chatContact = await storage.createWhatsappContact(contactData);
              console.log(`✅ Created contact for ${chatType}: ${chatId}`);
              
              // Verify the contact was created
              const verifyContact = await storage.getWhatsappContact(userId, instance.instanceId, chatId);
              if (!verifyContact) {
                throw new Error(`Contact creation failed - contact not found after creation: ${chatId}`);
              }
              console.log(`✅ Verified contact exists: ${chatId}`);
              
            } catch (contactError) {
              console.error('Error creating contact:', contactError);
              throw contactError; // Re-throw to prevent chat creation
            }
          }
          
          // Create new chat/conversation
          const chatData = {
            instanceId: instance.instanceId,
            chatId: chatId,
            type: chatType,
            unreadCount: chat.unreadMessages || 0,
            isArchived: chat.archived || false,
            isPinned: chat.pinned || false,
            isMuted: false,
            muteEndTimestamp: chat.muteExpiry ? new Date(chat.muteExpiry * 1000) : null,
            lastMessageTimestamp: chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp * 1000) : new Date()
          };

          await storage.createWhatsappChat(chatData);
          console.log(`✅ Created ${chatType} chat: ${chat.name || chatId}`);
          
          // For group chats, also create a group record
          if (chatType === 'group' && chat.name) {
            try {
              const groupData = {
                groupJid: chatId,
                instanceId: instance.instanceId,
                subject: chat.name,
                description: chat.description || null,
                ownerJid: null,
                creationTimestamp: new Date(),
                isLocked: false
              };
              
              await storage.createWhatsappGroup(groupData);
              console.log(`✅ Created group record: ${chat.name}`);
              
              // Fetch and sync group participants
              await syncGroupParticipants(instance.instanceId, chatId, instanceName);
            } catch (groupError) {
              console.error('Error creating group record:', groupError);
            }
          }
          
        } else {
          // Update existing chat
          const updateData = {
            unreadCount: chat.unreadMessages ?? existingChat.unreadCount,
            isArchived: chat.archived ?? existingChat.isArchived,
            isPinned: chat.pinned ?? existingChat.isPinned,
            muteEndTimestamp: chat.muteExpiry ? new Date(chat.muteExpiry * 1000) : existingChat.muteEndTimestamp,
            lastMessageTimestamp: chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp * 1000) : existingChat.lastMessageTimestamp
          };

          await storage.updateWhatsappChat(userId, instance.instanceId, chatId, updateData);
          console.log(`🔄 Updated ${chatType} chat: ${chat.name || chatId}`);
          
          // For group chats, periodically sync participants to keep them current
          if (chatType === 'group') {
            await syncGroupParticipants(instance.instanceId, chatId, instanceName);
          }
          
          // For existing group chats, ensure the group record exists
          if (chatType === 'group' && chat.name) {
            try {
              const existingGroup = await storage.getWhatsappGroup(userId, instance.instanceId, chatId);
              if (!existingGroup) {
                const groupData = {
                  groupJid: chatId,
                  instanceId: instance.instanceId,
                  subject: chat.name,
                  description: chat.description || null,
                  ownerJid: null,
                  creationTimestamp: new Date(),
                  isLocked: false
                };
                
                await storage.createWhatsappGroup(groupData);
                console.log(`✅ Created missing group record: ${chat.name}`);
                
                // Sync participants for newly discovered groups
                await syncGroupParticipants(instance.instanceId, chatId, instanceName);
              }
            } catch (groupError) {
              console.error('Error checking/creating group record:', groupError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing chats.upsert:', error);
      console.error('Chat data:', data);
    }
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

  function isMediaMessage(messageContent: any): boolean {
    return !!(
      messageContent.imageMessage ||
      messageContent.videoMessage ||
      messageContent.audioMessage ||
      messageContent.documentMessage ||
      messageContent.stickerMessage
    );
  }

  function extractMediaData(messageContent: any, messageId: string, instanceId: string) {
    let mediaInfo = null;
    let mediaType = '';

    if (messageContent.imageMessage) {
      mediaInfo = messageContent.imageMessage;
      mediaType = 'image';
    } else if (messageContent.videoMessage) {
      mediaInfo = messageContent.videoMessage;
      mediaType = 'video';
    } else if (messageContent.audioMessage) {
      mediaInfo = messageContent.audioMessage;
      mediaType = 'audio';
    } else if (messageContent.documentMessage) {
      mediaInfo = messageContent.documentMessage;
      mediaType = 'document';
    } else if (messageContent.stickerMessage) {
      mediaInfo = messageContent.stickerMessage;
      mediaType = 'sticker';
    }

    if (!mediaInfo) return null;

    return {
      messageId: messageId,
      instanceId: instanceId,
      mediaType: mediaType,
      mimetype: mediaInfo.mimetype || 'application/octet-stream',
      fileSize: parseInt(mediaInfo.fileLength || '0'),
      fileName: mediaInfo.fileName || mediaInfo.title || null,
      caption: mediaInfo.caption || null,
      url: mediaInfo.url || null,
      thumbnailUrl: null, // Evolution API doesn't provide separate thumbnail URLs
      width: mediaInfo.width || null,
      height: mediaInfo.height || null,
      durationSeconds: mediaInfo.seconds || null,
      isViewOnce: mediaInfo.viewOnce || false
    };
  }

  async function syncGroupParticipants(instanceId: string, groupJid: string, instanceName: string) {
    try {
      console.log(`👥 Syncing participants for group: ${groupJid}`);
      
      // Get Evolution API instance
      const evolutionApi = getEvolutionApi();
      if (!evolutionApi) {
        console.error('Evolution API not available for participant sync');
        return;
      }

      // Fetch group participants from Evolution API
      const participantsResponse = await evolutionApi.getGroupParticipants(instanceName, groupJid);
      
      if (!participantsResponse || !participantsResponse.participants) {
        console.log(`⚠️ No participants data received for group: ${groupJid}`);
        return;
      }

      const participants = participantsResponse.participants;
      console.log(`📋 Found ${participants.length} participants for group: ${groupJid}`);

      // Clear existing participants for this group
      await storage.clearWhatsappGroupParticipants('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instanceId, groupJid);

      // Add each participant
      for (const participant of participants) {
        const participantJid = participant.id || participant.jid;
        if (!participantJid) continue;

        const participantData = {
          groupJid: groupJid,
          instanceId: instanceId,
          participantJid: participantJid,
          isAdmin: participant.admin === 'admin' || participant.isAdmin || false,
          isSuperAdmin: participant.admin === 'superadmin' || participant.isSuperAdmin || false
        };

        try {
          await storage.createWhatsappGroupParticipant(participantData);
          console.log(`✅ Added participant: ${participantJid} (admin: ${participantData.isAdmin})`);
        } catch (participantError) {
          console.error(`Error adding participant ${participantJid}:`, participantError);
        }
      }

      console.log(`✅ Completed participant sync for group: ${groupJid}`);
      
    } catch (error) {
      console.error(`Error syncing participants for group ${groupJid}:`, error);
    }
  }

  function extractMessageContent(message: any): string {
    // Handle edited messages (direct structure)
    if (message.editedMessage?.message?.protocolMessage?.editedMessage?.conversation) {
      return message.editedMessage.message.protocolMessage.editedMessage.conversation;
    }
    
    // Handle edited messages (nested in message field)
    if (message.message?.editedMessage?.message?.protocolMessage?.editedMessage?.conversation) {
      return message.message.editedMessage.message.protocolMessage.editedMessage.conversation;
    }
    
    // Handle standard messages
    if (message.message?.conversation) return message.message.conversation;
    if (message.message?.extendedTextMessage?.text) return message.message.extendedTextMessage.text;
    if (message.message?.imageMessage?.caption) return message.message.imageMessage.caption;
    if (message.message?.videoMessage?.caption) return message.message.videoMessage.caption;
    return '[Media message]';
  }

  async function getOrCreateConversationId(instanceId: string, remoteJid: string): Promise<string> {
    // Check if conversation exists
    const conversations = await storage.getWhatsappConversations('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instanceId);
    const existing = conversations.find(c => c.chatId === remoteJid);
    
    if (existing) {
      return existing.chatId;
    }

    // Create new conversation
    const newConversation = await storage.saveWhatsappConversation({
      instanceId,
      chatId: remoteJid,
      type: remoteJid.includes('@g.us') ? 'group' : 'individual',
      lastMessageTimestamp: new Date(),
      unreadCount: 0
    });

    return newConversation.chatId;
  }

  // Webhook-based messaging system - no WebSocket server needed

  // Instance status endpoint (webhook-based)
  app.get('/api/whatsapp/instances/status', async (req, res) => {
    try {
      // Disable caching to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const instances = await storage.getWhatsappInstances(req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
      
      const statusWithDetails = instances.map(instance => {
        const isConnected = instance.isConnected;
        
        return {
          instanceId: instance.instanceId,
          instanceName: instance.instanceId,
          phoneNumber: instance.ownerJid || 'Not set',
          status: isConnected ? 'connected' : 'disconnected',
          webhookConfigured: !!instance.webhookUrl,
          lastConnected: instance.lastConnectionAt,
          connectionState: isConnected ? 'connected' : 'disconnected'
        };
      });

      res.json(statusWithDetails);
    } catch (error) {
      console.error('Error getting instance status:', error);
      res.status(500).json({ error: 'Failed to get instance status' });
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
      const userData = insertUserSchema.parse(req.body);
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
      // Generate required fields if not provided
      const userId = req.body.userId || req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const instanceId = req.body.instanceId || `instance-${Date.now()}`;
      
      const instanceData = {
        instanceId: instanceId,
        displayName: req.body.displayName || 'WhatsApp Instance',
        clientId: userId as string,
        ownerJid: req.body.ownerJid || null,
        apiKey: req.body.apiKey || null,
        webhookUrl: req.body.webhookUrl || null,
        isConnected: req.body.isConnected || false,
        lastConnectionAt: req.body.lastConnectionAt || null,
      };
      
      // Validate the complete data
      const validatedData = insertWhatsappInstanceSchema.parse(instanceData);
      
      // Create instance in Evolution API using global API key
      try {
        const evolutionApi = getEvolutionApi();
        const createResponse = await evolutionApi.createInstance({
          instanceName: validatedData.instanceId!,
          integration: "WHATSAPP-BAILEYS",
          webhook_url: validatedData.webhookUrl || undefined,
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
          apiKey: typeof instanceApiKey === 'string' ? instanceApiKey : undefined,
          isConnected: false
        });

        console.log(`✅ Created instance: ${instanceData.instanceId} with API key: ${typeof instanceApiKey === 'string' ? instanceApiKey.substring(0, 8) + '...' : 'none'}`);
        
        res.status(201).json(instance);
      } catch (evolutionError: any) {
        console.error("Evolution API creation failed:", evolutionError);
        
        // Fall back to creating instance without Evolution API
        const instance = await storage.createWhatsappInstance({
          ...instanceData,
          isConnected: false
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

  // Get all WhatsApp instances for a user
  app.get("/api/whatsapp/instances/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const instances = await storage.getWhatsappInstances(userId);
      
      // Transform instances to include computed fields for frontend compatibility
      const transformedInstances = instances.map(instance => ({
        instanceId: instance.instanceId,
        displayName: instance.displayName,
        ownerJid: instance.ownerJid,
        clientId: instance.clientId,
        apiKey: instance.apiKey,
        webhookUrl: instance.webhookUrl,
        isConnected: instance.isConnected,
        lastConnectionAt: instance.lastConnectionAt?.toISOString(),
        phoneNumber: instance.ownerJid ? instance.ownerJid.replace('@s.whatsapp.net', '') : undefined,
        profileName: undefined, // Will be populated by profile endpoint
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString()
      }));
      
      res.json(transformedInstances);
    } catch (error) {
      console.error("Failed to fetch WhatsApp instances:", error);
      res.status(500).json({ error: "Failed to fetch instances" });
    }
  });

  app.put("/api/whatsapp/instances/:id", async (req, res) => {
    try {
      const updateData = req.body;
      const instance = await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, updateData);
      
      // Refresh the Evolution API bridge for this instance
      const oldInstance = await storage.getWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id);
      if (oldInstance) {
        // Note: Webhook-based system - no instance refresh needed
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
      const instance = await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, updateData);
      res.json(instance);
    } catch (error) {
      res.status(400).json({ error: "Failed to update instance" });
    }
  });

  app.delete("/api/whatsapp/instances/:id", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      console.log(`🗑️ Deleting instance: ${instance.instanceId} (${instance.instanceId})`);

      // Remove the Evolution WebSocket bridge first
      // Note: Webhook-based system - no bridge removal needed

      // Delete the instance from Evolution API if we have an instance API key
      if (instance.apiKey) {
        try {
          const instanceEvolutionApi = getInstanceEvolutionApi(instance.apiKey);
          await instanceEvolutionApi.deleteInstance(instance.instanceId);
          console.log(`✅ Instance ${instance.instanceId} deleted from Evolution API`);
        } catch (evolutionError: any) {
          console.error(`❌ Failed to delete instance from Evolution API:`, evolutionError);
          // Continue with database deletion even if Evolution API fails
        }
      } else if (instance.instanceId) {
        try {
          // Fallback to global API key if no instance-specific key
          const globalEvolutionApi = getEvolutionApi();
          await globalEvolutionApi.deleteInstance(instance.instanceId);
          console.log(`✅ Instance ${instance.instanceId} deleted from Evolution API (global key)`);
        } catch (evolutionError: any) {
          console.error(`❌ Failed to delete instance from Evolution API with global key:`, evolutionError);
        }
      }

      // Delete from database
      await storage.deleteWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id);
      console.log(`✅ Instance ${instance.instanceId} deleted from database`);

      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete instance:", error);
      res.status(400).json({ error: "Failed to delete instance" });
    }
  });

  app.get("/api/whatsapp/instances/:id/status", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }
      
      // Get real-time status and QR code using HTTP polling
      try {
        let qrCodeData = null;
        let connectionState = null;
        
        if (instance.apiKey) {
          // Use instance-specific API key for authenticated requests
          const instanceApi = getInstanceEvolutionApi(instance.apiKey);
          
          // Get connection state
          connectionState = await instanceApi.getConnectionState(instance.instanceId);
          console.log(`📊 Connection state for ${instance.instanceId}:`, connectionState.instance.state);
          
          // Try to get QR code if connecting
          if (connectionState.instance.state === 'connecting') {
            try {
              qrCodeData = await instanceApi.getQRCode(instance.instanceId);
              console.log(`📱 QR Code retrieved for ${instance.instanceId}:`, qrCodeData ? 'Available' : 'Not available');
            } catch (qrError: any) {
              console.log(`⚠️ QR Code not ready for ${instance.instanceId}:`, qrError.message);
            }
          }
        } else {
          // Fall back to global API
          const evolutionApi = getEvolutionApi();
          connectionState = await evolutionApi.getConnectionState(instance.instanceId);
          
          if (connectionState.instance.state === 'connecting') {
            try {
              qrCodeData = await evolutionApi.getQRCode(instance.instanceId);
            } catch (qrError: any) {
              console.log(`⚠️ QR Code not ready for ${instance.instanceId}:`, qrError.message);
            }
          }
        }
        
        // Map Evolution API status to our status
        const isConnected = connectionState.instance.state === 'open';
        
        // Update database if status changed
        if (isConnected !== instance.isConnected) {
          await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, {
            isConnected: isConnected
          });
          console.log(`📱 Updated ${instance.instanceId} status: ${instance.isConnected} -> ${isConnected}`);
        }
        
        res.json({
          instance: {
            instanceId: instance.instanceId,
            name: instance.instanceId,
            status: connectionState.instance.state
          },
          qrCode: qrCodeData || connectionState.qrcode,
          evolutionStatus: {
            status: connectionState.instance.state,
            qrcode: qrCodeData || connectionState.qrcode
          }
        });
      } catch (apiError: any) {
        console.error(`❌ Evolution API error for ${instance.instanceId}:`, apiError.message);
        // Fall back to database status if API is unavailable
        res.json({
          instance: {
            instanceId: instance.instanceId,
            name: instance.instanceId,
            status: instance.isConnected ? 'open' : 'close'
          },
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
      const instance = await storage.getWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      // Update instance status to connecting
      await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, {
        isConnected: false
      });

      try {
        const evolutionApi = getEvolutionApi();
        
        // Create/ensure instance exists in Evolution API
        let instanceApiKey = instance.apiKey;
        
        if (!instanceApiKey) {
          try {
            console.log(`Creating new instance in Evolution API: ${instance.instanceId}`);
            const createResponse = await evolutionApi.createInstance({
              instanceName: instance.instanceId,
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
              await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, {
                apiKey: instanceApiKey
              });
              console.log(`✅ Created and stored API key for instance: ${instance.instanceId}`);
            } else {
              throw new Error("No API key returned from instance creation");
            }
          } catch (createError: any) {
            console.error(`Failed to create instance ${instance.instanceId}:`, createError.message);
            return res.status(500).json({
              success: false,
              message: `Failed to create instance: ${createError.message}`,
              needsConfiguration: true
            });
          }
        }
        
        // Now connect the instance and ensure it's ready
        try {
          await evolutionApi.connectInstance(instance.instanceId);
          console.log(`✅ Instance connection initiated: ${instance.instanceId}`);
          
          // Wait a moment for instance to initialize, then try to get QR code
          setTimeout(async () => {
            try {
              const qrCode = await evolutionApi.getQRCode(instance.instanceId);
              console.log(`📱 Initial QR Code generated for ${instance.instanceId}`);
            } catch (qrError: any) {
              console.log(`⚠️ QR Code not immediately available for ${instance.instanceId}: ${qrError.message}`);
            }
          }, 2000);
          
        } catch (connectError: any) {
          console.log(`Connection attempt for ${instance.instanceId}:`, connectError.message);
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
      const instance = await storage.getWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      try {
        // Ensure instance has API key, create if needed
        let instanceApiKey = instance.apiKey;
        
        if (!instanceApiKey) {
          console.log(`No API key found for instance ${instance.instanceId}, retrieving from Evolution API`);
          try {
            const evolutionApi = getEvolutionApi();
            
            // Try to get existing instance info first
            try {
              const instanceInfo = await evolutionApi.getInstanceInfo(instance.instanceId);
              if (instanceInfo.hash?.apikey) {
                instanceApiKey = instanceInfo.hash.apikey;
                await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, {
                  apiKey: instanceApiKey
                });
                console.log(`✅ Retrieved and stored API key for existing instance: ${instance.instanceId}`);
              }
            } catch (getError: any) {
              // Instance doesn't exist, try to create it
              console.log(`Instance ${instance.instanceId} not found, creating new instance`);
              const createResponse = await evolutionApi.createInstance({
                instanceName: instance.instanceId,
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
                await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, {
                  apiKey: instanceApiKey
                });
                console.log(`✅ Created instance and stored API key: ${instance.instanceId}`);
              }
            }

            if (!instanceApiKey) {
              throw new Error("Could not obtain API key for instance");
            }
          } catch (apiError: any) {
            console.error(`Failed to get/create instance ${instance.instanceId}:`, apiError.message);
            return res.status(500).json({
              qrCode: null,
              status: "error",
              message: `Failed to setup instance: ${apiError.message}`
            });
          }
        }

        // Use instance-specific API key
        const evolutionApi = getInstanceEvolutionApi(instanceApiKey);
        
        console.log(`Fetching QR code for instance: ${instance.instanceId} with API key: ${instanceApiKey}`);
        
        // Try to get QR code by connecting to the instance
        try {
          const qrResponse = await evolutionApi.getQRCode(instance.instanceId);
          console.log('QR response received:', Object.keys(qrResponse));
          
          if (qrResponse.base64) {
            await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, {
              isConnected: false
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
          const connectionState = await evolutionApi.getConnectionState(instance.instanceId);
          console.log('Connection state:', connectionState);
          
          if (connectionState.instance.state === 'open') {
            await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, {
              isConnected: true
            });
            return res.json({
              qrCode: null,
              status: "connected",
              message: "Instance is already connected"
            });
          }
          
          if (connectionState.qrcode?.base64) {
            await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, {
              isConnected: false
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

  // Manual status sync endpoint
  // Get all instance statuses for webhook-based system
  app.get('/api/whatsapp/instances/status', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const instances = await db.select().from(whatsappInstances);
      const statuses = instances.map(instance => ({
        instanceId: instance.instanceId,
        instanceName: instance.displayName,
        phoneNumber: instance.ownerJid || '',
        status: instance.isConnected ? 'connected' : 'disconnected',
        webhookConfigured: !!instance.webhookUrl,
        lastConnected: instance.lastConnectionAt,
        connectionState: instance.isConnected ? 'connected' : 'disconnected'
      }));
      res.json(statuses);
    } catch (error) {
      console.error('Error fetching instance statuses:', error);
      res.status(500).json({ error: 'Failed to fetch instance statuses' });
    }
  });

  app.post('/api/whatsapp/instances/:instanceId/sync-status', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const { instanceId } = req.params;
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Use default user ID for now

      console.log(`🔄 Manual status sync requested for ${instanceId}`);

      // Get current status from Evolution API
      const connectionState = await getEvolutionApi().getConnectionState(instanceId);
      console.log(`📊 Evolution API connection state for ${instanceId}:`, connectionState.instance.state);

      let dbStatus = 'disconnected';
      let connectionData: any = { state: connectionState.instance.state };

      if (connectionState.instance.state === 'open') {
        dbStatus = 'connected';
        // Get additional instance info for connected state
        try {
          const instanceInfo = await getEvolutionApi().getInstanceInfo(instanceId);
          if (instanceInfo.instance) {
            connectionData.ownerJid = instanceInfo.instance.owner || null;
          }
        } catch (infoError) {
          console.log('⚠️ Could not get instance info:', infoError);
        }
      } else if (connectionState.instance.state === 'connecting') {
        dbStatus = 'connecting';
      }

      // Update database status
      const updatedInstance = await storage.updateWhatsappInstanceStatus(instanceId, dbStatus, connectionData);

      if (updatedInstance) {
        console.log(`✅ Manual status sync successful for ${instanceId}: ${dbStatus}`);
        console.log(`✅ Updated instance data:`, JSON.stringify(updatedInstance, null, 2));
        res.json({ success: true, status: dbStatus, instance: updatedInstance });
      } else {
        console.log(`❌ Manual status sync failed for ${instanceId} - instance not found in database`);
        res.status(404).json({ success: false, error: 'Instance not found' });
      }
    } catch (error) {
      console.error('❌ Manual status sync error:', error);
      res.status(500).json({ success: false, error: 'Status sync failed' });
    }
  });

  // Get message updates for a specific message
  app.get('/api/whatsapp/messages/:messageId/updates', async (req: Request & { user?: { id: string } }, res: Response) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { messageId } = req.params;
      const { instanceId } = req.query;

      if (!instanceId || typeof instanceId !== 'string') {
        return res.status(400).json({ error: 'Instance ID is required' });
      }

      const updates = await storage.getWhatsappMessageUpdates(req.user.id, instanceId, messageId);
      res.json(updates);
    } catch (error) {
      console.error('Error fetching message updates:', error);
      res.status(500).json({ error: 'Failed to fetch message updates' });
    }
  });

  // Get all messages for an instance with pagination
  app.get('/api/whatsapp/messages/all/:instanceId', async (req: Request & { user?: { id: string } }, res: Response) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { instanceId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const messages = await storage.getAllWhatsappMessagesForInstance(req.user.id, instanceId, limit);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching all messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Get message update analytics for an instance
  app.get('/api/whatsapp/message-updates/analytics/:instanceId', async (req: Request & { user?: { id: string } }, res: Response) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { instanceId } = req.params;
      
      // Get all message updates for this instance
      const messages = await storage.getAllWhatsappMessagesForInstance(req.user.id, instanceId, 1000);
      const allUpdates = [];
      
      for (const message of messages) {
        const updates = await storage.getWhatsappMessageUpdates(req.user.id, instanceId, message.messageId);
        allUpdates.push(...updates);
      }
      
      res.json(allUpdates);
    } catch (error) {
      console.error('Error fetching update analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // WhatsApp profile endpoint
  app.get("/api/whatsapp/instances/:id/profile", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      if (!instance.apiKey) {
        return res.status(400).json({ error: "Instance not configured" });
      }

      try {
        const evolutionApi = getInstanceEvolutionApi(instance.apiKey);
        
        // Try multiple approaches to get phone number
        let profileData = null;
        
        try {
          // First try: Get instance info which might contain owner details
          const instanceInfo = await evolutionApi.getInstanceInfo(instance.instanceId);
          console.log(`📱 Instance info for ${instance.instanceId}:`, instanceInfo);
          
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
            const contacts = await evolutionApi.fetchContacts(instance.instanceId);
            console.log(`📱 Contacts for ${instance.instanceId}:`, contacts);
            
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
              phoneNumber: instance.ownerJid?.split('@')[0] || null,
              profileName: null,
              instanceName: instance.instanceId,
              status: 'connected'
            };
          }
        }
        
        console.log(`📱 Final profile data for ${instance.instanceId}:`, profileData);
        
        // Update database with any phone number we found
        if (profileData?.phoneNumber) {
          await storage.updateWhatsappInstance('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', req.params.id, {
            ownerJid: `${profileData.phoneNumber}@s.whatsapp.net`
          });
        }
        
        if (!profileData) {
          profileData = { error: "No profile data available" };
        }
        
        res.json(profileData);
      } catch (profileError: any) {
        console.error(`Failed to get profile for ${instance.instanceId}:`, profileError);
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

  // Optimized WhatsApp conversations endpoint with latest messages
  app.get("/api/whatsapp/conversations/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      
      // Get conversations with latest messages in a single optimized query
      const conversationsWithMessages = await storage.getConversationsWithLatestMessages(userId);
      
      console.log(`📱 Found ${conversationsWithMessages.length} conversations with latest messages`);
      
      res.json(conversationsWithMessages);
    } catch (error) {
      console.error('Error fetching optimized conversations:', error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  app.get("/api/whatsapp/conversation/:id", async (req, res) => {
    try {
      const userId = req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      
      const conversation = await storage.getWhatsappChat(userId, "", req.params.id);
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
      const conversationData = insertWhatsappChatSchema.parse(req.body);
      const conversation = await storage.createWhatsappChat(conversationData);
      res.status(201).json(conversation);
    } catch (error) {
      res.status(400).json({ error: "Invalid conversation data" });
    }
  });

  // Get WhatsApp messages for a specific instance (all messages) or specific chat
  app.get("/api/whatsapp/messages/:instanceId", async (req, res) => {
    try {
      const userId = req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const { instanceId } = req.params;
      const { chatId, limit = '50' } = req.query;
      const limitNum = parseInt(limit as string, 10);
      
      if (chatId) {
        // Get messages for a specific chat
        const messages = await storage.getWhatsappMessages(userId, instanceId, chatId as string, limitNum);
        res.json(messages);
      } else {
        // Get all messages for the instance - need to create a new method for this
        const messages = await storage.getAllWhatsappMessagesForInstance(userId, instanceId, limitNum);
        res.json(messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  app.post("/api/whatsapp/messages", async (req, res) => {
    try {
      const messageData = insertWhatsappMessageSchema.parse(req.body);
      
      // If this is an outgoing message, send it via Evolution API
      if (messageData.fromMe && messageData.instanceId && messageData.chatId) {
        try {
          // Evolution API message sending will be implemented via webhook response
          console.log('Message will be sent via Evolution API webhook response');
          // Note: deliveryStatus field will be handled separately in message updates
        } catch (evolError) {
          console.error('Failed to send via Evolution API:', evolError);
          // Note: error status will be handled separately in message updates
        }
      }
      
      const message = await storage.createWhatsappMessage(messageData);
      
      // Real-time updates handled via webhook polling system
      
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ error: "Invalid message data" });
    }
  });

  // Sync instance status from Evolution API
  app.post("/api/whatsapp/instances/:instanceId/sync-status", async (req, res) => {
    try {
      const { instanceId } = req.params;
      
      // Get current status from Evolution API
      const instanceInfo = await getEvolutionApi().getAllInstances();
      const matchingInstance = instanceInfo.find((instance: any) => 
        instance.instance.instanceName === instanceId
      );

      if (!matchingInstance) {
        return res.status(404).json({ error: "Instance not found in Evolution API" });
      }

      const evolutionStatus = matchingInstance.instance.status;
      const connectionData = {
        ownerJid: matchingInstance.instance.owner,
        state: evolutionStatus
      };

      // Update database status
      const status = evolutionStatus === 'open' ? 'connected' : evolutionStatus;
      await storage.updateWhatsappInstanceStatus(instanceId, status, connectionData);

      res.json({ 
        success: true, 
        status, 
        evolutionStatus,
        ownerJid: connectionData.ownerJid 
      });
    } catch (error) {
      console.error('Error syncing instance status:', error);
      res.status(500).json({ error: "Failed to sync instance status" });
    }
  });

  // Get individual WhatsApp message content (new endpoint to avoid caching)
  app.get("/api/whatsapp/message-content", async (req, res) => {
    try {
      const { messageId, instanceId } = req.query;
      const userId = req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      
      if (!messageId || !instanceId) {
        return res.status(400).json({ error: "messageId and instanceId are required" });
      }
      
      // Direct database query to get message content
      const result = await storage.getWhatsappMessage(userId, instanceId as string, messageId as string);
      
      if (!result) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Detect if this is a group chat
      const isGroupChat = result.chatId && result.chatId.includes('@g.us');
      
      // Look up sender's name and chat name
      let senderName = null;
      let participantName = null;
      let chatName = null;
      
      // For group messages, extract participant info from rawApiPayload
      if (isGroupChat && result.rawApiPayload) {
        const payload = result.rawApiPayload as any;
        if (payload.key && payload.key.participant) {
          const participantJid = payload.key.participant;
          
          // Try to get participant name from contacts
          try {
            const participantContact = await storage.getWhatsappContact(userId, instanceId as string, participantJid);
            if (participantContact && (participantContact.pushName || participantContact.verifiedName)) {
              participantName = participantContact.verifiedName || participantContact.pushName;
            }
          } catch (contactError) {
            console.log('Could not fetch contact for participant:', participantJid);
          }
          
          // If no contact found, try to extract from raw message payload
          if (!participantName && payload.pushName) {
            participantName = payload.pushName;
          }
          
          // Fallback to formatted phone number
          if (!participantName) {
            const phoneNumber = participantJid.split('@')[0];
            participantName = `+${phoneNumber}`;
          }
        }
      }
      
      // For non-group messages, get sender name
      if (!isGroupChat && result.senderJid) {
        try {
          const contact = await storage.getWhatsappContact(userId, instanceId as string, result.senderJid);
          if (contact && (contact.pushName || contact.verifiedName)) {
            senderName = contact.verifiedName || contact.pushName;
          }
        } catch (contactError) {
          console.log('Could not fetch contact for sender:', result.senderJid);
        }
        
        // If no contact found, try to extract from raw message payload
        if (!senderName && result.rawApiPayload) {
          const payload = result.rawApiPayload as any;
          if (payload.pushName) {
            senderName = payload.pushName;
          }
        }
      }
      
      // Look up chat name (for personal chats use contact name, for groups use group name)
      if (result.chatId) {
        try {
          if (isGroupChat) {
            // Group chat - try to get group name from whatsapp.groups table
            try {
              const groupResult = await pool.query(
                'SELECT subject FROM whatsapp.groups WHERE group_jid = $1 LIMIT 1',
                [result.chatId]
              );
              
              if (groupResult.rows.length > 0 && groupResult.rows[0].subject) {
                chatName = groupResult.rows[0].subject;
              } else {
                // Fallback: try whatsapp_conversations table
                const conversationResult = await pool.query(
                  'SELECT chat_name FROM whatsapp_conversations WHERE remote_jid = $1 AND user_id = $2 LIMIT 1',
                  [result.chatId, userId]
                );
                
                if (conversationResult.rows.length > 0 && conversationResult.rows[0].chat_name) {
                  chatName = conversationResult.rows[0].chat_name;
                } else {
                  // Final fallback: extract group name from raw API payload if available
                  const payload = result.rawApiPayload as any;
                  if (payload && payload.message && payload.message.messageContextInfo && payload.message.messageContextInfo.groupSubject) {
                    chatName = payload.message.messageContextInfo.groupSubject;
                  } else {
                    chatName = 'Group Chat';
                  }
                }
              }
            } catch (sqlError) {
              chatName = 'Group Chat';
            }
          } else {
            // Personal chat - use contact name
            const chatContact = await storage.getWhatsappContact(userId, instanceId as string, result.chatId);
            if (chatContact && (chatContact.pushName || chatContact.verifiedName)) {
              chatName = chatContact.verifiedName || chatContact.pushName;
            } else {
              // Extract phone number and format it nicely
              const phoneNumber = result.chatId.split('@')[0];
              chatName = `+${phoneNumber}`;
            }
          }
        } catch (chatError) {
          // Fallback formatting
          if (isGroupChat) {
            chatName = 'Group Chat';
          } else {
            const phoneNumber = result.chatId.split('@')[0];
            chatName = `+${phoneNumber}`;
          }
        }
      }
      
      // Look up instance display name
      let instanceDisplayName = null;
      try {
        // Query the instance directly using raw SQL since Drizzle schema might be mismatched
        const instanceResult = await pool.query(
          'SELECT display_name FROM whatsapp_instances WHERE user_id = $1 AND instance_name = $2 LIMIT 1',
          [userId, instanceId]
        );
        
        if (instanceResult.rows.length > 0 && instanceResult.rows[0].display_name) {
          instanceDisplayName = instanceResult.rows[0].display_name;
        }
      } catch (instanceError) {
        console.log('Could not fetch instance info:', instanceError);
      }
      
      // Add enhanced data to result
      const enhancedResult = {
        ...result,
        isGroupChat: isGroupChat,
        senderName: result.fromMe ? "You" : (senderName || result.senderJid?.split('@')[0] || 'Unknown sender'),
        participantName: participantName, // For group messages, this is who sent the message
        chatName: chatName || 'Unknown Chat',
        instanceDisplayName: instanceDisplayName || instanceId
      };
      
      // Set no-cache headers
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(enhancedResult);
    } catch (error) {
      console.error('Error fetching message content:', error);
      res.status(500).json({ error: "Failed to fetch message content" });
    }
  });

  // Get individual WhatsApp message
  app.get("/api/whatsapp/messages/single", async (req, res) => {
    try {
      const { messageId, instanceId } = req.query;
      const userId = req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      
      console.log('API: Received params:', { messageId, instanceId, userId });
      
      if (!messageId || !instanceId) {
        return res.status(400).json({ error: "messageId and instanceId are required" });
      }
      
      // Use storage function to get message
      const result = await storage.getWhatsappMessage(userId, instanceId as string, messageId as string);
      
      console.log('API: Storage result:', result);
      
      if (!result) {
        console.log('API: No result found, returning 404');
        return res.status(404).json({ error: "Message not found" });
      }
      
      console.log('API: Returning result:', result);
      res.json(result);
    } catch (error) {
      console.error('Error fetching individual message:', error);
      res.status(500).json({ error: "Failed to fetch message" });
    }
  });

  // Get chat messages for message thread
  app.get("/api/whatsapp/chat-messages", async (req, res) => {
    try {
      const { chatId, instanceId, limit = 50 } = req.query;
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      
      if (!chatId || !instanceId) {
        return res.status(400).json({ error: "chatId and instanceId are required" });
      }
      
      // Query messages using direct pool query to avoid schema issues
      const queryResult = await pool.query(`
        SELECT 
          message_id as "messageId",
          instance_id as "instanceId", 
          chat_id as "chatId",
          sender_jid as "senderJid",
          from_me as "fromMe",
          message_type as "messageType",
          content,
          timestamp,
          quoted_message_id as "quotedMessageId",
          raw_api_payload as "rawApiPayload"
        FROM whatsapp.messages 
        WHERE chat_id = $1 AND instance_id = $2
        ORDER BY timestamp DESC 
        LIMIT $3
      `, [chatId, instanceId, parseInt(limit as string)]);
      
      res.json(queryResult.rows);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: "Failed to fetch chat messages" });
    }
  });

  // Get message replies - only messages that directly quote a specific message
  app.get("/api/whatsapp/message-replies", async (req, res) => {
    try {
      const { originalMessageId, instanceId } = req.query;
      const userId = req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      
      if (!originalMessageId || !instanceId) {
        return res.status(400).json({ error: "Missing originalMessageId or instanceId" });
      }

      // Query replies using direct pool query
      const queryResult = await pool.query(`
        SELECT 
          message_id as "messageId",
          instance_id as "instanceId", 
          chat_id as "chatId",
          sender_jid as "senderJid",
          from_me as "fromMe",
          message_type as "messageType",
          content,
          timestamp,
          quoted_message_id as "quotedMessageId"
        FROM whatsapp.messages 
        WHERE instance_id = $1 
        AND (message_id = $2 OR quoted_message_id = $2)
        ORDER BY timestamp ASC
      `, [instanceId, originalMessageId]);
      
      res.json(queryResult.rows);
    } catch (error) {
      console.error('Error fetching message replies:', error);
      res.status(500).json({ error: "Failed to fetch message replies" });
    }
  });

  // Get tasks linked to a contact
  app.get("/api/contacts/tasks", async (req, res) => {
    try {
      const { contactJid, userId } = req.query;
      
      if (!contactJid || !userId) {
        return res.status(400).json({ error: "Missing contactJid or userId" });
      }

      // Query tasks linked to this contact via related_chat_jid or contact metadata
      const tasksQuery = await pool.query(`
        SELECT 
          id,
          title,
          description,
          status,
          priority,
          due_date,
          created_at,
          updated_at,
          metadata
        FROM tasks 
        WHERE user_id = $1::uuid 
        AND (
          metadata->>'related_chat_jid' = $2::text 
          OR metadata->>'contact_jid' = $2::text
          OR contact_id IN (
            SELECT contact_id FROM contacts 
            WHERE user_id = $1::uuid 
            AND (phone = $3::text OR metadata->>'jid' = $2::text)
          )
        )
        ORDER BY 
          CASE WHEN status = 'completed' THEN 1 ELSE 0 END,
          due_date ASC NULLS LAST,
          created_at DESC
      `, [userId, contactJid, (contactJid as string).split('@')[0]]);

      res.json(tasksQuery.rows);
    } catch (error) {
      console.error('Error fetching contact tasks:', error);
      res.status(500).json({ error: "Failed to fetch contact tasks" });
    }
  });

  // Get calendar events linked to a contact
  app.get("/api/contacts/events", async (req, res) => {
    try {
      const { contactJid, userId } = req.query;
      
      if (!contactJid || !userId) {
        return res.status(400).json({ error: "Missing contactJid or userId" });
      }

      // Query upcoming calendar events linked to this contact
      const phoneNumber = (contactJid as string).split('@')[0];
      const emailGuess = (contactJid as string).replace('@s.whatsapp.net', '@gmail.com');
      
      const eventsQuery = await pool.query(`
        SELECT DISTINCT
          ce.event_id,
          ce.title,
          ce.description,
          ce.start_time,
          ce.end_time,
          ce.is_all_day,
          ce.location,
          ce.meet_link,
          ce.status
        FROM calendar.events ce
        JOIN calendar.calendars cc ON ce.calendar_id = cc.calendar_id
        JOIN calendar.accounts ca ON cc.account_id = ca.account_id
        LEFT JOIN calendar.attendees cat ON ce.event_id = cat.event_id
        WHERE ca.user_id = $1::uuid
        AND ce.start_time >= NOW()
        AND (
          ce.description ILIKE '%' || $2::text || '%'
          OR cat.email = $3::text
          OR ce.title ILIKE '%' || $2::text || '%'
        )
        ORDER BY ce.start_time ASC
        LIMIT 10
      `, [userId, phoneNumber, emailGuess]);

      res.json(eventsQuery.rows);
    } catch (error) {
      console.error('Error fetching contact events:', error);
      res.status(500).json({ error: "Failed to fetch contact events" });
    }
  });

  // Get message reactions
  app.get("/api/whatsapp/message-reactions", async (req, res) => {
    try {
      const { messageId, instanceId } = req.query;
      
      if (!messageId || !instanceId) {
        return res.status(400).json({ error: "Missing messageId or instanceId" });
      }

      const reactionsQuery = await pool.query(`
        SELECT 
          reaction_id as "reactionId",
          message_id as "messageId",
          reactor_jid as "senderJid",
          reaction_emoji as "reaction",
          from_me as "fromMe",
          timestamp
        FROM whatsapp.message_reactions 
        WHERE message_id = $1 AND instance_id = $2
        ORDER BY timestamp ASC
      `, [messageId, instanceId]);

      res.json(reactionsQuery.rows);
    } catch (error) {
      console.error('Error fetching message reactions:', error);
      res.status(500).json({ error: "Failed to fetch message reactions" });
    }
  });

  // Add reaction to message
  app.post("/api/whatsapp/add-reaction", async (req, res) => {
    try {
      const { messageId, instanceId, chatId, reaction } = req.body;
      
      if (!messageId || !instanceId || !chatId || !reaction) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get instance details to find API key
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user for now
      const instances = await storage.getWhatsappInstances(userId);
      const instance = instances.find(i => i.instanceId === instanceId);

      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      // Send reaction via Evolution API
      const evolutionResponse = await fetch(`${process.env.EVOLUTION_API_URL}/message/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instance.apiKey || process.env.EVOLUTION_API_KEY || ''
        },
        body: JSON.stringify({
          remoteJid: chatId,
          key: {
            id: messageId,
            remoteJid: chatId
          },
          reaction: reaction
        })
      });

      if (!evolutionResponse.ok) {
        const errorText = await evolutionResponse.text();
        throw new Error(`Evolution API error: ${errorText}`);
      }

      const result = await evolutionResponse.json();
      res.json(result);
    } catch (error) {
      console.error('Error adding reaction:', error);
      res.status(500).json({ error: "Failed to add reaction" });
    }
  });

  // Create task from message
  app.post("/api/whatsapp/create-task-from-message", async (req, res) => {
    try {
      const { messageId, messageContent, chatId, instanceId } = req.body;
      
      if (!messageId || !messageContent || !chatId || !instanceId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user for now

      // Get contact name from the chat
      const contactQuery = await pool.query(`
        SELECT name, phone FROM whatsapp.contacts 
        WHERE chat_jid = $1 AND instance_id = $2
        LIMIT 1
      `, [chatId, instanceId]);

      const contactName = contactQuery.rows[0]?.name || chatId.split('@')[0];

      // Create intelligent task from message content
      const taskTitle = messageContent.length > 50 
        ? messageContent.substring(0, 47) + '...' 
        : messageContent;

      const taskDescription = `Task created from WhatsApp message:
"${messageContent}"

Contact: ${contactName}
Message ID: ${messageId}`;

      // Insert task into database
      const taskQuery = await pool.query(`
        INSERT INTO tasks (
          id,
          user_id,
          title,
          description,
          status,
          priority,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          $1::uuid,
          $2,
          $3,
          'pending',
          'medium',
          $4::jsonb,
          NOW(),
          NOW()
        ) RETURNING *
      `, [
        userId,
        taskTitle,
        taskDescription,
        JSON.stringify({
          source: 'whatsapp_message',
          message_id: messageId,
          chat_id: chatId,
          instance_id: instanceId,
          related_chat_jid: chatId,
          contact_name: contactName
        })
      ]);

      const task = taskQuery.rows[0];
      res.json({ 
        success: true, 
        task,
        message: `Task created: ${taskTitle}`
      });
    } catch (error) {
      console.error('Error creating task from message:', error);
      res.status(500).json({ error: "Failed to create task from message" });
    }
  });

  // Send WhatsApp message
  app.post("/api/whatsapp/send-message", async (req, res) => {
    try {
      const { instanceId, chatId, message, quotedMessageId } = req.body;
      
      if (!instanceId || !chatId || !message) {
        return res.status(400).json({ error: "instanceId, chatId, and message are required" });
      }
      
      // Get instance details to find API key
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user for now
      const instances = await storage.getWhatsappInstances(userId);
      const instance = instances.find(i => i.instanceId === instanceId);
      
      if (!instance || !instance.apiKey) {
        return res.status(404).json({ error: "Instance not found or not configured" });
      }
      
      // Prepare message request
      const messageRequest: any = {
        number: chatId,
        text: message
      };

      // If this is a reply, add quoted message information
      if (quotedMessageId) {
        const originalMessage = await storage.getWhatsappMessage(userId, instanceId, quotedMessageId);
        if (originalMessage) {
          messageRequest.quoted = {
            key: {
              remoteJid: chatId,
              fromMe: originalMessage.fromMe || false,
              id: quotedMessageId
            },
            message: {
              conversation: originalMessage.content
            }
          };
        }
      }
      
      // Send message via Evolution API
      const evolutionApi = getInstanceEvolutionApi(instance.apiKey);
      const result = await evolutionApi.sendTextMessage(instanceId, messageRequest);
      
      // Save the sent message to database with fromMe: true
      if (result.key?.id) {
        try {
          const messageData = {
            messageId: result.key.id,
            instanceId: instanceId,
            chatId: chatId,
            senderJid: instance.ownerJid || `${instanceId}@s.whatsapp.net`,
            fromMe: true,
            messageType: 'text',
            content: message,
            timestamp: new Date(),
            quotedMessageId: quotedMessageId || null,
            rawApiPayload: result
          };
          
          await storage.createWhatsappMessage(messageData);
          console.log(`✅ Saved sent message: ${result.key.id}`);
        } catch (saveError) {
          console.error('Failed to save sent message:', saveError);
        }
      }
      
      res.json({ success: true, messageId: result.key?.id, result });
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      res.status(500).json({ 
        error: "Failed to send message", 
        message: error.message 
      });
    }
  });

  // Manual sync endpoint for group participants
  // Manual participant sync endpoint
  app.post('/api/whatsapp/groups/:instanceId/:groupJid/sync-participants', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const { instanceId, groupJid } = req.params;
      
      // Find the instance name for Evolution API calls
      const userId = req.user?.id || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const instances = await storage.getWhatsappInstances(userId);
      const instance = instances.find(inst => inst.instanceId === instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      // Trigger participant sync
      await syncGroupParticipants(instanceId, groupJid, instanceId);
      
      res.json({ message: 'Participant sync initiated', groupJid, instanceId });
    } catch (error) {
      console.error('Error syncing participants:', error);
      res.status(500).json({ error: 'Failed to sync participants' });
    }
  });

  // Sync all groups and participants from Evolution API
  app.post('/api/whatsapp/instances/:instanceId/sync-groups-complete', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const { instanceId } = req.params;
      const userId = req.user?.id || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';

      const instance = await storage.getWhatsappInstance(userId, instanceId);
      if (!instance || !instance.apiKey) {
        return res.status(404).json({ error: 'Instance not found or missing API key' });
      }

      console.log(`🔄 Starting complete group sync for instance: ${instanceId}`);

      // Use Evolution API to fetch all groups with participants
      const evolutionApi = getEvolutionApi();
      const headers = { 'apikey': instance.apiKey };
      
      try {
        // First, fetch all chats to get groups
        const chatsResponse = await fetch(`https://evolution-api-evolution-api.vuswn0.easypanel.host/chat/findAll/${instanceId}`, {
          method: 'GET',
          headers
        });

        if (!chatsResponse.ok) {
          throw new Error(`Failed to fetch chats: ${chatsResponse.status}`);
        }

        const chatsData = await chatsResponse.json();
        const groupChats = chatsData.filter((chat: any) => chat.id && chat.id.endsWith('@g.us'));

        console.log(`📱 Found ${groupChats.length} group chats to sync`);

        let syncedGroups = 0;
        let totalParticipants = 0;

        for (const chat of groupChats) {
          const groupJid = chat.id;
          
          try {
            // Create/update the chat record
            const chatData = {
              chatId: groupJid,
              instanceId: instanceId,
              type: 'group' as const,
              name: chat.name || 'Unknown Group',
              unreadCount: chat.unreadCount || 0,
              isPinned: false,
              isArchived: chat.archived || false,
              isMuted: chat.mute || false
            };

            await storage.createWhatsappChat(chatData);

            // Create/update the group record
            const groupData = {
              groupJid: groupJid,
              instanceId: instanceId,
              subject: chat.name || 'Unknown Group',
              description: null,
              ownerJid: null,
              creationTimestamp: new Date(),
              isLocked: false
            };

            await storage.createWhatsappGroup(groupData);

            // Fetch participants for this specific group
            const participantsResponse = await fetch(`${process.env.EVOLUTION_API_URL}/group/participants/${instanceId}?groupJid=${encodeURIComponent(groupJid)}`, {
              method: 'GET',
              headers
            });

            if (participantsResponse.ok) {
              const participantsData = await participantsResponse.json();
              
              if (participantsData && Array.isArray(participantsData.participants)) {
                for (const participant of participantsData.participants) {
                  const participantData = {
                    groupJid: groupJid,
                    instanceId: instanceId,
                    participantJid: participant.id || participant.jid,
                    isAdmin: participant.admin === 'admin' || participant.isAdmin || false,
                    isSuperAdmin: participant.admin === 'superadmin' || participant.isSuperAdmin || false
                  };

                  await storage.createWhatsappGroupParticipant(participantData);
                  totalParticipants++;
                }
                console.log(`✅ Synced ${participantsData.participants.length} participants for group: ${chat.name}`);
              }
            } else {
              console.log(`⚠️ Could not fetch participants for group: ${chat.name}`);
            }

            syncedGroups++;
          } catch (groupError) {
            console.error(`❌ Error syncing group ${groupJid}:`, groupError);
          }
        }

        res.json({
          success: true,
          message: `Synchronized ${syncedGroups} groups with ${totalParticipants} total participants`,
          syncedGroups,
          totalParticipants,
          totalGroups: groupChats.length
        });

      } catch (apiError) {
        console.error('❌ Error calling Evolution API:', apiError);
        res.status(500).json({ error: 'Failed to fetch data from Evolution API' });
      }
    } catch (error) {
      console.error('❌ Error in complete group sync:', error);
      res.status(500).json({ error: 'Failed to sync groups' });
    }
  });

  app.post('/api/whatsapp/instances/:instanceId/sync-participants', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const { instanceId } = req.params;
      const userId = req.user?.id || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';

      const instance = await storage.getWhatsappInstance(userId, instanceId);
      if (!instance || !instance.apiKey) {
        return res.status(404).json({ error: 'Instance not found or missing API key' });
      }

      const evolutionApi = getInstanceEvolutionApi(instance.apiKey);
      
      // Get all groups for this instance
      const groups = await storage.getWhatsappChats(userId, instanceId);
      const groupChats = groups.filter(chat => chat.type === 'group');
      
      let totalParticipants = 0;
      let syncedGroups = 0;
      
      for (const group of groupChats) {
        try {
          // Fetch participants from Evolution API
          const response: any = await evolutionApi.getGroupParticipants(instanceId, group.chatId);
          
          if (response.participants && Array.isArray(response.participants)) {
            for (const participant of response.participants) {
              const participantData = {
                groupJid: group.chatId,
                instanceId: instanceId,
                participantJid: participant.id,
                isAdmin: participant.admin === 'admin',
                isSuperAdmin: participant.admin === 'superadmin'
              };

              await storage.createWhatsappGroupParticipant(participantData);
              totalParticipants++;
            }
            syncedGroups++;
            console.log(`✅ Synced ${response.participants.length} participants for group ${group.chatId}`);
          }
        } catch (error) {
          console.error(`Failed to sync participants for group ${group.chatId}:`, error);
        }
      }

      res.json({ 
        success: true,
        message: `Synchronized ${totalParticipants} participants across ${syncedGroups} groups`,
        totalParticipants,
        syncedGroups,
        totalGroups: groupChats.length
      });
    } catch (error) {
      console.error('Error syncing participants:', error);
      res.status(500).json({ error: 'Failed to sync participants' });
    }
  });

  // Legacy routes removed to focus on WhatsApp functionality

  // Helper function for extracting quoted message references
  function extractQuotedMessageId(message: any): string | null {
    if (!message?.message) return null;

    // Check different message types for quoted message references
    const messageContent = message.message;

    // Extended text message (most common for replies)
    if (messageContent.extendedTextMessage?.contextInfo?.quotedMessage) {
      return messageContent.extendedTextMessage.contextInfo.stanzaId || 
             messageContent.extendedTextMessage.contextInfo.quotedMessage.key?.id || null;
    }

    // Regular text message with context
    if (messageContent.conversation && messageContent.contextInfo?.quotedMessage) {
      return messageContent.contextInfo.stanzaId || 
             messageContent.contextInfo.quotedMessage.key?.id || null;
    }

    // Image message with quoted content
    if (messageContent.imageMessage?.contextInfo?.quotedMessage) {
      return messageContent.imageMessage.contextInfo.stanzaId || 
             messageContent.imageMessage.contextInfo.quotedMessage.key?.id || null;
    }

    // Video message with quoted content
    if (messageContent.videoMessage?.contextInfo?.quotedMessage) {
      return messageContent.videoMessage.contextInfo.stanzaId || 
             messageContent.videoMessage.contextInfo.quotedMessage.key?.id || null;
    }

    // Audio message with quoted content
    if (messageContent.audioMessage?.contextInfo?.quotedMessage) {
      return messageContent.audioMessage.contextInfo.stanzaId || 
             messageContent.audioMessage.contextInfo.quotedMessage.key?.id || null;
    }

    // Document message with quoted content
    if (messageContent.documentMessage?.contextInfo?.quotedMessage) {
      return messageContent.documentMessage.contextInfo.stanzaId || 
             messageContent.documentMessage.contextInfo.quotedMessage.key?.id || null;
    }

    return null;
  }

  // Evolution API webhook endpoint
  app.post("/api/whatsapp/webhook/:instanceId", async (req, res) => {
    try {
      const { instanceId } = req.params;
      const eventData = req.body;

      console.log('🔔 Webhook received for instance:', instanceId, 'Event:', eventData.event);
      console.log('📨 Full webhook payload:', JSON.stringify(eventData, null, 2));

      // Handle different event types
      if (eventData.event === 'connection.update') {
        // Connection status changed
        const connectionData = eventData.data;
        console.log('📱 Connection update for instance:', instanceId, 'Connection data:', JSON.stringify(connectionData, null, 2));
        
        // Update instance status in database
        if (connectionData.state === 'open') {
          const updatedInstance = await storage.updateWhatsappInstanceStatus(instanceId, 'connected', {
            ownerJid: connectionData.qr || connectionData.credentials?.me?.id || null,
            state: connectionData.state
          });
          console.log('✅ Instance status updated to connected:', updatedInstance ? 'SUCCESS' : 'FAILED');
          if (updatedInstance) {
            console.log('✅ Updated instance data:', JSON.stringify(updatedInstance, null, 2));
          }
        } else if (connectionData.state === 'close' || connectionData.state === 'connecting') {
          const updatedInstance = await storage.updateWhatsappInstanceStatus(instanceId, connectionData.state, connectionData);
          console.log('🔄 Instance status updated to:', connectionData.state, updatedInstance ? 'SUCCESS' : 'FAILED');
          if (updatedInstance) {
            console.log('🔄 Updated instance data:', JSON.stringify(updatedInstance, null, 2));
          }
        }
      } else if (eventData.event === 'messages.upsert') {
        // If receiving messages, instance must be connected - sync status
        console.log('📨 Received messages.upsert - checking if status needs sync for:', instanceId);
        try {
          const instanceStatus = await getEvolutionApi().getAllInstances();
          const matchingInstance = instanceStatus.find((instance: any) => 
            instance.instance.instanceName === instanceId
          );
          
          if (matchingInstance && matchingInstance.instance.status === 'open') {
            console.log('🔄 Auto-syncing status to connected for:', instanceId);
            await storage.updateWhatsappInstanceStatus(instanceId, 'connected', {
              ownerJid: matchingInstance.instance.owner,
              state: 'open'
            });
          }
        } catch (syncError) {
          console.log('⚠️ Status sync failed:', syncError);
        }
        
        await handleWebhookMessagesUpsert(instanceId, eventData.data);
      } else if (eventData.event === 'contacts.upsert') {
        await handleWebhookContactsUpsert(instanceId, eventData.data);
      } else if (eventData.event === 'chats.upsert') {
        await handleWebhookChatsUpsert(instanceId, eventData.data);
      } else if (eventData.event === 'group-participants.update' || eventData.event === 'GROUP_PARTICIPANTS_UPDATE') {
        await handleWebhookGroupParticipantsUpdate(instanceId, eventData.data);
      } else if (eventData.event === 'groups.upsert' || eventData.event === 'GROUPS_UPSERT') {
        await handleWebhookGroupsUpsert(instanceId, eventData.data);
      } else if (eventData.event === 'groups.update' || eventData.event === 'GROUP_UPDATE') {
        await handleWebhookGroupsUpsert(instanceId, eventData.data);
      } else if (eventData.event === 'message.reaction') {
        await handleWebhookMessageReaction(instanceId, eventData.data);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('❌ Webhook error:', error);
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

  // Get group information and participants
  // Serve media files
  app.get('/api/whatsapp/media/:instanceId/:messageId', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // await setRLSContext(req.user.id); // RLS context will be implemented
      
      const { instanceId, messageId } = req.params;
      
      // Get media information from database
      const [mediaInfo] = await db
        .select()
        .from(whatsappMessageMedia)
        .where(and(
          eq(whatsappMessageMedia.messageId, messageId),
          eq(whatsappMessageMedia.instanceId, instanceId)
        ));

      if (!mediaInfo) {
        return res.status(404).json({ error: 'Media not found' });
      }

      // Check if local file exists
      if (mediaInfo.fileLocalPath && fs.existsSync(mediaInfo.fileLocalPath)) {
        res.setHeader('Content-Type', mediaInfo.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${messageId}"`);
        return res.sendFile(path.resolve(mediaInfo.fileLocalPath));
      }

      // Fallback to redirect to original URL if local file not available
      if (mediaInfo.fileUrl) {
        return res.redirect(mediaInfo.fileUrl);
      }

      res.status(404).json({ error: 'Media file not available' });
    } catch (error) {
      console.error('Error serving media:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get message edit history
  app.get('/api/whatsapp/messages/:messageId/edit-history', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { messageId } = req.params;
      const { instanceId } = req.query;

      if (!instanceId) {
        return res.status(400).json({ error: 'Instance ID is required' });
      }

      const editHistory = await storage.getWhatsappMessageEditHistory(req.user.id, instanceId as string, messageId);
      res.json(editHistory);
    } catch (error) {
      console.error('Error fetching message edit history:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/whatsapp/groups/:instanceId/:groupJid", async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { instanceId, groupJid } = req.params;
      const decodedGroupJid = decodeURIComponent(groupJid);

      // Get group information
      const group = await storage.getWhatsappGroup(req.user.id, instanceId, decodedGroupJid);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Get group participants
      const participants = await storage.getWhatsappGroupParticipants(req.user.id, instanceId, decodedGroupJid);

      const groupInfo = {
        groupJid: group.groupJid,
        subject: group.subject,
        description: group.description,
        ownerJid: group.ownerJid,
        participants: participants,
        participantCount: participants.length
      };

      res.json(groupInfo);
    } catch (error) {
      console.error('Error fetching group info:', error);
      res.status(500).json({ error: "Failed to fetch group information" });
    }
  });

  // Force QR code generation for stuck instances
  app.post("/api/whatsapp/instances/:id/generate-qr", async (req, res) => {
    try {
      const instance = await storage.getWhatsappInstance("", req.params.id);
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      const evolutionApi = instance.apiKey 
        ? getInstanceEvolutionApi(instance.apiKey)
        : getEvolutionApi();

      // First restart the instance to clear any stuck state
      try {
        await evolutionApi.restartInstance(instance.instanceId);
        console.log(`Restarted instance: ${instance.instanceId}`);
        
        // Wait for restart to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (restartError: any) {
        console.log(`Restart failed for ${instance.instanceId}: ${restartError.message}`);
      }

      // Connect the instance
      try {
        await evolutionApi.connectInstance(instance.instanceId);
        console.log(`Connected instance: ${instance.instanceId}`);
        
        // Wait for connection to establish
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (connectError: any) {
        console.log(`Connect failed for ${instance.instanceId}: ${connectError.message}`);
      }

      // Try to get QR code
      try {
        const qrCode = await evolutionApi.getQRCode(instance.instanceId);
        console.log(`QR Code generated for ${instance.instanceId}`);
        
        res.json({
          success: true,
          qrCode: qrCode,
          message: "QR code generated successfully"
        });
      } catch (qrError: any) {
        console.error(`QR Code generation failed for ${instance.instanceId}:`, qrError.message);
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

  // =============================================================================
  // ACTIONS API ROUTES - Event Triggering and Automation
  // =============================================================================

  // Get all action rules for a user
  app.get('/api/actions/rules', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user ID
      const { workspaceId, spaceId } = req.query;

      const conditions = [eq(actionRules.userId, userId)];
      
      if (workspaceId) {
        conditions.push(eq(actionRules.workspaceId, workspaceId as string));
      }
      if (spaceId) {
        conditions.push(eq(actionRules.spaceId, parseInt(spaceId as string)));
      }

      const rules = await db
        .select()
        .from(actionRules)
        .where(and(...conditions))
        .orderBy(desc(actionRules.createdAt));
      res.json(rules);
    } catch (error) {
      console.error('Error fetching action rules:', error);
      res.status(500).json({ error: 'Failed to fetch action rules' });
    }
  });

  // Create a new action rule
  app.post('/api/actions/rules', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user ID
      const ruleData = insertActionRuleSchema.parse({
        ...req.body,
        userId
      });

      const [newRule] = await db.insert(actionRules).values(ruleData).returning();
      res.status(201).json(newRule);
    } catch (error) {
      console.error('Error creating action rule:', error);
      res.status(400).json({ error: 'Invalid action rule data' });
    }
  });

  // Update an action rule
  app.put('/api/actions/rules/:ruleId', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user ID
      const { ruleId } = req.params;
      const updateData = { ...req.body, updatedAt: new Date() };

      const [updatedRule] = await db
        .update(actionRules)
        .set(updateData)
        .where(and(eq(actionRules.ruleId, ruleId), eq(actionRules.userId, userId)))
        .returning();

      if (!updatedRule) {
        return res.status(404).json({ error: 'Action rule not found' });
      }

      res.json(updatedRule);
    } catch (error) {
      console.error('Error updating action rule:', error);
      res.status(500).json({ error: 'Failed to update action rule' });
    }
  });

  // Delete an action rule
  app.delete('/api/actions/rules/:ruleId', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user ID
      const { ruleId } = req.params;

      const [deletedRule] = await db
        .delete(actionRules)
        .where(and(eq(actionRules.ruleId, ruleId), eq(actionRules.userId, userId)))
        .returning();

      if (!deletedRule) {
        return res.status(404).json({ error: 'Action rule not found' });
      }

      res.json({ message: 'Action rule deleted successfully' });
    } catch (error) {
      console.error('Error deleting action rule:', error);
      res.status(500).json({ error: 'Failed to delete action rule' });
    }
  });

  // Toggle action rule active status
  app.patch('/api/actions/rules/:ruleId/toggle', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user ID
      const { ruleId } = req.params;

      const [currentRule] = await db
        .select()
        .from(actionRules)
        .where(and(eq(actionRules.ruleId, ruleId), eq(actionRules.userId, userId)));

      if (!currentRule) {
        return res.status(404).json({ error: 'Action rule not found' });
      }

      const [updatedRule] = await db
        .update(actionRules)
        .set({ 
          isActive: !currentRule.isActive,
          updatedAt: new Date()
        })
        .where(eq(actionRules.ruleId, ruleId))
        .returning();

      res.json(updatedRule);
    } catch (error) {
      console.error('Error toggling action rule:', error);
      res.status(500).json({ error: 'Failed to toggle action rule' });
    }
  });

  // Get action executions for a rule
  app.get('/api/actions/rules/:ruleId/executions', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user ID
      const { ruleId } = req.params;
      const { limit = '50', offset = '0' } = req.query;

      // Verify rule ownership
      const rule = await db
        .select()
        .from(actionRules)
        .where(and(eq(actionRules.ruleId, ruleId), eq(actionRules.userId, userId)))
        .limit(1);

      if (!rule.length) {
        return res.status(404).json({ error: 'Action rule not found' });
      }

      const executions = await db
        .select()
        .from(actionExecutions)
        .where(eq(actionExecutions.ruleId, ruleId))
        .orderBy(desc(actionExecutions.executedAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json(executions);
    } catch (error) {
      console.error('Error fetching action executions:', error);
      res.status(500).json({ error: 'Failed to fetch executions' });
    }
  });

  // Get WhatsApp instances from database for action rules
  app.get('/api/actions/whatsapp-instances', async (req: Request, res: Response) => {
    try {
      const instances = await db.execute(sql`
        SELECT 
          instance_id as "instanceId",
          display_name as "displayName", 
          is_connected as "isConnected",
          owner_jid as "ownerJid",
          created_at as "createdAt"
        FROM whatsapp.instances 
        ORDER BY created_at DESC
      `);

      const transformedInstances = instances.rows.map(instance => ({
        ...instance,
        phoneNumber: instance.ownerJid ? instance.ownerJid.replace('@s.whatsapp.net', '') : null
      }));

      res.json(transformedInstances);
    } catch (error) {
      console.error('Error fetching WhatsApp instances:', error);
      res.status(500).json({ error: 'Failed to fetch instances' });
    }
  });

  // Get action templates
  app.get('/api/actions/templates', async (req: Request, res: Response) => {
    try {
      const { category } = req.query;

      const conditions = [eq(actionTemplates.isPublic, true)];
      
      if (category) {
        conditions.push(eq(actionTemplates.category, category as string));
      }

      const templates = await db
        .select()
        .from(actionTemplates)
        .where(and(...conditions))
        .orderBy(desc(actionTemplates.usageCount));
      res.json(templates);
    } catch (error) {
      console.error('Error fetching action templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // Create action rule from template
  app.post('/api/actions/rules/from-template/:templateId', requireAuth, async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const userId = req.user!.id;
      const { templateId } = req.params;
      const { ruleName, customConfig } = req.body;

      const [template] = await db
        .select()
        .from(actionTemplates)
        .where(eq(actionTemplates.templateId, templateId));

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const defaultConfig = template.defaultConfig as any;
      const mergedConfig = { ...defaultConfig, ...customConfig };

      const ruleData = {
        userId,
        ruleName: ruleName || `${template.templateName} Rule`,
        description: `Created from template: ${template.templateName}`,
        triggerType: template.triggerType,
        actionType: template.actionType,
        triggerConditions: mergedConfig.triggerConditions || {},
        actionConfig: mergedConfig.actionConfig || {},
        instanceFilters: mergedConfig.instanceFilters || null,
        contactFilters: mergedConfig.contactFilters || null,
        timeFilters: mergedConfig.timeFilters || null,
        cooldownMinutes: mergedConfig.cooldownMinutes || 0,
        maxExecutionsPerDay: mergedConfig.maxExecutionsPerDay || 100,
        workspaceId: req.body.workspaceId || null,
        spaceId: req.body.spaceId || null,
      };

      const [newRule] = await db.insert(actionRules).values(ruleData).returning();

      // Increment template usage count
      await db
        .update(actionTemplates)
        .set({ usageCount: sql`${actionTemplates.usageCount} + 1` })
        .where(eq(actionTemplates.templateId, templateId));

      res.status(201).json(newRule);
    } catch (error) {
      console.error('Error creating rule from template:', error);
      res.status(500).json({ error: 'Failed to create rule from template' });
    }
  });

  // Get action statistics
  app.get('/api/actions/stats', async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Default user ID

      const [totalRules] = await db
        .select({ count: sql<number>`count(*)` })
        .from(actionRules)
        .where(eq(actionRules.userId, userId));

      const [activeRules] = await db
        .select({ count: sql<number>`count(*)` })
        .from(actionRules)
        .where(and(eq(actionRules.userId, userId), eq(actionRules.isActive, true)));

      const [totalExecutions] = await db
        .select({ total: sql<number>`sum(${actionRules.totalExecutions})` })
        .from(actionRules)
        .where(eq(actionRules.userId, userId));

      const [recentExecutions] = await db
        .select({ count: sql<number>`count(*)` })
        .from(actionExecutions)
        .innerJoin(actionRules, eq(actionExecutions.ruleId, actionRules.ruleId))
        .where(
          and(
            eq(actionRules.userId, userId),
            sql`${actionExecutions.executedAt} >= NOW() - INTERVAL '24 hours'`
          )
        );

      const stats = {
        totalRules: totalRules?.count || 0,
        activeRules: activeRules?.count || 0,
        totalExecutions: totalExecutions?.total || 0,
        recentExecutions: recentExecutions?.count || 0,
      };

      res.json(stats);
    } catch (error) {
      console.error('Error fetching action stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // Test action rule (dry run)
  app.post('/api/actions/rules/:ruleId/test', requireAuth, async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const userId = req.user!.id;
      const { ruleId } = req.params;
      const { testContext } = req.body;

      const [rule] = await db
        .select()
        .from(actionRules)
        .where(and(eq(actionRules.ruleId, ruleId), eq(actionRules.userId, userId)));

      if (!rule) {
        return res.status(404).json({ error: 'Action rule not found' });
      }

      const mockContext = {
        messageId: 'test-message-id',
        instanceId: testContext.instanceId || 'test-instance',
        chatId: testContext.chatId || 'test-chat',
        senderJid: testContext.senderJid || 'test-sender',
        content: testContext.content || 'Test message #todo',
        hashtags: testContext.hashtags || ['todo'],
        keywords: testContext.keywords || ['test'],
        timestamp: new Date(),
        fromMe: false,
      };

      // Test if rule would trigger
      const conditions = rule.triggerConditions as any;
      let wouldTrigger = false;

      switch (rule.triggerType) {
        case 'hashtag':
          wouldTrigger = mockContext.hashtags?.some((tag: string) => 
            conditions.hashtags?.includes(tag)
          ) || false;
          break;
        case 'keyword':
          wouldTrigger = conditions.keywords?.some((keyword: string) =>
            mockContext.content.toLowerCase().includes(keyword.toLowerCase())
          ) || false;
          break;
        case 'reaction':
          wouldTrigger = mockContext.reaction === conditions.reaction;
          break;
      }

      const result = {
        ruleId: rule.ruleId,
        ruleName: rule.ruleName,
        wouldTrigger,
        triggerType: rule.triggerType,
        actionType: rule.actionType,
        testContext: mockContext,
        conditions: conditions,
        actionConfig: rule.actionConfig,
      };

      res.json(result);
    } catch (error) {
      console.error('Error testing action rule:', error);
      res.status(500).json({ error: 'Failed to test action rule' });
    }
  });

  // ===== CRM API ROUTES =====

  // Get all tasks for user
  app.get('/api/crm/tasks', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      
      const tasks = await db.execute(sql`
        SELECT 
          t.*,
          COALESCE(
            json_agg(
              json_build_object(
                'item_id', ci.item_id,
                'content', ci.content,
                'is_completed', ci.is_completed,
                'display_order', ci.display_order
              ) ORDER BY ci.display_order
            ) FILTER (WHERE ci.item_id IS NOT NULL), 
            '[]'::json
          ) as checklist_items,
          COALESCE(
            json_agg(
              json_build_object(
                'task_id', st.task_id,
                'title', st.title,
                'description', st.description,
                'status', st.status,
                'priority', st.priority,
                'due_date', st.due_date,
                'created_at', st.created_at,
                'updated_at', st.updated_at
              ) ORDER BY st.created_at
            ) FILTER (WHERE st.task_id IS NOT NULL), 
            '[]'::json
          ) as subtasks
        FROM crm.tasks t
        LEFT JOIN crm.task_checklist_items ci ON t.task_id = ci.task_id
        LEFT JOIN crm.tasks st ON t.task_id = st.parent_task_id
        WHERE t.parent_task_id IS NULL
        GROUP BY t.task_id
        ORDER BY t.created_at DESC
      `);

      res.json(tasks.rows);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Create new task
  app.post('/api/crm/tasks', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      const {
        title,
        description,
        status = 'to_do',
        priority = 'medium',
        due_date,
        project_id,
        parent_task_id,
        assigned_to_user_id,
        related_chat_jid,
        checklist_items
      } = req.body;

      // Get user's instance ID
      const userInstances = await db.execute(sql`
        SELECT instance_id FROM whatsapp.instances WHERE client_id = ${userId} LIMIT 1
      `);
      
      const instanceId = userInstances.rows[0]?.instance_id || 'default';

      // Create task
      const newTask = await db.execute(sql`
        INSERT INTO crm.tasks (
          instance_id, title, description, status, priority, due_date,
          project_id, parent_task_id, assigned_to_user_id, related_chat_jid,
          created_by_user_id
        ) VALUES (
          ${instanceId}, ${title}, ${description || null}, ${status}, ${priority}, ${due_date || null},
          ${project_id || null}, ${parent_task_id || null}, ${assigned_to_user_id || null}, ${related_chat_jid || null},
          ${userId}
        ) RETURNING *
      `);

      const taskId = newTask.rows[0].task_id;

      // Add checklist items if provided
      if (checklist_items && checklist_items.length > 0) {
        for (let i = 0; i < checklist_items.length; i++) {
          await db.execute(sql`
            INSERT INTO crm.task_checklist_items (
              task_id, instance_id, content, display_order
            ) VALUES (
              ${taskId}, ${instanceId}, ${checklist_items[i]}, ${i}
            )
          `);
        }
      }

      res.json(newTask.rows[0]);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update task
  app.patch('/api/crm/tasks/:taskId', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      const { taskId } = req.params;
      const updates = req.body;

      // Build update object excluding checklist_items
      const updateData: any = { ...updates };
      delete updateData.checklist_items;
      
      if (Object.keys(updateData).length > 0) {
        // Build dynamic update fields
        const updateFields = Object.keys(updateData).map((key, index) => `${key} = $${index + 1}`);
        const values = Object.values(updateData);
        
        const updateQuery = `
          UPDATE crm.tasks 
          SET ${updateFields.join(', ')}, updated_at = NOW()
          WHERE task_id = $${values.length + 1} AND created_by_user_id = $${values.length + 2}
          RETURNING *
        `;
        
        values.push(parseInt(taskId), userId);
        
        const result = await pool.query(updateQuery, values);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Task not found' });
        }

        res.json(result.rows[0]);
      } else {
        res.json({ message: 'No updates provided' });
      }
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Delete task
  app.delete('/api/crm/tasks/:taskId', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      const { taskId } = req.params;

      // Delete checklist items first
      await db.execute(sql`
        DELETE FROM crm.task_checklist_items WHERE task_id = ${taskId}
      `);

      // Delete task
      const result = await db.execute(sql`
        DELETE FROM crm.tasks 
        WHERE task_id = ${taskId} AND created_by_user_id = ${userId}
        RETURNING task_id
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // Get all projects for user
  app.get('/api/crm/projects', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      
      const projects = await db.execute(sql`
        SELECT p.*, COUNT(t.task_id) as task_count
        FROM crm.projects p
        LEFT JOIN crm.tasks t ON p.project_id = t.project_id
        WHERE p.owner_user_id = ${userId}
        GROUP BY p.project_id
        ORDER BY p.created_at DESC
      `);

      res.json(projects.rows);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Create new project
  app.post('/api/crm/projects', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      const { project_name, description, status = 'active', start_date, end_date } = req.body;

      // Get user's instance ID
      const userInstances = await db.execute(sql`
        SELECT instance_id FROM whatsapp.instances WHERE client_id = ${userId} LIMIT 1
      `);
      
      const instanceId = userInstances.rows[0]?.instance_id || 'default';

      const newProject = await db.execute(sql`
        INSERT INTO crm.projects (
          instance_id, project_name, description, status, start_date, end_date,
          owner_user_id, space_id
        ) VALUES (
          ${instanceId}, ${project_name}, ${description}, ${status}, ${start_date}, ${end_date},
          ${userId}, 1
        ) RETURNING *
      `);

      res.json(newProject.rows[0]);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  // Get checklist items for all tasks
  app.get('/api/crm/checklist-items', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      
      const items = await db.execute(sql`
        SELECT ci.* 
        FROM crm.task_checklist_items ci
        JOIN crm.tasks t ON ci.task_id = t.task_id
        WHERE t.created_by_user_id = ${userId}
        ORDER BY ci.task_id, ci.display_order
      `);

      res.json(items.rows);
    } catch (error) {
      console.error('Error fetching checklist items:', error);
      res.status(500).json({ error: 'Failed to fetch checklist items' });
    }
  });

  // Create checklist item
  app.post('/api/crm/checklist-items', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      const { task_id, content, is_completed = false } = req.body;

      // Verify the task belongs to the user and get instance_id
      const taskCheck = await db.execute(sql`
        SELECT task_id, instance_id FROM crm.tasks 
        WHERE task_id = ${task_id} AND created_by_user_id = ${userId}
      `);

      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const taskInstanceId = taskCheck.rows[0]?.instance_id;

      // Get the next display order
      const orderResult = await db.execute(sql`
        SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
        FROM crm.task_checklist_items
        WHERE task_id = ${task_id}
      `);

      const displayOrder = orderResult.rows[0]?.next_order || 1;

      // Create the checklist item
      const result = await db.execute(sql`
        INSERT INTO crm.task_checklist_items (task_id, instance_id, content, is_completed, display_order, created_at, updated_at)
        VALUES (${task_id}, ${taskInstanceId}, ${content}, ${is_completed}, ${displayOrder}, NOW(), NOW())
        RETURNING *
      `);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating checklist item:', error);
      res.status(500).json({ error: 'Failed to create checklist item' });
    }
  });

  // Update checklist item
  app.patch('/api/crm/checklist-items/:itemId', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      const { itemId } = req.params;
      const { is_completed, content } = req.body;

      const result = await db.execute(sql`
        UPDATE crm.task_checklist_items ci
        SET 
          is_completed = COALESCE(${is_completed}, ci.is_completed),
          content = COALESCE(${content}, ci.content),
          updated_at = NOW()
        FROM crm.tasks t
        WHERE ci.item_id = ${itemId} 
          AND ci.task_id = t.task_id 
          AND t.created_by_user_id = ${userId}
        RETURNING ci.*
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Checklist item not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating checklist item:', error);
      res.status(500).json({ error: 'Failed to update checklist item' });
    }
  });

  // Delete checklist item
  app.delete('/api/crm/checklist-items/:itemId', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      const { itemId } = req.params;

      const result = await db.execute(sql`
        DELETE FROM crm.task_checklist_items ci
        USING crm.tasks t
        WHERE ci.item_id = ${itemId} 
          AND ci.task_id = t.task_id 
          AND t.created_by_user_id = ${userId}
        RETURNING ci.*
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Checklist item not found' });
      }

      res.json({ message: 'Checklist item deleted successfully' });
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      res.status(500).json({ error: 'Failed to delete checklist item' });
    }
  });

  // CRM Action Mappings API
  app.get('/api/crm/action-mappings', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      
      const mappings = await db.execute(sql`
        SELECT 
          am.mapping_id,
          am.instance_id,
          am.trigger_type,
          am.trigger_value,
          am.action_type,
          am.default_title,
          am.is_active,
          am.created_at,
          am.updated_at
        FROM crm.action_mappings am
        INNER JOIN whatsapp.instances wi ON am.instance_id = wi.instance_id
        WHERE wi.client_id = ${userId}
        ORDER BY am.created_at DESC
      `);

      res.json(mappings.rows);
    } catch (error) {
      console.error('Error fetching CRM action mappings:', error);
      res.status(500).json({ error: 'Failed to fetch CRM action mappings' });
    }
  });

  // CRM Action Stats API
  app.get('/api/crm/action-stats', async (req: Request, res: Response) => {
    try {
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Demo user ID
      
      const stats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_mappings,
          COUNT(CASE WHEN am.is_active THEN 1 END) as active_mappings,
          0 as total_executions,
          0 as recent_executions
        FROM crm.action_mappings am
        INNER JOIN whatsapp.instances wi ON am.instance_id = wi.instance_id
        WHERE wi.client_id = ${userId}
      `);

      const result = stats.rows[0] || {
        total_mappings: 0,
        active_mappings: 0,
        total_executions: 0,
        recent_executions: 0
      };

      res.json({
        totalMappings: parseInt(result.total_mappings) || 0,
        activeMappings: parseInt(result.active_mappings) || 0,
        totalExecutions: parseInt(result.total_executions) || 0,
        recentExecutions: parseInt(result.recent_executions) || 0
      });
    } catch (error) {
      console.error('Error fetching CRM action stats:', error);
      res.status(500).json({ error: 'Failed to fetch CRM action stats' });
    }
  });

  // Authentication Routes
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const { email, password, fullName } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      const passwordValidation = isValidPassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.message });
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.email, email))
        .limit(1);

      if (existingUser) {
        return res.status(409).json({ error: 'User already exists with this email' });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const userId = crypto.randomUUID();

      const [newUser] = await db
        .insert(appUsers)
        .values({
          userId,
          email,
          passwordHash: hashedPassword,
          fullName: fullName || null,
        })
        .returning({
          userId: appUsers.userId,
          email: appUsers.email,
          fullName: appUsers.fullName,
        });

      // Generate JWT token
      const token = generateToken({
        userId: newUser.userId,
        email: newUser.email,
        fullName: newUser.fullName || undefined,
      });

      res.status(201).json({
        message: 'User created successfully',
        user: newUser,
        token,
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user
      const [user] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.email, email))
        .limit(1);

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check password
      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.userId,
        email: user.email,
        fullName: user.fullName || undefined,
      });

      res.json({
        message: 'Login successful',
        user: {
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
        },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      res.json({
        user: {
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
        },
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user information' });
    }
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if user exists
      const [user] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.email, email))
        .limit(1);

      if (!user) {
        // Don't reveal if user exists or not for security
        return res.json({ 
          message: 'If an account with that email exists, you will receive a password reset link.' 
        });
      }

      // Generate reset token (6-digit code for simplicity)
      const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
      const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store reset token in database (you might want to create a separate table for this)
      await db
        .update(appUsers)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpiry: resetTokenExpiry,
        })
        .where(eq(appUsers.userId, user.userId));

      // In a real app, you would send an email here
      // For demo purposes, we'll log the token
      console.log(`Password reset token for ${email}: ${resetToken}`);

      res.json({ 
        message: 'If an account with that email exists, you will receive a password reset link.',
        // For demo purposes only - remove in production
        resetToken: resetToken
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { email, resetToken, newPassword } = req.body;

      if (!email || !resetToken || !newPassword) {
        return res.status(400).json({ error: 'Email, reset token, and new password are required' });
      }

      const passwordValidation = isValidPassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.message });
      }

      // Find user with valid reset token
      const [user] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.email, email))
        .limit(1);

      if (!user || 
          !user.passwordResetToken || 
          user.passwordResetToken !== resetToken ||
          !user.passwordResetExpiry ||
          new Date() > user.passwordResetExpiry) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password and clear reset token
      await db
        .update(appUsers)
        .set({
          passwordHash: hashedPassword,
          passwordResetToken: null,
          passwordResetExpiry: null,
        })
        .where(eq(appUsers.userId, user.userId));

      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // Spaces management routes
  app.get('/api/spaces/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.params.userId;
      
      // Verify user can access these spaces
      if (req.user?.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const userSpaces = await db
        .select({
          spaceId: appSpaces.spaceId,
          name: appSpaces.spaceName,
          createdAt: appSpaces.createdAt,
        })
        .from(appSpaces)
        .where(eq(appSpaces.creatorUserId, userId))
        .orderBy(appSpaces.createdAt);

      res.json(userSpaces);
    } catch (error) {
      console.error('Error fetching spaces:', error);
      res.status(500).json({ error: 'Failed to fetch spaces' });
    }
  });

  app.post('/api/spaces', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { name, description } = req.body;
      const userId = req.user?.userId;

      if (!name || !userId) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const [newSpace] = await db
        .insert(appSpaces)
        .values({
          spaceName: name.trim(),
          creatorUserId: userId,
        })
        .returning({
          spaceId: appSpaces.spaceId,
          name: appSpaces.spaceName,
          createdAt: appSpaces.createdAt,
        });

      res.status(201).json(newSpace);
    } catch (error) {
      console.error('Error creating space:', error);
      res.status(500).json({ error: 'Failed to create space' });
    }
  });

  app.put('/api/spaces/:spaceId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { spaceId } = req.params;
      const { name } = req.body;
      const userId = req.user?.userId;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // Verify user owns this space
      const [space] = await db
        .select()
        .from(appSpaces)
        .where(eq(appSpaces.spaceId, parseInt(spaceId)))
        .limit(1);

      if (!space || space.creatorUserId !== userId) {
        return res.status(404).json({ error: 'Space not found or access denied' });
      }

      const [updatedSpace] = await db
        .update(appSpaces)
        .set({
          spaceName: name.trim(),
        })
        .where(eq(appSpaces.spaceId, parseInt(spaceId)))
        .returning({
          spaceId: appSpaces.spaceId,
          name: appSpaces.spaceName,
          createdAt: appSpaces.createdAt,
        });

      res.json(updatedSpace);
    } catch (error) {
      console.error('Error updating space:', error);
      res.status(500).json({ error: 'Failed to update space' });
    }
  });

  app.delete('/api/spaces/:spaceId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { spaceId } = req.params;
      const userId = req.user?.userId;

      // Verify user owns this space
      const [space] = await db
        .select()
        .from(appSpaces)
        .where(eq(appSpaces.spaceId, spaceId))
        .limit(1);

      if (!space || space.ownerId !== userId) {
        return res.status(404).json({ error: 'Space not found or access denied' });
      }

      await db
        .delete(appSpaces)
        .where(eq(appSpaces.spaceId, spaceId));

      res.json({ message: 'Space deleted successfully' });
    } catch (error) {
      console.error('Error deleting space:', error);
      res.status(500).json({ error: 'Failed to delete space' });
    }
  });

  // Calendar integration routes
  app.get('/api/calendar/account/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const account = await storage.getCalendarAccount(userId);
      if (!account) {
        return res.status(404).json({ error: 'Calendar account not found' });
      }
      res.json(account);
    } catch (error) {
      console.error('Error fetching calendar account:', error);
      res.status(500).json({ error: 'Failed to fetch calendar account' });
    }
  });

  app.post('/api/calendar/account', async (req, res) => {
    try {
      const accountData = req.body;
      const account = await storage.createCalendarAccount(accountData);
      res.status(201).json(account);
    } catch (error) {
      console.error('Error creating calendar account:', error);
      res.status(500).json({ error: 'Failed to create calendar account' });
    }
  });

  app.get('/api/calendar/calendars/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const calendars = await storage.getCalendarCalendars(userId);
      res.json(calendars);
    } catch (error) {
      console.error('Error fetching calendars:', error);
      res.status(500).json({ error: 'Failed to fetch calendars' });
    }
  });

  app.post('/api/calendar/calendars', async (req, res) => {
    try {
      const calendarData = req.body;
      const calendar = await storage.createCalendarCalendar(calendarData);
      res.status(201).json(calendar);
    } catch (error) {
      console.error('Error creating calendar:', error);
      res.status(500).json({ error: 'Failed to create calendar' });
    }
  });

  app.get('/api/calendar/events/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { calendarId } = req.query;
      const events = await storage.getCalendarEvents(userId, calendarId ? Number(calendarId) : undefined);
      res.json(events);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  });

  app.post('/api/calendar/events', async (req, res) => {
    try {
      const eventData = req.body;
      const event = await storage.createCalendarEvent(eventData);
      res.status(201).json(event);
    } catch (error) {
      console.error('Error creating calendar event:', error);
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  });

  app.get('/api/calendar/events/:eventId/attendees', async (req, res) => {
    try {
      const { eventId } = req.params;
      const attendees = await storage.getCalendarAttendees(Number(eventId));
      res.json(attendees);
    } catch (error) {
      console.error('Error fetching event attendees:', error);
      res.status(500).json({ error: 'Failed to fetch event attendees' });
    }
  });

  app.post('/api/calendar/attendees', async (req, res) => {
    try {
      const attendeeData = req.body;
      const attendee = await storage.createCalendarAttendee(attendeeData);
      res.status(201).json(attendee);
    } catch (error) {
      console.error('Error creating calendar attendee:', error);
      res.status(500).json({ error: 'Failed to create calendar attendee' });
    }
  });

  // Database viewer endpoints with connection retry
  app.get('/api/database/schemas', async (req: Request, res: Response) => {
    let retries = 3;
    while (retries > 0) {
      try {
        const result = await db.execute(sql`
          SELECT 
            schema_name,
            (SELECT COUNT(*) FROM information_schema.tables 
             WHERE table_schema = s.schema_name) as table_count
          FROM information_schema.schemata s
          WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          ORDER BY schema_name
        `);
        return res.json(result.rows);
      } catch (error: any) {
        console.error(`Database schemas error (retries left: ${retries-1}):`, error.message);
        retries--;
        if (retries === 0) {
          // Return cached/known schema info as fallback
          const fallbackSchemas = [
            { schema_name: 'whatsapp', table_count: 6 },
            { schema_name: 'public', table_count: 20 }
          ];
          return res.json(fallbackSchemas);
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  });

  app.get('/api/database/tables/:schema', async (req: Request, res: Response) => {
    const { schema } = req.params;
    let retries = 3;
    
    while (retries > 0) {
      try {
        const result = await db.execute(sql`
          SELECT 
            table_name,
            (SELECT COUNT(*) FROM information_schema.columns 
             WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
          FROM information_schema.tables t
          WHERE table_schema = ${schema}
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        return res.json(result.rows);
      } catch (error: any) {
        console.error(`Database tables error (retries left: ${retries-1}):`, error.message);
        retries--;
        if (retries === 0) {
          // Return known tables for whatsapp schema as fallback
          if (schema === 'whatsapp') {
            const fallbackTables = [
              { table_name: 'instances', column_count: 10 },
              { table_name: 'messages', column_count: 18 },
              { table_name: 'contacts', column_count: 11 },
              { table_name: 'chats', column_count: 11 },
              { table_name: 'groups', column_count: 8 },
              { table_name: 'group_participants', column_count: 7 }
            ];
            return res.json(fallbackTables);
          }
          return res.status(500).json({ error: 'Failed to fetch tables after retries' });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  });

  app.get('/api/database/table-data/:schema/:table', async (req: Request, res: Response) => {
    const { schema, table } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    let retries = 3;
    
    while (retries > 0) {
      try {
        // Get table columns first
        const columnsResult = await db.execute(sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = ${schema} AND table_name = ${table}
          ORDER BY ordinal_position
        `);
        
        // Build safe query for table data
        const tableName = `"${schema}"."${table}"`;
        let orderClause = '';
        
        // Try to order by common timestamp columns
        const timestampColumns = ['created_at', 'updated_at', 'timestamp', 'last_updated_at'];
        const hasTimestampCol = columnsResult.rows.find(col => 
          timestampColumns.includes(col.column_name)
        );
        
        if (hasTimestampCol) {
          orderClause = `ORDER BY "${hasTimestampCol.column_name}" DESC`;
        }
        
        const dataQuery = `SELECT * FROM ${tableName} ${orderClause} LIMIT ${limit}`;
        const dataResult = await db.execute(sql.raw(dataQuery));
        
        return res.json({
          columns: columnsResult.rows,
          data: dataResult.rows,
          total: dataResult.rows.length
        });
      } catch (error: any) {
        console.error(`Database table data error (retries left: ${retries-1}):`, error.message);
        retries--;
        if (retries === 0) {
          return res.status(500).json({ 
            error: 'Database connection temporarily unavailable',
            message: 'Please try again in a moment'
          });
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  });

  app.get('/api/database/messages', async (req: Request, res: Response) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          message_id, instance_id, chat_id, sender_jid, from_me,
          message_type, content, timestamp, created_at
        FROM whatsapp.messages 
        ORDER BY created_at DESC 
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Database messages error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.get('/api/database/instances', async (req: Request, res: Response) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          instance_id, display_name, owner_jid, is_connected, created_at
        FROM whatsapp.instances 
        ORDER BY created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Database instances error:', error);
      res.status(500).json({ error: 'Failed to fetch instances' });
    }
  });

  app.get('/api/database/contacts', async (req: Request, res: Response) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          jid, instance_id, push_name, profile_picture_url, 
          is_business, last_updated_at
        FROM whatsapp.contacts 
        ORDER BY last_updated_at DESC 
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Database contacts error:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  app.get('/api/database/chats', async (req: Request, res: Response) => {
    try {
      const result = await db.execute(sql`
        SELECT 
          chat_id, instance_id, type, unread_count, last_message_timestamp
        FROM whatsapp.chats 
        ORDER BY last_message_timestamp DESC 
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Database chats error:', error);
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });

  return httpServer;
}
