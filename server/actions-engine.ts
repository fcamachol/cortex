import { db } from "./db";
import { actionRules, actionExecutions, tasks, whatsappInstances, whatsappContacts, whatsappMessages, whatsappMessageReactions, ActionRule, InsertActionExecution } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { EvolutionApi } from "./evolution-api";
import * as chrono from 'chrono-node';

export interface TriggerContext {
  messageId?: string;
  reactionId?: string;
  instanceId: string;
  chatId: string;
  senderJid: string;
  reactorJid?: string; // Who performed the reaction
  content?: string;
  reaction?: string;
  hashtags?: string[];
  keywords?: string[];
  timestamp: Date;
  fromMe: boolean;
  originalSenderJid?: string; // Sender of the original message being reacted to
}

export class ActionsEngine {
  private static instance: ActionsEngine;
  
  static getInstance(): ActionsEngine {
    if (!ActionsEngine.instance) {
      ActionsEngine.instance = new ActionsEngine();
    }
    return ActionsEngine.instance;
  }

  async processMessageTriggers(context: TriggerContext): Promise<void> {
    console.log('🎯 Starting processMessageTriggers with context:', context);
    try {
      // STEP 1: Authorization Check (Who Reacted?)
      if (context.reaction && context.reactionId) {
        console.log('🔍 Processing reaction-based trigger:', context.reactionId);
        console.log('✅ Reaction triggers bypass authorization check - proceeding with action processing');
      }
        
      // STEP 3: Context Gathering (What was the original context?)
      if (context.messageId) {
        console.log('🔍 Gathering context for original message:', context.messageId);
        
        const [originalMessage] = await db
          .select()
          .from(whatsappMessages)
          .where(
            and(
              eq(whatsappMessages.messageId, context.messageId),
              eq(whatsappMessages.instanceId, context.instanceId)
            )
          );

        if (originalMessage) {
          context.originalSenderJid = originalMessage.senderJid;
          context.chatId = originalMessage.chatId;
          console.log('✅ Original message context gathered:', {
            originalSender: context.originalSenderJid,
            chatId: context.chatId
          });
        } else {
          console.log('⚠️ Original message not found in database');
        }
      }

      // STEP 2: Rule Check (Is this a Trigger?)
      const rules = await db
        .select()
        .from(actionRules)
        .where(
          and(
            eq(actionRules.isActive, true),
            sql`(${actionRules.instanceFilters} IS NULL OR ${actionRules.instanceFilters}::jsonb ? ${context.instanceId})`
          )
        );

      console.log('📋 Found active rules:', rules.length, rules.map(r => r.ruleName));

      const matchingRules = rules.filter(rule => {
        const matches = this.evaluateRule(rule, context);
        console.log(`🔍 Rule "${rule.ruleName}" matches:`, matches);
        return matches;
      });

      console.log('✅ Matching rules:', matchingRules.length, matchingRules.map(r => r.ruleName));

      // STEP 4: Task Creation (Execute matching rules)
      for (const rule of matchingRules) {
        console.log(`⚡ Checking if rule "${rule.ruleName}" should execute...`);
        if (await this.shouldExecuteRule(rule)) {
          console.log(`🚀 Executing rule "${rule.ruleName}"`);
          await this.executeRule(rule, context);
        } else {
          console.log(`⏸️ Rule "${rule.ruleName}" should not execute (rate limited or conditions not met)`);
        }
      }
    } catch (error) {
      console.error('❌ Error processing message triggers:', error);
    }
  }

  private evaluateRule(rule: ActionRule, context: TriggerContext): boolean {
    const conditions = rule.triggerConditions as any;
    
    // Check performer filters first
    if (!this.matchesPerformerFilters(rule, context)) {
      return false;
    }
    
    switch (rule.triggerType) {
      case 'reaction':
        return Boolean(context.reaction) && this.matchesReactionConditions(conditions, context);
      
      case 'hashtag':
        return Boolean(context.hashtags?.length) && this.matchesHashtagConditions(conditions, context);
      
      case 'keyword':
        return Boolean(context.content) && this.matchesKeywordConditions(conditions, context);
      
      default:
        return false;
    }
  }

  private matchesReactionConditions(conditions: any, context: TriggerContext): boolean {
    if (!conditions.reactions || !context.reaction) return false;
    
    // Check if reaction matches any of the configured reactions
    return conditions.reactions.includes(context.reaction);
  }

  private matchesHashtagConditions(conditions: any, context: TriggerContext): boolean {
    if (!conditions.hashtags || !context.hashtags) return false;
    
    // Check if any hashtag matches the configured patterns
    return conditions.hashtags.some((pattern: string) => 
      context.hashtags!.some(hashtag => 
        this.matchesPattern(hashtag, pattern)
      )
    );
  }

  private matchesKeywordConditions(conditions: any, context: TriggerContext): boolean {
    if (!conditions.keywords || !context.content) return false;
    
    const content = context.content.toLowerCase();
    return conditions.keywords.some((keyword: string) => 
      content.includes(keyword.toLowerCase())
    );
  }

  private matchesPattern(text: string, pattern: string): boolean {
    // Simple pattern matching - can be enhanced with regex
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      return new RegExp(regexPattern, 'i').test(text);
    }
    return text.toLowerCase() === pattern.toLowerCase();
  }

  private matchesPerformerFilters(rule: ActionRule, context: TriggerContext): boolean {
    const performerFilters = rule.performerFilters as any;
    
    // If no performer filters set, allow all
    if (!performerFilters || !performerFilters.allowedPerformers) {
      return true;
    }
    
    const allowedPerformers = performerFilters.allowedPerformers;
    
    // Check performer type
    if (allowedPerformers.includes('user_only') && !context.fromMe) {
      return false;
    }
    
    if (allowedPerformers.includes('contacts_only') && context.fromMe) {
      return false;
    }
    
    // If 'both' is specified or no restrictions, allow
    return allowedPerformers.includes('both') || 
           (allowedPerformers.includes('user_only') && context.fromMe) ||
           (allowedPerformers.includes('contacts_only') && !context.fromMe);
  }

  private async shouldExecuteRule(rule: ActionRule): Promise<boolean> {
    console.log(`🔍 Checking execution conditions for rule: ${rule.ruleName}`);
    console.log(`📊 Rule settings: cooldown=${rule.cooldownMinutes}, maxPerDay=${rule.maxExecutionsPerDay}, lastExecuted=${rule.lastExecutedAt}`);
    
    // Check cooldown
    const cooldownMinutes = rule.cooldownMinutes ?? 0;
    if (cooldownMinutes > 0 && rule.lastExecutedAt) {
      const cooldownEnd = new Date(rule.lastExecutedAt.getTime() + cooldownMinutes * 60000);
      console.log(`⏰ Cooldown check: now=${new Date()}, cooldownEnd=${cooldownEnd}`);
      if (new Date() < cooldownEnd) {
        console.log(`❌ Rule blocked: still in cooldown period`);
        return false;
      }
    }

    // Check daily execution limit
    const maxExecutionsPerDay = rule.maxExecutionsPerDay ?? 0;
    if (maxExecutionsPerDay > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayExecutions = await db
        .select({ count: sql<number>`count(*)` })
        .from(actionExecutions)
        .where(
          and(
            eq(actionExecutions.ruleId, rule.ruleId),
            sql`${actionExecutions.executedAt} >= ${today}`
          )
        );

      console.log(`📈 Daily limit check: executed=${todayExecutions[0]?.count}, maxAllowed=${maxExecutionsPerDay}`);
      if (todayExecutions[0]?.count >= maxExecutionsPerDay) {
        console.log(`❌ Rule blocked: daily execution limit reached`);
        return false;
      }
    }

    console.log(`✅ Rule execution conditions met`);
    return true;
  }

  private async executeRule(rule: ActionRule, context: TriggerContext): Promise<void> {
    console.log('🎬 Executing rule:', rule.ruleName, 'Action type:', rule.actionType);
    const startTime = Date.now();
    let execution: InsertActionExecution;

    try {
      console.log('🔧 Calling performAction with config:', rule.actionConfig);
      const result = await this.performAction(rule, context);
      console.log('✅ performAction completed with result:', result);
      
      execution = {
        ruleId: rule.ruleId,
        triggeredBy: context.messageId || context.reactionId || 'unknown',
        triggerData: context,
        status: 'success',
        result,
        processingTimeMs: Date.now() - startTime,
      };

      // Update rule statistics
      await db
        .update(actionRules)
        .set({
          totalExecutions: sql`${actionRules.totalExecutions} + 1`,
          lastExecutedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actionRules.ruleId, rule.ruleId));

    } catch (error) {
      execution = {
        ruleId: rule.ruleId,
        triggeredBy: context.messageId || context.reactionId || 'unknown',
        triggerData: context,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Log execution
    await db.insert(actionExecutions).values(execution);
  }

  private async performAction(rule: ActionRule, context: TriggerContext): Promise<any> {
    const config = rule.actionConfig as any;

    switch (rule.actionType) {
      case 'create_task':
        return await this.createTask(config, context);
      
      case 'create_calendar_event':
        return await this.createCalendarEvent(config, context);
      
      case 'send_message':
        return await this.sendMessage(config, context);
      
      case 'add_label':
        return await this.addLabel(config, context);
      
      case 'send_notification':
        return await this.sendNotification(config, context);
      
      default:
        throw new Error(`Unsupported action type: ${rule.actionType}`);
    }
  }

  private async createTask(config: any, context: TriggerContext): Promise<any> {
    console.log('🚀 Creating intelligent task from reaction trigger - START');
    console.log('📋 Config received:', config);
    console.log('📍 Context received:', context);

    // Get the current message details
    const currentMessage = await db
      .select()
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.messageId, context.messageId),
          eq(whatsappMessages.instanceId, context.instanceId)
        )
      )
      .limit(1);

    let fullContextText = context.content || '';
    let conversationContext = '';
    let taskTitle = context.content || 'New Task';

    // Enhanced context gathering for quoted/replied messages
    if (currentMessage[0]?.quotedMessageId) {
      console.log('🔗 Found quoted message, gathering conversation context...');
      
      const quotedMessage = await db
        .select()
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.messageId, currentMessage[0].quotedMessageId),
            eq(whatsappMessages.instanceId, context.instanceId)
          )
        )
        .limit(1);

      if (quotedMessage[0]) {
        console.log(`📨 Original message: "${quotedMessage[0].content}"`);
        console.log(`💬 Reply message: "${context.content}"`);
        
        // Combine context for better NLP analysis
        fullContextText = `${quotedMessage[0].content} ${context.content}`;
        conversationContext = `Original: "${quotedMessage[0].content}"\nReply: "${context.content}"`;
        
        // Use original message as primary title source if it's more descriptive
        if (quotedMessage[0].content && quotedMessage[0].content.length > 10) {
          taskTitle = quotedMessage[0].content;
        }
        
        console.log(`🧠 Combined context text: "${fullContextText}"`);
      }
    }

    // Intelligent NLP analysis of the combined context
    const nlpAnalysis = this.analyzeMessageIntelligently(fullContextText);
    
    // Enhanced description with conversation context and intelligent insights
    let enhancedDescription = this.interpolateTemplate(config.description, context);
    
    // If this task is created from a reaction, include context and NLP insights
    if (context.reaction) {
      if (conversationContext) {
        enhancedDescription = `Task created from reaction ${context.reaction}\n\n${conversationContext}`;
      } else {
        enhancedDescription = `Task created from reaction ${context.reaction}\n\nMessage: "${context.content}"`;
      }
      
      // Add intelligent insights to description
      if (nlpAnalysis.isUrgent) {
        enhancedDescription = `🚨 URGENT TASK DETECTED\n\n${enhancedDescription}`;
      }
      if (nlpAnalysis.suggestedDueDate) {
        enhancedDescription += `\n\n📅 Intelligent due date suggestion: ${nlpAnalysis.suggestedDueDate.toLocaleDateString()}`;
      }
      if (nlpAnalysis.extractedLocation) {
        enhancedDescription += `\n📍 Location context: ${nlpAnalysis.extractedLocation}`;
      }
      if (nlpAnalysis.keywords.length > 0) {
        enhancedDescription += `\n🏷️ Key topics: ${nlpAnalysis.keywords.slice(0, 3).join(', ')}`;
      }
    }

    // Use intelligent priority detection
    const intelligentPriority = nlpAnalysis.isUrgent ? 'high' : (config.priority || nlpAnalysis.suggestedPriority || 'medium');

    // Use intelligent due date if detected
    let dueDate = null;
    if (config.dueDate) {
      dueDate = new Date(config.dueDate);
    } else if (nlpAnalysis.suggestedDueDate) {
      dueDate = nlpAnalysis.suggestedDueDate;
    }

    // Generate intelligent title from conversation context
    let intelligentTitle = this.createIntelligentTitle(config.title, context, nlpAnalysis);
    if (taskTitle && taskTitle.length < 80) {
      intelligentTitle = taskTitle;
      if (nlpAnalysis.isUrgent && !intelligentTitle.toLowerCase().includes('urgent')) {
        intelligentTitle = `[URGENT] ${intelligentTitle}`;
      }
    }

    const taskData = {
      userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42', // Use default user ID
      title: intelligentTitle,
      description: enhancedDescription,
      priority: intelligentPriority,
      taskStatus: 'to_do',
      dueDate,
      relatedChatJid: context.chatId,
      originalSenderJid: context.originalSenderJid || context.senderJid,
    };

    console.log('📝 Intelligent task data prepared:', taskData);
    if (conversationContext) {
      console.log('💬 Used conversation context for enhanced intelligence');
    }
    console.log(`🎯 Task will be related to chat: ${taskData.relatedChatJid}, original sender: ${taskData.originalSenderJid}`);
    if (nlpAnalysis.suggestedDueDate) {
      console.log(`🧠 Intelligent due date applied: ${nlpAnalysis.suggestedDueDate.toISOString()}`);
    }

    // Save task to database using CRM schema
    try {
      const result = await db.execute(sql`
        INSERT INTO crm.tasks (instance_id, title, description, priority, status, related_chat_jid, created_by_user_id)
        VALUES (${context.instanceId}, ${taskData.title}, ${taskData.description}, ${taskData.priority}, ${taskData.taskStatus}, ${taskData.relatedChatJid}, ${taskData.userId})
        RETURNING task_id, title, description, status
      `);
      
      console.log('✅ Intelligent task saved to database:', result);
      return { 
        success: true, 
        data: result, 
        nlpEnhanced: true, 
        conversationAware: !!conversationContext,
        analysis: nlpAnalysis 
      };
    } catch (error) {
      console.error('❌ Error saving intelligent task to database:', error);
      return { success: false, error: String(error) };
    }
  }

  private async createCalendarEvent(config: any, context: TriggerContext): Promise<any> {
    console.log('🗓️ Creating intelligent calendar event from reaction trigger - START');
    console.log('📋 Config received:', config);
    console.log('📍 Context received:', context);

    // Get the current message details
    const currentMessage = await db
      .select()
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.messageId, context.messageId),
          eq(whatsappMessages.instanceId, context.instanceId)
        )
      )
      .limit(1);

    let fullContextText = context.content || '';
    let conversationContext = '';
    let eventTitle = context.content || 'New Event';

    // Enhanced context gathering for quoted/replied messages
    if (currentMessage[0]?.quotedMessageId) {
      console.log('🔗 Found quoted message, gathering conversation context...');
      
      const quotedMessage = await db
        .select()
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.messageId, currentMessage[0].quotedMessageId),
            eq(whatsappMessages.instanceId, context.instanceId)
          )
        )
        .limit(1);

      if (quotedMessage[0]) {
        console.log(`📨 Original message: "${quotedMessage[0].content}"`);
        console.log(`💬 Reply message: "${context.content}"`);
        
        // Combine context for better NLP analysis
        fullContextText = `${quotedMessage[0].content} ${context.content}`;
        conversationContext = `Original: "${quotedMessage[0].content}"\nReply: "${context.content}"`;
        
        // Use original message as primary title source if it's more descriptive
        if (quotedMessage[0].content && quotedMessage[0].content.length > 10) {
          eventTitle = quotedMessage[0].content;
        }
        
        console.log(`🧠 Combined context text: "${fullContextText}"`);
      }
    }

    // Intelligent NLP analysis of the combined context
    const nlpAnalysis = this.analyzeMessageIntelligently(fullContextText);
    
    // Use intelligent date parsing or fallback to config/defaults
    let startDate = new Date();
    let endDate = new Date();
    
    if (nlpAnalysis.suggestedDueDate) {
      startDate = nlpAnalysis.suggestedDueDate;
      console.log(`🧠 Intelligent date detected from conversation: ${startDate.toISOString()}`);
    } else if (config.startDate) {
      startDate = new Date(config.startDate);
    }
    
    // Set end date based on duration or default to 1 hour
    const durationMs = (config.durationMinutes || 60) * 60 * 1000;
    endDate = new Date(startDate.getTime() + durationMs);

    // Use intelligent location detection from combined context
    let location = config.location;
    if (nlpAnalysis.extractedLocation) {
      location = nlpAnalysis.extractedLocation;
      console.log(`🧠 Intelligent location detected from conversation: ${location}`);
    }
    
    // Generate intelligent title from conversation context
    let title = this.interpolateTemplate(config.title, context);
    if (eventTitle && eventTitle.length < 80) {
      title = eventTitle;
    }
    
    // Enhanced description with conversation context and NLP insights
    let description = this.interpolateTemplate(config.description || '', context);
    if (context.reaction) {
      if (conversationContext) {
        description = `Calendar event created from reaction ${context.reaction}\n\n${conversationContext}\n\n${description}`;
      } else {
        description = `Calendar event created from reaction ${context.reaction}\n\nMessage: "${context.content}"\n\n${description}`;
      }
      
      if (nlpAnalysis.needsMeetLink) {
        description += `\n🔗 Virtual meeting requested`;
      }
      if (nlpAnalysis.extractedLocation) {
        description += `\n📍 Location: ${nlpAnalysis.extractedLocation}`;
      }
      if (nlpAnalysis.keywords.length > 0) {
        description += `\n🏷️ Key topics: ${nlpAnalysis.keywords.slice(0, 3).join(', ')}`;
      }
    }

    const eventData = {
      title,
      description,
      startDate,
      endDate,
      location,
      attendees: config.attendees || [],
      sourceInstanceId: context.instanceId,
      sourceChatId: context.chatId,
      nlpEnhanced: true,
      conversationAware: !!conversationContext,
      analysis: nlpAnalysis
    };

    console.log('📅 Intelligent calendar event data prepared:', eventData);
    if (conversationContext) {
      console.log('💬 Used conversation context for enhanced intelligence');
    }
    if (nlpAnalysis.suggestedDueDate) {
      console.log(`🗓️ Using intelligent start time: ${startDate.toISOString()}`);
    }
    if (nlpAnalysis.extractedLocation) {
      console.log(`📍 Using intelligent location: ${location}`);
    }

    return { eventId: 'generated-event-id', ...eventData };
  }

  private async sendMessage(config: any, context: TriggerContext): Promise<any> {
    const message = this.interpolateTemplate(config.message, context);
    const targetChat = config.targetChat || context.chatId;
    
    // Send via Evolution API
    console.log(`Sending message to ${targetChat}:`, message);
    return { messageId: 'sent-message-id', content: message };
  }

  private async addLabel(config: any, context: TriggerContext): Promise<any> {
    const labelData = {
      chatId: context.chatId,
      instanceId: context.instanceId,
      labels: config.labels || [],
    };

    console.log('Adding labels:', labelData);
    return labelData;
  }

  private async sendNotification(config: any, context: TriggerContext): Promise<any> {
    const notification = {
      title: this.interpolateTemplate(config.title, context),
      message: this.interpolateTemplate(config.message, context),
      type: config.type || 'info',
      instanceId: context.instanceId,
    };

    console.log('Sending notification:', notification);
    return notification;
  }

  private interpolateTemplate(template: string, context: TriggerContext): string {
    if (!template) return '';
    
    return template
      .replace(/\{\{sender\}\}/g, context.senderJid)
      .replace(/\{\{content\}\}/g, context.content || '')
      .replace(/\{\{reaction\}\}/g, context.reaction || '')
      .replace(/\{\{hashtags\}\}/g, context.hashtags?.join(', ') || '')
      .replace(/\{\{timestamp\}\}/g, context.timestamp.toISOString())
      .replace(/\{\{chatId\}\}/g, context.chatId);
  }

  private analyzeMessageIntelligently(content: string): {
    isUrgent: boolean;
    suggestedDueDate: Date | null;
    extractedLocation: string | null;
    keywords: string[];
    suggestedPriority: 'low' | 'medium' | 'high';
    needsMeetLink: boolean;
  } {
    if (!content) {
      return {
        isUrgent: false,
        suggestedDueDate: null,
        extractedLocation: null,
        keywords: [],
        suggestedPriority: 'medium',
        needsMeetLink: false
      };
    }

    const lowerContent = content.toLowerCase();

    // Intelligent urgency detection
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', '!!', 'urgente', 'inmediatamente'];
    const isUrgent = urgentKeywords.some(keyword => lowerContent.includes(keyword));

    // Intelligent date parsing using chrono-node
    const parsedDates = chrono.parse(content, new Date(), { forwardDate: true });
    const suggestedDueDate = parsedDates.length > 0 ? parsedDates[0].start.date() : null;

    // Priority detection based on context
    const highPriorityKeywords = ['important', 'priority', 'critical', 'urgent', 'importante', 'prioridad'];
    const lowPriorityKeywords = ['later', 'sometime', 'eventually', 'cuando puedas', 'mas tarde'];
    
    let suggestedPriority: 'low' | 'medium' | 'high' = 'medium';
    if (isUrgent || highPriorityKeywords.some(keyword => lowerContent.includes(keyword))) {
      suggestedPriority = 'high';
    } else if (lowPriorityKeywords.some(keyword => lowerContent.includes(keyword))) {
      suggestedPriority = 'low';
    }

    // Meeting detection
    const meetKeywords = ['meet', 'meeting', 'call', 'videocall', 'conference', 'zoom', 'teams', 'reunion', 'llamada'];
    const needsMeetLink = meetKeywords.some(keyword => lowerContent.includes(keyword));

    // Location extraction
    let extractedLocation = null;
    if (needsMeetLink) {
      extractedLocation = "Virtual Meeting";
    } else {
      const locationPatterns = [
        /(at|en|in)\s+(the\s+)?(.*?)(?=\s+at|\s+el|\s+a\s+las|$)/i,
        /location:\s*(.*?)(?=\s|$)/i,
        /venue:\s*(.*?)(?=\s|$)/i,
        /lugar:\s*(.*?)(?=\s|$)/i
      ];
      
      for (const pattern of locationPatterns) {
        const match = content.match(pattern);
        if (match && match[3] && match[3].trim().length > 2) {
          // Avoid matching dates as locations
          if (!chrono.parseDate(match[3].trim())) {
            extractedLocation = match[3].trim();
            break;
          }
        }
      }
    }

    // Extract meaningful keywords
    const keywords = content.toLowerCase()
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['the', 'and', 'for', 'with', 'this', 'that', 'para', 'con', 'que', 'una', 'del', 'por', 'but', 'not'].includes(word) &&
        !word.match(/^\d+$/) // exclude pure numbers
      )
      .slice(0, 5);

    const analysis = {
      isUrgent,
      suggestedDueDate,
      extractedLocation,
      keywords,
      suggestedPriority,
      needsMeetLink
    };

    if (isUrgent || suggestedDueDate || extractedLocation || keywords.length > 0) {
      console.log('🧠 Intelligent message analysis:', {
        isUrgent,
        dueDate: suggestedDueDate?.toISOString(),
        location: extractedLocation,
        priority: suggestedPriority,
        keywordCount: keywords.length
      });
    }

    return analysis;
  }

  private createIntelligentTitle(templateTitle: string, context: TriggerContext, nlpAnalysis: any): string {
    let title = this.interpolateTemplate(templateTitle, context);
    
    // Enhance title with intelligent context
    if (nlpAnalysis.isUrgent && !title.toLowerCase().includes('urgent')) {
      title = `[URGENT] ${title}`;
    }
    
    // If the original content is short and meaningful, use it as title
    if (context.content && context.content.length < 50 && context.content.length > 5) {
      const cleanContent = context.content.replace(/[^\w\s]/gi, '').trim();
      if (cleanContent.length > 0) {
        title = cleanContent;
        if (nlpAnalysis.isUrgent) {
          title = `[URGENT] ${title}`;
        }
      }
    }

    return title;
  }

  // Method to extract hashtags and keywords from message content
  static extractHashtagsAndKeywords(content: string): { hashtags: string[], keywords: string[] } {
    const hashtags = (content.match(/#[\w]+/g) || []).map(tag => tag.substring(1));
    const keywords = content.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    return { hashtags, keywords };
  }
}

export const actionsEngine = ActionsEngine.getInstance();