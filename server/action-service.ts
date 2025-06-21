import { storage } from './storage';
import { SseManager } from './sse-manager';
import * as chrono from 'chrono-node';
import { 
    type InsertWhatsappMessage,
    type InsertWhatsappMessageReaction
} from '@shared/schema';

/**
 * @class ActionService
 * @description The "Kitchen / Brain" of the application. It receives clean data
 * objects and orchestrates the complex business logic, such as checking rules,
 * running NLP, calling external APIs, and commanding the storage layer.
 */
export const ActionService = {

    async processNewMessage(cleanMessage: InsertWhatsappMessage): Promise<void> {
        try {
            // First, save the message itself to the database
            await storage.upsertWhatsappMessage(cleanMessage);
            console.log(`✅ [${cleanMessage.instanceId}] Message stored: ${cleanMessage.messageId}`);
            
            // Notify any connected front-end clients about the new message
            // notifyClientsOfNewMessage(cleanMessage);

            // Then, check if this message is a reply that updates an existing task/event
            if (cleanMessage.quotedMessageId) {
                await this.handleReplyToContextMessage(cleanMessage.instanceId, cleanMessage);
            }

            // Check for hashtag-based triggers in message content
            if (cleanMessage.content) {
                await this.processHashtagTriggers(cleanMessage);
            }
        } catch (error) {
            console.error(`❌ Error processing new message ${cleanMessage.messageId}:`, error);
        }
    },

    async processReaction(cleanReaction: InsertWhatsappMessageReaction): Promise<void> {
        try {
            const storedReaction = await storage.upsertWhatsappMessageReaction(cleanReaction);
            console.log(`✅ [${cleanReaction.instanceId}] Reaction stored: ${cleanReaction.reactionEmoji} on ${cleanReaction.messageId}`);
            
            // Notify clients of new reaction via SSE
            SseManager.notifyClientsOfNewReaction(storedReaction);
            
            // Security check - only process reactions from internal users
            // if (!await storage.isInternalUser(cleanReaction.reactorJid)) return;
            
            // Trigger action logic based on reaction
            await this.triggerAction(cleanReaction.instanceId, 'reaction', cleanReaction.reactionEmoji, {
                messageId: cleanReaction.messageId,
                reactorJid: cleanReaction.reactorJid,
                chatId: await this.getChatIdFromMessage(cleanReaction.messageId, cleanReaction.instanceId),
                timestamp: cleanReaction.timestamp
            });
        } catch (error) {
            console.error(`❌ Error processing reaction:`, error);
        }
    },

    async triggerAction(instanceId: string, triggerType: string, triggerValue: string, context: any): Promise<void> {
        console.log(`🧠 ActionService processing trigger: ${triggerType} -> ${triggerValue}`);
        
        try {
            // 1. Find matching action rules from the database
            const matchingRules = await storage.getActionRulesByTrigger(triggerType, triggerValue, instanceId);
            
            console.log(`🔍 Debug: Found ${matchingRules.length} rules for ${triggerType}:${triggerValue}:${instanceId}`);
            console.log(`🔍 Rules data:`, JSON.stringify(matchingRules, null, 2));
            
            if (matchingRules.length === 0) {
                console.log(`📭 No matching action rules found for ${triggerType}: ${triggerValue}`);
                return;
            }

            // 2. Process each matching rule
            for (const rule of matchingRules) {
                console.log(`⚡ Executing action rule: ${rule.rule_name} (${rule.action_type})`);
                
                // 3. Execute the specific action based on rule configuration
                await this.executeAction(rule.action_type, rule.action_config, {
                    instanceId,
                    triggerType,
                    triggerValue,
                    context,
                    rule
                });
            }
        } catch (error) {
            console.error(`❌ Error in triggerAction:`, error);
        }
    },

    async executeAction(actionType: string, config: any, triggerContext: any): Promise<void> {
        switch (actionType) {
            case 'create_task':
                await this.createTaskAction(config, triggerContext);
                break;
            case 'create_calendar_event':
                await this.createCalendarEventAction(config, triggerContext);
                break;
            case 'send_message':
                await this.sendMessageAction(config, triggerContext);
                break;
            case 'add_label':
                await this.addLabelAction(config, triggerContext);
                break;
            default:
                console.log(`⚠️ Unknown action type: ${actionType}`);
        }
    },

    async createTaskAction(config: any, triggerContext: any): Promise<void> {
        console.log('📝 Creating task from action trigger');
        
        // Process template variables in config
        const processedConfig = this.processTemplateVariables(config, triggerContext);
        
        // Use NLP to enhance task creation
        const nlpAnalysis = this.analyzeContentWithNLP(triggerContext.context.content || '');
        
        // Create task with processed data
        const taskData = {
            instanceId: triggerContext.instanceId,
            title: processedConfig.title || `Task from ${triggerContext.triggerType}`,
            description: processedConfig.description || 'Automatically created task',
            priority: nlpAnalysis.isUrgent ? 'high' : (processedConfig.priority || 'medium'),
            status: 'to_do',
            triggeringMessageId: triggerContext.context.messageId,
            relatedChatJid: triggerContext.context.chatId,
            dueDate: nlpAnalysis.suggestedDueDate || (processedConfig.dueDate ? new Date(processedConfig.dueDate) : null)
        };
        
        const createdTask = await storage.createTask(taskData);
        console.log(`✅ Task created: ${taskData.title}`);
        
        // Notify clients of new task via SSE
        SseManager.notifyClientsOfNewTask(createdTask);
    },

    async createCalendarEventAction(config: any, triggerContext: any): Promise<void> {
        console.log('📅 Creating calendar event from action trigger');
        
        const processedConfig = this.processTemplateVariables(config, triggerContext);
        const nlpAnalysis = this.analyzeContentWithNLP(triggerContext.context.content || '');
        
        const eventData = {
            title: processedConfig.title || 'WhatsApp Event',
            description: processedConfig.description || 'Event created from WhatsApp',
            startTime: nlpAnalysis.suggestedDueDate || new Date(),
            endTime: nlpAnalysis.suggestedDueDate ? new Date(nlpAnalysis.suggestedDueDate.getTime() + 3600000) : new Date(Date.now() + 3600000),
            calendarId: 1 // Default calendar
        };
        
        await storage.createCalendarEvent(eventData);
        console.log(`✅ Calendar event created: ${eventData.title}`);
    },

    async sendMessageAction(config: any, triggerContext: any): Promise<void> {
        console.log('💬 Sending message from action trigger');
        // Implementation would depend on your WhatsApp API integration
    },

    async addLabelAction(config: any, triggerContext: any): Promise<void> {
        console.log('🏷️ Adding label from action trigger');
        // Implementation for adding labels to chats/messages
    },

    processTemplateVariables(config: any, triggerContext: any): any {
        const processed = JSON.parse(JSON.stringify(config));
        const context = triggerContext.context;
        
        const replaceVariables = (text: string): string => {
            if (!text || typeof text !== 'string') return text;
            
            return text
                .replace(/\{\{sender\}\}/g, context.reactorJid || context.senderJid || 'Unknown')
                .replace(/\{\{content\}\}/g, context.content || 'No content')
                .replace(/\{\{chatId\}\}/g, context.chatId || 'Unknown chat')
                .replace(/\{\{messageId\}\}/g, context.messageId || 'Unknown message')
                .replace(/\{\{instanceId\}\}/g, triggerContext.instanceId || 'Unknown instance')
                .replace(/\{\{reaction\}\}/g, triggerContext.triggerValue || 'Unknown reaction')
                .replace(/\{\{triggerType\}\}/g, triggerContext.triggerType || 'Unknown trigger');
        };
        
        // Process all string values in config
        Object.keys(processed).forEach(key => {
            if (typeof processed[key] === 'string') {
                processed[key] = replaceVariables(processed[key]);
            }
        });
        
        return processed;
    },

    analyzeContentWithNLP(content: string): any {
        // Basic NLP analysis using chrono for date parsing
        const dates = chrono.parse(content);
        const isUrgent = /urgent|asap|emergency|importante|urgente/i.test(content);
        
        return {
            suggestedDueDate: dates.length > 0 ? dates[0].start.date() : null,
            isUrgent,
            keywords: this.extractKeywords(content)
        };
    },

    extractKeywords(content: string): string[] {
        // Simple keyword extraction
        const words = content.toLowerCase().split(/\s+/);
        return words.filter(word => 
            word.length > 3 && 
            !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'para', 'esto', 'como', 'pero'].includes(word)
        ).slice(0, 5);
    },

    async processHashtagTriggers(message: InsertWhatsappMessage): Promise<void> {
        const hashtags = this.extractHashtags(message.content || '');
        
        for (const hashtag of hashtags) {
            await this.triggerAction(message.instanceId, 'hashtag', hashtag, {
                messageId: message.messageId,
                chatId: message.chatId,
                senderJid: message.senderJid,
                content: message.content
            });
        }
    },

    extractHashtags(content: string): string[] {
        const hashtagRegex = /#(\w+)/g;
        const matches = content.match(hashtagRegex);
        return matches ? matches.map(tag => tag.substring(1)) : [];
    },

    async handleReplyToContextMessage(instanceId: string, replyMessage: InsertWhatsappMessage): Promise<void> {
        console.log(`💡 ActionService processing reply to message: ${replyMessage.quotedMessageId}`);
        
        try {
            // Check if the quoted message is linked to any tasks
            const relatedTasks = await storage.getTasksByTriggeringMessageId(replyMessage.quotedMessageId!, instanceId);
            
            if (relatedTasks.length > 0) {
                // Update tasks with new information from the reply
                for (const task of relatedTasks) {
                    const nlpAnalysis = this.analyzeContentWithNLP(replyMessage.content || '');
                    
                    const updates: any = {};
                    if (nlpAnalysis.suggestedDueDate && !task.dueDate) {
                        updates.dueDate = nlpAnalysis.suggestedDueDate;
                    }
                    if (nlpAnalysis.isUrgent && task.priority !== 'high') {
                        updates.priority = 'high';
                    }
                    
                    // Append reply content to task description
                    updates.description = `${task.description}\n\nUpdate: ${replyMessage.content}`;
                    
                    await storage.updateTask(task.taskId, updates);
                    console.log(`✅ Updated task ${task.taskId} with reply information`);
                }
            }
        } catch (error) {
            console.error(`❌ Error handling reply to context message:`, error);
        }
    },

    async getChatIdFromMessage(messageId: string, instanceId: string): Promise<string | null> {
        try {
            const message = await storage.getWhatsappMessage(messageId, instanceId);
            return message?.chatId || null;
        } catch (error) {
            console.error('Error getting chat ID from message:', error);
            return null;
        }
    }
};