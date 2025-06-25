/**
 * WEBHOOK RELIABILITY SYSTEM
 * Ensures uninterrupted webhook event capture in production deployment
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

interface WebhookEvent {
  id: string;
  timestamp: Date;
  instanceId: string;
  eventType: string;
  payload: any;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  lastError?: string;
}

export class WebhookReliabilityManager extends EventEmitter {
  private eventQueue: WebhookEvent[] = [];
  private processingQueue: Map<string, WebhookEvent> = new Map();
  private maxRetries = 5;
  private retryDelays = [1000, 2000, 5000, 10000, 30000]; // Progressive delays
  private persistencePath = path.join(process.cwd(), 'webhook-backup');
  private isProcessing = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializePersistence();
    this.startHealthCheck();
  }

  /**
   * Initialize file-based persistence for webhook events
   */
  private async initializePersistence() {
    try {
      await fs.mkdir(this.persistencePath, { recursive: true });
      console.log('📂 Webhook persistence initialized');
      
      // Restore pending events on startup
      await this.restorePendingEvents();
    } catch (error) {
      console.error('❌ Failed to initialize webhook persistence:', error);
    }
  }

  /**
   * Capture incoming webhook event with immediate persistence
   */
  async captureWebhookEvent(instanceId: string, eventType: string, payload: any): Promise<string> {
    const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const webhookEvent: WebhookEvent = {
      id: eventId,
      timestamp: new Date(),
      instanceId,
      eventType,
      payload,
      processingStatus: 'pending',
      retryCount: 0
    };

    // Immediate persistence before processing
    await this.persistEvent(webhookEvent);
    
    // Add to processing queue
    this.eventQueue.push(webhookEvent);
    
    console.log(`📥 Webhook event ${eventId} captured for ${instanceId}:${eventType}`);
    
    // Trigger processing if not already running
    if (!this.isProcessing) {
      this.processEventQueue();
    }
    
    return eventId;
  }

  /**
   * Process webhook events with retry logic
   */
  private async processEventQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('🔄 Starting webhook event processing...');
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (!event) continue;
      
      try {
        // Mark as processing
        event.processingStatus = 'processing';
        this.processingQueue.set(event.id, event);
        await this.persistEvent(event);
        
        // Emit for actual processing by webhook handlers
        this.emit('process-webhook', event);
        
        // Mark as completed
        event.processingStatus = 'completed';
        await this.persistEvent(event);
        this.processingQueue.delete(event.id);
        
        console.log(`✅ Webhook event ${event.id} processed successfully`);
        
      } catch (error) {
        console.error(`❌ Failed to process webhook event ${event.id}:`, error);
        
        // Handle retry logic
        event.lastError = error instanceof Error ? error.message : String(error);
        event.retryCount++;
        
        if (event.retryCount <= this.maxRetries) {
          event.processingStatus = 'pending';
          const delay = this.retryDelays[Math.min(event.retryCount - 1, this.retryDelays.length - 1)];
          
          console.log(`🔄 Retrying webhook event ${event.id} in ${delay}ms (attempt ${event.retryCount})`);
          
          // Schedule retry
          setTimeout(() => {
            this.eventQueue.push(event);
            if (!this.isProcessing) {
              this.processEventQueue();
            }
          }, delay);
        } else {
          event.processingStatus = 'failed';
          console.error(`💀 Webhook event ${event.id} failed after ${this.maxRetries} retries`);
        }
        
        await this.persistEvent(event);
        this.processingQueue.delete(event.id);
      }
    }
    
    this.isProcessing = false;
    console.log('✅ Webhook event processing completed');
  }

  /**
   * Persist webhook event to file system
   */
  private async persistEvent(event: WebhookEvent) {
    try {
      const filename = `${event.id}.json`;
      const filepath = path.join(this.persistencePath, filename);
      await fs.writeFile(filepath, JSON.stringify(event, null, 2));
    } catch (error) {
      console.error(`Failed to persist webhook event ${event.id}:`, error);
    }
  }

  /**
   * Restore pending events from file system on startup
   */
  private async restorePendingEvents() {
    try {
      const files = await fs.readdir(this.persistencePath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const filepath = path.join(this.persistencePath, file);
          const content = await fs.readFile(filepath, 'utf-8');
          const event: WebhookEvent = JSON.parse(content);
          
          // Only restore pending or processing events
          if (event.processingStatus === 'pending' || event.processingStatus === 'processing') {
            event.processingStatus = 'pending'; // Reset processing status
            this.eventQueue.push(event);
            console.log(`🔄 Restored pending webhook event ${event.id}`);
          }
        } catch (error) {
          console.error(`Failed to restore webhook event from ${file}:`, error);
        }
      }
      
      if (this.eventQueue.length > 0) {
        console.log(`📥 Restored ${this.eventQueue.length} pending webhook events`);
        this.processEventQueue();
      }
    } catch (error) {
      console.error('Failed to restore pending webhook events:', error);
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      const pendingCount = this.eventQueue.length;
      const processingCount = this.processingQueue.size;
      
      if (pendingCount > 0 || processingCount > 0) {
        console.log(`🏥 Webhook health: ${pendingCount} pending, ${processingCount} processing`);
        
        // Force processing if queue is stuck
        if (pendingCount > 0 && !this.isProcessing) {
          console.log('🚨 Force starting webhook processing - queue was stuck');
          this.processEventQueue();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get system status for monitoring
   */
  getStatus() {
    return {
      queueLength: this.eventQueue.length,
      processingCount: this.processingQueue.size,
      isProcessing: this.isProcessing,
      uptime: process.uptime()
    };
  }

  /**
   * Manual cleanup of completed events
   */
  async cleanupCompletedEvents(olderThanHours = 24) {
    try {
      const files = await fs.readdir(this.persistencePath);
      const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filepath = path.join(this.persistencePath, file);
          const content = await fs.readFile(filepath, 'utf-8');
          const event: WebhookEvent = JSON.parse(content);
          
          if (event.processingStatus === 'completed' && 
              new Date(event.timestamp) < cutoffTime) {
            await fs.unlink(filepath);
            console.log(`🗑️ Cleaned up completed webhook event ${event.id}`);
          }
        } catch (error) {
          console.error(`Failed to cleanup webhook event ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup completed webhook events:', error);
    }
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Wait for current processing to complete
    let attempts = 0;
    while (this.isProcessing && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    console.log('🛑 Webhook reliability manager shutdown complete');
  }
}

// Singleton instance
export const webhookReliability = new WebhookReliabilityManager();