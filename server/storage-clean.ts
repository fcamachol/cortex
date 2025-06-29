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
            const result = await db.execute(sql`
                SELECT DISTINCT c.chat_id, c.instance_name, c.name, c.phone, c.last_message_timestamp, 
                       c.unread_count, c.status, c.is_group, c.is_archived
                FROM whatsapp.chats c
                WHERE c.instance_name = ${instanceName}
                ORDER BY c.last_message_timestamp DESC NULLS LAST
            `);
            return result.rows;
        } catch (error) {
            console.error('Error fetching conversations:', error);
            throw error;
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
    // UTILITY METHODS
    // =============================
    
    normalizePhoneNumber(phone: string): string {
        // Basic phone normalization
        return phone.replace(/\D/g, '');
    }
}

export const storage = new DatabaseStorage();