import { Request, Response, NextFunction, Express } from 'express';
import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { storage } from './storage';
import { sql } from 'drizzle-orm';
import { db } from './db';
import * as chrono from 'chrono-node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// ActionsEngine import commented out for now

// Helper function to format phone numbers to E.164 format
function formatToE164(phoneNumber: string): string {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // If it starts with +52 or 52, it's already Mexican format
  if (cleaned.startsWith('52') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  
  // If it's 10 digits, assume it's Mexican without country code
  if (cleaned.length === 10) {
    return '+52' + cleaned;
  }
  
  // If it's 11 digits and starts with 1, assume it's US/Canada
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return '+' + cleaned;
  }
  
  // Return as-is with + prefix if not already there
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
}

const requireAuth = (req: Request & { user?: { id: string } }, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string };
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

interface AuthRequest extends Request {
  user?: { userId: string };
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Basic test route
  app.get('/api/test', (req: Request, res: Response) => {
    res.json({ message: 'API is working' });
  });

  // API to refresh group subjects from Evolution API
  app.post('/api/whatsapp/refresh-group-subjects/:instanceId', async (req: Request, res: Response) => {
    const { instanceId } = req.params;
    
    try {
      console.log(`🔄 Starting group subject refresh for instance: ${instanceId}`);
      
      // Get all groups for this instance that have generic subjects
      const groupsResult = await db.execute(sql`
        SELECT group_jid, subject, instance_id 
        FROM whatsapp.groups 
        WHERE instance_id = ${instanceId} 
        AND (subject = 'Group Chat' OR subject = 'Unknown Group' OR subject LIKE 'Group %')
        ORDER BY updated_at DESC
      `);
      
      const groups = groupsResult.rows;
      console.log(`📊 Found ${groups.length} groups with generic subjects to refresh`);
      
      let updatedCount = 0;
      let errors = 0;
      
      for (const group of groups) {
        try {
          const groupJid = group.group_jid as string;
          console.log(`🔍 Fetching info for group: ${groupJid}`);
          
          const groupInfoResponse = await fetch(`https://evolution-api-evolution-api.vuswn0.easypanel.host/group/findGroup/${instanceId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'B6D711FCDE4D4FD5936544120E713976'
            },
            body: JSON.stringify({
              groupJid: groupJid
            })
          });

          if (groupInfoResponse.ok) {
            const groupInfo: any = await groupInfoResponse.json();
            
            if (groupInfo && groupInfo.subject && groupInfo.subject !== 'Group Chat' && groupInfo.subject !== group.subject) {
              // Update the group subject in database
              await db.execute(sql`
                UPDATE whatsapp.groups 
                SET subject = ${groupInfo.subject}, updated_at = NOW()
                WHERE group_jid = ${groupJid} AND instance_id = ${instanceId}
              `);
              
              // Also update the contact record
              await db.execute(sql`
                UPDATE whatsapp.contacts 
                SET push_name = ${groupInfo.subject}, verified_name = ${groupInfo.subject}, updated_at = NOW()
                WHERE jid = ${groupJid} AND instance_id = ${instanceId}
              `);
              
              console.log(`✅ Updated group subject: ${groupJid} -> "${groupInfo.subject}"`);
              updatedCount++;
            } else {
              console.log(`⚠️ No valid subject found for group: ${groupJid}`);
            }
          } else {
            console.log(`⚠️ API request failed for group ${groupJid}: ${groupInfoResponse.status}`);
            errors++;
          }
          
          // Add small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (groupError) {
          console.error(`❌ Error processing group ${group.group_jid}:`, groupError);
          errors++;
        }
      }
      
      console.log(`🎉 Group subject refresh completed: ${updatedCount} updated, ${errors} errors`);
      
      res.json({
        success: true,
        message: `Refreshed group subjects`,
        totalGroups: groups.length,
        updated: updatedCount,
        errors: errors
      });
      
    } catch (error) {
      console.error('Error refreshing group subjects:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to refresh group subjects',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // WhatsApp webhook handlers
  app.post('/api/evolution/webhook/:instanceName/messages-upsert', async (req: Request, res: Response) => {
    const { instanceName } = req.params;
    const data = req.body;
    
    try {
      await handleWebhookMessagesUpsert(instanceName, data);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error processing messages.upsert webhook:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  app.post('/api/evolution/webhook/:instanceName/groups-upsert', async (req: Request, res: Response) => {
    const { instanceName } = req.params;
    const data = req.body;
    
    try {
      await handleWebhookGroupsUpsert(instanceName, data);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error processing groups.upsert webhook:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  app.post('/api/evolution/webhook/:instanceName/chats-upsert', async (req: Request, res: Response) => {
    const { instanceName } = req.params;
    const data = req.body;
    
    try {
      await handleWebhookChatsUpsert(instanceName, data);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error processing chats.upsert webhook:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  // Helper functions for webhook handlers
  async function handleWebhookMessagesUpsert(instanceName: string, data: any) {
    console.log(`📨 Processing: messages.upsert for ${instanceName}`);
    // Implementation would go here
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

        // Extract proper group subject from various possible fields
        let groupSubject = 'Unknown Group';
        if (group.subject && group.subject !== 'Group Chat') {
          groupSubject = group.subject;
        } else if (group.name && group.name !== 'Group Chat') {
          groupSubject = group.name;
        } else if (group.pushName && group.pushName !== 'Group Chat') {
          groupSubject = group.pushName;
        } else if (group.verifiedName && group.verifiedName !== 'Group Chat') {
          groupSubject = group.verifiedName;
        }

        // Create or update group record
        const groupData = {
          groupJid: groupJid,
          instanceId: instance.instanceId,
          subject: groupSubject,
          description: group.desc || group.description || null,
          ownerJid: group.owner || group.ownerJid || null,
          creationTimestamp: group.creation ? new Date(group.creation * 1000) : new Date(),
          isLocked: group.restrict || false
        };

        console.log(`📝 Processing group ${groupJid} with subject: "${groupSubject}"`);
        
        // If we still have a generic subject, try to fetch the real group info from Evolution API
        if (groupSubject === 'Group Chat' || groupSubject === 'Unknown Group') {
          try {
            console.log(`🔍 Fetching detailed group info for ${groupJid} from Evolution API...`);
            const groupInfoResponse = await fetch(`https://evolution-api-evolution-api.vuswn0.easypanel.host/group/findGroup/${instanceName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': 'B6D711FCDE4D4FD5936544120E713976'
              },
              body: JSON.stringify({
                groupJid: groupJid
              })
            });

            if (groupInfoResponse.ok) {
              const groupInfo: any = await groupInfoResponse.json();
              console.log(`📋 Detailed group info from API:`, JSON.stringify(groupInfo, null, 2));
              
              if (groupInfo && groupInfo.subject && groupInfo.subject !== 'Group Chat') {
                groupSubject = groupInfo.subject;
                groupData.subject = groupSubject;
                console.log(`✅ Updated group subject to: "${groupSubject}"`);
              }
            } else {
              console.log(`⚠️ Could not fetch group info from API: ${groupInfoResponse.status}`);
            }
          } catch (fetchError) {
            console.log(`⚠️ Error fetching group info from API:`, fetchError);
          }
        }

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

  async function handleWebhookChatsUpsert(instanceName: string, data: any) {
    try {
      console.log(`💬 Processing chats.upsert for ${instanceName}:`, data);
      
      const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
      const instances = await storage.getWhatsappInstances(userId);
      const instance = instances.find(inst => inst.instanceId === instanceName);
      
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
            } catch (contactError) {
              console.error(`❌ Error creating contact for ${chatId}:`, contactError);
              continue;
            }
          }

          // Create the chat record
          const chatData = {
            instanceId: instance.instanceId,
            chatId: chatId,
            type: chatType as 'individual' | 'group',
            unreadCount: chat.unreadCount || 0,
            isArchived: chat.archived || false,
            lastMessageTimestamp: chat.t ? new Date(chat.t * 1000) : new Date()
          };

          await storage.createWhatsappChat(chatData);
          console.log(`✅ Created ${chatType} chat: ${chatId}`);

          // If this is a group chat, ensure the group record exists
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

  // Return a mock server for now
  return {} as Server;
}