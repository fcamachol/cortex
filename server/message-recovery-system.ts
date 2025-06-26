/**
 * Message Recovery System
 * Prevents message loss due to database timeouts, malformed data, and processing failures
 */

import fs from 'fs/promises';
import path from 'path';
import { storage } from './storage';

interface FailedMessage {
  id: string;
  timestamp: number;
  instanceId: string;
  originalPayload: any;
  error: string;
  retryCount: number;
  lastRetry: number;
  eventType: string;
}

export class MessageRecoverySystem {
  private failedMessagesDir = path.join(process.cwd(), 'failed-messages');
  private maxRetries = 5;
  private retryIntervals = [1000, 5000, 15000, 30000, 60000]; // Progressive backoff

  constructor() {
    this.ensureDirectoryExists();
    this.startRecoveryScheduler();
  }

  private async ensureDirectoryExists() {
    try {
      await fs.mkdir(this.failedMessagesDir, { recursive: true });
    } catch (error) {
      console.error('❌ Failed to create failed-messages directory:', error);
    }
  }

  /**
   * Capture a failed message for later recovery
   */
  async captureFailedMessage(
    instanceId: string,
    eventType: string,
    payload: any,
    error: string
  ): Promise<void> {
    try {
      const failedMessage: FailedMessage = {
        id: `${instanceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        instanceId,
        originalPayload: payload,
        error,
        retryCount: 0,
        lastRetry: 0,
        eventType
      };

      const filePath = path.join(this.failedMessagesDir, `${failedMessage.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(failedMessage, null, 2));
      
      console.log(`💾 Captured failed message for recovery: ${failedMessage.id}`);
    } catch (err) {
      console.error('❌ Failed to capture failed message:', err);
    }
  }

  /**
   * Attempt to recover and process failed messages
   */
  private async processFailedMessages(): Promise<void> {
    try {
      const files = await fs.readdir(this.failedMessagesDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      for (const file of jsonFiles) {
        const filePath = path.join(this.failedMessagesDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const failedMessage: FailedMessage = JSON.parse(content);

          // Check if it's time for retry
          const now = Date.now();
          const timeSinceLastRetry = now - failedMessage.lastRetry;
          const requiredInterval = this.retryIntervals[Math.min(failedMessage.retryCount, this.retryIntervals.length - 1)];

          if (timeSinceLastRetry < requiredInterval) {
            continue; // Not time to retry yet
          }

          // Attempt recovery
          const recovered = await this.attemptMessageRecovery(failedMessage);
          
          if (recovered) {
            // Success - remove the failed message file
            await fs.unlink(filePath);
            console.log(`✅ Successfully recovered message: ${failedMessage.id}`);
          } else {
            // Update retry count
            failedMessage.retryCount++;
            failedMessage.lastRetry = now;

            if (failedMessage.retryCount >= this.maxRetries) {
              // Move to dead letter queue
              await this.moveToDeadLetter(failedMessage, filePath);
              console.log(`💀 Moved message to dead letter queue after ${this.maxRetries} attempts: ${failedMessage.id}`);
            } else {
              // Update the file with new retry info
              await fs.writeFile(filePath, JSON.stringify(failedMessage, null, 2));
              console.log(`🔄 Retry ${failedMessage.retryCount} scheduled for message: ${failedMessage.id}`);
            }
          }
        } catch (err) {
          console.error(`❌ Failed to process recovery file ${file}:`, err);
        }
      }
    } catch (err) {
      console.error('❌ Failed to process failed messages directory:', err);
    }
  }

  /**
   * Attempt to recover a specific failed message
   */
  private async attemptMessageRecovery(failedMessage: FailedMessage): Promise<boolean> {
    try {
      console.log(`🔄 Attempting recovery for message: ${failedMessage.id}`);

      // Sanitize and validate the payload
      const sanitizedPayload = this.sanitizePayload(failedMessage.originalPayload);
      
      if (!sanitizedPayload) {
        console.log(`❌ Cannot sanitize payload for message: ${failedMessage.id}`);
        return false;
      }

      // Check database connectivity first
      const dbHealthy = await this.checkDatabaseHealth();
      if (!dbHealthy) {
        console.log(`❌ Database unhealthy, postponing recovery for: ${failedMessage.id}`);
        return false;
      }

      // Attempt to process the message through the normal pipeline
      switch (failedMessage.eventType) {
        case 'messages.upsert':
        case 'messages-upsert':
        case 'messages.update':
        case 'messages-update':
          return await this.recoverMessage(sanitizedPayload, failedMessage.instanceId);
        case 'contacts.upsert':
        case 'contacts-upsert':
        case 'contacts.update':
        case 'contacts-update':
          return await this.recoverContact(sanitizedPayload, failedMessage.instanceId);
        case 'chats.upsert':
        case 'chats-upsert':
        case 'chats.update':
        case 'chats-update':
          return await this.recoverChat(sanitizedPayload, failedMessage.instanceId);
        default:
          console.log(`❌ Unknown event type for recovery: ${failedMessage.eventType}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ Recovery attempt failed for ${failedMessage.id}:`, error);
      return false;
    }
  }

  /**
   * Sanitize payload to fix common issues like malformed chat IDs
   */
  private sanitizePayload(payload: any): any | null {
    try {
      if (!payload || !payload.data) {
        return null;
      }

      const sanitized = JSON.parse(JSON.stringify(payload));

      // Fix malformed chat IDs
      if (sanitized.data.key?.remoteJid) {
        const jid = sanitized.data.key.remoteJid;
        
        // Fix malformed group JIDs
        if (!jid.includes('@') && jid.length > 10) {
          // Likely a malformed group JID - try to reconstruct
          if (jid.match(/[0-9]+/)) {
            sanitized.data.key.remoteJid = `${jid}@g.us`;
          }
        }
        
        // Fix malformed individual JIDs
        if (!jid.includes('@') && jid.length <= 15) {
          sanitized.data.key.remoteJid = `${jid}@s.whatsapp.net`;
        }
      }

      // Fix contact data
      if (sanitized.data.id && !sanitized.data.id.includes('@')) {
        if (sanitized.data.id.length > 10) {
          sanitized.data.id = `${sanitized.data.id}@g.us`;
        } else {
          sanitized.data.id = `${sanitized.data.id}@s.whatsapp.net`;
        }
      }

      // Ensure required fields exist
      if (sanitized.data.key && !sanitized.data.key.id) {
        sanitized.data.key.id = `recovered-${Date.now()}`;
      }

      return sanitized;
    } catch (error) {
      console.error('❌ Failed to sanitize payload:', error);
      return null;
    }
  }

  /**
   * Check if database is healthy before attempting recovery
   */
  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Simple database health check
      await storage.getWhatsappInstances('health-check');
      return true;
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return false;
    }
  }

  /**
   * Recover a specific message
   */
  private async recoverMessage(payload: any, instanceId: string): Promise<boolean> {
    try {
      const messageData = payload.data;
      
      // Ensure chat exists first
      if (messageData.key?.remoteJid) {
        await storage.ensureChatExists(messageData.key.remoteJid, instanceId);
      }

      // Create message record
      const message = {
        messageId: messageData.key?.id || `recovered-${Date.now()}`,
        instanceName: instanceId, // Use instanceName field for consistency
        chatId: messageData.key?.remoteJid || 'unknown',
        senderJid: messageData.key?.fromMe ? `system@${instanceId}` : messageData.key?.remoteJid || 'unknown',
        fromMe: messageData.key?.fromMe || false,
        messageType: messageData.messageType || 'text',
        content: messageData.message?.conversation || messageData.message?.text || '[Recovered Message]',
        timestamp: new Date(messageData.messageTimestamp * 1000 || Date.now()),
        quotedMessageId: messageData.message?.extendedTextMessage?.contextInfo?.stanzaId || null,
        isForwarded: false,
        forwardingScore: 0,
        isStarred: false,
        isEdited: false,
        lastEditedAt: null,
        sourcePlatform: 'recovered',
        rawApiPayload: payload
      };

      await storage.upsertWhatsappMessage(message);
      console.log(`✅ Successfully recovered message: ${message.messageId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to recover message:', error);
      return false;
    }
  }

  /**
   * Recover a contact
   */
  private async recoverContact(payload: any, instanceId: string): Promise<boolean> {
    try {
      const contactData = payload.data;
      
      const contact = {
        jid: contactData.id || 'unknown',
        instanceName: instanceId, // Use instanceName field for consistency
        pushName: contactData.name || contactData.pushName || 'Unknown',
        verifiedName: contactData.verifiedName || null,
        profilePictureUrl: contactData.profilePictureUrl || null,
        isBusiness: contactData.isBusiness || false,
        isMe: contactData.isMe || false,
        isBlocked: contactData.isBlocked || false
      };

      await storage.upsertWhatsappContact(contact);
      console.log(`✅ Successfully recovered contact: ${contact.jid}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to recover contact:', error);
      return false;
    }
  }

  /**
   * Recover a chat
   */
  private async recoverChat(payload: any, instanceId: string): Promise<boolean> {
    try {
      const chatData = payload.data;
      
      const chat = {
        chatId: chatData.id || 'unknown',
        instanceName: instanceId, // Use instanceName field for consistency
        type: (chatData.id?.includes('@g.us') ? 'group' : 'individual') as 'group' | 'individual',
        unreadCount: chatData.unreadCount || 0,
        isArchived: chatData.archived || false,
        isPinned: chatData.pinned || false,
        isMuted: chatData.muted || false,
        muteEndTimestamp: null,
        lastMessageTimestamp: chatData.conversationTimestamp ? new Date(chatData.conversationTimestamp * 1000) : null
      };

      await storage.upsertWhatsappChat(chat);
      console.log(`✅ Successfully recovered chat: ${chat.chatId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to recover chat:', error);
      return false;
    }
  }

  /**
   * Move failed message to dead letter queue
   */
  private async moveToDeadLetter(failedMessage: FailedMessage, originalPath: string): Promise<void> {
    try {
      const deadLetterDir = path.join(this.failedMessagesDir, 'dead-letter');
      await fs.mkdir(deadLetterDir, { recursive: true });
      
      const deadLetterPath = path.join(deadLetterDir, path.basename(originalPath));
      await fs.rename(originalPath, deadLetterPath);
      
      console.log(`💀 Moved to dead letter queue: ${failedMessage.id}`);
    } catch (error) {
      console.error('❌ Failed to move to dead letter queue:', error);
    }
  }

  /**
   * Start the recovery scheduler
   */
  private startRecoveryScheduler(): void {
    // Process failed messages every 30 seconds
    setInterval(() => {
      this.processFailedMessages().catch(err => {
        console.error('❌ Recovery scheduler error:', err);
      });
    }, 30000);

    console.log('🔄 Message recovery scheduler started');
  }

  /**
   * Get recovery system status
   */
  async getStatus(): Promise<any> {
    try {
      const files = await fs.readdir(this.failedMessagesDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const deadLetterDir = path.join(this.failedMessagesDir, 'dead-letter');
      let deadLetterFiles = [];
      try {
        deadLetterFiles = await fs.readdir(deadLetterDir);
      } catch (err) {
        // Dead letter directory doesn't exist yet
      }

      return {
        pendingRecovery: jsonFiles.length,
        deadLetterQueue: deadLetterFiles.length,
        maxRetries: this.maxRetries,
        healthy: true
      };
    } catch (error) {
      return {
        pendingRecovery: 0,
        deadLetterQueue: 0,
        maxRetries: this.maxRetries,
        healthy: false,
        error: error.message
      };
    }
  }
}

export const messageRecovery = new MessageRecoverySystem();