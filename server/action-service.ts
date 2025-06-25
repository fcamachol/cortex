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

    async processNewMessage(storedMessage: any): Promise<void> {
        try {
            console.log(`🔍 Processing new message for actions: ${storedMessage.messageId}`);
            
            // Process business logic with the stored message
            if (storedMessage.quotedMessageId) {
                this.handleReplyToContextMessage(storedMessage.instanceId, storedMessage);
            }

            if (storedMessage.content) {
                // Process hashtag triggers
                this.processHashtagTriggers(storedMessage);
                
                // Process keyword triggers for financial automation
                await this.processKeywordTriggers(storedMessage);
            }
        } catch (error) {
            console.error(`❌ Error processing new message ${storedMessage.messageId}:`, error);
        }
    },

    async processReaction(cleanReaction: InsertWhatsappMessageReaction): Promise<void> {
        try {
            // Store reaction asynchronously without blocking
            storage.upsertWhatsappMessageReaction(cleanReaction).then((storedReaction) => {
                console.log(`✅ [${cleanReaction.instanceId}] Reaction stored: ${cleanReaction.reactionEmoji} on ${cleanReaction.messageId}`);
                // Notify clients of new reaction via SSE
                SseManager.notifyClientsOfNewReaction(storedReaction);
            }).catch(error => {
                console.error(`❌ Error storing reaction:`, error);
            });
            
            // Security check - only process reactions from internal users
            // if (!await storage.isInternalUser(cleanReaction.reactorJid)) return;
            
            // Get the original message content for template processing
            const originalMessage = await storage.getWhatsappMessageById(cleanReaction.messageId, cleanReaction.instanceId);
            console.log(`🔍 Retrieved message for reaction: ${cleanReaction.messageId}`, originalMessage?.content?.substring(0, 50));
            
            // Trigger action logic based on reaction
            await this.triggerAction(cleanReaction.instanceId, 'reaction', cleanReaction.reactionEmoji, {
                messageId: cleanReaction.messageId,
                reactorJid: cleanReaction.reactorJid,
                chatId: originalMessage?.chatId || await this.getChatIdFromMessage(cleanReaction.messageId, cleanReaction.instanceId),
                content: originalMessage?.content || '',
                senderJid: originalMessage?.senderJid || '',
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
            console.log(`🔍 Rules data:`, matchingRules);
            
            // Debug: Check individual rule field access
            if (matchingRules.length > 0) {
                const firstRule = matchingRules[0];
                console.log(`🔍 Rule field debug:`, {
                    ruleName: firstRule.ruleName,
                    actionType: firstRule.actionType,
                    keys: Object.keys(firstRule)
                });
            }
            
            if (matchingRules.length === 0) {
                console.log(`📭 No matching action rules found for ${triggerType}: ${triggerValue}`);
                return;
            }

            // 2. Process each matching rule
            for (const rule of matchingRules) {
                console.log(`⚡ Executing action rule: ${rule.ruleName} (${rule.actionType})`);
                
                // 3. Execute the specific action based on rule configuration
                await this.executeAction(rule.actionType, rule.actionConfig, {
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
        console.log(`🎯 Executing action: ${actionType}`);
        
        switch (actionType) {
            case 'create_task':
                await this.createTaskAction(config, triggerContext);
                break;
            case 'create_note':
                await this.createNoteAction(config, triggerContext);
                break;
            case 'create_financial_record':
                await this.createFinancialRecordAction(config, triggerContext);
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

    async createNoteAction(config: any, triggerContext: any): Promise<void> {
        console.log('📝 Creating note from action trigger');
        
        // Process template variables in config
        const processedConfig = this.processTemplateVariables(config, triggerContext);
        
        // Create note with processed data
        const noteData = {
            title: processedConfig.title || `Note from ${triggerContext.triggerType}`,
            content: processedConfig.content || 'Automatically created note',
            spaceId: processedConfig.spaceId || 1,
            userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
            instanceId: triggerContext.instanceId,
            triggeringMessageId: triggerContext.context.messageId,
            relatedChatJid: triggerContext.context.chatId
        };
        
        console.log('📝 Note data prepared:', noteData);
        
        // Save note to database
        try {
            const createdNote = await storage.createNote(noteData);
            console.log(`✅ Note created: ${noteData.title}`);
            
            // Notify clients of new note via SSE if available
            if (typeof SseManager !== 'undefined' && SseManager.notifyClientsOfNewNote) {
                SseManager.notifyClientsOfNewNote(createdNote);
            }
        } catch (error) {
            console.error('❌ Error creating note:', error);
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

    async processKeywordTriggers(storedMessage: any): Promise<void> {
        if (!storedMessage.content) return;
        
        console.log(`🔍 Processing keyword triggers for: "${storedMessage.content}"`);
        
        // Get all active keyword-based action rules
        const keywordRules = await storage.getActionRulesByTrigger('keyword', storedMessage.content, storedMessage.instanceId);
        
        console.log(`🎯 Found ${keywordRules.length} keyword rules for message`);
        
        for (const rule of keywordRules) {
            console.log(`⚡ Executing keyword action: ${rule.ruleName} (${rule.actionType})`);
            
            await this.executeAction(rule.actionType, rule.actionConfig, {
                instanceId: storedMessage.instanceId,
                triggerType: 'keyword',
                triggerValue: storedMessage.content,
                context: {
                    messageId: storedMessage.messageId,
                    content: storedMessage.content,
                    senderJid: storedMessage.senderJid,
                    chatId: storedMessage.chatJid
                },
                rule
            });
        }
    },

    async createFinancialRecordAction(config: any, triggerContext: any): Promise<void> {
        console.log('💰 Creating financial record from action trigger');
        
        try {
            // Process template variables in config
            const processedConfig = this.processTemplateVariables(config, triggerContext);
            
            console.log('🔄 Processed financial config:', processedConfig);
            
            // Extract financial details from message content using NLP
            const nlpAnalysis = this.analyzeContentWithNLP(triggerContext.context.content || '');
            const extractedAmount = this.extractAmountFromText(triggerContext.context.content || '');
            
            // Create payable record
            const payableData = {
                spaceId: processedConfig.spaceId || 1, // Default space
                description: processedConfig.description || `Bill from WhatsApp: ${triggerContext.context.content}`,
                totalAmount: extractedAmount || processedConfig.amount || 0,
                dueDate: nlpAnalysis.suggestedDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
                status: 'unpaid',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Save payable to database
            const createdPayable = await storage.createPayable(payableData);
            console.log('✅ Payable created:', createdPayable.payableId);
            
            // Create companion payment task
            const taskData = {
                title: processedConfig.taskTitle || `Pay Bill: ${triggerContext.context.senderJid} - $${createdPayable.totalAmount}`,
                description: `Payment task for bill: ${createdPayable.description}\n\nBill Details:\n- Amount: $${createdPayable.totalAmount}\n- Due Date: ${createdPayable.dueDate}\n\nCreated from WhatsApp automation system`,
                priority: nlpAnalysis.isUrgent ? 'high' : 'medium',
                status: 'to_do',
                dueDate: createdPayable.dueDate,
                linkedPayableId: createdPayable.payableId,
                instanceId: triggerContext.instanceId,
                triggeringMessageId: triggerContext.context.messageId,
                relatedChatJid: triggerContext.context.chatId
            };
            
            const createdTask = await storage.createTask(taskData);
            console.log('✅ Payment task created:', createdTask.taskId);
            
            // Log action execution
            await this.logActionExecution(triggerContext.rule, {
                payableId: createdPayable.payableId,
                taskId: createdTask.taskId,
                amount: createdPayable.totalAmount
            });
            
            // Notify clients via SSE
            SseManager.notifyTaskCreated(createdTask);
            
        } catch (error) {
            console.error('❌ Error creating financial record:', error);
        }
    },

    processTemplateVariables(config: any, triggerContext: any): any {
        const processed = JSON.parse(JSON.stringify(config));
        const context = triggerContext.context;
        
        console.log(`🔧 Processing template variables with context:`, {
            messageId: context.messageId,
            content: context.content?.substring(0, 50),
            reactorJid: context.reactorJid,
            senderJid: context.senderJid
        });
        
        const replaceVariables = (text: string): string => {
            if (!text || typeof text !== 'string') return text;
            
            const result = text
                .replace(/\{\{sender\}\}/g, context.reactorJid || context.senderJid || 'Unknown')
                .replace(/\{\{content\}\}/g, context.content || 'No content')
                .replace(/\{\{message_content\}\}/g, context.content || 'No content')
                .replace(/\{\{message_id\}\}/g, context.messageId || 'No ID')
                .replace(/\{\{chatId\}\}/g, context.chatId || 'Unknown chat')
                .replace(/\{\{messageId\}\}/g, context.messageId || 'Unknown message')
                .replace(/\{\{instanceId\}\}/g, triggerContext.instanceId || 'Unknown instance')
                .replace(/\{\{reaction\}\}/g, triggerContext.triggerValue || 'Unknown reaction')
                .replace(/\{\{triggerType\}\}/g, triggerContext.triggerType || 'Unknown trigger');
                
            console.log(`🔧 Template replacement: "${text}" -> "${result}"`);
            return result;
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