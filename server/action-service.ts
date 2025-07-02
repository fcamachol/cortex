import { storage } from './storage';
import { SseManager } from './sse-manager';
import * as chrono from 'chrono-node';
import { randomUUID } from 'crypto';
import { nlpService } from './nlp-service';
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
                
                // TEMPORARILY DISABLED: Process keyword triggers to prevent unwanted task creation
                // await this.processKeywordTriggers(storedMessage);
                console.log(`🚫 Keyword triggers disabled to prevent unwanted task creation`);
            }
        } catch (error) {
            console.error(`❌ Error processing new message ${storedMessage.messageId}:`, error);
        }
    },

    async processReaction(cleanReaction: InsertWhatsappMessageReaction): Promise<void> {
        try {
            console.log(`🎯 [ActionService] Processing reaction: ${cleanReaction.reactionEmoji} on message ${cleanReaction.messageId}`);
            
            // Reaction is already stored by the webhook adapter, we just process actions
            
            // Security check - only process reactions from internal users
            // if (!await storage.isInternalUser(cleanReaction.reactorJid)) return;
            
            // Get the original message content for template processing
            const originalMessage = await storage.getWhatsappMessageById(cleanReaction.messageId, cleanReaction.instanceName);
            console.log(`🔍 Retrieved message for reaction: ${cleanReaction.messageId}`, originalMessage?.content?.substring(0, 50));
            console.log(`🔍 Original message sender info:`, {
                senderJid: originalMessage?.senderJid,
                fromMe: originalMessage?.fromMe,
                chatId: originalMessage?.chatId,
                reactorJid: cleanReaction.reactorJid
            });
            
            // Trigger action logic based on reaction using simple actionRules approach
            // For reactions, the "sender" in context should be the person who reacted (reactorJid)
            await this.triggerSimpleAction('reaction', cleanReaction.reactionEmoji || '', {
                messageId: cleanReaction.messageId,
                reactorJid: cleanReaction.reactorJid,
                chatId: originalMessage?.chatId || await this.getChatIdFromMessage(cleanReaction.messageId, cleanReaction.instanceName),
                content: originalMessage?.content || '',
                senderJid: cleanReaction.reactorJid || originalMessage?.senderJid || '', // Use reactor as sender for task creation
                timestamp: cleanReaction.timestamp,
                instanceName: cleanReaction.instanceName,
                emoji: cleanReaction.reactionEmoji || ''
            });
        } catch (error) {
            console.error(`❌ Error processing reaction:`, error);
        }
    },

    async triggerSimpleAction(triggerType: string, triggerValue: string, context: any): Promise<void> {
        console.log(`🧠 ActionService processing simple trigger: ${triggerType} -> ${triggerValue}`);
        
        try {
            // Get matching action rules from the simple actionRules table
            const rules = await storage.getActionRulesByTrigger(triggerType);
            console.log(`🔍 Found ${rules.length} potential rules for ${triggerType}`);
            
            if (rules.length === 0) {
                console.log(`📭 No action rules found for ${triggerType}`);
                return;
            }

            // Filter rules based on conditions (synchronous checks first)
            const initialMatchingRules = rules.filter(rule => {
                if (!rule.isActive) {
                    console.log(`⏭️  Skipping inactive rule: ${rule.name}`);
                    return false;
                }
                
                // Check reaction matching for reaction triggers
                if (triggerType === 'reaction' && rule.trigger_conditions?.reactions) {
                    const allowedReactions = rule.trigger_conditions.reactions;
                    if (Array.isArray(allowedReactions) && !allowedReactions.includes(triggerValue)) {
                        console.log(`⏭️  Skipping rule "${rule.name}" - reaction ${triggerValue} not in allowed list`);
                        return false;
                    }
                }
                
                return true;
            });

            // Filter for performer permissions (async checks)
            const matchingRules = [];
            for (const rule of initialMatchingRules) {
                // Check performer filter - only execute if the right person is reacting
                if (rule.performer_filter === 'user_only') {
                    const reactorJid = context.reactorJid || context.senderJid;
                    const instanceName = context.instanceName;
                    
                    console.log(`🔒 Checking performer filter: reactorJid=${reactorJid}, instanceName=${instanceName}`);
                    
                    // For user_only, the reactor must be the owner of the WhatsApp instance
                    try {
                        // Get the owner JID from the context or check against known instance owners
                        const instanceOwners = {
                            'instance-1750433520122': '5215579188699@s.whatsapp.net',
                            'live-test-1750199771': '15103165094@s.whatsapp.net'
                        };
                        
                        const expectedOwnerJid = instanceOwners[instanceName as keyof typeof instanceOwners];
                        
                        if (!expectedOwnerJid) {
                            console.log(`⏭️  Skipping rule "${rule.name}" - unknown instance ${instanceName}`);
                            continue;
                        }
                        
                        if (reactorJid !== expectedOwnerJid) {
                            console.log(`⏭️  Skipping rule "${rule.name}" - reactor ${reactorJid} is not the instance owner ${expectedOwnerJid}`);
                            continue;
                        }
                        
                        console.log(`✅ Performer filter passed: ${reactorJid} is the owner of ${instanceName}`);
                    } catch (error) {
                        console.error(`❌ Error checking performer filter:`, error);
                        continue;
                    }
                }
                
                matchingRules.push(rule);
            }

            console.log(`🎯 Found ${matchingRules.length} matching rules after filtering`);

            // Execute each matching rule
            for (const rule of matchingRules) {
                console.log(`⚡ Executing simple action rule: ${rule.name}`);
                
                try {
                    await this.executeSimpleAction(rule, context);
                    
                    // Log successful execution
                    await storage.saveActionExecution({
                        rule_id: rule.id,
                        status: 'success',
                        trigger_type: triggerType,
                        trigger_value: triggerValue,
                        context: context,
                        executed_at: new Date()
                    });
                    
                } catch (actionError) {
                    console.error(`❌ Error executing rule ${rule.name}:`, actionError);
                    
                    // Log failed execution
                    await storage.saveActionExecution({
                        rule_id: rule.id,
                        status: 'failure',
                        trigger_type: triggerType,
                        trigger_value: triggerValue,
                        error: actionError.message,
                        executed_at: new Date()
                    });
                }
            }
        } catch (error) {
            console.error(`❌ Error in triggerSimpleAction:`, error);
        }
    },

    async executeSimpleAction(rule: any, context: any): Promise<void> {
        console.log(`🎯 Executing simple action: ${rule.actionType} for rule: ${rule.name}`);
        
        // First, determine which NLP parser to use based on action type
        let nlpParser: string | null = null;
        switch (rule.action_type) {
            case 'create_task':
                nlpParser = 'task';
                break;
            case 'create_calendar_event':
                nlpParser = 'calendar';
                break;
            case 'create_bill_payable':
            case 'create_bill_receivable':
                nlpParser = 'bill';
                break;
            default:
                console.log(`⚠️  Unknown action type: ${rule.action_type}`);
                return;
        }

        // Use NLP to parse the message content if available
        let nlpData = null;
        if (nlpParser && context.content) {
            console.log(`🧠 Running NLP parsing with ${nlpParser} parser for content: "${context.content.substring(0, 100)}..."`);
            try {
                nlpData = await nlpService.parse(context.content, nlpParser);
                console.log(`🧠 NLP parsing result:`, nlpData);
            } catch (error) {
                console.error(`❌ Error in NLP parsing:`, error);
                // Continue without NLP data if parsing fails
            }
        } else {
            console.log(`🧠 Skipping NLP parsing - no parser for ${rule.actionType} or no content available`);
        }

        // Execute the action with enriched context (original + NLP data)
        const enrichedContext = {
            ...context,
            nlp: nlpData // Add NLP parsed data to context
        };

        switch (rule.action_type) {
            case 'create_task':
                await this.createEnhancedTaskAction(rule.action_config, enrichedContext, rule);
                break;
            case 'create_calendar_event':
                await this.createEnhancedCalendarAction(rule.action_config, enrichedContext, rule);
                break;
            case 'create_bill':
                await this.createEnhancedBillAction(rule.action_config, enrichedContext, rule);
                break;
            default:
                console.log(`⚠️  Unknown action type: ${rule.action_type}`);
        }
    },

    async createEnhancedTaskAction(config: any, context: any, rule: any): Promise<void> {
        try {
            console.log(`🧠 Creating enhanced task with NLP data:`, context.nlp);
            
            // Use NLP data if available, otherwise fall back to templates and defaults
            const nlpTask = context.nlp;
            
            const taskData = {
                id: randomUUID(),
                title: nlpTask?.title || this.processTemplate(config.title || 'New Task', context),
                description: nlpTask?.description || this.processTemplate(config.description || '', context),
                status: config.status || rule.status || 'todo',
                priority: nlpTask?.priority || config.priority || 'medium',
                dueDate: nlpTask?.dueDate || null,
                tags: nlpTask?.tags || [],
                createdByEntityId: 'cu_181de66a23864b2fac56779a82189691',
                assignedToEntityId: 'cu_181de66a23864b2fac56779a82189691',
                triggeringMessageId: context.messageId,
                triggeringInstanceName: context.instanceName,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const createdTask = await storage.createTask(taskData);
            
            if (nlpTask) {
                console.log(`✅ Enhanced task created with NLP data: "${createdTask.title}" (priority: ${taskData.priority}, confidence: ${nlpTask.confidence})`);
            } else {
                console.log(`✅ Task created with template data: ${createdTask.title}`);
            }
            
            // Send SSE notification
            SseManager.notifyClientsOfNewTask(createdTask);
            
            return createdTask;
        } catch (error) {
            console.error('❌ Error creating enhanced task:', error);
            throw error;
        }
    },

    async createEnhancedCalendarAction(config: any, context: any, rule: any): Promise<void> {
        try {
            console.log(`🧠 Creating enhanced calendar event with NLP data:`, context.nlp);
            
            const nlpEvent = context.nlp;
            
            // Determine if a Google Meet invite should be created
            const shouldCreateMeetInvite = 
                nlpEvent?.shouldCreateMeetInvite ||          // NLP detected virtual meeting
                config.shouldCreateMeetInvite ||             // Config specifies it
                (nlpEvent?.attendees && nlpEvent.attendees.length > 1); // Multiple attendees likely need virtual access
            
            const startTime = nlpEvent?.startTime || new Date();
            // Use NLP-detected duration if available, otherwise fall back to config or default 60 minutes
            const durationMinutes = nlpEvent?.duration || config.durationMinutes || 60;
            const endTime = nlpEvent?.endTime || new Date(startTime.getTime() + durationMinutes * 60000);
            
            const eventData = {
                id: randomUUID(),
                title: nlpEvent?.title || this.processTemplate(config.title || 'New Event', context),
                description: nlpEvent?.description || this.processTemplate(config.description || '', context),
                start_time: startTime,
                end_time: endTime,
                location: nlpEvent?.location || null,
                created_by_entity_id: 'cu_181de66a23864b2fac56779a82189691',
                created_at: new Date(),
                updated_at: new Date()
            };

            const createdEvent = await storage.createCalendarEvent(eventData);
            
            if (nlpEvent) {
                console.log(`✅ Enhanced calendar event created: "${createdEvent.title}" (confidence: ${nlpEvent.confidence})`);
                if (shouldCreateMeetInvite) {
                    console.log(`📹 Google Meet invite ${nlpEvent.shouldCreateMeetInvite ? 'detected by NLP' : 'configured'} for this event`);
                }
            } else {
                console.log(`✅ Calendar event created with template data: ${createdEvent.title}`);
            }
            
            // TODO: Integrate with Google Calendar service to create actual Google Meet invite if shouldCreateMeetInvite is true
            if (shouldCreateMeetInvite) {
                console.log(`🔗 Would create Google Meet invite for: ${createdEvent.title}`);
            }
            
            return createdEvent;
        } catch (error) {
            console.error('❌ Error creating enhanced calendar event:', error);
            throw error;
        }
    },

    async createEnhancedBillAction(config: any, context: any, rule: any): Promise<void> {
        try {
            console.log(`🧠 Creating enhanced bill with NLP data:`, context.nlp);
            
            const nlpBill = context.nlp;
            
            const billData = {
                id: randomUUID(),
                vendor_name: nlpBill?.vendor || this.processTemplate(config.vendor || 'Unknown Vendor', context),
                amount: nlpBill?.amount || config.amount || 0,
                currency: nlpBill?.currency || config.currency || 'MXN',
                due_date: nlpBill?.dueDate || null,
                category: nlpBill?.category || config.category || 'general',
                description: nlpBill?.description || this.processTemplate(config.description || '', context),
                status: 'pending',
                created_by_entity_id: 'cu_181de66a23864b2fac56779a82189691',
                created_at: new Date(),
                updated_at: new Date()
            };

            const createdBill = await storage.createBillPayable(billData);
            
            if (nlpBill) {
                console.log(`✅ Enhanced bill created: "${createdBill.vendor_name}" ${createdBill.amount} ${createdBill.currency} (confidence: ${nlpBill.confidence})`);
            } else {
                console.log(`✅ Bill created with template data: ${createdBill.vendor_name}`);
            }
            
            return createdBill;
        } catch (error) {
            console.error('❌ Error creating enhanced bill:', error);
            throw error;
        }
    },

    processTemplate(template: string, context: any): string {
        if (!template) return '';
        
        // Extract sender name from JID (e.g., "5215579188699@s.whatsapp.net" -> "5215579188699")
        const senderName = context.senderJid ? context.senderJid.split('@')[0] : 'Unknown';
        
        // Generate task number (simple timestamp-based approach)
        const taskNumber = `TASK-${Date.now().toString().slice(-6)}`;
        
        return template
            .replace(/\{\{content\}\}/g, context.content || '')
            .replace(/\{\{emoji\}\}/g, context.emoji || '')
            .replace(/\{\{messageId\}\}/g, context.messageId || '')
            .replace(/\{\{chatId\}\}/g, context.chatId || '')
            .replace(/\{\{sender\}\}/g, senderName)
            .replace(/\{\{senderJid\}\}/g, context.senderJid || '')
            .replace(/\{\{taskNumber\}\}/g, taskNumber);
    },

    async triggerAction(instanceId: string, triggerType: string, triggerValue: string, context: any): Promise<void> {
        console.log(`🧠 ActionService processing trigger: ${triggerType} -> ${triggerValue} from instance: ${instanceId}`);
        
        try {
            // 1. Find matching action rules from cortex_automation schema
            const potentialRules = await storage.getActionRulesByTrigger(triggerType);
            
            console.log(`🔍 Found ${potentialRules.length} potential rules for ${triggerType}`);
            
            if (potentialRules.length === 0) {
                console.log(`📭 No action rules found for ${triggerType}`);
                return;
            }

            // 2. Filter rules based on instance permissions and conditions
            const matchingRules = potentialRules.filter(rule => {
                // Check if rule applies to this WhatsApp instance
                if (rule.whatsapp_instance_id && rule.whatsapp_instance_id !== instanceId) {
                    console.log(`⏭️  Skipping rule "${rule.name}" - not for instance ${instanceId}`);
                    return false;
                }
                
                // Check user permissions for WhatsApp triggers
                if (triggerType === 'whatsapp_message' && !this.checkUserPermissions(rule, context)) {
                    console.log(`🔒 Skipping rule "${rule.name}" - user permission denied`);
                    return false;
                }
                
                // Check rule conditions (handle both field name formats)
                const conditions = rule.trigger_conditions || rule.conditions || [];
                return this.checkRuleConditions(conditions, context);
            });

            console.log(`🎯 Found ${matchingRules.length} matching rules after filtering`);

            // 3. Process each matching rule
            for (const rule of matchingRules) {
                console.log(`⚡ Executing action rule: ${rule.name} for instance: ${instanceId}`);
                
                // 4. Execute the action for this rule (simple structure)
                // Handle both camelCase and snake_case field names
                const actionType = rule.action_type || rule.actionType;
                const actionConfig = rule.action_config || rule.actionConfig || {};
                
                console.log(`🔍 Rule structure:`, { 
                    action_type: rule.action_type, 
                    actionType: rule.actionType,
                    action_config: rule.action_config,
                    actionConfig: rule.actionConfig 
                });
                
                if (actionType) {
                    console.log(`🎯 About to execute action: ${actionType}`);
                    try {
                        await this.executeAction(actionType, actionConfig, {
                            instanceId,
                            triggerType,
                            triggerValue,
                            context,
                            rule
                        });
                        console.log(`✅ Action ${actionType} completed successfully`);
                    } catch (actionError) {
                        console.error(`❌ Error executing action ${actionType}:`, actionError);
                    }
                } else if (rule.actions && rule.actions.length > 0) {
                    // Support complex multi-action rules
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

    checkUserPermissions(rule: any, context: any): boolean {
        // Use cortex_automation field names: performer_filter instead of trigger_permission
        const performerFilter = rule.performer_filter || rule.trigger_permission;
        
        // If no permission set, default to anyone can trigger
        if (!performerFilter) {
            return true;
        }
        
        switch (performerFilter) {
            case 'anyone':
                return true;
                
            case 'user_only':
            case 'me':
                // Check if the sender is the rule creator (owner)
                return context.senderJid === rule.created_by || context.reactorJid === rule.created_by;
                
            case 'users':
                // Check if sender is in allowed users list
                if (!rule.allowed_user_ids || rule.allowed_user_ids.length === 0) {
                    return false;
                }
                const senderJid = context.senderJid || context.reactorJid;
                return rule.allowed_user_ids.includes(senderJid);
                
            default:
                return false;
        }
    },

    checkRuleConditions(conditions: any, context: any): boolean {
        try {
            console.log(`🔍 Checking rule conditions:`, { conditions, context });
            
            if (!conditions) {
                console.log(`✅ No conditions - rule applies to all`);
                return true;
            }

            // New cortex_automation format - object with specific keys
            if (typeof conditions === 'object' && !Array.isArray(conditions)) {
                // Check reaction conditions
                if (conditions.reactions && Array.isArray(conditions.reactions)) {
                    const emoji = context.emoji || context.triggerValue;
                    if (!conditions.reactions.includes(emoji)) {
                        console.log(`🔍 Emoji "${emoji}" not in allowed reactions:`, conditions.reactions);
                        return false;
                    }
                    console.log(`✅ Emoji "${emoji}" matches reaction condition`);
                    return true;
                }
                
                // Check keyword conditions
                if (conditions.keywords && Array.isArray(conditions.keywords)) {
                    const content = context.content || context.messageContent || '';
                    const hasKeyword = conditions.keywords.some((keyword: string) => 
                        content.toLowerCase().includes(keyword.toLowerCase())
                    );
                    if (!hasKeyword) {
                        console.log(`🔍 No matching keywords found in: ${content}`);
                        return false;
                    }
                    console.log(`✅ Keyword condition matched`);
                    return true;
                }
                
                console.log(`✅ Object conditions passed - no specific conditions to check`);
                return true;
            }

            // Legacy array format handling
            if (Array.isArray(conditions)) {
                console.log(`🔍 Processing legacy array conditions`);
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
            }

            console.log(`✅ Unknown condition format - defaulting to allow`);
            return true;
            
        } catch (error) {
            console.error(`❌ Error in checkRuleConditions:`, error);
            return false;
        }
    },

    async executeAction(actionType: string, config: any, triggerContext: any): Promise<void> {
        console.log(`🎯 Executing action: ${actionType}`);
        console.log(`🔍 Action config:`, config);
        console.log(`🔍 Trigger context:`, {
            instanceId: triggerContext.instanceId,
            triggerType: triggerContext.triggerType,
            triggerValue: triggerContext.triggerValue,
            contextData: triggerContext.context
        });
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
        console.log('🔍 DEBUG triggerContext:', {
            triggerType: triggerContext.triggerType,
            instanceId: triggerContext.instanceId,
            context: {
                messageId: triggerContext.context.messageId,
                content: triggerContext.context.content?.substring(0, 100),
                reactorJid: triggerContext.context.reactorJid,
                senderJid: triggerContext.context.senderJid,
                chatId: triggerContext.context.chatId
            }
        });
        
        // Process template variables in config
        const processedConfig = this.processTemplateVariables(config, triggerContext);
        console.log('🔍 DEBUG processedConfig:', processedConfig);
        
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
            status: 'todo',
            dueDate: nlpAnalysis.suggestedDueDate || (processedConfig.dueDate ? new Date(processedConfig.dueDate) : null),
            // Add WhatsApp tracking fields with correct field names for database
            triggeringMessageId: triggerContext.context.messageId,
            triggeringInstanceName: triggerContext.context.instanceName || triggerContext.instanceId
        };
        
        console.log('🔍 DEBUG taskData before creation:', {
            title: taskData.title,
            description: taskData.description,
            triggeringMessageId: taskData.triggeringMessageId,
            triggeringInstanceName: taskData.triggeringInstanceName
        });
        
        const createdTask = await storage.createTask(taskData);
        console.log(`✅ Task created: ${taskData.title} (ID: ${createdTask.id})`);
        
        // Create task-message link using the new junction table
        const linkData = {
            taskId: createdTask.id,
            messageId: triggerContext.context.messageId,
            instanceId: triggerContext.instanceId, // Use instanceId from the trigger context root
            linkType: 'trigger' as const // This message triggered the task creation
        };
        
        console.log('🔍 DEBUG linkData:', linkData);
        await storage.createTaskMessageLink(linkData);
        console.log(`🔗 Task-message link created: ${linkData.linkType}`);
        
        // Notify clients of new task via SSE
        SseManager.notifyClientsOfNewTask(createdTask);
    },

    async createCalendarEventAction(config: any, triggerContext: any): Promise<void> {
        console.log('📅 Creating calendar event from action trigger');
        
        const processedConfig = this.processTemplateVariables(config, triggerContext);
        
        // Use enhanced NLP parsing for calendar events
        const nlpResult = await NLPService.parseCalendarEvent(
            triggerContext.context.content || '',
            triggerContext.context.emoji || ''
        );
        
        console.log('🧠 NLP Calendar Analysis:', nlpResult);
        
        // Determine Google Meet invite creation
        const shouldCreateMeetInvite = nlpResult.shouldCreateMeetInvite || 
                                     processedConfig.shouldCreateMeetInvite || 
                                     false;
        
        const eventData = {
            title: nlpResult.title || processedConfig.title || 'WhatsApp Event',
            description: nlpResult.description || processedConfig.description || 'Event created from WhatsApp',
            startTime: nlpResult.startTime || new Date(),
            endTime: nlpResult.endTime || new Date(Date.now() + (nlpResult.durationMinutes || 60) * 60000),
            location: nlpResult.location || processedConfig.location || '',
            duration: nlpResult.durationMinutes || processedConfig.durationMinutes || 60,
            shouldCreateMeetInvite: shouldCreateMeetInvite,
            instanceId: triggerContext.instanceId,
            ownerUserId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
            calendarId: 1 // Default calendar
        };
        
        console.log('📅 Creating enhanced calendar event:', {
            title: eventData.title,
            startTime: eventData.startTime,
            endTime: eventData.endTime,
            duration: eventData.duration,
            location: eventData.location,
            shouldCreateMeetInvite: eventData.shouldCreateMeetInvite
        });
        
        const createdEvent = await storage.createCalendarEvent(eventData);
        console.log(`✅ Enhanced calendar event created: ${eventData.title} (ID: ${createdEvent.id})`);
        
        // Log NLP processing for monitoring
        try {
            await this.logNLPProcessing(
                triggerContext.context.messageId,
                triggerContext.context.emoji || '',
                nlpResult,
                createdEvent
            );
        } catch (logError) {
            console.warn('⚠️ Failed to log NLP processing:', logError.message);
        }
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
        
        // Get all active keyword-based action rules using the simple method
        const keywordRules = await storage.getActionRulesByTrigger('keyword', storedMessage.instanceName);
        
        console.log(`🎯 Found ${keywordRules.length} keyword rules for message`);
        
        // Filter rules that actually match the message content
        const matchingRules = keywordRules.filter(rule => {
            const conditions = rule.triggerConditions || {};
            const keywords = conditions.keywords || [];
            return keywords.some((keyword: string) => 
                storedMessage.content.toLowerCase().includes(keyword.toLowerCase())
            );
        });
        
        console.log(`🎯 Found ${matchingRules.length} matching keyword rules`);
        
        for (const rule of matchingRules) {
            console.log(`⚡ Executing keyword action: ${rule.name}`);
            
            // Use the new simple action architecture
            await this.triggerSimpleAction('keyword', storedMessage.content, {
                instanceName: storedMessage.instanceName,
                messageId: storedMessage.messageId,
                content: storedMessage.content,
                senderJid: storedMessage.senderJid,
                chatId: storedMessage.chatJid
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
                status: 'todo',
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
            
            const execution = await storage.saveActionExecution({
                rule_id: rule.id,
                status,
                result: JSON.stringify(result),
                error_message: errorMessage,
                processing_time_ms: processingTimeMs,
                trigger_data: JSON.stringify(executionData.triggerData)
            });
            console.log(`📊 Action execution logged: ${rule.id} (${status})`);
            
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
            const message = await storage.getWhatsappMessageById(messageId, instanceName);
            return message?.chatId || null;
        } catch (error) {
            console.error('Error getting chat ID from message:', error);
            return null;
        }
    }
};