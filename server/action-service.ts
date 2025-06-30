import { storage } from './storage';
import { SseManager } from './sse-manager';
import * as chrono from 'chrono-node';
import { nanoid } from 'nanoid';
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
                this.handleReplyToContextMessage(storedMessage.instanceName, storedMessage);
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
                console.log(`✅ [${cleanReaction.instanceName}] Reaction stored: ${cleanReaction.reactionEmoji} on ${cleanReaction.messageId}`);
                // Notify clients of new reaction via SSE
                SseManager.notifyClientsOfNewReaction(storedReaction);
            }).catch(error => {
                console.error(`❌ Error storing reaction:`, error);
            });
            
            // Security check - only process reactions from internal users
            // if (!await storage.isInternalUser(cleanReaction.reactorJid)) return;
            
            // Get the original message content for template processing
            const originalMessage = await storage.getWhatsappMessageById(cleanReaction.messageId, cleanReaction.instanceName);
            console.log(`🔍 Retrieved message for reaction: ${cleanReaction.messageId}`, originalMessage?.content?.substring(0, 50));
            
            // Trigger action logic based on reaction using cortex_automation schema
            await this.triggerAction(cleanReaction.instanceName, 'whatsapp_message', cleanReaction.reactionEmoji || '', {
                messageId: cleanReaction.messageId,
                reactorJid: cleanReaction.reactorJid,
                chatId: originalMessage?.chatId || await this.getChatIdFromMessage(cleanReaction.messageId, cleanReaction.instanceName),
                content: originalMessage?.content || '',
                senderJid: originalMessage?.senderJid || '',
                timestamp: cleanReaction.timestamp,
                eventType: 'reaction',
                emoji: cleanReaction.reactionEmoji || ''
            });
        } catch (error) {
            console.error(`❌ Error processing reaction:`, error);
        }
    },

    async triggerAction(instanceId: string, triggerType: string, triggerValue: string, context: any): Promise<void> {
        console.log(`🧠 ActionService processing trigger: ${triggerType} -> ${triggerValue}`);
        
        try {
            // 1. Find matching action rules from cortex_automation schema
            const potentialRules = await storage.getActionRulesByTrigger(triggerType);
            
            console.log(`🔍 Found ${potentialRules.length} potential rules for ${triggerType}`);
            
            if (potentialRules.length === 0) {
                console.log(`📭 No action rules found for ${triggerType}`);
                return;
            }

            // 2. Filter rules based on conditions matching the context
            const matchingRules = potentialRules.filter(rule => {
                return this.checkRuleConditions(rule.conditions, context);
            });

            console.log(`🎯 Found ${matchingRules.length} matching rules after condition filtering`);

            // 3. Process each matching rule
            for (const rule of matchingRules) {
                console.log(`⚡ Executing action rule: ${rule.name}`);
                
                // 4. Execute each action for this rule
                if (rule.actions && rule.actions.length > 0) {
                    for (const action of rule.actions) {
                        await this.executeAction(action.action_type, action.parameters, {
                            instanceId,
                            triggerType,
                            triggerValue,
                            context,
                            rule,
                            action
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error in triggerAction:`, error);
        }
    },

    checkRuleConditions(conditions: any[], context: any): boolean {
        if (!conditions || conditions.length === 0) {
            return true; // No conditions means rule applies to all
        }

        // For now, implement simple condition checking
        // This can be expanded to handle complex condition groups later
        for (const condition of conditions) {
            if (condition.condition_type === 'message_event' && condition.field_name === 'event_type') {
                if (condition.operator === 'equals' && condition.value !== context.eventType) {
                    return false;
                }
            }
            if (condition.condition_type === 'reaction_emoji' && condition.field_name === 'emoji') {
                if (condition.operator === 'equals' && condition.value !== context.emoji) {
                    return false;
                }
            }
        }

        return true;
    },

    async executeAction(actionType: string, config: any, triggerContext: any): Promise<void> {
        console.log(`🎯 Executing action: ${actionType}`);
        const startTime = Date.now();
        
        try {
            let result: any = null;
            
            switch (actionType) {
                case 'create_task':
                    result = await this.createTaskAction(config, triggerContext);
                    break;
                case 'create_note':
                    result = await this.createNoteAction(config, triggerContext);
                    break;
                case 'create_financial_record':
                    result = await this.createFinancialRecordAction(config, triggerContext);
                    break;
                case 'create_calendar_event':
                    result = await this.createCalendarEventAction(config, triggerContext);
                    break;
                case 'send_message':
                    result = await this.sendMessageAction(config, triggerContext);
                    break;
                case 'add_label':
                    result = await this.addLabelAction(config, triggerContext);
                    break;
                default:
                    console.log(`⚠️ Unknown action type: ${actionType}`);
                    throw new Error(`Unknown action type: ${actionType}`);
            }
            
            // Log successful execution
            await this.logActionExecution(
                triggerContext.rule,
                'success',
                result,
                null,
                Date.now() - startTime,
                triggerContext
            );
            
        } catch (error) {
            console.error(`❌ Error executing action ${actionType}:`, error);
            
            // Log failed execution
            await this.logActionExecution(
                triggerContext.rule,
                'failed',
                null,
                error.message,
                Date.now() - startTime,
                triggerContext
            );
            
            throw error;
        }
    },

    async createNoteAction(config: any, triggerContext: any): Promise<any> {
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
            
            return { noteId: createdNote.noteId, title: noteData.title };
        } catch (error) {
            console.error('❌ Error creating note:', error);
            throw error;
        }
    },

    async createTaskAction(config: any, triggerContext: any): Promise<void> {
        console.log('📝 Creating task from action trigger');
        
        // Process template variables in config
        const processedConfig = this.processTemplateVariables(config, triggerContext);
        
        // Use NLP to enhance task creation
        const nlpAnalysis = this.analyzeContentWithNLP(triggerContext.context.content || '');
        
        // TODO: Get actual userId from authentication context
        // For now, using development placeholder with proper UUID format
        const userId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
        
        // Create task with clean data (no embedded WhatsApp fields)
        const taskData = {
            userId: userId,
            title: processedConfig.title || `Task from ${triggerContext.triggerType}`,
            description: processedConfig.description || 'Automatically created task',
            priority: nlpAnalysis.isUrgent ? 'high' : (processedConfig.priority || 'medium'),
            status: 'to_do',
            dueDate: nlpAnalysis.suggestedDueDate || (processedConfig.dueDate ? new Date(processedConfig.dueDate) : null)
        };
        
        const createdTask = await storage.createTask(taskData);
        console.log(`✅ Task created: ${taskData.title}`);
        
        // Create task-message link using the new junction table
        const linkData = {
            taskId: createdTask.id,
            messageId: triggerContext.context.messageId,
            instanceId: triggerContext.instanceId, // Use instanceId from the trigger context root
            linkType: 'trigger' as const // This message triggered the task creation
        };
        
        await storage.createTaskMessageLink(linkData);
        console.log(`🔗 Task-message link created: ${linkData.linkType}`);
        
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
            instanceId: triggerContext.instanceId,
            ownerUserId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
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
        const keywordRules = await storage.getActionRulesByTrigger('keyword', storedMessage.content, storedMessage.instanceName);
        
        console.log(`🎯 Found ${keywordRules.length} keyword rules for message`);
        
        for (const rule of keywordRules) {
            console.log(`⚡ Executing keyword action: ${rule.ruleName} (${rule.actionType})`);
            
            await this.executeAction(rule.actionType, rule.actionConfig, {
                instanceName: storedMessage.instanceName,
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
                .replace(/\{\{instanceId\}\}/g, triggerContext.instanceName || 'Unknown instance')
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

    extractAmountFromText(text: string): number | null {
        // Extract monetary amounts from text
        const amountRegex = /\$?(\d+(?:\.\d{2})?)/g;
        const matches = text.match(amountRegex);
        if (matches && matches.length > 0) {
            const amount = parseFloat(matches[0].replace('$', ''));
            return isNaN(amount) ? null : amount;
        }
        return null;
    },

    async logActionExecution(
        rule: any, 
        status: string, 
        result: any, 
        errorMessage: string | null, 
        processingTimeMs: number,
        triggerContext: any
    ): Promise<void> {
        try {
            const executionData = {
                ruleId: rule.ruleId,
                triggeredBy: triggerContext.context.messageId || triggerContext.context.reactorJid || 'unknown',
                triggerData: {
                    messageId: triggerContext.context.messageId,
                    content: triggerContext.context.content,
                    senderJid: triggerContext.context.senderJid,
                    reactorJid: triggerContext.context.reactorJid,
                    instanceId: triggerContext.instanceName
                },
                status,
                result,
                errorMessage,
                processingTimeMs
            };
            
            const execution = await storage.createActionExecution(executionData);
            console.log(`📊 Action execution logged: ${execution.executionId} (${status})`);
            
        } catch (error) {
            console.error('❌ Error logging action execution:', error);
        }
    },

    async processHashtagTriggers(message: InsertWhatsappMessage): Promise<void> {
        const hashtags = this.extractHashtags(message.content || '');
        
        for (const hashtag of hashtags) {
            await this.triggerAction(message.instanceName, 'hashtag', hashtag, {
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

    async getChatIdFromMessage(messageId: string, instanceName: string): Promise<string | null> {
        try {
            const message = await storage.getWhatsappMessage(messageId, instanceName);
            return message?.chatId || null;
        } catch (error) {
            console.error('Error getting chat ID from message:', error);
            return null;
        }
    }
};