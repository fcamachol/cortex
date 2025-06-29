/**
 * CORTEX API ADAPTER
 * Provides backward compatibility for CRM endpoints while transitioning to Cortex schemas
 * Maintains existing API contracts while internally using new Cortex data structures
 */

import { DatabaseConnection } from './storage';

export class CortexApiAdapter {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Get contacts - returns data from Cortex entities.persons with CRM format
   */
  async getContacts(userId: string) {
    try {
      // First try to get from Cortex entities
      const cortexContacts = await this.db.query(`
        SELECT 
          p.id as cortex_person_id,
          p.first_name,
          p.last_name,
          p.display_name,
          p.profession,
          p.description,
          p.avatar,
          p.status,
          p.created_at,
          p.updated_at,
          -- Get primary phone
          (SELECT phone_number FROM cortex_entities.person_phones WHERE person_id = p.id AND is_primary = true LIMIT 1) as primary_phone,
          -- Get primary email  
          (SELECT email_address FROM cortex_entities.person_emails WHERE person_id = p.id AND is_primary = true LIMIT 1) as primary_email,
          -- Get WhatsApp linking info
          (SELECT is_whatsapp_linked FROM cortex_entities.person_phones WHERE person_id = p.id AND is_whatsapp_linked = true LIMIT 1) as is_whatsapp_linked
        FROM cortex_entities.persons p
        WHERE p.status = 'active'
        ORDER BY p.created_at DESC
      `);

      // Transform to CRM format for backward compatibility
      return cortexContacts.rows.map(contact => ({
        contactId: contact.cortex_person_id,
        fullName: contact.display_name,
        firstName: contact.first_name,
        lastName: contact.last_name,
        profession: contact.profession,
        notes: contact.description,
        profilePictureUrl: contact.avatar,
        primaryPhone: contact.primary_phone,
        primaryEmail: contact.primary_email,
        isWhatsappLinked: contact.is_whatsapp_linked || false,
        createdAt: contact.created_at,
        updatedAt: contact.updated_at,
        // Legacy fields for compatibility
        relationship: 'Contact',
        tags: []
      }));
    } catch (error) {
      console.log('Cortex contacts not available, falling back to CRM schema:', error.message);
      
      // Fallback to CRM schema
      const crmContacts = await this.db.query(`
        SELECT * FROM crm.contacts
        WHERE owner_user_id = $1
        ORDER BY created_at DESC
      `, [userId]);

      return crmContacts.rows;
    }
  }

  /**
   * Get tasks - returns data from Cortex projects.tasks with CRM format
   */
  async getTasks(userId: string) {
    try {
      const cortexTasks = await this.db.query(`
        SELECT 
          t.id as task_id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date,
          t.completed_at,
          t.estimated_hours,
          t.actual_hours,
          t.tags,
          t.created_at,
          t.updated_at,
          -- Get associated project info
          p.name as project_name,
          p.id as project_id
        FROM cortex_projects.tasks t
        LEFT JOIN cortex_projects.projects p ON t.project_id = p.id
        ORDER BY t.created_at DESC
      `);

      return cortexTasks.rows.map(task => ({
        taskId: task.task_id,
        title: task.title,
        description: task.description,
        taskStatus: task.status,
        priority: task.priority,
        dueDate: task.due_date,
        completedAt: task.completed_at,
        estimatedHours: task.estimated_hours,
        actualHours: task.actual_hours,
        tags: task.tags,
        projectName: task.project_name,
        projectId: task.project_id,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }));
    } catch (error) {
      console.log('Cortex tasks not available, falling back to CRM schema:', error.message);
      
      // Fallback to CRM schema
      const crmTasks = await this.db.query(`
        SELECT * FROM crm.tasks
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [userId]);

      return crmTasks.rows;
    }
  }

  /**
   * Get projects - returns data from Cortex projects.projects with CRM format
   */
  async getProjects(userId: string) {
    try {
      const cortexProjects = await this.db.query(`
        SELECT 
          p.id as project_id,
          p.name as project_name,
          p.description,
          p.status,
          p.priority,
          p.start_date,
          p.end_date,
          p.budget,
          p.spent_amount,
          p.progress,
          p.tags,
          p.color,
          p.created_at,
          p.updated_at,
          -- Count tasks
          (SELECT COUNT(*) FROM cortex_projects.tasks WHERE project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM cortex_projects.tasks WHERE project_id = p.id AND status = 'completed') as completed_tasks
        FROM cortex_projects.projects p
        ORDER BY p.created_at DESC
      `);

      return cortexProjects.rows.map(project => ({
        projectId: project.project_id,
        projectName: project.project_name,
        name: project.project_name, // Alias for different naming conventions
        description: project.description,
        status: project.status,
        priority: project.priority,
        startDate: project.start_date,
        endDate: project.end_date,
        budget: project.budget,
        spentAmount: project.spent_amount,
        progress: project.progress,
        tags: project.tags,
        color: project.color,
        taskCount: project.task_count,
        completedTasks: project.completed_tasks,
        createdAt: project.created_at,
        updatedAt: project.updated_at
      }));
    } catch (error) {
      console.log('Cortex projects not available, falling back to CRM schema:', error.message);
      
      // Fallback to CRM schema
      const crmProjects = await this.db.query(`
        SELECT * FROM crm.projects
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [userId]);

      return crmProjects.rows;
    }
  }

  /**
   * Get events - returns data from Cortex scheduling.events with CRM format
   */
  async getEvents(userId: string) {
    try {
      const cortexEvents = await this.db.query(`
        SELECT 
          e.id as event_id,
          e.title,
          e.description,
          e.event_type,
          e.start_time,
          e.end_time,
          e.location,
          e.all_day,
          e.timezone,
          e.status,
          e.priority,
          e.created_at,
          e.updated_at
        FROM cortex_scheduling.events e
        ORDER BY e.start_time DESC
      `);

      return cortexEvents.rows.map(event => ({
        eventId: event.event_id,
        title: event.title,
        description: event.description,
        eventType: event.event_type,
        startTime: event.start_time,
        endTime: event.end_time,
        location: event.location,
        isAllDay: event.all_day,
        timezone: event.timezone,
        status: event.status,
        priority: event.priority,
        createdAt: event.created_at,
        updatedAt: event.updated_at
      }));
    } catch (error) {
      console.log('Cortex events not available, falling back to CRM schema:', error.message);
      
      // Fallback to CRM schema
      const crmEvents = await this.db.query(`
        SELECT * FROM crm.calendar_events
        WHERE created_by_user_id = $1
        ORDER BY start_time DESC
      `, [userId]);

      return crmEvents.rows;
    }
  }

  /**
   * Get notes - returns data from Cortex knowledge.notes with CRM format
   */
  async getNotes(userId: string) {
    try {
      const cortexNotes = await this.db.query(`
        SELECT 
          n.id as note_id,
          n.title,
          n.content,
          n.content_type,
          n.word_count,
          n.note_type,
          n.is_pinned,
          n.is_archived,
          n.tags,
          n.created_at,
          n.updated_at
        FROM cortex_knowledge.notes n
        WHERE n.is_archived = false
        ORDER BY n.created_at DESC
      `);

      return cortexNotes.rows.map(note => ({
        noteId: note.note_id,
        title: note.title,
        content: note.content,
        contentType: note.content_type,
        wordCount: note.word_count,
        noteType: note.note_type,
        isPinned: note.is_pinned,
        isArchived: note.is_archived,
        tags: note.tags,
        createdAt: note.created_at,
        updatedAt: note.updated_at
      }));
    } catch (error) {
      console.log('Cortex notes not available, falling back to CRM schema:', error.message);
      
      // Fallback to CRM schema
      const crmNotes = await this.db.query(`
        SELECT * FROM crm.notes
        WHERE created_by_user_id = $1
        ORDER BY created_at DESC
      `, [userId]);

      return crmNotes.rows;
    }
  }

  /**
   * Create contact in Cortex entities.persons
   */
  async createContact(contactData: any) {
    try {
      // Generate cp_ prefixed UUID
      const { v4: uuidv4 } = await import('crypto');
      const cortexPersonId = 'cp_' + uuidv4().replace(/-/g, '');

      // Insert into Cortex entities
      await this.db.query(`
        INSERT INTO cortex_entities.persons (
          id, first_name, last_name, display_name, profession, 
          description, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'active', NOW(), NOW()
        )
      `, [
        cortexPersonId,
        contactData.firstName || '',
        contactData.lastName || '',
        contactData.fullName || `${contactData.firstName} ${contactData.lastName}`.trim(),
        contactData.profession,
        contactData.notes
      ]);

      // Add primary phone if provided
      if (contactData.primaryPhone) {
        await this.db.query(`
          INSERT INTO cortex_entities.person_phones (
            person_id, phone_number, label, is_primary, is_whatsapp_linked
          ) VALUES ($1, $2, 'Mobile', true, $3)
        `, [
          cortexPersonId,
          contactData.primaryPhone,
          contactData.isWhatsappLinked || false
        ]);
      }

      // Add primary email if provided
      if (contactData.primaryEmail) {
        await this.db.query(`
          INSERT INTO cortex_entities.person_emails (
            person_id, email_address, label, is_primary
          ) VALUES ($1, $2, 'Personal', true)
        `, [
          cortexPersonId,
          contactData.primaryEmail
        ]);
      }

      return { contactId: cortexPersonId, ...contactData };
    } catch (error) {
      console.log('Cortex person creation failed, falling back to CRM schema:', error.message);
      throw error;
    }
  }

  /**
   * Create task in Cortex projects.tasks
   */
  async createTask(taskData: any) {
    try {
      const { v4: uuidv4 } = await import('crypto');
      const cortexTaskId = uuidv4();

      await this.db.query(`
        INSERT INTO cortex_projects.tasks (
          id, title, description, status, priority, due_date,
          estimated_hours, tags, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        )
      `, [
        cortexTaskId,
        taskData.title,
        taskData.description,
        taskData.status || 'to_do',
        taskData.priority || 'medium',
        taskData.dueDate,
        taskData.estimatedHours,
        JSON.stringify(taskData.tags || [])
      ]);

      return { taskId: cortexTaskId, ...taskData };
    } catch (error) {
      console.log('Cortex task creation failed, falling back to CRM schema:', error.message);
      throw error;
    }
  }

  /**
   * Check if Cortex schemas are available
   */
  async isCortexAvailable(): Promise<boolean> {
    try {
      await this.db.query(`SELECT 1 FROM cortex_entities.persons LIMIT 1`);
      return true;
    } catch {
      return false;
    }
  }
}

export async function createCortexApiAdapter(): Promise<CortexApiAdapter> {
  const { db } = await import('./storage');
  return new CortexApiAdapter(db);
}