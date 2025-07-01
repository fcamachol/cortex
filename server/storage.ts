import { db } from './db';
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
import { automationRules } from '../shared/cortex-automations-schema';

// Import finance schema
import { cortexCreditCards } from '../shared/finance-schema';

class DatabaseStorage {
    // =============================
    // WHATSAPP CORE METHODS
    // =============================
    
    async getWhatsappInstances(spaceId?: string): Promise<any[]> {
        try {
            const result = await db.select().from(whatsappInstances);
            return result;
        } catch (error) {
            console.error('Error fetching WhatsApp instances:', error);
            throw error;
        }
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
        try {
            const taskId = taskData.id || crypto.randomUUID();
            const result = await db.execute(sql.raw(`
                INSERT INTO cortex_projects.tasks (
                    id, user_id, name, description, status, priority, due_date
                ) VALUES (
                    '${taskId}', 
                    '${taskData.userId}', 
                    '${taskData.title}', 
                    '${taskData.description || ''}', 
                    '${taskData.status || 'todo'}', 
                    '${taskData.priority || 'medium'}', 
                    ${taskData.due_date ? `'${taskData.due_date}'` : 'NULL'}
                ) RETURNING *
            `));
            return result.rows[0];
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
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
        try {
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
        } catch (error) {
            console.error('Error upserting WhatsApp message:', error);
            throw error;
        }
    }

    async getWhatsappMessageById(messageId: string, instanceName: string): Promise<any> {
        try {
            const result = await db.execute(sql`
                SELECT m.*, mm.local_path as media_path
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
    // ACTION RULES METHODS
    // =============================
    
    async getActionRulesByTrigger(triggerType: string, instanceId?: string): Promise<any[]> {
        try {
            // Get rules with their conditions and actions from cortex_automation schema
            const query = sql`
                SELECT 
                    r.id,
                    r.name,
                    r.description,
                    r.is_active,
                    r.trigger_type,
                    r.priority,
                    r.created_by,
                    r.space_id,
                    r.whatsapp_instance_id,
                    r.trigger_permission,
                    r.allowed_user_ids,
                    array_agg(
                        json_build_object(
                            'condition_type', rc.condition_type,
                            'operator', rc.operator,
                            'field_name', rc.field_name,
                            'value', rc.value,
                            'is_negated', rc.is_negated
                        )
                    ) FILTER (WHERE rc.id IS NOT NULL) as conditions,
                    array_agg(
                        json_build_object(
                            'action_type', ra.action_type,
                            'action_order', ra.action_order,
                            'target_entity_id', ra.target_entity_id,
                            'parameters', ra.parameters,
                            'template_id', ra.template_id
                        ) ORDER BY ra.action_order
                    ) FILTER (WHERE ra.id IS NOT NULL) as actions
                FROM cortex_automation.rules r
                LEFT JOIN cortex_automation.rule_conditions rc ON r.id = rc.rule_id
                LEFT JOIN cortex_automation.rule_actions ra ON r.id = ra.rule_id
                WHERE r.trigger_type = ${triggerType}
                AND (r.is_active IS NULL OR r.is_active = true)
                GROUP BY r.id, r.name, r.description, r.is_active, r.trigger_type, r.priority, r.created_by, r.space_id, r.whatsapp_instance_id, r.trigger_permission, r.allowed_user_ids
            `;
            
            const result = await db.execute(query);
            return result.rows;
        } catch (error) {
            console.error('Error fetching action rules from cortex_automation:', error);
            return [];
        }
    }
    
    async saveActionExecution(executionData: any): Promise<any> {
        try {
            const result = await db.execute(sql`
                INSERT INTO cortex_automation.rule_executions (
                    rule_id, trigger_data, execution_result, status, error_message, 
                    actions_executed, actions_failed, execution_time_ms, executed_at
                ) VALUES (
                    ${executionData.ruleId}, 
                    ${JSON.stringify(executionData.triggerContext)}, 
                    ${JSON.stringify(executionData.executionResult)}, 
                    ${executionData.status}, 
                    ${executionData.errorMessage},
                    ${executionData.actionsExecuted || 1},
                    ${executionData.actionsFailed || 0},
                    ${executionData.executionTimeMs || 0},
                    NOW()
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error saving action execution to cortex_automation:', error);
            throw error;
        }
    }
    
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
            // Get rules from cortex_automation schema with WhatsApp instance and permission info
            const query = sql`
                SELECT 
                    r.id,
                    r.name,
                    r.description,
                    r.is_active,
                    r.trigger_type,
                    r.priority,
                    r.created_by,
                    r.space_id,
                    r.whatsapp_instance_id,
                    r.trigger_permission,
                    r.allowed_user_ids,
                    r.last_executed_at,
                    r.execution_count,
                    r.success_count,
                    r.failure_count,
                    r.created_at,
                    r.updated_at,
                    -- Get associated WhatsApp instance name
                    r.whatsapp_instance_id as instance_name,
                    -- Get conditions
                    COALESCE(
                        ARRAY_AGG(
                            json_build_object(
                                'id', rc.id,
                                'condition_type', rc.condition_type,
                                'operator', rc.operator,
                                'field_name', rc.field_name,
                                'value', rc.value,
                                'is_negated', rc.is_negated
                            )
                        ) FILTER (WHERE rc.id IS NOT NULL),
                        ARRAY[]::json[]
                    ) as conditions,
                    -- Get actions
                    COALESCE(
                        ARRAY_AGG(
                            json_build_object(
                                'action_id', ra.id,
                                'action_type', ra.action_type,
                                'action_order', ra.action_order,
                                'target_entity_id', ra.target_entity_id,
                                'parameters', ra.parameters,
                                'template_id', ra.template_id
                            ) ORDER BY ra.action_order
                        ) FILTER (WHERE ra.rule_id IS NOT NULL),
                        ARRAY[]::json[]
                    ) as actions
                FROM cortex_automation.rules r
                LEFT JOIN cortex_automation.rule_conditions rc ON r.id = rc.rule_id
                LEFT JOIN cortex_automation.rule_actions ra ON r.id = ra.rule_id
                WHERE r.created_by = ${userId} OR r.trigger_permission = 'anyone'
                GROUP BY r.id, r.name, r.description, r.is_active, r.trigger_type, r.priority, 
                         r.created_by, r.space_id, r.whatsapp_instance_id, r.trigger_permission, 
                         r.allowed_user_ids, r.last_executed_at, r.execution_count, r.success_count, 
                         r.failure_count, r.created_at, r.updated_at
                ORDER BY r.priority DESC, r.created_at DESC
            `;
            
            const result = await db.execute(query);
            return result.rows;
        } catch (error) {
            console.error('Error fetching action rules from cortex_automation:', error);
            return [];
        }
    }

    // =============================
    // UTILITY METHODS
    // =============================
    
    async createActionRule(ruleData: any): Promise<any> {
        try {
            console.log('Creating rule with data:', ruleData);
            
            const result = await db.execute(sql`
                INSERT INTO cortex_automation.rules (
                    name, description, is_active, trigger_type, priority, 
                    created_by, space_id
                ) VALUES (
                    ${ruleData.name}, ${ruleData.description}, ${ruleData.is_active || true},
                    ${ruleData.trigger_type || 'whatsapp_message'}, ${ruleData.priority || 0},
                    ${ruleData.created_by}, ${ruleData.space_id}
                ) RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating action rule:', error);
            throw error;
        }
    }

    async updateActionRule(ruleId: string, updates: any): Promise<any> {
        try {
            // Handle PostgreSQL array field properly
            const allowedUserIds = updates.allowed_user_ids || [];
            const allowedUserIdsArray = Array.isArray(allowedUserIds) ? allowedUserIds : [];
            
            // Check for undefined/null values that might cause SQL issues
            const updateData = {
                name: updates.name || 'Untitled Rule',
                description: updates.description || '',
                is_active: Boolean(updates.is_active),
                trigger_type: updates.trigger_type || 'whatsapp_message',
                priority: Number(updates.priority) || 0,
                whatsapp_instance_id: updates.whatsapp_instance_id || null,
                trigger_permission: updates.trigger_permission || 'me',
                allowed_user_ids: allowedUserIdsArray
            };
            
            // Use raw SQL to handle all fields including extra ones not in schema
            const result = await db.execute(sql`
                UPDATE cortex_automation.rules 
                SET 
                    name = ${updateData.name},
                    description = ${updateData.description},
                    is_active = ${updateData.is_active},
                    trigger_type = ${updateData.trigger_type},
                    priority = ${updateData.priority},
                    whatsapp_instance_id = ${updateData.whatsapp_instance_id},
                    trigger_permission = ${updateData.trigger_permission},
                    allowed_user_ids = ARRAY[${updateData.allowed_user_ids.length > 0 ? updateData.allowed_user_ids.map((id: string) => `'${id}'`).join(',') : ''}]::text[],
                    updated_at = NOW()
                WHERE id = ${ruleId}
                RETURNING *
            `);
                
            return result.rows[0];
        } catch (error) {
            console.error('Error updating action rule:', error);
            throw error;
        }
    }

    async getActionRule(ruleId: string): Promise<any> {
        try {
            const query = sql`
                SELECT * FROM cortex_automation.rules 
                WHERE id = ${ruleId}
            `;
            
            const result = await db.execute(query);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting action rule:', error);
            return null;
        }
    }

    async deleteActionRule(ruleId: string): Promise<void> {
        try {
            await db.execute(sql`
                DELETE FROM cortex_automation.rules WHERE id = ${ruleId}
            `);
        } catch (error) {
            console.error('Error deleting action rule:', error);
            throw error;
        }
    }

    async getActionExecutions(ruleId?: string): Promise<any[]> {
        try {
            const query = ruleId 
                ? sql`SELECT * FROM cortex_automation.rule_executions WHERE rule_id = ${ruleId} ORDER BY executed_at DESC`
                : sql`SELECT * FROM cortex_automation.rule_executions ORDER BY executed_at DESC LIMIT 50`;
            
            const result = await db.execute(query);
            return result.rows;
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
            // Format tags as PostgreSQL array literal
            const tagsArray = data.tags || [];
            const tagsLiteral = `{${tagsArray.map((tag: string) => `"${tag.replace(/"/g, '\\"')}"`).join(',')}}`;
            
            // Create complete contact with both name and full_name populated
            const result = await db.execute(sql`
                INSERT INTO crm.contacts (
                    name, full_name, relationship, notes, tags, owner_user_id, entity_type
                ) VALUES (
                    ${data.fullName}, 
                    ${data.fullName}, 
                    ${data.relationship || 'Contact'}, 
                    ${data.notes || ''}, 
                    ${tagsLiteral}::text[], 
                    ${data.ownerUserId},
                    ${data.entityType || 'person'}
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
                SELECT * FROM crm.companies 
                WHERE owner_user_id = ${userId}
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
                INSERT INTO crm.companies (
                    name, industry, website, description, size, 
                    founded_year, headquarters, owner_user_id
                ) VALUES (
                    ${data.name}, 
                    ${data.industry || ''}, 
                    ${data.website || ''}, 
                    ${data.description || ''}, 
                    ${data.size || ''}, 
                    ${data.foundedYear || null}, 
                    ${data.headquarters || ''}, 
                    ${data.ownerUserId}
                )
                RETURNING *
            `);
            return result.rows[0];
        } catch (error) {
            console.error('Error creating CRM company:', error);
            throw error;
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
}

export const storage = new DatabaseStorage();