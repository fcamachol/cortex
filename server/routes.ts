import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { storage } from "./storage";
import { evolutionManager } from "./evolution-manager";
import { getEvolutionApi, updateEvolutionApiSettings, getEvolutionApiSettings, getInstanceEvolutionApi } from "./evolution-api";
import { db, pool } from "./db";
import { actionsEngine, ActionsEngine } from "./actions-engine";
import { 
  insertUserSchema,
  insertWhatsappInstanceSchema,
  insertWhatsappContactSchema,
  insertWhatsappChatSchema,
  insertWhatsappMessageSchema,
  whatsappInstances,
  actionRules,
  actionExecutions,
  actionTemplates,
  insertActionRuleSchema,
  ActionRule,
  InsertActionRule,
  tasks
} from "../shared/schema";
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
          await handleWebhookMessagesUpdate(instanceName, data);
          break;
        case 'contacts.upsert':
          await handleWebhookContactsUpsert(instanceName, data);
          break;
        case 'chats.upsert':
          await handleWebhookChatsUpsert(instanceName, data);
          break;
        case 'groups.upsert':
          await handleWebhookGroupsUpsert(instanceName, data);
          break;
        case 'group-participants.update':
          await handleWebhookGroupParticipantsUpdate(instanceName, data);
          break;
        case 'messages.reaction':
          await handleWebhookMessageReaction(instanceName, data);
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
      // Find the instance in our database using instanceName as instanceId
      const instance = await storage.getWhatsappInstanceByName('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instanceName);
      if (!instance) {
        console.error(`Instance ${instanceName} not found in database`);
        return;
      }

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

        // Determine message type from the message content
        let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact_card' | 'reaction' = 'text';
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
        
        try {
          // For individual chats, the contact JID should match the chat ID
          // For group chats, we create contacts for both the chat and the sender
          const contactJid = chatId.includes('@g.us') ? senderJid : chatId;
          
          // First, ensure the main contact exists (for the chat)
          let chatContact = await storage.getWhatsappContact('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instance.instanceId, contactJid);
          
          if (!chatContact) {
            // Create the contact if it doesn't exist
            const newContactData = {
              instanceId: instance.instanceId,
              jid: contactJid,
              name: message.pushName || contactJid.split('@')[0],
              isMyContact: false,
              isBlocked: false
            };
            
            chatContact = await storage.createWhatsappContact(newContactData);
            console.log(`✅ Created new contact: ${contactJid}`);
          }
          
          // For group chats, also ensure the sender contact exists if different
          if (chatId.includes('@g.us') && senderJid !== contactJid) {
            let senderContact = await storage.getWhatsappContact('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instance.instanceId, senderJid);
            
            if (!senderContact) {
              const senderContactData = {
                instanceId: instance.instanceId,
                jid: senderJid,
                name: message.pushName || senderJid.split('@')[0],
                isMyContact: false,
                isBlocked: false
              };
              
              senderContact = await storage.createWhatsappContact(senderContactData);
              console.log(`✅ Created new sender contact: ${senderJid}`);
            }
          }
          
          // Then, ensure the chat exists
          let chat = await storage.getWhatsappChat('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instance.instanceId, chatId);
          
          if (!chat) {
            // Create the chat if it doesn't exist
            const chatType: 'individual' | 'group' = chatId.includes('@g.us') ? 'group' : 'individual';
            const newChatData = {
              instanceId: instance.instanceId,
              chatId: chatId,
              type: chatType,
              unreadCount: 0,
              isArchived: false,
              isPinned: false,
              isMuted: false,
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
            await storage.deleteWhatsappMessageReaction('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instance.instanceId, targetMessageId, reactorJid);
            console.log(`🗑️ Removed reaction from ${reactorJid} on message ${targetMessageId}`);
          } else {
            // Use the webhook's fromMe value directly - it's more accurate than database lookup
            const isInternalUser = message.key.fromMe || false;
            
            console.log(`🔍 Using webhook fromMe value for ${reactorJid}: fromMe=${isInternalUser}`);

            // Add or update reaction
            const reactionMessageData = {
              messageId: targetMessageId,
              instanceId: instance.instanceId,
              reactorJid: reactorJid,
              reactionEmoji: reactionEmoji,
              fromMe: isInternalUser,
              timestamp: new Date((message.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000)
            };

            await storage.createWhatsappMessageReaction(reactionMessageData);
            console.log(`👍 Saved reaction ${reactionEmoji} from ${reactorJid} (fromMe=${isInternalUser}) on message ${targetMessageId}`);

            // Process actions triggers for this reaction
            try {
              console.log(`🔍 Looking for original message: ${targetMessageId} in instance: ${instance.instanceId}`);
              const originalMessage = await storage.getWhatsappMessage('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instance.instanceId, targetMessageId);
              
              if (originalMessage) {
                console.log(`📨 Found original message: "${originalMessage.content?.substring(0, 50) || 'No content'}"`);
                const triggerContext = {
                  reactionId: `${targetMessageId}_${reactionEmoji}`,
                  messageId: targetMessageId,
                  instanceId: instance.instanceId,
                  chatId: message.key.remoteJid, // Use the actual chat/group ID from webhook
                  senderJid: reactorJid,
                  content: originalMessage.content || '',
                  reaction: reactionEmoji,
                  timestamp: new Date(),
                  fromMe: isInternalUser, // Use the reaction's fromMe value, not the original message's
                };

                console.log(`🎯 Triggering actions engine for reaction: ${reactionEmoji}`);
                // Trigger actions engine for reaction
                await actionsEngine.processMessageTriggers(triggerContext);
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
            instanceId: instance.instanceId,
            messageId: message.key.id || '',
            chatId: chatId,
            senderJid: message.participant || message.key.remoteJid || '',
            fromMe: message.key.fromMe || false,
            messageType: messageType,
            content: extractMessageContent(message),
            timestamp: new Date((message.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000),
            quotedMessageId: message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.key?.id || null,
            rawApiPayload: message
          };

          const savedMessage = await storage.createWhatsappMessage(whatsappMessageData);
          console.log(`✅ Saved WhatsApp message from ${message.pushName || 'Unknown'}: "${whatsappMessageData.content?.substring(0, 50) || 'No content'}"`);

          // Process actions triggers for this message
          const messageContent = whatsappMessageData.content || '';
          const { hashtags, keywords } = ActionsEngine.extractHashtagsAndKeywords(messageContent);
          
          if (hashtags.length > 0 || keywords.length > 0) {
            const triggerContext = {
              messageId: whatsappMessageData.messageId,
              instanceId: instance.instanceId,
              chatId: whatsappMessageData.chatId,
              senderJid: whatsappMessageData.senderJid,
              content: messageContent,
              hashtags,
              keywords,
              timestamp: whatsappMessageData.timestamp,
              fromMe: whatsappMessageData.fromMe,
            };
            
            // Trigger actions engine for hashtags and keywords
            await actionsEngine.processMessageTriggers(triggerContext);
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
              instanceId: instance.instanceId,
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
    console.log(`👤 Processing contacts.upsert for ${instanceName}:`, data);
    // Implementation for contact updates
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

      // Send WebSocket notification to connected clients
      const wsMessage = {
        type: 'group-participants-update',
        groupJid: groupJid,
        instanceId: instance.instanceId,
        action: action,
        participants: participants,
        timestamp: new Date().toISOString()
      };

      // Broadcast to all connected WebSocket clients
      clients.forEach((client, clientId) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(wsMessage));
        }
      });

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

      // Extract reaction data from webhook
      const messageId = data.key?.id || data.messageId;
      const reactionEmoji = data.message?.reactionMessage?.text || data.reaction;
      const senderJid = data.key?.participant || data.key?.remoteJid || data.senderJid;
      const chatId = data.key?.remoteJid || data.chatId;

      if (!messageId || !reactionEmoji || !senderJid || !chatId) {
        console.log('⚠️ Missing reaction data, skipping');
        return;
      }

      console.log(`⭐ Reaction detected: ${reactionEmoji} on message ${messageId} by ${senderJid}`);

      // Get the original message to extract content
      const originalMessage = await storage.getWhatsappMessage(userId, instance.instanceId, messageId);
      if (!originalMessage) {
        console.log(`⚠️ Original message not found: ${messageId}`);
        return;
      }

      // Process actions triggers for this reaction
      const triggerContext = {
        reactionId: `${messageId}_${reactionEmoji}`,
        messageId: messageId,
        instanceId: instance.instanceId,
        chatId: chatId,
        senderJid: senderJid,
        content: originalMessage.content || '',
        reaction: reactionEmoji,
        timestamp: new Date(),
        fromMe: originalMessage.fromMe,
      };

      // Trigger actions engine for reaction
      await actionsEngine.processMessageTriggers(triggerContext);
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
    console.log(`💬 Processing chats.upsert for ${instanceName}:`, data);
    
    try {
      // Use hardcoded user ID for now and find the instance directly
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const instances = await storage.getWhatsappInstances(userId);
      const instance = instances.find(inst => inst.instanceId === instanceName);
      if (!instance) {
        console.error(`❌ Instance ${instanceName} not found`);
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
      // Disable caching to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const instances = await storage.getWhatsappInstances(req.query.userId as string || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
      
      const statusWithDetails = instances.map(instance => {
        // Use the database isConnected field as the source of truth for bridge status
        const isConnected = instance.isConnected;
        
        return {
          instanceId: instance.instanceId,
          instanceName: instance.instanceId,
          phoneNumber: instance.ownerJid || 'Not set',
          status: isConnected ? 'connected' : 'disconnected',
          websocketConnected: isConnected, // Use same value as database
          bridgeExists: true, // Always true if instance exists in database
          lastConnected: instance.lastConnectionAt,
          connectionState: isConnected ? 'open' : 'closed'
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
      const instance = await storage.getWhatsappInstanceByName('7804247f-3ae8-4eb2-8c6d-2c44f967ad42', instanceName);
      
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      res.json({
        instanceId: instance.instanceId,
        instanceName: instance.instanceId,
        phoneNumber: instance.ownerJid || 'Not set',
        status: instance.isConnected ? 'connected' : 'disconnected',
        websocketConnected: status.connected,
        bridgeExists: status.bridgeExists,
        lastConnected: instance.lastConnectionAt,
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
        await evolutionManager.refreshInstance(oldInstance.clientId, req.params.id);
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
      await evolutionManager.removeBridge(instance.instanceId);

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
      
      // HTTP polling mode - disable bridge status since WebSocket is disabled
      const bridgeStatus = {
        connected: false,
        bridgeExists: false
      };
      
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
          bridge: bridgeStatus,
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

  // WhatsApp conversation routes - fetch from Evolution API
  app.get("/api/whatsapp/conversations/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { instanceId } = req.query;
      
      // Get user's active WhatsApp instances
      const instances = await storage.getWhatsappInstances(userId);
      const allConversations = [];
      
      for (const instance of instances) {
        if (instance.isConnected && instance.apiKey) {
          try {
            // Fetch chats from Evolution API
            const evolutionApi = getInstanceEvolutionApi(instance.apiKey);
            const chats = await evolutionApi.fetchChats(instance.instanceId);
            
            if (chats && Array.isArray(chats)) {
              for (const chat of chats) {
                // Create or update conversation in database
                const conversationData = {
                  instanceId: instance.instanceId,
                  chatId: chat.id,
                  type: chat.id.includes('@g.us') ? 'group' as const : 'individual' as const,
                  unreadCount: chat.unreadCount || 0,
                  lastMessageTimestamp: chat.lastMessage?.messageTimestamp ? new Date(chat.lastMessage.messageTimestamp * 1000) : null
                };
                
                // Check if conversation exists
                const existingConversations = await storage.getWhatsappChats(userId, instance.instanceId);
                const existing = existingConversations.find(c => c.chatId === chat.id);
                
                let conversation;
                if (existing) {
                  conversation = await storage.updateWhatsappChat(userId, instance.instanceId, chat.id, conversationData);
                } else {
                  conversation = await storage.createWhatsappChat(conversationData);
                }
                
                allConversations.push(conversation);
              }
            }
          } catch (apiError) {
            console.error(`Failed to fetch chats for instance ${instance.instanceId}:`, apiError);
          }
        }
      }
      
      // Also get any existing conversations from database
      const dbConversations = await storage.getWhatsappChats(userId, instanceId as string);
      
      // Merge and deduplicate by chatId
      const conversationMap = new Map();
      [...allConversations, ...dbConversations].forEach(conv => {
        const key = conv.chatId;
        const currentTimestamp = conv.lastMessageTimestamp?.getTime() || 0;
        const existingTimestamp = conversationMap.get(key)?.lastMessageTimestamp?.getTime() || 0;
        if (!conversationMap.has(key) || currentTimestamp > existingTimestamp) {
          conversationMap.set(key, conv);
        }
      });
      
      const finalConversations = Array.from(conversationMap.values())
        .sort((a, b) => (b.lastMessageTimestamp?.getTime() || 0) - (a.lastMessageTimestamp?.getTime() || 0));
      
      // Enhance conversations with contact/group information
      const enhancedConversations = await Promise.all(finalConversations.map(async (conversation) => {
        try {
          // Get contact information for this chat
          const contact = await storage.getWhatsappContact(userId, conversation.instanceId, conversation.chatId);
          
          // Get group information if it's a group chat
          let groupInfo = null;
          if (conversation.type === 'group') {
            try {
              groupInfo = await storage.getWhatsappGroup(userId, conversation.instanceId, conversation.chatId);
            } catch (groupError) {
              console.log(`No group info found for ${conversation.chatId}`);
            }
          }
          
          // Determine display name
          let displayName = conversation.chatId;
          if (groupInfo && groupInfo.subject) {
            displayName = groupInfo.subject;
          } else if (contact && (contact.pushName || contact.verifiedName)) {
            displayName = contact.pushName || contact.verifiedName;
          } else if (conversation.chatId.includes('@s.whatsapp.net')) {
            // Extract phone number for individual chats
            displayName = conversation.chatId.split('@')[0];
          }
          
          return {
            ...conversation,
            displayName,
            contactInfo: contact,
            groupInfo
          };
        } catch (error) {
          console.error(`Error enhancing conversation ${conversation.chatId}:`, error);
          return conversation;
        }
      }));
      
      res.json(enhancedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
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
          const result = await evolutionManager.sendMessage(
            messageData.instanceId,
            messageData.chatId,
            messageData.content || ""
          );
          
          // Update message with Evolution API response
          messageData.messageId = result.key?.id || messageData.messageId;
          // Note: deliveryStatus field will be handled separately in message updates
        } catch (evolError) {
          console.error('Failed to send via Evolution API:', evolError);
          // Note: error status will be handled separately in message updates
        }
      }
      
      const message = await storage.createWhatsappMessage(messageData);
      
      // Broadcast to connected clients via WebSocket
      // TODO: Implement WebSocket broadcasting for real-time message updates
      
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
      
      // Look up sender's name and chat name
      let senderName = null;
      let chatName = null;
      
      // First try to get sender name from contacts database
      if (result.senderJid) {
        try {
          const contact = await storage.getWhatsappContact(userId, instanceId as string, result.senderJid);
          if (contact && (contact.pushName || contact.verifiedName)) {
            senderName = contact.verifiedName || contact.pushName;
          }
        } catch (contactError) {
          console.log('Could not fetch contact for sender:', result.senderJid);
        }
      }
      
      // If no contact found, try to extract from raw message payload
      if (!senderName && result.rawApiPayload && result.rawApiPayload.pushName) {
        senderName = result.rawApiPayload.pushName;
      }
      
      // Look up chat name (for personal chats use contact name, for groups use group name)
      if (result.chatId) {
        try {
          if (result.chatId.includes('@g.us')) {
            // Group chat - try to get group info
            const chat = await storage.getWhatsappChat(userId, instanceId as string, result.chatId);
            if (chat && chat.name) {
              chatName = chat.name;
            } else {
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
          if (result.chatId.includes('@g.us')) {
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
        senderName: result.fromMe ? "You" : (senderName || result.senderJid?.split('@')[0] || 'Unknown sender'),
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
      } else if (eventData.event === 'group-participants.update') {
        await handleWebhookGroupParticipantsUpdate(instanceId, eventData.data);
      } else if (eventData.event === 'groups.upsert') {
        await handleWebhookGroupsUpsert(instanceId, eventData.data);
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

      await setRLSContext(req.user.id);
      
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

      let query = db.select().from(actionRules).where(eq(actionRules.userId, userId));

      if (workspaceId) {
        query = query.where(eq(actionRules.workspaceId, workspaceId as string));
      }
      if (spaceId) {
        query = query.where(eq(actionRules.spaceId, parseInt(spaceId as string)));
      }

      const rules = await query.orderBy(desc(actionRules.createdAt));
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

  // Get action templates
  app.get('/api/actions/templates', async (req: Request, res: Response) => {
    try {
      const { category } = req.query;

      let query = db.select().from(actionTemplates).where(eq(actionTemplates.isPublic, true));

      if (category) {
        query = query.where(eq(actionTemplates.category, category as string));
      }

      const templates = await query.orderBy(desc(actionTemplates.usageCount));
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
      const engine = ActionsEngine.getInstance();
      const conditions = rule.triggerConditions as any;
      let wouldTrigger = false;

      switch (rule.triggerType) {
        case 'hashtag':
          wouldTrigger = mockContext.hashtags?.some(tag => 
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
          ) as checklist_items
        FROM crm.tasks t
        LEFT JOIN crm.task_checklist_items ci ON t.task_id = ci.task_id
        WHERE t.created_by_user_id = ${userId}
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
          created_by_user_id, space_id
        ) VALUES (
          ${instanceId}, ${title}, ${description}, ${status}, ${priority}, ${due_date},
          ${project_id}, ${parent_task_id}, ${assigned_to_user_id}, ${related_chat_jid},
          ${userId}, 1
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

  return httpServer;
}
