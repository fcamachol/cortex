import { Request, Response } from 'express';
import * as chrono from 'chrono-node';
import { actionsEngine, TriggerContext } from './actions-engine';

export const IntelligentNLP = {
    /**
     * Enhanced NLP parsing for intelligent date, location, and context extraction
     */
    parseMessageForIntelligentContext(text: string): { 
        date: Date | null, 
        location: string | null, 
        isUrgent: boolean,
        needsMeetLink: boolean,
        keywords: string[],
        priority: 'low' | 'medium' | 'high'
    } {
        if (!text) return { 
            date: null, 
            location: null, 
            isUrgent: false, 
            needsMeetLink: false, 
            keywords: [],
            priority: 'medium'
        };

        const lowerText = text.toLowerCase();
        
        // Parse dates with chrono-node
        const parsedResults = chrono.parse(text, new Date(), { forwardDate: true });
        const date = parsedResults.length > 0 ? parsedResults[0].start.date() : null;

        // Intelligent urgency detection
        const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', '!!', 'urgente', 'inmediatamente'];
        const isUrgent = urgentKeywords.some(keyword => lowerText.includes(keyword));

        // Priority detection
        const highPriorityKeywords = ['important', 'priority', 'critical', 'urgent', 'importante', 'prioridad'];
        const lowPriorityKeywords = ['later', 'sometime', 'eventually', 'cuando puedas', 'mas tarde'];
        
        let priority: 'low' | 'medium' | 'high' = 'medium';
        if (isUrgent || highPriorityKeywords.some(keyword => lowerText.includes(keyword))) {
            priority = 'high';
        } else if (lowPriorityKeywords.some(keyword => lowerText.includes(keyword))) {
            priority = 'low';
        }

        // Intelligent meeting detection
        const meetKeywords = ['meet', 'meeting', 'call', 'videocall', 'conference', 'zoom', 'teams', 'reunion', 'llamada'];
        const needsMeetLink = meetKeywords.some(keyword => lowerText.includes(keyword));

        // Intelligent location extraction
        let location = null;
        if (needsMeetLink) {
            location = "Google Meet"; // Indicates need for meet link generation
        } else {
            // Try to extract physical locations
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
            .slice(0, 5); // Limit to top 5 keywords

        const result = { date, location, isUrgent, needsMeetLink, keywords, priority };
        
        if (date || location || isUrgent || needsMeetLink || priority !== 'medium') {
            console.log(`🧠 Intelligent NLP analysis completed:`, {
                date: date?.toISOString(),
                location,
                isUrgent,
                needsMeetLink,
                priority,
                keywordCount: keywords.length
            });
        }

        return result;
    },

    /**
     * Creates intelligent task descriptions with NLP insights
     */
    createIntelligentTaskDescription(originalContent: string, senderJid: string, nlpResult: any): string {
        let description = `Task created from intelligent reaction processing\n\n`;
        description += `Original message: "${originalContent}"\n`;
        description += `From: ${senderJid}\n\n`;

        if (nlpResult.isUrgent) {
            description += `🚨 URGENT: High priority task detected\n`;
        }
        if (nlpResult.date) {
            description += `📅 Suggested due date: ${nlpResult.date.toLocaleDateString()}\n`;
        }
        if (nlpResult.location) {
            description += `📍 Location context: ${nlpResult.location}\n`;
        }
        if (nlpResult.keywords.length > 0) {
            description += `🏷️ Key topics: ${nlpResult.keywords.join(', ')}\n`;
        }

        description += `\n${originalContent}`;
        return description;
    },

    /**
     * Enhanced template interpolation with NLP context
     */
    interpolateIntelligentTemplate(template: string, context: any, nlpResult?: any): string {
        let result = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return context[key] || match;
        });

        // Add intelligent enhancements based on NLP
        if (nlpResult) {
            if (nlpResult.isUrgent && !result.toLowerCase().includes('urgent')) {
                result = `[URGENT] ${result}`;
            }
            if (nlpResult.date && !template.includes('{{date}}')) {
                result += ` (Due: ${nlpResult.date.toLocaleDateString()})`;
            }
        }

        return result;
    }
};

export const IntelligentWebhookController = {
    /**
     * Main entry point for all incoming webhooks from the Evolution API
     */
    async handleIncomingEvent(req: Request, res: Response) {
        try {
            const instanceName = req.params.instanceName;
            const eventPayload = req.body;
            res.status(200).json({ status: "received", instance: instanceName });
            await this.processEvolutionEvent(instanceName, eventPayload);
        } catch (error) {
            console.error('❌ Critical error in webhook handler:', error);
        }
    },

    /**
     * Routes the event to the appropriate handler based on its type
     */
    async processEvolutionEvent(instanceId: string, event: any) {
        const { event: eventType, data, sender } = event;
        console.log(`📨 Intelligent Webhook Event: ${eventType} for instance ${instanceId}`);

        switch (eventType) {
            case 'messages.upsert':
                if (data.message?.reactionMessage) {
                    await this.handleReaction(instanceId, data, sender);
                } else {
                    await this.handleMessageUpsert(instanceId, data);
                }
                break;
            case 'messages.update':
                if (data.updates && data.updates[0]?.message?.reactionMessage) {
                    await this.handleReaction(instanceId, data.updates[0], sender);
                } else {
                    await this.handleMessageUpdate(instanceId, data);
                }
                break;
            default:
                console.log(`🎯 Unhandled event type: ${eventType}`);
        }
    },

    /**
     * Handles reaction events with intelligent context awareness
     */
    async handleReaction(instanceId: string, reactionData: any, reactorJid: string) {
        const reactionEmoji = reactionData.message?.reactionMessage?.text;
        const targetMessageId = reactionData.message?.reactionMessage?.key?.id;

        if (!reactionEmoji || !targetMessageId) {
            console.log('⚠️ Invalid reaction data received');
            return;
        }

        console.log(`👍 Intelligent reaction processing: '${reactionEmoji}' on message ${targetMessageId} by ${reactorJid}`);
        await this.triggerIntelligentAction(instanceId, 'reaction', reactionEmoji, { 
            messageId: targetMessageId, 
            reactorJid 
        });
    },

    /**
     * Central intelligent action trigger with NLP and context awareness
     */
    async triggerIntelligentAction(instanceId: string, triggerType: 'reaction' | 'hashtag', triggerValue: string, context: { messageId: string, reactorJid: string }) {
        // Find action rule
        const rules = await db
            .select()
            .from(actionRules)
            .where(and(
                eq(actionRules.isActive, true),
                eq(actionRules.triggerType, triggerType)
            ));

        const rule = rules.find(r => {
            const conditions = r.triggerConditions as any;
            if (triggerType === 'reaction') {
                return conditions.reactions?.includes(triggerValue);
            }
            return false;
        });

        if (!rule) {
            console.log(`🔍 No intelligent rule found for trigger: ${triggerType} -> ${triggerValue}`);
            return;
        }

        // Check if task already exists for this message
        const existingTaskLink = await this.findTaskLinkByMessage(instanceId, context.messageId);

        if (existingTaskLink) {
            if (rule.actionType === 'update_task_status') {
                const actionConfig = rule.actionConfig as any;
                const newStatus = actionConfig?.new_status || 'completed';
                await this.updateTaskStatus(existingTaskLink.task_id, newStatus);
                console.log(`✅ Updated task ${existingTaskLink.task_id} status to '${newStatus}' intelligently`);
            } else {
                console.log(`🎯 Task ${existingTaskLink.task_id} already exists for this trigger`);
            }
        } else {
            // Get triggering message for context
            const triggeringMessage = await this.getWhatsappMessage(instanceId, context.messageId);
            if (!triggeringMessage) {
                console.error(`❌ Could not find triggering message ${context.messageId}`);
                return;
            }

            if (rule.actionType === 'create_task') {
                await this.createIntelligentTask(instanceId, rule, triggeringMessage, context);
            } else if (rule.actionType === 'create_calendar_event') {
                await this.createIntelligentCalendarEvent(instanceId, rule, triggeringMessage, context);
            } else {
                console.log(`🎯 Unhandled intelligent action type: ${rule.actionType}`);
            }
        }

        // Record execution
        await db.insert(actionExecutions).values({
            executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ruleId: rule.ruleId,
            triggeredByMessageId: context.messageId,
            triggeredByReactorJid: context.reactorJid,
            executionTimestamp: new Date(),
            executionStatus: 'completed',
            executionResult: { success: true, intelligentProcessing: true }
        });
    },

    /**
     * Creates intelligent tasks with NLP parsing and context awareness
     */
    async createIntelligentTask(instanceId: string, rule: any, triggeringMessage: any, context: any) {
        // Check for parent task (if replying to another task)
        let parentTaskId = null;
        if (triggeringMessage.quotedMessageId) {
            const parentTaskLink = await this.findTaskLinkByMessage(instanceId, triggeringMessage.quotedMessageId);
            if (parentTaskLink) {
                parentTaskId = parentTaskLink.task_id;
                console.log(`🔗 Creating subtask under parent task ${parentTaskId}`);
            }
        }

        // Use NLP to extract intelligent context
        const nlpResult = this.parseMessageForNlp(triggeringMessage.content || '');
        const actionConfig = rule.actionConfig as any;

        // Create task with intelligent defaults
        const taskData = {
            userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42', // Should come from context
            spaceId: 1, // Should be determined from instance/chat context
            title: this.interpolateTemplate(actionConfig?.title || '{{content}}', {
                content: triggeringMessage.content,
                sender: context.reactorJid,
                date: new Date().toISOString()
            }),
            description: this.createIntelligentDescription(triggeringMessage, context, nlpResult),
            priority: actionConfig?.priority || (nlpResult.isUrgent ? 'high' : 'medium'),
            taskStatus: 'to_do' as const,
            dueDate: nlpResult.date || null,
            parentTaskId,
            relatedChatJid: triggeringMessage.chatId,
            originalSenderJid: triggeringMessage.senderJid,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const [newTask] = await db.insert(crmTasks).values(taskData).returning();
        
        // Create intelligent task-message links
        await this.createTaskMessageLink(newTask.taskId, context.messageId, instanceId, 'trigger');
        if (triggeringMessage.quotedMessageId) {
            await this.createTaskMessageLink(newTask.taskId, triggeringMessage.quotedMessageId, instanceId, 'context');
        }

        console.log(`✅ Created intelligent task ${newTask.taskId} with NLP enhancement`);
        if (nlpResult.date) {
            console.log(`📅 Intelligent due date detected: ${nlpResult.date.toISOString()}`);
        }
        if (nlpResult.location) {
            console.log(`📍 Intelligent location detected: ${nlpResult.location}`);
        }
    },

    /**
     * Creates intelligent calendar events with NLP and Google Meet integration
     */
    async createIntelligentCalendarEvent(instanceId: string, rule: any, triggeringMessage: any, context: any) {
        const nlpResult = this.parseMessageForNlp(triggeringMessage.content || '');
        const actionConfig = rule.actionConfig as any;

        const eventTitle = this.interpolateTemplate(
            actionConfig?.title || '{{content}}',
            { content: triggeringMessage.content, sender: context.reactorJid }
        );

        const eventStartTime = nlpResult.date || new Date();
        const eventEndTime = nlpResult.date 
            ? new Date(nlpResult.date.getTime() + 60*60*1000) 
            : new Date(Date.now() + 60*60*1000);
        let eventLocation = nlpResult.location;

        // Intelligent attendee detection
        const attendeesToInvite: string[] = [];
        const contactDetails = await this.getContactDetailsByJid(instanceId, triggeringMessage.senderJid);
        if (contactDetails?.emailAddress) {
            attendeesToInvite.push(contactDetails.emailAddress);
        }

        // Intelligent Google Meet integration
        if (nlpResult.needsMeetLink) {
            const googleEvent = await googleCalendarApi.createEvent({
                title: eventTitle,
                startTime: eventStartTime,
                endTime: eventEndTime,
                attendees: attendeesToInvite
            });
            if (googleEvent.success) {
                eventLocation = googleEvent.htmlLink;
                console.log(`🔗 Intelligent Google Meet link created: ${eventLocation}`);
            }
        }

        // Create calendar event
        const eventData = {
            eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
            spaceId: 1,
            title: eventTitle,
            description: this.createIntelligentDescription(triggeringMessage, context, nlpResult),
            startTime: eventStartTime,
            endTime: eventEndTime,
            location: eventLocation,
            relatedChatJid: triggeringMessage.chatId,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const [newEvent] = await db.insert(crmCalendarEvents).values(eventData).returning();
        await this.createEventMessageLink(newEvent.eventId, context.messageId, instanceId, 'trigger');

        console.log(`✅ Created intelligent calendar event ${newEvent.eventId} with NLP enhancement`);
    },

    /**
     * Advanced NLP parsing for intelligent date, location, and context extraction
     */
    parseMessageForNlp(text: string): { 
        date: Date | null, 
        location: string | null, 
        isUrgent: boolean,
        needsMeetLink: boolean,
        keywords: string[]
    } {
        if (!text) return { date: null, location: null, isUrgent: false, needsMeetLink: false, keywords: [] };

        const lowerText = text.toLowerCase();
        
        // Parse dates with chrono-node
        const parsedResults = chrono.parse(text, new Date(), { forwardDate: true });
        const date = parsedResults.length > 0 ? parsedResults[0].start.date() : null;

        // Intelligent urgency detection
        const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'urgent!', '!!'];
        const isUrgent = urgentKeywords.some(keyword => lowerText.includes(keyword));

        // Intelligent meeting detection
        const meetKeywords = ['meet', 'meeting', 'call', 'videocall', 'conference', 'zoom', 'teams'];
        const needsMeetLink = meetKeywords.some(keyword => lowerText.includes(keyword));

        // Intelligent location extraction
        let location = null;
        if (needsMeetLink) {
            location = "https://meet.google.com/new"; // Will be replaced with actual link
        } else {
            // Try to extract physical locations
            const locationPatterns = [
                /(at|en|in)\s+(the\s+)?(.*?)(?=\s+at|\s+el|\s+a\s+las|$)/i,
                /location:\s*(.*?)(?=\s|$)/i,
                /venue:\s*(.*?)(?=\s|$)/i
            ];
            
            for (const pattern of locationPatterns) {
                const match = text.match(pattern);
                if (match && match[3] && !chrono.parseDate(match[3].trim())) {
                    location = match[3].trim();
                    break;
                }
            }
        }

        // Extract keywords for intelligent categorization
        const keywords = text.toLowerCase().split(/\s+/).filter(word => 
            word.length > 3 && !['the', 'and', 'for', 'with', 'this', 'that'].includes(word)
        );

        const result = { date, location, isUrgent, needsMeetLink, keywords };
        
        if (date || location || isUrgent || needsMeetLink) {
            console.log(`🧠 Intelligent NLP analysis:`, {
                date: date?.toISOString(),
                location,
                isUrgent,
                needsMeetLink,
                keywordCount: keywords.length
            });
        }

        return result;
    },

    /**
     * Creates intelligent descriptions with context and NLP insights
     */
    createIntelligentDescription(triggeringMessage: any, context: any, nlpResult: any): string {
        let description = `Created from intelligent reaction processing\n\n`;
        description += `Original message: "${triggeringMessage.content}"\n`;
        description += `Triggered by: ${context.reactorJid}\n`;
        description += `Chat: ${triggeringMessage.chatId}\n\n`;

        if (nlpResult.isUrgent) {
            description += `🚨 URGENT: Detected high priority indicators\n`;
        }
        if (nlpResult.date) {
            description += `📅 Intelligent date detected: ${nlpResult.date.toLocaleDateString()}\n`;
        }
        if (nlpResult.location) {
            description += `📍 Location: ${nlpResult.location}\n`;
        }
        if (nlpResult.keywords.length > 0) {
            description += `🏷️ Key topics: ${nlpResult.keywords.slice(0, 5).join(', ')}\n`;
        }

        description += `\n${triggeringMessage.content}`;
        return description;
    },

    /**
     * Template interpolation for intelligent content generation
     */
    interpolateTemplate(template: string, context: any): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return context[key] || match;
        });
    },

    // Helper methods for database operations
    async findTaskLinkByMessage(instanceId: string, messageId: string) {
        // This would be implemented with proper task-message linking table
        // For now, returning null as placeholder
        return null;
    },

    async getWhatsappMessage(instanceId: string, messageId: string) {
        const [message] = await db
            .select()
            .from(whatsappMessages)
            .where(and(
                eq(whatsappMessages.instanceId, instanceId),
                eq(whatsappMessages.messageId, messageId)
            ))
            .limit(1);
        return message || null;
    },

    async getContactDetailsByJid(instanceId: string, jid: string) {
        const [contact] = await db
            .select()
            .from(whatsappContacts)
            .where(and(
                eq(whatsappContacts.instanceId, instanceId),
                eq(whatsappContacts.jid, jid)
            ))
            .limit(1);
        return contact || null;
    },

    async updateTaskStatus(taskId: number, newStatus: string) {
        await db
            .update(crmTasks)
            .set({ 
                taskStatus: newStatus as any,
                updatedAt: new Date()
            })
            .where(eq(crmTasks.taskId, taskId));
    },

    async createTaskMessageLink(taskId: number, messageId: string, instanceId: string, linkType: string) {
        // This would create a link in a task-message linking table
        console.log(`🔗 Creating ${linkType} link: Task ${taskId} <-> Message ${messageId}`);
    },

    async createEventMessageLink(eventId: string, messageId: string, instanceId: string, linkType: string) {
        // This would create a link in an event-message linking table
        console.log(`🔗 Creating ${linkType} link: Event ${eventId} <-> Message ${messageId}`);
    },

    // Standard webhook handlers (simplified versions)
    async handleMessageUpsert(instanceId: string, data: any) {
        console.log(`📩 Processing message upsert with intelligent analysis for ${instanceId}`);
        // Implementation would include intelligent message processing
    },

    async handleMessageUpdate(instanceId: string, data: any) {
        console.log(`📝 Processing message update with intelligent analysis for ${instanceId}`);
        // Implementation would include intelligent update processing
    }
};