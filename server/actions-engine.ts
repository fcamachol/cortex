import { storage } from './storage';
import { db } from './db';
import { sql, eq, and } from 'drizzle-orm';
import { 
  whatsappMessages, 
  whatsappContacts,
  actionRules,
  actionExecutions,
  tasks,
  type ActionRule,
  type InsertActionExecution
} from '../shared/schema';
import * as chrono from 'chrono-node';
import { calendarService } from './calendar-service';

export interface TriggerContext {
  messageId: string;
  instanceId: string;
  chatId: string;
  senderJid: string;
  content: string;
  hashtags: string[];
  keywords: string[];
  timestamp: Date;
  fromMe: boolean;
  reaction?: string;
  originalSenderJid?: string;
}

export interface NLPAnalysis {
  suggestedDueDate?: Date;
  extractedLocation?: string;
  isUrgent: boolean;
  needsMeetLink: boolean;
  keywords: string[];
  suggestedPriority: 'low' | 'medium' | 'high';
}

export class ActionsEngine {
  static async executeAction(actionType: string, config: any, context: TriggerContext): Promise<any> {
    console.log(`🎯 Executing action: ${actionType}`);
    
    switch (actionType) {
      case 'create_task':
        return await ActionsEngine.createTask(config, context);
      case 'create_project':
        return await ActionsEngine.createProject(config, context);
      case 'create_note':
        return await ActionsEngine.createNote(config, context);
      case 'store_file':
        return await ActionsEngine.storeFile(config, context);
      case 'create_document':
        return await ActionsEngine.createDocument(config, context);
      case 'create_space':
        return await ActionsEngine.createSpace(config, context);
      case 'create_calendar_event':
        return await ActionsEngine.createCalendarEvent(config, context);
      case 'send_message':
        return await ActionsEngine.sendMessage(config, context);
      case 'add_label':
        return await ActionsEngine.addLabel(config, context);
      case 'send_notification':
        return await ActionsEngine.sendNotification(config, context);
      default:
        console.log(`❌ Unknown action type: ${actionType}`);
        return { success: false, error: `Unknown action type: ${actionType}` };
    }
  }

  static async processMessageForActions(messageContext: TriggerContext) {
    console.log('🔍 Processing message for automated actions');
    
    try {
      // Get all active action rules with multi-instance support
      const rules = await db.execute(sql`
        SELECT * FROM actions.action_rules 
        WHERE is_active = true
        ORDER BY created_at DESC
      `);

      for (const rule of rules.rows) {
        // Check if rule applies to this instance
        if (ActionsEngine.shouldTriggerRule(rule, messageContext) && 
            ActionsEngine.matchesInstanceFilter(rule, messageContext.instanceId)) {
          console.log(`🎯 Triggering rule: ${rule.rule_name} for instance: ${messageContext.instanceId}`);
          
          const result = await ActionsEngine.executeAction(
            rule.action_type,
            rule.action_config,
            messageContext
          );

          // Log execution with proper schema
          await db.execute(sql`
            INSERT INTO actions.action_executions (
              rule_id, triggered_by, trigger_data, status, result, executed_at
            ) VALUES (
              ${rule.rule_id}, 
              ${messageContext.messageId}, 
              ${JSON.stringify(messageContext)}, 
              ${result.success ? 'success' : 'failed'}, 
              ${JSON.stringify(result)}, 
              NOW()
            )
          `);
        }
      }
    } catch (error) {
      console.error('❌ Error processing message for actions:', error);
    }
  }

  private static matchesInstanceFilter(rule: any, instanceId: string): boolean {
    const instanceFilters = rule.instance_filters;
    
    // If no instance filters are set, rule applies to all instances
    if (!instanceFilters || (!instanceFilters.include && !instanceFilters.exclude)) {
      return true;
    }
    
    // Check include filter
    if (instanceFilters.include && Array.isArray(instanceFilters.include)) {
      return instanceFilters.include.includes(instanceId);
    }
    
    // Check exclude filter
    if (instanceFilters.exclude && Array.isArray(instanceFilters.exclude)) {
      return !instanceFilters.exclude.includes(instanceId);
    }
    
    return true;
  }

  private static shouldTriggerRule(rule: any, context: TriggerContext): boolean {
    const trigger = rule.trigger_conditions;
    
    if (!trigger) return false;
    
    // Check hashtag triggers
    if (trigger.hashtags && trigger.hashtags.length > 0) {
      const hasMatchingHashtag = trigger.hashtags.some((tag: string) => 
        context.hashtags.includes(tag)
      );
      if (hasMatchingHashtag) return true;
    }
    
    // Check keyword triggers
    if (trigger.keywords && trigger.keywords.length > 0) {
      const hasMatchingKeyword = trigger.keywords.some((keyword: string) => 
        context.keywords.includes(keyword) || 
        context.content.toLowerCase().includes(keyword.toLowerCase())
      );
      if (hasMatchingKeyword) return true;
    }
    
    // Check reaction triggers
    if (trigger.reactions && trigger.reactions.length > 0 && context.reaction) {
      return trigger.reactions.includes(context.reaction);
    }
    
    return false;
  }

  private static async createTask(config: any, context: TriggerContext): Promise<any> {
    console.log('📝 Creating intelligent task from action trigger');
    
    // Process config templates first
    const processedConfig = {
      title: ActionsEngine.interpolateTemplate(config.title || 'New Task', context),
      description: ActionsEngine.interpolateTemplate(config.description || 'Task description', context),
      priority: config.priority || 'medium'
    };

    console.log('🔄 Processed config templates:', processedConfig);
    
    // Get the current message for conversation context
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
    let taskTitle = processedConfig.title;

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
        const originalContent = quotedMessage[0].content || '';
        const replyContent = currentMessage[0].content || '';
        
        conversationContext = `Original: "${originalContent}"\n\nReply: "${replyContent}"`;
        fullContextText = `${originalContent} ${replyContent}`;
        
        // Use processed title unless we have a better one from conversation
        if (replyContent.length > 5 && replyContent.length < 80) {
          taskTitle = replyContent;
        }
        
        console.log('💬 Conversation context built:', conversationContext);
      }
    }

    // Intelligent NLP analysis of the combined context
    const nlpAnalysis = ActionsEngine.analyzeMessageIntelligently(fullContextText);
    
    // Enhanced description with conversation context and intelligent insights
    let enhancedDescription = processedConfig.description;
    
    // If this task is created from a reaction, include context and NLP insights
    if (context.reaction) {
      if (conversationContext) {
        enhancedDescription = `Task created from reaction ${context.reaction}\n\n${conversationContext}`;
      } else {
        enhancedDescription = `Task created from reaction ${context.reaction}\n\nMessage: "${context.content}"`;
      }
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

    // Use intelligent priority detection
    const intelligentPriority = nlpAnalysis.isUrgent ? 'high' : (processedConfig.priority || nlpAnalysis.suggestedPriority || 'medium');

    // Use intelligent due date if detected
    let dueDate = null;
    if (config.dueDate) {
      dueDate = new Date(config.dueDate);
    } else if (nlpAnalysis.suggestedDueDate) {
      dueDate = nlpAnalysis.suggestedDueDate;
    }

    // Use processed title with intelligent enhancements
    let intelligentTitle = taskTitle;
    if (nlpAnalysis.isUrgent && !intelligentTitle.toLowerCase().includes('urgent')) {
      intelligentTitle = `[URGENT] ${intelligentTitle}`;
    }

    const taskData = {
      userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
      title: intelligentTitle,
      description: enhancedDescription,
      priority: intelligentPriority,
      taskStatus: 'to_do',
      dueDate,
      relatedChatJid: context.chatId,
      originalSenderJid: context.originalSenderJid || context.senderJid,
    };

    console.log('📝 Intelligent task data prepared:', taskData);

    // Save task to database using correct CRM schema
    try {
      const result = await db.execute(sql`
        INSERT INTO crm.tasks (title, description, priority, status, due_date, instance_id, triggering_message_id, related_chat_jid)
        VALUES (${taskData.title}, ${taskData.description}, ${taskData.priority}, ${taskData.taskStatus}, ${taskData.dueDate}, ${context.instanceId}, ${context.messageId}, ${context.chatId})
        RETURNING task_id, title, description, status
      `);
      
      const newTask = result.rows[0];
      
      console.log('✅ Intelligent task saved to database:', newTask);
      
      // Notify clients about new task creation for real-time updates
      ActionsEngine.notifyTaskCreated(newTask);
      
      return { 
        success: true, 
        data: newTask, 
        nlpEnhanced: true, 
        conversationAware: !!conversationContext,
        analysis: nlpAnalysis 
      };
    } catch (error) {
      console.error('❌ Error saving intelligent task to database:', error);
      return { success: false, error: String(error) };
    }
  }

  private static async createCalendarEvent(config: any, context: TriggerContext): Promise<any> {
    console.log('🗓️ Creating intelligent calendar event from reaction trigger');
    
    // Get the current message for conversation context
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
        const originalContent = quotedMessage[0].textContent || '';
        const replyContent = currentMessage[0].textContent || '';
        
        conversationContext = `Original: "${originalContent}"\n\nReply: "${replyContent}"`;
        fullContextText = `${originalContent} ${replyContent}`;
        eventTitle = replyContent.length > 5 ? replyContent : originalContent;
        
        console.log('💬 Conversation context built for calendar event:', conversationContext);
      }
    }

    // Intelligent NLP analysis for calendar event
    const nlpAnalysis = ActionsEngine.analyzeMessageIntelligently(fullContextText);
    
    try {
      // Use calendar service to create the event
      const calendarEvent = await calendarService.createEventFromMessage(
        '7804247f-3ae8-4eb2-8c6d-2c44f967ad42', // Default user ID
        conversationContext || context.content,
        {
          suggestedTitle: eventTitle,
          suggestedDueDate: nlpAnalysis.suggestedDueDate,
          extractedLocation: nlpAnalysis.extractedLocation,
          needsMeetLink: nlpAnalysis.needsMeetLink
        }
      );

      console.log('✅ Calendar event created successfully:', calendarEvent);
      return { 
        success: true, 
        data: calendarEvent, 
        nlpEnhanced: true, 
        conversationAware: !!conversationContext 
      };
    } catch (error) {
      console.error('❌ Error creating calendar event:', error);
      return { success: false, error: String(error) };
    }
  }

  private static async sendMessage(config: any, context: TriggerContext): Promise<any> {
    console.log('📤 Sending automated message');
    const message = ActionsEngine.interpolateTemplate(config.message, context);
    
    // Implementation would send message via WhatsApp API
    console.log('Message to send:', message);
    return { success: true, message };
  }

  private static async addLabel(config: any, context: TriggerContext): Promise<any> {
    console.log('🏷️ Adding label to chat');
    // Implementation would add label to chat
    return { success: true, label: config.label };
  }

  private static async sendNotification(config: any, context: TriggerContext): Promise<any> {
    console.log('🔔 Sending notification');
    // Implementation would send notification
    return { success: true, notification: config.notification };
  }

  static analyzeMessageIntelligently(text: string): NLPAnalysis {
    if (!text || text.trim().length === 0) {
      return {
        isUrgent: false,
        needsMeetLink: false,
        keywords: [],
        suggestedPriority: 'medium'
      };
    }

    // Detect urgency patterns
    const urgencyPatterns = [
      /urgent|emergency|asap|immediately|now|critical|importante|urgente|ya|ahora/i,
      /need.{0,10}(today|tonight|this morning|esta noche|hoy|esta mañana)/i,
      /deadline.{0,10}(today|tomorrow|mañana|hoy)/i
    ];
    
    const isUrgent = urgencyPatterns.some(pattern => pattern.test(text));

    // Detect meeting/call patterns that need meet links
    const meetPatterns = [
      /meeting|call|video|zoom|meet|reunion|llamada|videollamada/i,
      /let.{0,5}s.{0,5}(talk|meet|call|hablar|reunir)/i,
      /schedule.{0,10}(meeting|call|reunion|llamada)/i
    ];
    
    const needsMeetLink = meetPatterns.some(pattern => pattern.test(text));

    // Enhanced date detection using chrono-node
    let date = null;
    try {
      const parsed = chrono.parseDate(text);
      if (parsed && parsed > new Date()) {
        date = parsed;
      }
    } catch (error) {
      console.log('Date parsing error:', error);
    }

    // Intelligent location extraction
    let location = null;
    if (needsMeetLink) {
        location = "Google Meet";
    } else {
        const locationPatterns = [
            /(at|en|in)\s+(the\s+)?(.*?)(?=\s+at|\s+el|\s+a\s+las|$)/i,
            /location:\s*(.*?)(?=\s|$)/i,
            /venue:\s*(.*?)(?=\s|$)/i,
            /lugar:\s*(.*?)(?=\s|$)/i
        ];
        
        for (const pattern of locationPatterns) {
            const match = text.match(pattern);
            if (match && match[3] && match[3].trim().length > 2 && !chrono.parseDate(match[3].trim())) {
                location = match[3].trim();
                break;
            }
        }
    }

    // Extract keywords for intelligent categorization
    const keywords = text.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !['the', 'and', 'for', 'with', 'this', 'that', 'para', 'con', 'que', 'una', 'del'].includes(word))
        .slice(0, 5);

    const result = { 
      suggestedDueDate: date, 
      extractedLocation: location, 
      isUrgent, 
      needsMeetLink, 
      keywords, 
      suggestedPriority: isUrgent ? 'high' : 'medium' as 'low' | 'medium' | 'high'
    };
    
    return result;
  }

  static createIntelligentTitle(templateTitle: string, context: TriggerContext, nlpAnalysis: any): string {
    if (!templateTitle) {
      templateTitle = context.content || 'Task';
    }
    
    let title = ActionsEngine.interpolateTemplate(templateTitle, context);
    
    // Enhance title with context
    if (context.reaction === '✅' && !title.toLowerCase().includes('task')) {
      title = `Task: ${title}`;
    } else if (context.reaction === '📅' && !title.toLowerCase().includes('event')) {
      title = `Event: ${title}`;
    }
    
    return title.length > 100 ? title.substring(0, 97) + '...' : title;
  }

  static extractHashtagsAndKeywords(content: string): { hashtags: string[]; keywords: string[] } {
    // Extract hashtags and remove the # symbol for matching
    const hashtagMatches = content.match(/#\w+/g) || [];
    const hashtags = hashtagMatches.map(tag => tag.substring(1)); // Remove # symbol
    
    const keywords = content.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !['the', 'and', 'for', 'with', 'this', 'that'].includes(word))
      .slice(0, 10);
    
    return { hashtags, keywords };
  }

  static interpolateTemplate(template: string, context: TriggerContext): string {
    if (!template) return '';
    
    // Extract phone number from JID for sender display
    const senderPhone = context.senderJid ? context.senderJid.split('@')[0] : '';
    const chatPhone = context.chatId ? context.chatId.split('@')[0] : '';
    
    return template
      .replace(/\{\{content\}\}/g, context.content || '')
      .replace(/\{\{senderJid\}\}/g, context.senderJid || '')
      .replace(/\{\{sender\}\}/g, senderPhone || context.senderJid || '')
      .replace(/\{\{chatId\}\}/g, context.chatId || '')
      .replace(/\{\{chat\}\}/g, chatPhone || context.chatId || '')
      .replace(/\{\{messageId\}\}/g, context.messageId || '')
      .replace(/\{\{instanceId\}\}/g, context.instanceId || '')
      .replace(/\{\{reaction\}\}/g, context.reaction || '')
      .replace(/\{\{timestamp\}\}/g, context.timestamp.toISOString() || '')
      .replace(/\{\{originalSender\}\}/g, context.originalSenderJid || '');
  }

  // Event notification system for real-time updates
  private static taskUpdateCallbacks: Array<(task: any) => void> = [];

  static onTaskCreated(callback: (task: any) => void) {
    ActionsEngine.taskUpdateCallbacks.push(callback);
  }

  static notifyTaskCreated(task: any) {
    console.log('📢 Broadcasting task creation to', ActionsEngine.taskUpdateCallbacks.length, 'listeners');
    ActionsEngine.taskUpdateCallbacks.forEach(callback => {
      try {
        callback(task);
      } catch (error) {
        console.error('Error in task notification callback:', error);
      }
    });
  }
}