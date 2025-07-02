/**
 * ACTION PROCESSOR SERVICE
 * 
 * Manages asynchronous processing of webhook events through a database queue.
 * This service handles the complex action processing separately from webhook ingestion
 * to ensure webhook reliability and enable sophisticated NLP processing.
 */

import { ActionService } from '../action-service';
import { Storage } from '../storage';
import { WhatsAppAPIAdapter } from '../adapters/whatsapp-api-adapter';
import { db } from '../db';
import { actionQueue, nlpProcessingLog } from '../../shared/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';

interface NLPResult {
  type: 'calendar' | 'task' | 'bill' | 'note' | 'unknown';
  confidence: number;
  data: any;
  language: string;
  processingTimeMs: number;
}

export class ActionProcessorService {
  private storage: Storage;
  private actionService: ActionService;
  private whatsappAdapter: WhatsAppAPIAdapter;
  private isProcessing = false;
  private processInterval: NodeJS.Timer | null = null;
  private readonly PROCESS_INTERVAL_MS = 2000; // 2 seconds
  private readonly BATCH_SIZE = 5;

  constructor(storage: Storage, actionService: ActionService, whatsappAdapter: WhatsAppAPIAdapter) {
    this.storage = storage;
    this.actionService = actionService;
    this.whatsappAdapter = whatsappAdapter;
  }

  /**
   * Start the action processor with periodic batch processing
   */
  start() {
    if (this.processInterval) {
      console.log('⚠️ Action processor already running');
      return;
    }

    this.processInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processNextBatch().catch(error => {
          console.error('❌ Batch processing error:', error);
        });
      }
    }, this.PROCESS_INTERVAL_MS);

    console.log('🔄 Action processor started - processing every 2 seconds');
  }

  /**
   * Stop the action processor
   */
  stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      console.log('⏹️ Action processor stopped');
    }
  }

  /**
   * Queue an action for processing
   */
  async queueAction(eventType: 'reaction' | 'message' | 'keyword' | 'scheduled', eventData: any): Promise<string> {
    try {
      const result = await db.insert(actionQueue).values({
        eventType,
        eventData,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
      }).returning({ id: actionQueue.id });

      const queueId = result[0].id;
      console.log(`📨 Queued ${eventType} action: ${queueId}`);
      return queueId;
    } catch (error) {
      console.error('❌ Failed to queue action:', error);
      throw error;
    }
  }

  /**
   * Process the next batch of pending actions
   */
  private async processNextBatch() {
    this.isProcessing = true;

    try {
      // Get pending actions using FOR UPDATE SKIP LOCKED for concurrent processing
      // First, get the pending items
      const pendingItems = await db
        .select()
        .from(actionQueue)
        .where(
          and(
            eq(actionQueue.status, 'pending'),
            lt(actionQueue.attempts, actionQueue.maxAttempts)
          )
        )
        .limit(this.BATCH_SIZE);

      if (pendingItems.length === 0) {
        return; // No pending actions
      }

      // Then, update them to processing status
      const itemIds = pendingItems.map(item => item.id);
      const batch = await db
        .update(actionQueue)
        .set({ status: 'processing', processedAt: new Date() })
        .where(inArray(actionQueue.id, itemIds))
        .returning();

      if (batch.length === 0) {
        return; // No pending actions
      }

      console.log(`🔄 Processing batch of ${batch.length} actions`);

      // Process each action in the batch
      for (const queueItem of batch) {
        await this.processAction(queueItem);
      }

    } catch (error) {
      console.error('❌ Batch processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single action from the queue
   */
  private async processAction(queueItem: any) {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Processing ${queueItem.eventType} action: ${queueItem.id}`);

      switch (queueItem.eventType) {
        case 'reaction':
          await this.processReactionAction(queueItem.eventData);
          break;
          
        case 'message':
          await this.processMessageAction(queueItem.eventData);
          break;
          
        case 'keyword':
          await this.processKeywordAction(queueItem.eventData);
          break;
          
        case 'scheduled':
          await this.processScheduledAction(queueItem.eventData);
          break;
          
        default:
          throw new Error(`Unknown event type: ${queueItem.eventType}`);
      }

      // Mark as completed
      await db
        .update(actionQueue)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(actionQueue.id, queueItem.id));

      const processingTime = Date.now() - startTime;
      console.log(`✅ Action ${queueItem.id} processed in ${processingTime}ms`);

    } catch (error) {
      // Update error info and increment attempts
      await db
        .update(actionQueue)
        .set({
          status: 'pending',
          attempts: queueItem.attempts + 1,
          lastError: error instanceof Error ? error.message : String(error),
        })
        .where(eq(actionQueue.id, queueItem.id));

      console.error(`❌ Action ${queueItem.id} failed (attempt ${queueItem.attempts + 1}/${queueItem.maxAttempts}):`, error);

      // Mark as failed if max attempts reached
      if (queueItem.attempts + 1 >= queueItem.maxAttempts) {
        await db
          .update(actionQueue)
          .set({ status: 'failed' })
          .where(eq(actionQueue.id, queueItem.id));
        
        console.error(`💀 Action ${queueItem.id} failed permanently after ${queueItem.maxAttempts} attempts`);
      }
    }
  }

  /**
   * Process a reaction action with optional NLP
   */
  private async processReactionAction(eventData: any) {
    // Handle different data structures from webhooks
    const reactionId = eventData.key?.id || 
                      eventData.reactionId || 
                      eventData.data?.reaction?.id ||
                      eventData.messageId;
    
    const messageId = eventData.message?.reactionMessage?.key?.id || 
                     eventData.messageId || 
                     eventData.data?.reaction?.id ||
                     reactionId;
    
    if (!reactionId || !messageId) {
      throw new Error(`No reaction/message ID found in event data. Available keys: ${Object.keys(eventData)}`);
    }

    // Get the reaction with message content for NLP
    const reactions = await this.storage.getWhatsappMessageReactions({
      messageId: messageId,
      instanceName: eventData.instanceName,
    });

    if (reactions.length === 0) {
      throw new Error('Reaction not found in database');
    }

    const reaction = reactions[0];
    
    // Check for NLP-enabled emojis
    const nlpEmojis = ['📅', '✅', '📝', '💰'];
    if (nlpEmojis.includes(reaction.reaction)) {
      await this.processNLPAction(reaction, eventData);
    } else {
      // Regular action processing (existing logic)
      await this.actionService.triggerSimpleAction(reaction);
    }
  }

  /**
   * Process message action (keyword triggers and reactions)
   */
  private async processMessageAction(eventData: any) {
    // Check if this is actually a reaction event
    if (eventData.event === 'messages.reaction' || eventData.data?.reaction) {
      console.log('🎯 Processing reaction event as message action');
      await this.processReactionAction(eventData);
      return;
    }
    
    // Keyword triggers disabled to prevent unwanted task creation
    console.log('🚫 Message action processing disabled to prevent spurious task creation');
  }

  /**
   * Process keyword action
   */
  private async processKeywordAction(eventData: any) {
    // Keyword triggers disabled to prevent unwanted task creation
    console.log('🚫 Keyword action processing disabled to prevent spurious task creation');
  }

  /**
   * Process scheduled action
   */
  private async processScheduledAction(eventData: any) {
    // Handle scheduled actions (future feature)
    console.log('📅 Processing scheduled action:', eventData);
  }

  /**
   * Process action with NLP analysis
   */
  private async processNLPAction(reaction: any, eventData: any) {
    const startTime = Date.now();
    
    try {
      // Get the message content for NLP analysis
      const message = await this.storage.getWhatsappMessageById(reaction.messageId, reaction.instanceName);
      
      if (!message || !message.content) {
        throw new Error('Message content not found for NLP analysis');
      }

      // Perform NLP analysis
      const nlpResult = await this.performNLPAnalysis(message.content, reaction.reaction);
      
      // Log NLP processing result
      await this.logNLPProcessing(reaction.messageId, reaction.reaction, nlpResult, Date.now() - startTime);

      // Check confidence threshold
      if (nlpResult.confidence < 0.5) {
        // Send error message to user
        await this.sendParsingErrorMessage(reaction, nlpResult);
        return;
      }

      // Process based on NLP result
      await this.executeNLPAction(nlpResult, reaction, message);

    } catch (error) {
      await this.logNLPProcessing(
        reaction.messageId, 
        reaction.reaction, 
        { type: 'unknown', confidence: 0, data: null, language: 'unknown', processingTimeMs: Date.now() - startTime }, 
        Date.now() - startTime,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Perform NLP analysis on message content
   */
  private async performNLPAnalysis(content: string, emoji: string): Promise<NLPResult> {
    const startTime = Date.now();
    
    // For now, implement basic rule-based analysis
    // TODO: Integrate with actual NLP service (OpenAI, Claude, etc.)
    
    let type: NLPResult['type'] = 'unknown';
    let confidence = 0.6; // Default confidence for rule-based analysis
    let extractedData: any = {};

    switch (emoji) {
      case '📅':
        type = 'calendar';
        extractedData = this.extractCalendarData(content);
        break;
        
      case '✅':
        type = 'task';
        extractedData = this.extractTaskData(content);
        break;
        
      case '📝':
        type = 'note';
        extractedData = this.extractNoteData(content);
        break;
        
      case '💰':
        type = 'bill';
        extractedData = this.extractBillData(content);
        break;
    }

    return {
      type,
      confidence,
      data: extractedData,
      language: this.detectLanguage(content),
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Extract calendar event data from message content
   */
  private extractCalendarData(content: string): any {
    // Basic calendar extraction logic
    const data: any = {
      title: content.slice(0, 100), // Use first 100 chars as title
      description: content,
    };

    // Look for date patterns
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})|(\d{1,2}-\d{1,2}-\d{4})/;
    const timePattern = /(\d{1,2}:\d{2})/;
    
    const dateMatch = content.match(datePattern);
    const timeMatch = content.match(timePattern);

    if (dateMatch) {
      data.date = dateMatch[0];
    }
    
    if (timeMatch) {
      data.time = timeMatch[0];
    }

    return data;
  }

  /**
   * Extract task data from message content
   */
  private extractTaskData(content: string): any {
    return {
      title: content.slice(0, 100),
      description: content,
      priority: content.toLowerCase().includes('urgent') ? 'high' : 'medium',
    };
  }

  /**
   * Extract note data from message content
   */
  private extractNoteData(content: string): any {
    return {
      title: content.slice(0, 50),
      content: content,
    };
  }

  /**
   * Extract bill data from message content
   */
  private extractBillData(content: string): any {
    const data: any = {
      description: content,
    };

    // Look for currency amounts
    const amountPattern = /\$?([\d,]+\.?\d*)/;
    const amountMatch = content.match(amountPattern);
    
    if (amountMatch) {
      data.amount = parseFloat(amountMatch[1].replace(',', ''));
    }

    return data;
  }

  /**
   * Detect language of content (basic implementation)
   */
  private detectLanguage(content: string): string {
    // Basic language detection - could be enhanced with proper library
    if (/[ñáéíóúü]/i.test(content)) {
      return 'es';
    }
    return 'en';
  }

  /**
   * Execute action based on NLP analysis result
   */
  private async executeNLPAction(nlpResult: NLPResult, reaction: any, message: any) {
    switch (nlpResult.type) {
      case 'calendar':
        await this.actionService.createCalendarEventAction(reaction, message, nlpResult.data);
        break;
        
      case 'task':
        await this.actionService.createTaskAction(reaction, message, nlpResult.data);
        break;
        
      case 'note':
        // TODO: Implement note creation action
        console.log('📝 Creating note from NLP:', nlpResult.data);
        break;
        
      case 'bill':
        await this.actionService.createFinancialRecordAction(reaction, message, nlpResult.data);
        break;
        
      default:
        throw new Error(`Unknown NLP result type: ${nlpResult.type}`);
    }
  }

  /**
   * Log NLP processing results
   */
  private async logNLPProcessing(
    messageId: string, 
    emoji: string, 
    result: NLPResult, 
    processingTime: number,
    errorMessage?: string
  ) {
    try {
      await db.insert(nlpProcessingLog).values({
        messageId,
        reactionEmoji: emoji,
        parsedType: result.type,
        confidence: result.confidence,
        extractedData: result.data,
        language: result.language,
        success: !errorMessage,
        errorMessage,
        processingTimeMs: processingTime,
      });
    } catch (error) {
      console.error('❌ Failed to log NLP processing:', error);
    }
  }

  /**
   * Send error message when NLP parsing fails
   */
  private async sendParsingErrorMessage(reaction: any, nlpResult: NLPResult) {
    // TODO: Send WhatsApp message to user about parsing failure
    console.log(`⚠️ NLP parsing failed for ${reaction.reaction} (confidence: ${nlpResult.confidence})`);
  }

  /**
   * Get queue statistics for monitoring
   */
  async getQueueStats() {
    const stats = await db
      .select({
        status: actionQueue.status,
        count: db.count(),
      })
      .from(actionQueue)
      .groupBy(actionQueue.status);

    const backlogCount = await db
      .select({ count: db.count() })
      .from(actionQueue)
      .where(eq(actionQueue.status, 'pending'));

    return {
      stats,
      backlog: backlogCount[0]?.count || 0,
      health: (backlogCount[0]?.count || 0) < 100 ? 'healthy' : 'warning',
    };
  }
}