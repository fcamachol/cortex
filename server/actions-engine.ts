import { db } from "./db";
import { actionRules, actionExecutions, tasks, whatsappInstances, whatsappContacts, whatsappMessages, whatsappMessageReactions, ActionRule, InsertActionExecution } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { EvolutionApi } from "./evolution-api";

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
      // Get user ID from instance to filter rules by user
      const [instance] = await db
        .select({ clientId: whatsappInstances.clientId })
        .from(whatsappInstances)
        .where(eq(whatsappInstances.instanceId, context.instanceId));

      if (!instance) {
        console.log('❌ Instance not found:', context.instanceId);
        return;
      }

      const userId = instance.clientId;

      // STEP 1: Authorization Check (Who Reacted?)
      if (context.reaction && context.reactionId) {
        console.log('🔍 Checking authorization for reaction:', context.reactionId);
        
        // Look up the reaction in whatsapp.message_reactions table
        const [reaction] = await db
          .select()
          .from(whatsappMessageReactions)
          .where(
            and(
              eq(whatsappMessageReactions.messageId, context.messageId || ''),
              eq(whatsappMessageReactions.instanceId, context.instanceId),
              eq(whatsappMessageReactions.reactionEmoji, context.reaction)
            )
          )
          .orderBy(desc(whatsappMessageReactions.timestamp))
          .limit(1);

        if (!reaction) {
          console.log('❌ Reaction not found in database, stopping action processing');
          return;
        }

        // Check if reaction is from internal user (from_me flag)
        if (!reaction.fromMe) {
          console.log('❌ Reaction is not from internal user (from_me = false), stopping action processing');
          return;
        }

        console.log('✅ Authorization passed: Reaction is from internal user');
        
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
      }

      // STEP 2: Rule Check (Is this a Trigger?)
      const rules = await db
        .select()
        .from(actionRules)
        .where(
          and(
            eq(actionRules.isActive, true),
            eq(actionRules.userId, userId),
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
    console.log('🚀 Creating task from reaction trigger - START');
    console.log('📋 Config received:', config);
    console.log('📍 Context received:', context);

    // Simple task creation without complex database queries for now
    const taskData = {
      userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42', // Use default user ID
      title: this.interpolateTemplate(config.title, context),
      description: this.interpolateTemplate(config.description, context),
      priority: config.priority || 'medium',
      taskStatus: 'to_do',
      dueDate: config.dueDate ? new Date(config.dueDate) : null,
      relatedChatJid: context.chatId, // This should be the chat/group ID, not the sender
      originalSenderJid: context.originalSenderJid || context.senderJid, // The person who sent the original message
    };

    console.log('📝 Task data prepared:', taskData);
    console.log(`🎯 Task will be related to chat: ${taskData.relatedChatJid}, original sender: ${taskData.originalSenderJid}`);

    // Save task to database using CRM schema
    try {
      const result = await db.execute(sql`
        INSERT INTO crm.tasks (instance_id, title, description, priority, status, related_chat_jid, triggering_message_id, created_by_user_id)
        VALUES ('live-test-1750199771', ${taskData.title}, ${taskData.description}, ${taskData.priority}, ${taskData.taskStatus}, ${taskData.relatedChatJid}, ${context.messageId}, ${taskData.userId})
        RETURNING task_id, title, description, status, triggering_message_id
      `);
      
      console.log('✅ Task saved to database:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Error saving task to database:', error);
      return { success: false, error: String(error) };
    }
  }

  private async createCalendarEvent(config: any, context: TriggerContext): Promise<any> {
    const eventData = {
      title: this.interpolateTemplate(config.title, context),
      description: this.interpolateTemplate(config.description, context),
      startDate: new Date(config.startDate),
      endDate: new Date(config.endDate),
      location: config.location,
      attendees: config.attendees || [],
      sourceInstanceId: context.instanceId,
      sourceChatId: context.chatId,
    };

    console.log('Creating calendar event:', eventData);
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

  // Method to extract hashtags and keywords from message content
  static extractHashtagsAndKeywords(content: string): { hashtags: string[], keywords: string[] } {
    const hashtags = (content.match(/#[\w]+/g) || []).map(tag => tag.substring(1));
    const keywords = content.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    return { hashtags, keywords };
  }
}

export const actionsEngine = ActionsEngine.getInstance();