import { db, pool, dbConnection } from './db';
import { sql, desc, eq, and, or, asc, isNull, isNotNull, like, count, inArray } from 'drizzle-orm';

// Import core schemas
import { 
    whatsappInstances, 
    whatsappContacts, 
    whatsappChats, 
    whatsappMessages, 
    whatsappGroups, 
    whatsappGroupParticipants,
    whatsappMessageMedia,
    whatsappMessageReactions,
    whatsappMessageUpdates
} from '../shared/schema';

// Import cortex automation schema
import { actionRules } from '../shared/cortex-automations-schema';

// Import finance schema
import { cortexCreditCards } from '../shared/finance-schema';

class DatabaseStorage {
    // =============================
    // WHATSAPP CORE METHODS
    // =============================
    
    async getWhatsappInstances(spaceId?: string): Promise<any[]> {
        return await dbConnection.executeWithRetry(async () => {
            const result = await db.select().from(whatsappInstances);
            return result;
        }, 'getWhatsappInstances');
    }

    async getInstanceById(instanceName: string): Promise<any | null> {
        try {
            const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.instanceName, instanceName));
            return instance || null;
        } catch (error) {
            console.error('Error fetching WhatsApp instance by name:', error);
            return null;
        }
    }

    async getWhatsappInstance(instanceName: string): Promise<any | null> {
        try {
            const [instance] = await db.select().from(whatsappInstances).where(eq(whatsappInstances.instanceName, instanceName));
            return instance || null;
        } catch (error) {
            console.error('Error fetching WhatsApp instance:', error);
            return null;
        }
    }

    async getWhatsappContact(jid: string, instanceName: string): Promise<any | null> {
        try {
            const [contact] = await db.select()
                .from(whatsappContacts)
                .where(
                    and(
                        eq(whatsappContacts.jid, jid),
                        eq(whatsappContacts.instanceName, instanceName)
                    )
                );
            return contact || null;
        } catch (error) {
            console.error('Error fetching WhatsApp contact:', error);
            return null;
        }
    }

    async getWhatsappContacts(instanceName: string): Promise<any[]> {
        try {
            const result = await db.select()
                .from(whatsappContacts)
                .where(eq(whatsappContacts.instanceName, instanceName));
            return result;
        } catch (error) {
            console.error('Error fetching WhatsApp contacts:', error);
            throw error;
        }
    }

    async upsertWhatsappContact(contact: any): Promise<any> {
        try {
            // Check if contact already exists with a valid push name
            const existingContact = await db.select()
                .from(whatsappContacts)
                .where(
                    and(
                        eq(whatsappContacts.jid, contact.jid),
                        eq(whatsappContacts.instanceName, contact.instanceName)
                    )
                )
                .limit(1);

            const existing = existingContact[0];
            
            // Build the update object dynamically to avoid undefined values
            const updateSet: any = {};
            
            // Only update push name if the new one is better than existing
            if (contact.pushName && contact.pushName !== contact.jid) {
                // If no existing name, or existing name is just the JID, use new name
                if (!existing?.pushName || existing.pushName === existing.jid || existing.pushName === '') {
                    updateSet.pushName = contact.pushName;
                }
                // If new name is more specific (not just phone number), prefer it
                else if (contact.pushName.length > 10 && !/^\d+$/.test(contact.pushName)) {
                    updateSet.pushName = contact.pushName;
                }
            }
            
            if (contact.profilePictureUrl) updateSet.profilePictureUrl = contact.profilePictureUrl;
            if (contact.verifiedName) updateSet.verifiedName = contact.verifiedName;
            if (typeof contact.isBusiness === 'boolean') updateSet.isBusiness = contact.isBusiness;
            if (typeof contact.isBlocked === 'boolean') updateSet.isBlocked = contact.isBlocked;
            
            // Always update the timestamp
            updateSet.lastUpdatedAt = new Date();

            // If no meaningful updates, just ensure we have something to update
            if (Object.keys(updateSet).length === 1) {
                // Only timestamp, force at least one field update
                if (!updateSet.pushName && contact.pushName) {
                    updateSet.pushName = contact.pushName;
                }
            }

            const [result] = await db.insert(whatsappContacts)
                .values(contact)
                .onConflictDoUpdate({
                    target: [whatsappContacts.jid, whatsappContacts.instanceName],
                    set: updateSet
                })
                .returning();
            
            return result;
        } catch (error) {
            console.error('Error upserting WhatsApp contact:', error);
            throw error;
        }
    }

    async upsertWhatsappChat(chat: any): Promise<any> {
        return await dbConnection.executeWithRetry(async () => {
            const [result] = await db.insert(whatsappChats)
                .values(chat)
                .onConflictDoUpdate({
                    target: [whatsappChats.chatId, whatsappChats.instanceName],
                    set: {
                        name: chat.name,
                        phone: chat.phone,
                        unreadCount: chat.unreadCount,
                        isGroup: chat.isGroup,
                        isArchived: chat.isArchived,
                        status: chat.status,
                        lastMessageTimestamp: chat.lastMessageTimestamp,
                        updatedAt: new Date()
                    }
                })
                .returning();
            
            return result;
        }, 'upsertWhatsappChat');
    }

    async getWhatsappConversations(instanceName: string): Promise<any[]> {
        try {
            // First check if is_group column exists, otherwise determine from chat_id pattern
            const result = await db.execute(sql`
                SELECT DISTINCT c.chat_id, c.instance_name, c.last_message_timestamp, 
                       c.unread_count, c.is_archived, c.type,
                       CASE 
                         WHEN c.chat_id LIKE '%@g.us' THEN true
                         ELSE false
                       END as is_group
                FROM whatsapp.chats c
                WHERE c.instance_name = ${instanceName}
                ORDER BY c.last_message_timestamp DESC NULLS LAST
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching conversations:', error);
            return [];
        }
    }

    // =============================
    // CONTACT METHODS (CORTEX)
    // =============================
    
    async getContactById(contactId: string): Promise<any> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_entities.persons WHERE id = ${contactId}
            `);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error fetching contact:', error);
            throw error;
        }
    }

    async getContactDetails(contactId: string): Promise<any> {
        try {
            // Get basic contact info
            const contact = await this.getContactById(contactId);
            if (!contact) return null;

            // Get phone numbers
            const phones = await db.execute(sql`
                SELECT phone_number, label, is_primary, is_whatsapp_linked 
                FROM cortex_entities.person_phones 
                WHERE person_id = ${contactId}
            `);

            // Get emails
            const emails = await db.execute(sql`
                SELECT email_address, label, is_primary 
                FROM cortex_entities.person_emails 
                WHERE person_id = ${contactId}
            `);

            return {
                ...contact,
                phones: phones.rows || [],
                emails: emails.rows || []
            };
        } catch (error) {
            console.error('Error fetching contact details:', error);
            throw error;
        }
    }

    async getContacts(spaceId: string): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT p.*, 
                       pp.phone_number as primary_phone,
                       pe.email_address as primary_email
                FROM cortex_entities.persons p
                LEFT JOIN cortex_entities.person_phones pp ON p.id = pp.person_id AND pp.is_primary = true
                LEFT JOIN cortex_entities.person_emails pe ON p.id = pe.person_id AND pe.is_primary = true
                ORDER BY p.first_name, p.last_name
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching contacts:', error);
            throw error;
        }
    }

    // =============================
    // TASK METHODS (CORTEX)
    // =============================
    
    async getTaskById(taskId: string): Promise<any> {
        try {
            const result = await db.execute(sql`
                SELECT *, name as title FROM cortex_projects.tasks WHERE id = ${taskId}
            `);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error fetching task:', error);
            throw error;
        }
    }

    async createTaskGeneral(taskData: any): Promise<any> {
        return await dbConnection.executeWithRetry(async () => {
            const taskId = taskData.id || crypto.randomUUID();
            const result = await db.execute(sql.raw(`
                INSERT INTO cortex_projects.tasks (
                    id, title, description, status, priority, due_date,
                    created_by_entity_id, assigned_to_entity_id, 
                    triggering_message_id, triggering_instance_name,
                    created_at, updated_at
                ) VALUES (
                    '${taskId}', 
                    '${taskData.title}', 
                    '${taskData.description || ''}', 
                    '${taskData.status || 'todo'}', 
                    '${taskData.priority || 'medium'}', 
                    ${taskData.due_date ? `'${taskData.due_date}'` : 'NULL'},
                    '${taskData.createdByEntityId || taskData.userId || 'cu_181de66a23864b2fac56779a82189691'}',
                    '${taskData.assignedToEntityId || taskData.userId || 'cu_181de66a23864b2fac56779a82189691'}',
                    ${taskData.triggeringMessageId ? `'${taskData.triggeringMessageId}'` : 'NULL'},
                    ${taskData.triggeringInstanceName ? `'${taskData.triggeringInstanceName}'` : 'NULL'},
                    NOW(),
                    NOW()
                ) RETURNING *
            `));
            return result.rows[0];
        }, 'createTaskGeneral');
    }

    // =============================
    // SPACE METHODS
    // =============================
    
    async getSpaces(userId?: string): Promise<any[]> {
        try {
            // Use Cortex Foundation spaces instead of app.spaces
            const result = await db.execute(sql`
                SELECT 
                    id,
                    name,
                    description,
                    icon,
                    color,
                    parent_space_id,
                    space_type as type,
                    privacy,
                    category,
                    level,
                    path,
                    created_at,
                    updated_at
                FROM cortex_foundation.spaces 
                ORDER BY name
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching Cortex Foundation spaces:', error);
            throw error;
        }
    }

    async getSpaceTemplates(): Promise<any[]> {
        try {
            // Return predefined templates since templates are not yet in Cortex Foundation
            return [
                { id: 1, name: 'Project Management', description: 'Organize projects with tasks and milestones', category: 'work' },
                { id: 2, name: 'Team Collaboration', description: 'Share docs and communicate with team', category: 'work' },
                { id: 3, name: 'Personal Workspace', description: 'Manage personal tasks and notes', category: 'personal' },
                { id: 4, name: 'Client Management', description: 'Track clients and relationships', category: 'business' },
                { id: 5, name: 'Finance Tracking', description: 'Monitor budgets and expenses', category: 'business' }
            ];
        } catch (error) {
            console.error('Error fetching space templates:', error);
            return [];
        }
    }

    // =============================
    // MINIMAL FINANCE STUBS REMOVED - Full implementation added below
    // =============================

    // =============================
    // MISSING METHODS STUBS (FOR LEGACY API COMPATIBILITY)
    // =============================
    
    async getCrmContactById(contactId: string): Promise<any> {
        return await this.getContactById(contactId);
    }

    async createCrmContact(contactData: any): Promise<any> {
        // DISABLED: CRM functionality migrated to Cortex
        throw new Error('CRM functionality migrated to Cortex entities');
    }

    async updateCrmContact(contactId: string, updates: any): Promise<any> {
        // DISABLED: CRM functionality migrated to Cortex
        throw new Error('CRM functionality migrated to Cortex entities');
    }

    async getCrmContactsByPhoneOrJid(phone: string): Promise<any[]> {
        // DISABLED: CRM functionality migrated to Cortex
        return [];
    }

    async linkContactToWhatsApp(contactId: string, phoneNumber: string): Promise<void> {
        // DISABLED: WhatsApp linking functionality needs migration to Cortex
        console.log(`WhatsApp linking disabled: ${contactId} with ${phoneNumber}`);
    }

    async createCrmContactPhone(data: any): Promise<any> {
        // DISABLED: CRM functionality migrated to Cortex
        throw new Error('CRM functionality migrated to Cortex entities');
    }

    async getCrmNotes(): Promise<any[]> {
        // DISABLED: Notes functionality needs migration to Cortex
        return [];
    }

    async getUserByEmail(email: string): Promise<any> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM app.users WHERE email = ${email}
            `);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error fetching user by email:', error);
            return null;
        }
    }

    async createAppUser(userData: any): Promise<any> {
        try {
            const userId = crypto.randomUUID();
            const result = await db.execute(sql.raw(`
                INSERT INTO app.users (id, email, password, name)
                VALUES ('${userId}', '${userData.email}', '${userData.password}', '${userData.name}')
                RETURNING *
            `));
            return result.rows[0];
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async getUserById(userId: string): Promise<any> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM app.users WHERE id = ${userId}
            `);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error fetching user by ID:', error);
            return null;
        }
    }

    async getTasks(userId?: string): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_projects.tasks
                ORDER BY created_at DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
    }

    async createTask(taskData: any): Promise<any> {
        return await this.createTaskGeneral(taskData);
    }

    async updateTask(taskId: string, updates: any): Promise<any> {
        try {
            const setClause = Object.keys(updates)
                .map(key => `${key} = '${updates[key]}'`)
                .join(', ');
            
            const result = await db.execute(sql.raw(`
                UPDATE cortex_projects.tasks 
                SET ${setClause}
                WHERE id = '${taskId}'
                RETURNING *
            `));
            return result.rows[0];
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    }

    // =============================
    // WHATSAPP CONVERSATION METHODS
    // =============================
    
    async getConversationsWithLatestMessages(userId: string): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT DISTINCT c.chat_id, c.instance_name, c.last_message_timestamp, 
                       c.unread_count, c.is_archived, c.type,
                       CASE 
                         WHEN c.chat_id LIKE '%@g.us' THEN true
                         ELSE false
                       END as is_group,
                       CASE 
                         WHEN c.chat_id LIKE '%@g.us' THEN COALESCE(g.subject, c.chat_id)
                         ELSE COALESCE(cont.push_name, cont.jid, c.chat_id)
                       END as name,
                       CASE 
                         WHEN c.chat_id LIKE '%@g.us' THEN COALESCE(g.subject, c.chat_id)
                         ELSE COALESCE(cont.push_name, cont.jid, c.chat_id)
                       END as displayname,
                       c.chat_id as chatid,
                       c.instance_name as instanceid,
                       c.instance_name as instancename,
                       c.type,
                       c.last_message_timestamp as lastmessagetimestamp,
                       c.unread_count as unreadcount,
                       c.is_archived as isarchived,
                       -- Get latest message content for preview
                       m.content as lastMessageContent,
                       m.from_me as lastMessageFromMe,
                       m.message_type as lastMessageType
                FROM whatsapp.chats c
                LEFT JOIN whatsapp.groups g ON c.chat_id = g.group_jid AND c.instance_name = g.instance_name
                LEFT JOIN whatsapp.contacts cont ON c.chat_id = cont.jid AND c.instance_name = cont.instance_name
                LEFT JOIN LATERAL (
                    SELECT content, from_me, message_type
                    FROM whatsapp.messages 
                    WHERE chat_id = c.chat_id AND instance_name = c.instance_name
                    ORDER BY timestamp DESC 
                    LIMIT 1
                ) m ON true
                ORDER BY c.last_message_timestamp DESC NULLS LAST
                LIMIT 50
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching conversations with latest messages:', error);
            return [];
        }
    }

    async getWhatsappMessages(userId: string, instanceName: string, chatId: string, limit: number = 50): Promise<any[]> {
        try {
            // Optimized query - fetch only message data first without complex joins
            const result = await db.execute(sql`
                SELECT message_id, instance_name, chat_id, sender_jid, from_me, 
                       message_type, content, timestamp, quoted_message_id, 
                       is_forwarded, is_starred, raw_api_payload
                FROM whatsapp.messages 
                WHERE instance_name = ${instanceName} AND chat_id = ${chatId}
                ORDER BY timestamp DESC
                LIMIT ${limit}
            `);
            
            const messages = result.rows.reverse(); // Return in chronological order
            
            // Add basic media path for media messages if needed (without complex join)
            return messages.map(msg => ({
                ...msg,
                media_path: msg.message_type === 'audio' || msg.message_type === 'image' || msg.message_type === 'document' 
                    ? `/api/whatsapp/media/${msg.instance_name}/${msg.message_id}` 
                    : null
            }));
        } catch (error) {
            console.error('Error fetching WhatsApp messages:', error);
            return [];
        }
    }

    async upsertWhatsappMessage(message: any): Promise<any> {
        return await dbConnection.executeWithRetry(async () => {
            const [result] = await db.insert(whatsappMessages)
                .values(message)
                .onConflictDoUpdate({
                    target: [whatsappMessages.messageId, whatsappMessages.instanceName],
                    set: {
                        content: message.content,
                        messageType: message.messageType,
                        fromMe: message.fromMe,
                        timestamp: message.timestamp,
                        senderJid: message.senderJid,
                        quotedMessageId: message.quotedMessageId,
                        forwardingScore: message.forwardingScore,
                        isForwarded: message.isForwarded,
                        isStarred: message.isStarred,
                        rawApiPayload: message.rawApiPayload,
                        updatedAt: new Date()
                    }
                })
                .returning();
            
            return result;
        }, 'upsertWhatsappMessage');
    }

    async getWhatsappMessageById(messageId: string, instanceName: string): Promise<any> {
        try {
            const result = await db.execute(sql`
                SELECT m.*, mm.file_local_path as media_path
                FROM whatsapp.messages m
                LEFT JOIN whatsapp.message_media mm ON m.message_id = mm.message_id AND m.instance_name = mm.instance_name
                WHERE m.message_id = ${messageId} AND m.instance_name = ${instanceName}
            `);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error fetching WhatsApp message by ID:', error);
            return null;
        }
    }

    async upsertWhatsappMessageReaction(reaction: any): Promise<any> {
        return await dbConnection.executeWithRetry(async () => {
            const [result] = await db
                .insert(whatsappMessageReactions)
                .values(reaction)
                .onConflictDoUpdate({
                    target: [whatsappMessageReactions.messageId, whatsappMessageReactions.instanceName, whatsappMessageReactions.reactorJid],
                    set: {
                        reactionEmoji: reaction.reactionEmoji,
                        timestamp: reaction.timestamp,
                        fromMe: reaction.fromMe
                    }
                })
                .returning();
            return result;
        }, 'upsertWhatsappMessageReaction');
    }

    // =============================
    // COMPANIES/UPCOMING DATES STUBS
    // =============================
    
    async getCompanies(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_entities.companies ORDER BY name
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching companies:', error);
            return [];
        }
    }

    async getUpcomingDates(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT p.first_name, p.last_name, pd.event_name, pd.event_day, pd.event_month
                FROM cortex_entities.persons p
                JOIN cortex_entities.person_special_dates pd ON p.id = pd.person_id
                WHERE pd.event_month = EXTRACT(MONTH FROM CURRENT_DATE)
                   OR pd.event_month = EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '1 month')
                ORDER BY pd.event_month, pd.event_day
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching upcoming dates:', error);
            return [];
        }
    }

    // =============================
    // CORTEX PERSONS METHODS
    // =============================
    
    async getCortexPersons(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT id, first_name, last_name, 
                       CONCAT(first_name, ' ', last_name) as name,
                       profession, company_name as company, notes as description
                FROM cortex_entities.persons
                ORDER BY first_name, last_name
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching Cortex persons:', error);
            return [];
        }
    }

    // =============================
    // FINANCE LOAN METHODS
    // =============================
    
    async createLoan(loanData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO cortex_finance.loans (
                    lender_name, lender_entity_id, borrower_entity_id, 
                    principal_amount, interest_rate, interest_rate_type, term_months, 
                    payment_frequency, start_date, payment_date, purpose, collateral,
                    interest_type, moratory_rate, moratory_rate_type, notes, currency, user_id,
                    use_custom_formula, custom_formula, custom_formula_description
                ) VALUES (
                    ${loanData.lenderName}, ${loanData.lenderContactId || null}, ${loanData.borrowerContactId || null},
                    ${loanData.principalAmount}, ${loanData.interestRate}, ${loanData.interestRateType || 'monthly'}, ${loanData.termMonths || null},
                    ${loanData.paymentFrequency}, ${loanData.startDate}, ${loanData.paymentDate || null}, ${loanData.purpose}, ${loanData.collateral || null},
                    ${loanData.interestType || 'simple'}, ${loanData.moratoryRate || 0}, ${loanData.moratoryRateType || 'monthly'}, ${loanData.notes || null}, ${loanData.currency || 'USD'}, 
                    '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
                    ${loanData.useCustomFormula || false}, ${loanData.customFormula || null}, ${loanData.customFormulaDescription || null}
                ) RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating loan:', error);
            throw error;
        }
    }

    async updateLoan(loanId: string, loanData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                UPDATE cortex_finance.loans SET
                    lender_name = ${loanData.lenderName},
                    lender_entity_id = ${loanData.lenderContactId || null},
                    borrower_entity_id = ${loanData.borrowerContactId || null},
                    principal_amount = ${loanData.principalAmount},
                    interest_rate = ${loanData.interestRate},
                    interest_rate_type = ${loanData.interestRateType || 'monthly'},
                    term_months = ${loanData.termMonths || null},
                    payment_frequency = ${loanData.paymentFrequency},
                    start_date = ${loanData.startDate},
                    payment_date = ${loanData.paymentDate || null},
                    purpose = ${loanData.purpose},
                    collateral = ${loanData.collateral || null},
                    interest_type = ${loanData.interestType || 'simple'},
                    moratory_rate = ${loanData.moratoryRate || 0},
                    moratory_rate_type = ${loanData.moratoryRateType || 'monthly'},
                    notes = ${loanData.notes || null},
                    currency = ${loanData.currency || 'USD'},
                    use_custom_formula = ${loanData.useCustomFormula || false},
                    custom_formula = ${loanData.customFormula || null},
                    custom_formula_description = ${loanData.customFormulaDescription || null},
                    updated_at = NOW()
                WHERE id = ${loanId}
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error updating loan:', error);
            throw error;
        }
    }

    // =============================
    // CORTEX FINANCE METHODS
    // =============================
    
    async getPayables(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.bills_payable 
                ORDER BY due_date DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching payables:', error);
            return [];
        }
    }

    async createPayable(payableData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO cortex_finance.bills_payable (
                    bill_number, vendor_entity_id, description, amount, 
                    bill_date, due_date, status, created_by_entity_id
                ) VALUES (
                    ${payableData.bill_number || `BILL-${Date.now()}`},
                    ${payableData.vendor_entity_id || 'cv_unknown_vendor'},
                    ${payableData.description || ''},
                    ${payableData.amount || 0},
                    ${payableData.bill_date || new Date().toISOString().split('T')[0]},
                    ${payableData.due_date || new Date().toISOString().split('T')[0]},
                    ${payableData.status || 'draft'},
                    ${'7804247f-3ae8-4eb2-8c6d-2c44f967ad42'}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating payable:', error);
            throw error;
        }
    }

    async updatePayable(id: string, payableData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                UPDATE cortex_finance.bills_payable 
                SET 
                    bill_number = ${payableData.bill_number},
                    vendor_entity_id = ${payableData.vendor_entity_id},
                    description = ${payableData.description},
                    amount = ${payableData.amount},
                    bill_date = ${payableData.bill_date},
                    due_date = ${payableData.due_date},
                    status = ${payableData.status},
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error updating payable:', error);
            throw error;
        }
    }

    async deletePayable(id: string): Promise<void> {
        try {
            await db.execute(sql`
                DELETE FROM cortex_finance.bills_payable WHERE id = ${id}
            `);
        } catch (error) {
            console.error('Error deleting payable:', error);
            throw error;
        }
    }

    async getReceivables(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.bills_receivable 
                ORDER BY due_date DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching receivables:', error);
            return [];
        }
    }

    async createReceivable(receivableData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO cortex_finance.bills_receivable (
                    invoice_number, customer_entity_id, description, amount, 
                    invoice_date, due_date, status, created_by_entity_id
                ) VALUES (
                    ${receivableData.invoice_number || `INV-${Date.now()}`},
                    ${receivableData.customer_entity_id || 'cp_unknown_customer'},
                    ${receivableData.description || ''},
                    ${receivableData.amount || 0},
                    ${receivableData.invoice_date || new Date().toISOString().split('T')[0]},
                    ${receivableData.due_date || new Date().toISOString().split('T')[0]},
                    ${receivableData.status || 'draft'},
                    ${'7804247f-3ae8-4eb2-8c6d-2c44f967ad42'}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating receivable:', error);
            throw error;
        }
    }

    async updateReceivable(id: string, receivableData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                UPDATE cortex_finance.bills_receivable 
                SET 
                    invoice_number = ${receivableData.invoice_number},
                    customer_entity_id = ${receivableData.customer_entity_id},
                    description = ${receivableData.description},
                    amount = ${receivableData.amount},
                    invoice_date = ${receivableData.invoice_date},
                    due_date = ${receivableData.due_date},
                    status = ${receivableData.status},
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error updating receivable:', error);
            throw error;
        }
    }

    async deleteReceivable(id: string): Promise<void> {
        try {
            await db.execute(sql`
                DELETE FROM cortex_finance.bills_receivable WHERE id = ${id}
            `);
        } catch (error) {
            console.error('Error deleting receivable:', error);
            throw error;
        }
    }

    async getLoans(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.loans 
                ORDER BY start_date DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching loans:', error);
            return [];
        }
    }

    async getTransactions(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.transactions 
                ORDER BY transaction_date DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
    }

    // =============================
    // CREDIT CARDS METHODS
    // =============================

    async getCreditCards(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.credit_cards 
                WHERE is_active = true
                ORDER BY card_name ASC
            `);
            console.log('Database result for credit cards:', result);
            console.log('Result rows:', result.rows);
            console.log('Result type:', typeof result);
            console.log('Result keys:', Object.keys(result));
            return result.rows || [];
        } catch (error) {
            console.error('Error fetching credit cards:', error);
            return [];
        }
    }

    async createCreditCard(creditCardData: any): Promise<any> {
        try {
            // Generate ID with cc_ prefix for credit cards
            const creditCardId = `cc_${Date.now()}`;
            
            // Calculate available credit
            const availableCredit = creditCardData.credit_limit - Math.abs(creditCardData.current_balance || 0);
            
            const result = await db.execute(sql`
                INSERT INTO cortex_finance.credit_cards (
                    id, card_name, bank_name, last_4_digits, current_balance, 
                    credit_limit, available_credit, apr, statement_closing_day, 
                    payment_due_days_after_statement, currency, is_active, notes, 
                    created_by_entity_id
                ) VALUES (
                    ${creditCardId}, 
                    ${creditCardData.card_name}, 
                    ${creditCardData.bank_name}, 
                    ${creditCardData.last_4_digits}, 
                    ${creditCardData.current_balance || 0}, 
                    ${creditCardData.credit_limit}, 
                    ${availableCredit}, 
                    ${creditCardData.apr}, 
                    ${creditCardData.statement_closing_day}, 
                    ${creditCardData.payment_due_days_after_statement || 21}, 
                    ${creditCardData.currency || 'MXN'}, 
                    ${creditCardData.is_active !== false}, 
                    ${creditCardData.notes || null}, 
                    ${'default-user-id'}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating credit card:', error);
            throw error;
        }
    }

    async updateCreditCard(id: string, creditCardData: any): Promise<any> {
        try {
            // Calculate available credit if credit limit or balance changed
            let availableCredit = null;
            if (creditCardData.credit_limit !== undefined || creditCardData.current_balance !== undefined) {
                const creditLimit = creditCardData.credit_limit;
                const currentBalance = creditCardData.current_balance || 0;
                availableCredit = creditLimit - Math.abs(currentBalance);
            }

            const result = await db.execute(sql`
                UPDATE cortex_finance.credit_cards SET
                    card_name = COALESCE(${creditCardData.card_name}, card_name),
                    bank_name = COALESCE(${creditCardData.bank_name}, bank_name),
                    last_4_digits = COALESCE(${creditCardData.last_4_digits}, last_4_digits),
                    current_balance = COALESCE(${creditCardData.current_balance}, current_balance),
                    credit_limit = COALESCE(${creditCardData.credit_limit}, credit_limit),
                    available_credit = COALESCE(${availableCredit}, available_credit),
                    apr = COALESCE(${creditCardData.apr}, apr),
                    statement_closing_day = COALESCE(${creditCardData.statement_closing_day}, statement_closing_day),
                    payment_due_days_after_statement = COALESCE(${creditCardData.payment_due_days_after_statement}, payment_due_days_after_statement),
                    currency = COALESCE(${creditCardData.currency}, currency),
                    is_active = COALESCE(${creditCardData.is_active}, is_active),
                    notes = COALESCE(${creditCardData.notes}, notes),
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error updating credit card:', error);
            throw error;
        }
    }

    async deleteCreditCard(id: string): Promise<void> {
        try {
            await db.execute(sql`
                UPDATE cortex_finance.credit_cards 
                SET is_active = false, updated_at = NOW()
                WHERE id = ${id}
            `);
        } catch (error) {
            console.error('Error deleting credit card:', error);
            throw error;
        }
    }

    async getCreditCardById(id: string): Promise<any> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.credit_cards WHERE id = ${id}
            `);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error fetching credit card:', error);
            throw error;
        }
    }

    // =============================
    // RECURRING BILLS METHODS
    // =============================

    async getRecurringBillTemplates(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.recurring_bill_templates
                ORDER BY next_due_date ASC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching recurring bill templates:', error);
            return [];
        }
    }

    async getUpcomingRecurringBills(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.upcoming_recurring_bills
                ORDER BY next_due_date ASC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching upcoming recurring bills:', error);
            return [];
        }
    }

    async generateNextRecurringBill(parentBillId: string): Promise<any> {
        try {
            const result = await db.execute(sql`
                SELECT cortex_finance.generate_next_recurring_bill(${parentBillId}) as new_bill_id
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error generating next recurring bill:', error);
            throw error;
        }
    }

    async processRecurringBills(): Promise<number> {
        try {
            const result = await db.execute(sql`
                SELECT cortex_finance.process_daily_recurring_bills() as bills_generated
            `);
            return result.rows[0].bills_generated || 0;
        } catch (error) {
            console.error('Error processing recurring bills:', error);
            throw error;
        }
    }

    async getAllBillsWithRecurrence(): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.all_bills_with_recurrence
                ORDER BY bill_date DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching all bills with recurrence:', error);
            return [];
        }
    }

    async createRecurringPayable(payableData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO cortex_finance.bills_payable (
                    bill_number, vendor_entity_id, amount, bill_date, due_date, description,
                    is_recurring, recurrence_type, recurrence_interval, recurrence_end_date,
                    next_due_date, auto_pay_enabled, auto_pay_account_id, category, subcategory,
                    created_by_entity_id
                ) VALUES (
                    ${payableData.billNumber}, ${payableData.vendorEntityId}, ${payableData.amount},
                    ${payableData.billDate}, ${payableData.dueDate}, ${payableData.description},
                    ${payableData.isRecurring}, ${payableData.recurrenceType}, ${payableData.recurrenceInterval},
                    ${payableData.recurrenceEndDate}, ${payableData.nextDueDate}, ${payableData.autoPayEnabled},
                    ${payableData.autoPayAccountId}, ${payableData.category}, ${payableData.subcategory},
                    ${payableData.createdByEntityId}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating recurring payable:', error);
            throw error;
        }
    }

    async createRecurringReceivable(receivableData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO cortex_finance.bills_receivable (
                    bill_number, customer_entity_id, amount, bill_date, due_date, description,
                    is_recurring, recurrence_type, recurrence_interval, recurrence_end_date,
                    next_due_date, category, subcategory, created_by_entity_id
                ) VALUES (
                    ${receivableData.billNumber}, ${receivableData.customerEntityId}, ${receivableData.amount},
                    ${receivableData.billDate}, ${receivableData.dueDate}, ${receivableData.description},
                    ${receivableData.isRecurring}, ${receivableData.recurrenceType}, ${receivableData.recurrenceInterval},
                    ${receivableData.recurrenceEndDate}, ${receivableData.nextDueDate}, ${receivableData.category},
                    ${receivableData.subcategory}, ${receivableData.createdByEntityId}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating recurring receivable:', error);
            throw error;
        }
    }

    // =============================
    // ACTION RULES METHODS (Simple approach)
    // =============================
    
    // Simple saveActionExecution will be handled by the later duplicate implementation
    
    async createTaskMessageLink(linkData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO whatsapp.task_message_links (
                    task_id, message_id, instance_id, link_type
                ) VALUES (
                    ${linkData.taskId}, 
                    ${linkData.messageId}, 
                    ${linkData.instanceId}, 
                    ${linkData.linkType}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating task-message link:', error);
            throw error;
        }
    }

    // =============================
    // ACTION TEMPLATES AND RULES METHODS
    // =============================
    
    async getActionTemplates(): Promise<any[]> {
        // Return predefined templates for cortex automation system
        return [
            {
                templateId: "checkmark-task-creator",
                templateName: "Task from Checkmark Reaction", 
                description: "Create a task when someone reacts with ✅ to a message",
                category: "task_management",
                triggerType: "reaction",
                actionType: "create_task",
                defaultConfig: {
                    triggerConditions: { reactions: ["✅"] },
                    actionConfig: { 
                        taskTitle: "Follow up on: {{message_content}}",
                        priority: "medium",
                        dueDate: "in_3_days"
                    }
                },
                usageCount: 45,
                rating: 4.8
            },
            {
                templateId: "calendar-event-creator",
                templateName: "Calendar Event from Date Reaction",
                description: "Create calendar event when someone reacts with 📅 to a message",
                category: "scheduling", 
                triggerType: "reaction",
                actionType: "create_event",
                defaultConfig: {
                    triggerConditions: { reactions: ["📅"] },
                    actionConfig: {
                        eventTitle: "Event: {{message_content}}",
                        duration: 60,
                        reminders: [15]
                    }
                },
                usageCount: 32,
                rating: 4.6
            },
            {
                templateId: "note-creator", 
                templateName: "Note from Document Reaction",
                description: "Create a note when someone reacts with 📝 to a message",
                category: "knowledge",
                triggerType: "reaction", 
                actionType: "create_note",
                defaultConfig: {
                    triggerConditions: { reactions: ["📝"] },
                    actionConfig: {
                        noteTitle: "Note: {{message_content}}",
                        noteType: "general"
                    }
                },
                usageCount: 28,
                rating: 4.7
            }
        ];
    }

    async getActionRules(userId: string): Promise<any[]> {
        try {
            console.log('Fetching simple action rules for user:', userId);
            
            // Use the simple actionRules table
            const rules = await db
                .select()
                .from(actionRules)
                .where(eq(actionRules.createdBy, userId))
                .orderBy(desc(actionRules.createdAt));
            
            console.log('Found rules:', rules.length);
            return rules;
        } catch (error) {
            console.error('Error fetching simple action rules:', error);
            return [];
        }
    }



    // =============================
    // UTILITY METHODS
    // =============================

    async createActionRule(ruleData: any): Promise<any> {
        try {
            console.log('Creating simple action rule with data:', ruleData);
            
            // Use the simple actionRules table from cortex-automations-schema
            const [newRule] = await db.insert(actionRules).values({
                name: ruleData.name,
                description: ruleData.description || '',
                isActive: ruleData.is_active !== false,
                triggerType: ruleData.trigger_type || 'whatsapp_message',
                actionType: ruleData.action_type || 'create_task',
                triggerConditions: ruleData.trigger_conditions || {},
                actionConfig: ruleData.action_config || {},
                performerFilter: ruleData.performer_filter || 'both',
                instanceFilterType: ruleData.instance_filter_type || 'all',
                selectedInstances: ruleData.selected_instances || [],
                cooldownMinutes: ruleData.cooldown_minutes || 5,
                maxExecutionsPerDay: ruleData.max_executions_per_day || 100,
                createdBy: ruleData.created_by || 'system'
            }).returning();
            
            return newRule;
        } catch (error) {
            console.error('Error creating action rule:', error);
            throw error;
        }
    }

    async updateActionRule(ruleId: string, updates: any): Promise<any> {
        try {
            console.log('Updating simple action rule:', ruleId, updates);
            
            // Extract status from action_config if present
            const statusValue = updates.action_config?.status || updates.status || 'todo';
            
            const [updatedRule] = await db
                .update(actionRules)
                .set({
                    name: updates.name,
                    description: updates.description,
                    isActive: updates.is_active,
                    triggerType: updates.trigger_type,
                    actionType: updates.action_type,
                    triggerConditions: updates.trigger_conditions,
                    actionConfig: updates.action_config,
                    status: statusValue, // Update the status field
                    performerFilter: updates.performer_filter,
                    instanceFilterType: updates.instance_filter_type,
                    selectedInstances: updates.selected_instances,
                    cooldownMinutes: updates.cooldown_minutes,
                    maxExecutionsPerDay: updates.max_executions_per_day
                })
                .where(eq(actionRules.id, ruleId))
                .returning();
            
            return updatedRule;
        } catch (error) {
            console.error('Error updating action rule:', error);
            throw error;
        }
    }

    async getActionRule(ruleId: string): Promise<any> {
        try {
            const [rule] = await db
                .select()
                .from(actionRules)
                .where(eq(actionRules.id, ruleId));
            
            return rule || null;
        } catch (error) {
            console.error('Error fetching action rule:', error);
            return null;
        }
    }

    async deleteActionRule(ruleId: string): Promise<void> {
        try {
            await db
                .delete(actionRules)
                .where(eq(actionRules.id, ruleId));
        } catch (error) {
            console.error('Error deleting action rule:', error);
            throw error;
        }
    }

    async getActionRulesByTrigger(triggerType: string, instanceId?: string): Promise<any[]> {
        return await dbConnection.executeWithRetry(async () => {
            console.log('Fetching action rules by trigger:', triggerType);
            
            let query = db
                .select()
                .from(actionRules)
                .where(and(
                    eq(actionRules.triggerType, 'whatsapp_message'), // Map reaction -> whatsapp_message
                    eq(actionRules.isActive, true)
                ));
            
            const rules = await query;
            
            // Filter by trigger conditions for reactions
            if (triggerType === 'reaction') {
                const filteredRules = rules.filter(rule => {
                    const conditions = rule.triggerConditions || {};
                    return conditions.reactions && Array.isArray(conditions.reactions);
                });
                console.log(`Found ${filteredRules.length} reaction rules`);
                return filteredRules;
            }
            
            console.log(`Found ${rules.length} rules for trigger type: ${triggerType}`);
            return rules;
        }, 'getActionRulesByTrigger');
    }

    async saveActionExecution(executionData: any): Promise<any> {
        return await dbConnection.executeWithRetry(async () => {
            console.log(`✅ Saving action execution for rule ${executionData.rule_id}: ${executionData.status}`);
            
            // For the simple system, we could either:
            // 1. Create a separate executions table
            // 2. Update the rule's execution counters
            // 3. Just log it (simplified approach)
            
            // For now, let's update the rule's execution counters
            if (executionData.rule_id) {
                const result = await db
                    .update(actionRules)
                    .set({
                        lastExecutedAt: new Date(),
                        executionCount: sql`${actionRules.executionCount} + 1`,
                        successCount: executionData.status === 'success' 
                            ? sql`${actionRules.successCount} + 1`
                            : actionRules.successCount,
                        failureCount: executionData.status === 'failure'
                            ? sql`${actionRules.failureCount} + 1`
                            : actionRules.failureCount
                    })
                    .where(eq(actionRules.id, executionData.rule_id));
                
                console.log(`✅ Execution counter updated successfully for rule ${executionData.rule_id}`);
            }
            
            return { success: true, execution: executionData };
        }, 'saveActionExecution');
    }



    async getActionExecutions(ruleId?: string, status?: string, limit?: number): Promise<any[]> {
        try {
            return []; // Placeholder for now
        } catch (error) {
            console.error('Error getting action executions:', error);
            return [];
        }
    }

    normalizePhoneNumber(phone: string): string {
        // Basic phone normalization
        return phone.replace(/\D/g, '');
    }

    // =============================
    // FINANCE METHODS
    // =============================

    async getFinancialSummary(type: 'income' | 'expense'): Promise<{ total: number; change: number }> {
        try {
            // Return placeholder data for now
            if (type === 'income') {
                return { total: 45000, change: 12.5 };
            } else {
                return { total: 32000, change: -8.2 };
            }
        } catch (error) {
            console.error(`Error getting ${type} summary:`, error);
            return { total: 0, change: 0 };
        }
    }

    async getPendingPayables(): Promise<{ count: number; total: number }> {
        try {
            return { count: 5, total: 12500 };
        } catch (error) {
            console.error('Error getting pending payables:', error);
            return { count: 0, total: 0 };
        }
    }

    async getActiveLoans(): Promise<{ count: number; total: number }> {
        try {
            return { count: 2, total: 125000 };
        } catch (error) {
            console.error('Error getting active loans:', error);
            return { count: 0, total: 0 };
        }
    }

    async getRecentTransactions(limit: number = 10): Promise<any[]> {
        try {
            return [
                {
                    transactionId: 1,
                    amount: 2500,
                    type: 'income',
                    description: 'Client Payment - Project ABC',
                    transactionDate: '2025-06-30',
                    categoryName: 'Revenue'
                },
                {
                    transactionId: 2,
                    amount: 850,
                    type: 'expense',
                    description: 'Office Supplies',
                    transactionDate: '2025-06-29',
                    categoryName: 'Operations'
                },
                {
                    transactionId: 3,
                    amount: 3200,
                    type: 'income',
                    description: 'Consulting Services',
                    transactionDate: '2025-06-28',
                    categoryName: 'Revenue'
                }
            ];
        } catch (error) {
            console.error('Error getting recent transactions:', error);
            return [];
        }
    }

    async getFinanceCategories(): Promise<any[]> {
        try {
            return [
                { categoryId: 1, name: 'Revenue', type: 'income', parentId: null },
                { categoryId: 2, name: 'Operations', type: 'expense', parentId: null },
                { categoryId: 3, name: 'Marketing', type: 'expense', parentId: null },
                { categoryId: 4, name: 'Travel', type: 'expense', parentId: null }
            ];
        } catch (error) {
            console.error('Error getting finance categories:', error);
            return [];
        }
    }

    async createFinanceCategory(data: any): Promise<any> {
        try {
            return {
                categoryId: Date.now(),
                ...data,
                createdAt: new Date()
            };
        } catch (error) {
            console.error('Error creating finance category:', error);
            throw error;
        }
    }

    // =============================
    // FINANCE ACCOUNTS METHODS
    // =============================

    async getFinanceAccounts(userId: string): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.accounts 
                ORDER BY name ASC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching finance accounts:', error);
            return [];
        }
    }

    async createFinanceAccount(data: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO cortex_finance.accounts (
                    id, name, account_type, current_balance, currency, description, 
                    status, institution_name, account_number, owner_entity_id
                ) VALUES (
                    ${data.id || 'ca_' + Date.now().toString()}, 
                    ${data.name}, 
                    ${data.account_type || 'checking'}, 
                    ${data.current_balance || 0}, 
                    ${data.currency || 'MXN'}, 
                    ${data.description || ''}, 
                    ${data.status || 'active'}, 
                    ${data.institution_name || ''}, 
                    ${data.account_number || ''},
                    ${data.owner_entity_id || 'default-entity'}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating finance account:', error);
            throw error;
        }
    }

    async updateFinanceAccount(accountId: number, data: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                UPDATE cortex_finance.accounts 
                SET 
                    name = ${data.name},
                    account_type = ${data.account_type},
                    current_balance = ${data.current_balance || data.balance},
                    currency = ${data.currency},
                    description = ${data.description},
                    status = ${data.status},
                    institution_name = ${data.institution_name},
                    account_number = ${data.account_number},
                    updated_at = NOW()
                WHERE id = ${accountId.toString()}
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error updating finance account:', error);
            throw error;
        }
    }

    async deleteFinanceAccount(accountId: number): Promise<void> {
        try {
            await db.execute(sql`
                DELETE FROM cortex_finance.accounts WHERE id = ${accountId.toString()}
            `);
        } catch (error) {
            console.error('Error deleting finance account:', error);
            throw error;
        }
    }

    // =============================
    // CRM CONTACTS METHODS
    // =============================

    async createCompleteContact(data: any): Promise<any> {
        try {
            // Create contact in Cortex entities schema
            const result = await db.execute(sql`
                INSERT INTO cortex_entities.persons (
                    full_name, 
                    first_name, 
                    last_name,
                    profession,
                    company_name,
                    relationship, 
                    notes, 
                    created_by
                ) VALUES (
                    ${data.fullName}, 
                    ${data.firstName || ''},
                    ${data.lastName || ''},
                    ${data.profession || ''},
                    ${data.company || ''},
                    ${data.relationship || 'Contact'}, 
                    ${data.notes || ''}, 
                    ${data.ownerUserId}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating complete contact:', error);
            throw error;
        }
    }

    async getCrmCompanies(userId: string): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_entities.companies 
                ORDER BY name ASC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching CRM companies:', error);
            return [];
        }
    }

    async createCrmCompany(data: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO cortex_entities.companies (
                    name, description, created_by
                ) VALUES (
                    ${data.name}, 
                    ${data.description || null}, 
                    ${data.createdBy || 'cu_181de66a23864b2fac56779a82189691'}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating CRM company:', error);
            throw error;
        }
    }

    async deleteCrmCompany(companyId: string): Promise<void> {
        try {
            await db.execute(sql`
                DELETE FROM cortex_entities.companies 
                WHERE id = ${companyId}
            `);
        } catch (error) {
            console.error('Error deleting CRM company:', error);
            throw error;
        }
    }

    // =============================
    // COMPLETE COMPANY METHODS
    // =============================

    async getCompleteCompany(companyId: string): Promise<any> {
        try {
            // Get company basic info
            const companyResult = await db.execute(sql`
                SELECT * FROM cortex_entities.companies 
                WHERE id = ${companyId}
            `);
            
            if (companyResult.rows.length === 0) {
                throw new Error('Company not found');
            }
            
            const company = companyResult.rows[0];
            
            // For now return basic company data - phone/email/address support can be added later
            return {
                ...company,
                phones: [],
                emails: [],
                addresses: [],
                relationships: []
            };
        } catch (error) {
            console.error('Error fetching complete company:', error);
            throw error;
        }
    }

    async createCompleteCompany(data: any): Promise<any> {
        try {
            // Create company in Cortex entities schema
            const result = await db.execute(sql`
                INSERT INTO cortex_entities.companies (
                    name, 
                    description,
                    legal_name,
                    business_type,
                    industry,
                    website_url,
                    main_phone,
                    main_email,
                    created_by
                ) VALUES (
                    ${data.name}, 
                    ${data.description || null},
                    ${data.legalName || null},
                    ${data.businessType || null},
                    ${data.industry || null},
                    ${data.websiteUrl || null},
                    ${data.mainPhone || null},
                    ${data.mainEmail || null},
                    ${data.ownerUserId || 'cu_181de66a23864b2fac56779a82189691'}
                )
                RETURNING *
            `);
            
            // For now just return the company - block processing can be added later
            return result.rows[0];
        } catch (error) {
            console.error('Error creating complete company:', error);
            throw error;
        }
    }

    async updateCompleteCompany(companyId: string, data: any): Promise<any> {
        try {
            // Update company basic info
            const result = await db.execute(sql`
                UPDATE cortex_entities.companies SET
                    name = COALESCE(${data.name}, name),
                    description = COALESCE(${data.description}, description),
                    legal_name = COALESCE(${data.legalName}, legal_name),
                    business_type = COALESCE(${data.businessType}, business_type),
                    industry = COALESCE(${data.industry}, industry),
                    website_url = COALESCE(${data.websiteUrl}, website_url),
                    main_phone = COALESCE(${data.mainPhone}, main_phone),
                    main_email = COALESCE(${data.mainEmail}, main_email),
                    updated_at = NOW()
                WHERE id = ${companyId}
                RETURNING *
            `);
            
            if (result.rows.length === 0) {
                throw new Error('Company not found');
            }
            
            return result.rows[0];
        } catch (error) {
            console.error('Error updating complete company:', error);
            throw error;
        }
    }

    async getContactsByCompany(companyId: string): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT 
                    p.id as contact_id,
                    p.full_name as full_name,
                    p.profession as profession,
                    er.relationship_type,
                    er.metadata->>'title' as title,
                    er.metadata->>'department' as department,
                    er.metadata->>'role' as role,
                    (er.metadata->>'start_date')::DATE as start_date,
                    (er.metadata->>'end_date')::DATE as end_date,
                    COALESCE((er.metadata->>'is_primary')::BOOLEAN, FALSE) as is_primary,
                    er.weight,
                    er.id as relationship_id,
                    CASE 
                        WHEN (er.metadata->>'end_date')::DATE < CURRENT_DATE THEN 'ended'
                        WHEN (er.metadata->>'end_date')::DATE IS NULL THEN 'active'
                        ELSE 'active'
                    END as status,
                    (SELECT phone_number FROM cortex_entities.contact_phones 
                     WHERE person_id = p.id AND is_primary = TRUE LIMIT 1) as phone,
                    (SELECT email_address FROM cortex_entities.contact_emails 
                     WHERE person_id = p.id AND is_primary = TRUE LIMIT 1) as email,
                    er.created_at
                FROM cortex_foundation.entity_relationships er
                INNER JOIN cortex_entities.persons p ON er.from_entity_id = p.id
                WHERE er.to_entity_id = ${companyId}
                AND er.relationship_type IN ('works_for', 'owns', 'manages', 'client_of', 'vendor_of', 'colleague_of', 'reports_to')
                AND er.is_active = true
                ORDER BY 
                    COALESCE((er.metadata->>'is_primary')::BOOLEAN, FALSE) DESC,
                    er.weight DESC,
                    p.full_name ASC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error getting contacts by company:', error);
            return [];
        }
    }

    async associateContactWithCompany(
        contactId: string, 
        companyId: string, 
        relationshipType: string = 'employee',
        metadata: any = {}
    ): Promise<any> {
        try {
            // Validate entities exist
            const personExists = await db.execute(sql`
                SELECT 1 FROM cortex_entities.persons WHERE id = ${contactId}
            `);
            if (personExists.rows.length === 0) {
                throw new Error(`Person with ID ${contactId} not found`);
            }

            const companyExists = await db.execute(sql`
                SELECT 1 FROM cortex_entities.companies WHERE id = ${companyId}
            `);
            if (companyExists.rows.length === 0) {
                throw new Error(`Company with ID ${companyId} not found`);
            }

            // Check if association already exists
            const existingAssociation = await db.execute(sql`
                SELECT * FROM cortex_foundation.entity_relationships 
                WHERE from_entity_id = ${contactId} 
                AND to_entity_id = ${companyId}
                AND relationship_type = ${relationshipType}
                AND is_active = true
            `);
            
            if (existingAssociation.rows.length > 0) {
                throw new Error('Contact is already associated with this company in this role');
            }

            // Calculate weight based on relationship type
            const weight = this.calculateRelationshipWeight(relationshipType, metadata.is_primary);

            // If this is a primary relationship, mark others as non-primary
            if (metadata.is_primary && relationshipType === 'employee') {
                await db.execute(sql`
                    UPDATE cortex_foundation.entity_relationships 
                    SET metadata = metadata || '{"is_primary": false}'::jsonb,
                        weight = weight * 0.8
                    WHERE from_entity_id = ${contactId}
                      AND relationship_type = 'employee'
                      AND metadata->>'is_primary' = 'true'
                `);
            }

            // Create enhanced metadata
            const enhancedMetadata = {
                ...metadata,
                start_date: metadata.start_date || new Date().toISOString().split('T')[0],
                created_date: new Date().toISOString(),
                is_primary: metadata.is_primary || false
            };

            // Create the association using entity_relationships
            const result = await db.execute(sql`
                INSERT INTO cortex_foundation.entity_relationships (
                    from_entity_id, 
                    to_entity_id, 
                    relationship_type, 
                    is_bidirectional,
                    weight,
                    metadata,
                    is_active,
                    created_at
                )
                VALUES (
                    ${contactId}, 
                    ${companyId}, 
                    ${relationshipType}, 
                    true,
                    ${weight},
                    ${JSON.stringify(enhancedMetadata)},
                    true,
                    NOW()
                )
                RETURNING *
            `);
            
            return result.rows[0];
        } catch (error) {
            console.error('Error associating contact with company:', error);
            throw error;
        }
    }

    private calculateRelationshipWeight(relationshipType: string, isPrimary: boolean = false): number {
        if (isPrimary) return 1.0;
        
        switch (relationshipType) {
            case 'employee':
            case 'founder':
            case 'owner':
                return 0.9;
            case 'contractor':
            case 'consultant':
                return 0.7;
            case 'client':
            case 'customer':
                return 0.8;
            case 'vendor':
            case 'supplier':
                return 0.6;
            case 'partner':
            case 'investor':
                return 0.8;
            case 'member_of':
                return 0.5;
            default:
                return 0.5;
        }
    }

    async updatePersonCompanyRelationship(
        relationshipId: string,
        updates: {
            title?: string;
            department?: string;
            salary?: number;
            promotionDate?: string;
            endDate?: string;
        }
    ): Promise<boolean> {
        try {
            // Get current metadata
            const currentResult = await db.execute(sql`
                SELECT metadata, from_entity_id FROM cortex_foundation.entity_relationships
                WHERE id = ${relationshipId}
            `);
            
            if (currentResult.rows.length === 0) {
                return false;
            }

            const currentMetadata = currentResult.rows[0].metadata || {};
            const personId = currentResult.rows[0].from_entity_id;

            // Build updated metadata
            const updatedMetadata: any = {
                ...currentMetadata,
                ...updates,
                last_updated: new Date().toISOString()
            };

            if (updates.promotionDate) {
                updatedMetadata.last_promotion_date = updates.promotionDate;
                delete updatedMetadata.promotionDate;
            }

            // Update the relationship
            await db.execute(sql`
                UPDATE cortex_foundation.entity_relationships
                SET metadata = ${JSON.stringify(updatedMetadata)},
                    updated_at = NOW()
                WHERE id = ${relationshipId}
            `);

            return true;
        } catch (error) {
            console.error('Error updating person-company relationship:', error);
            return false;
        }
    }

    async getPersonCompanies(
        personId: string,
        relationshipTypes: string[] = [],
        activeOnly: boolean = true
    ): Promise<any[]> {
        try {
            const typeFilter = relationshipTypes.length > 0 
                ? sql`AND er.relationship_type = ANY(${relationshipTypes})`
                : sql``;

            const activeFilter = activeOnly 
                ? sql`AND (er.metadata->>'end_date' IS NULL OR (er.metadata->>'end_date')::DATE >= CURRENT_DATE)`
                : sql``;

            const result = await db.execute(sql`
                SELECT 
                    c.id as company_id,
                    c.name as company_name,
                    er.relationship_type,
                    er.id as relationship_id,
                    (er.metadata->>'start_date')::DATE as start_date,
                    (er.metadata->>'end_date')::DATE as end_date,
                    COALESCE((er.metadata->>'is_primary')::BOOLEAN, FALSE) as is_primary,
                    er.metadata->>'title' as title,
                    er.metadata->>'department' as department,
                    er.weight,
                    er.created_at
                FROM cortex_foundation.entity_relationships er
                JOIN cortex_entities.companies c ON er.to_entity_id = c.id
                WHERE er.from_entity_id = ${personId}
                  AND er.is_active = true
                  ${typeFilter}
                  ${activeFilter}
                ORDER BY 
                    COALESCE((er.metadata->>'is_primary')::BOOLEAN, FALSE) DESC,
                    er.weight DESC,
                    er.created_at DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error getting person companies:', error);
            return [];
        }
    }

    async getCrmGroups(userId: string): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM crm.groups 
                WHERE owner_user_id = ${userId}
                ORDER BY name ASC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching CRM groups:', error);
            return [];
        }
    }

    async createCrmGroup(data: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO crm.groups (
                    name, description, group_type, color, 
                    parent_group_id, status, owner_user_id
                ) VALUES (
                    ${data.name}, 
                    ${data.description || ''}, 
                    ${data.groupType || 'general'}, 
                    ${data.color || '#3B82F6'}, 
                    ${data.parentGroupId || null}, 
                    ${data.status || 'active'}, 
                    ${data.ownerUserId}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating CRM group:', error);
            throw error;
        }
    }

    async getCrmObjects(userId: string): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM crm.objects 
                WHERE owner_user_id = ${userId}
                ORDER BY name ASC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching CRM objects:', error);
            return [];
        }
    }

    async createCrmObject(data: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO crm.objects (
                    name, category, brand, model, serial_number, 
                    description, purchase_date, purchase_price, 
                    condition, location, status, tags, owner_user_id
                ) VALUES (
                    ${data.name}, 
                    ${data.category || ''}, 
                    ${data.brand || ''}, 
                    ${data.model || ''}, 
                    ${data.serialNumber || ''}, 
                    ${data.description || ''}, 
                    ${data.purchaseDate || null}, 
                    ${data.purchasePrice || null}, 
                    ${data.condition || 'good'}, 
                    ${data.location || ''}, 
                    ${data.status || 'active'}, 
                    ${data.tags || []}, 
                    ${data.ownerUserId}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating CRM object:', error);
            throw error;
        }
    }

    // =============================
    // CORTEX FINANCE TRANSACTIONS METHODS
    // =============================

    async getCortexFinanceTransactions(userId: string): Promise<any[]> {
        try {
            const result = await db.execute(sql`
                SELECT * FROM cortex_finance.transactions 
                ORDER BY transaction_date DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching cortex finance transactions:', error);
            return [];
        }
    }

    async createCortexFinanceTransaction(data: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO cortex_finance.transactions (
                    amount, transaction_type, description, transaction_date, 
                    category, subcategory, debit_account_entity_id, 
                    credit_account_entity_id, created_by_entity_id
                ) VALUES (
                    ${data.amount}, 
                    ${data.transactionType}, 
                    ${data.description}, 
                    ${data.transactionDate}, 
                    ${data.category || ''}, 
                    ${data.subcategory || ''}, 
                    ${data.debitAccountEntityId}, 
                    ${data.creditAccountEntityId},
                    ${data.createdByEntityId}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating cortex finance transaction:', error);
            throw error;
        }
    }

    // =============================
    // GOOGLE CALENDAR INTEGRATION - CORTEX_SCHEDULING
    // =============================
    
    async getCalendarEvents(): Promise<any[]> {
        try {
            // Return CRM calendar events for now
            // TODO: Integrate with cortex_scheduling.events once sync is implemented
            const result = await db.execute(sql`
                SELECT * FROM crm.calendar_events 
                ORDER BY start_time DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching calendar events:', error);
            return [];
        }
    }

    async createCalendarEvent(eventData: any): Promise<any> {
        try {
            console.log('📅 Creating calendar event in CRM schema:', eventData.title);
            
            const result = await db.execute(sql`
                INSERT INTO crm.calendar_events (
                    title, description, start_time, end_time, location, 
                    is_all_day, created_by_user_id, triggering_message_id,
                    project_id, task_id, related_chat_jid, space_id, instance_id
                ) VALUES (
                    ${eventData.title},
                    ${eventData.description || null},
                    ${eventData.startTime || new Date()},
                    ${eventData.endTime || null},
                    ${eventData.location || null},
                    ${eventData.isAllDay || false},
                    ${eventData.ownerUserId || '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'},
                    ${eventData.triggeringMessageId || null},
                    ${eventData.projectId || null},
                    ${eventData.taskId || null},
                    ${eventData.relatedChatJid || null},
                    ${eventData.spaceId || null},
                    ${eventData.instanceId || null}
                )
                RETURNING *
            `);
            
            console.log('✅ CRM calendar event created successfully:', eventData.title);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Error creating CRM calendar event:', error);
            throw error;
        }
    }

    async getCalendarProviders(): Promise<any[]> {
        try {
            // Return cortex_scheduling calendar integrations
            const result = await db.execute(sql`
                SELECT 
                    id,
                    provider_type,
                    account_name,
                    sync_status,
                    last_sync_at,
                    created_at
                FROM cortex_scheduling.calendar_integrations 
                ORDER BY created_at DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching calendar providers:', error);
            return [];
        }
    }

    async getCalendars(): Promise<any[]> {
        try {
            // Return default calendars for frontend display
            // TODO: Implement sync with actual Google Calendar data
            return [
                { 
                    id: 'personal', 
                    name: 'Personal', 
                    color: 'bg-blue-500', 
                    visible: true, 
                    provider: 'local' 
                },
                { 
                    id: 'work', 
                    name: 'Work', 
                    color: 'bg-red-500', 
                    visible: true, 
                    provider: 'local' 
                },
                { 
                    id: 'family', 
                    name: 'Family', 
                    color: 'bg-purple-500', 
                    visible: true, 
                    provider: 'local' 
                },
            ];
        } catch (error) {
            console.error('Error fetching calendars:', error);
            return [];
        }
    }

    async updateCalendar(id: string, data: any): Promise<any> {
        // TODO: Implement calendar update functionality
        console.log('Calendar update not yet implemented for cortex_scheduling');
        return { id, ...data };
    }

    async deleteCalendar(id: string): Promise<void> {
        // TODO: Implement calendar deletion functionality
        console.log('Calendar deletion not yet implemented for cortex_scheduling');
    }

    async createGoogleCalendarIntegration(integrationData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO cortex_scheduling.calendar_integrations (
                    id, user_id, provider_type, provider_account_id, 
                    account_name, access_token, refresh_token, 
                    token_expires_at, sync_status, sync_direction
                ) VALUES (
                    gen_random_uuid(),
                    ${integrationData.userId},
                    'google',
                    ${integrationData.accountId},
                    ${integrationData.accountName},
                    ${integrationData.accessToken},
                    ${integrationData.refreshToken},
                    ${integrationData.tokenExpiresAt},
                    'active',
                    'bidirectional'
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating Google Calendar integration:', error);
            throw error;
        }
    }
}

export const storage = new DatabaseStorage();