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
            const result = await db.execute(sql`
                SELECT * FROM app.spaces ORDER BY space_name
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching spaces:', error);
            throw error;
        }
    }

    // =============================
    // MINIMAL FINANCE STUBS
    // =============================
    
    async createReceivable(data: any): Promise<any> {
        throw new Error('Finance functionality temporarily disabled during schema migration');
    }

    async updateReceivable(receivableId: number, data: any): Promise<any> {
        throw new Error('Finance functionality temporarily disabled during schema migration');
    }

    async deleteReceivable(receivableId: number): Promise<void> {
        throw new Error('Finance functionality temporarily disabled during schema migration');
    }

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
                       c.is_archived as isarchived
                FROM whatsapp.chats c
                LEFT JOIN whatsapp.groups g ON c.chat_id = g.group_jid AND c.instance_name = g.instance_name
                LEFT JOIN whatsapp.contacts cont ON c.chat_id = cont.jid AND c.instance_name = cont.instance_name
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
                SELECT * FROM cortex_entities.companies ORDER BY company_name
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
    // UTILITY METHODS
    // =============================
    
    normalizePhoneNumber(phone: string): string {
        // Basic phone normalization
        return phone.replace(/\D/g, '');
    }
}

export const storage = new DatabaseStorage();