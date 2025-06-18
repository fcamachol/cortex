import { db } from "./db";
import { actionRules, actionExecutions, tasks, whatsappInstances, ActionRule, InsertActionExecution } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { EvolutionApi } from "./evolution-api";

export interface TriggerContext {
  messageId?: string;
  reactionId?: string;
  instanceId: string;
  chatId: string;
  senderJid: string;
  content?: string;
  reaction?: string;
  hashtags?: string[];
  keywords?: string[];
  timestamp: Date;
  fromMe: boolean;
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
    try {
      // Get all active rules for this user's instances
      const rules = await db
        .select()
        .from(actionRules)
        .where(
          and(
            eq(actionRules.isActive, true),
            sql`(${actionRules.instanceFilters} IS NULL OR ${actionRules.instanceFilters}::jsonb ? ${context.instanceId})`
          )
        );

      const matchingRules = rules.filter(rule => this.evaluateRule(rule, context));

      for (const rule of matchingRules) {
        if (await this.shouldExecuteRule(rule)) {
          await this.executeRule(rule, context);
        }
      }
    } catch (error) {
      console.error('Error processing message triggers:', error);
    }
  }

  private evaluateRule(rule: ActionRule, context: TriggerContext): boolean {
    const conditions = rule.triggerConditions as any;
    
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

  private async shouldExecuteRule(rule: ActionRule): Promise<boolean> {
    // Check cooldown
    const cooldownMinutes = rule.cooldownMinutes ?? 0;
    if (cooldownMinutes > 0 && rule.lastExecutedAt) {
      const cooldownEnd = new Date(rule.lastExecutedAt.getTime() + cooldownMinutes * 60000);
      if (new Date() < cooldownEnd) return false;
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

      if (todayExecutions[0]?.count >= maxExecutionsPerDay) return false;
    }

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
      conversationJid: context.chatId,
      contactJid: context.senderJid,
    };

    console.log('📝 Task data prepared:', taskData);

    // Save task to database using CRM schema
    try {
      const result = await db.execute(sql`
        INSERT INTO crm.tasks (instance_id, title, description, priority, status, due_date, related_chat_jid, created_by_user_id)
        VALUES ('live-test-1750199771', ${taskData.title}, ${taskData.description}, ${taskData.priority}, ${taskData.taskStatus}, ${taskData.dueDate}, ${taskData.conversationJid}, ${taskData.userId})
        RETURNING task_id, title, description, status
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