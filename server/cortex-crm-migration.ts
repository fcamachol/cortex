/**
 * CORTEX CRM MIGRATION SCRIPT
 * Migrates data from CRM schema to corresponding Cortex schemas
 * Maintains data integrity and creates proper entity relationships
 */

import { storage } from './storage';
import { randomUUID } from 'crypto';

interface MigrationResult {
  success: boolean;
  migrated: number;
  failed: number;
  errors: string[];
}

export class CortexCrmMigrator {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Full migration from CRM to Cortex schemas
   */
  async migrateAll(): Promise<{ [key: string]: MigrationResult }> {
    console.log('🚀 Starting CRM to Cortex migration...');
    
    const results = {
      contacts: await this.migrateContacts(),
      companies: await this.migrateCompanies(),
      groups: await this.migrateGroups(),
      tasks: await this.migrateTasks(),
      projects: await this.migrateProjects(),
      events: await this.migrateEvents(),
      notes: await this.migrateNotes(),
      documents: await this.migrateDocuments(),
    };

    console.log('✅ Migration completed. Summary:');
    Object.entries(results).forEach(([type, result]) => {
      console.log(`  ${type}: ${result.migrated} migrated, ${result.failed} failed`);
    });

    return results;
  }

  /**
   * Migrate CRM contacts to cortex_entities.persons
   */
  async migrateContacts(): Promise<MigrationResult> {
    const result: MigrationResult = { success: true, migrated: 0, failed: 0, errors: [] };

    try {
      // Get all CRM contacts
      const crmContacts = await this.db.query(`
        SELECT * FROM crm.contacts
        ORDER BY created_at ASC
      `);

      for (const contact of crmContacts.rows) {
        try {
          // Generate cp_ prefixed UUID for Cortex person
          const cortexPersonId = 'cp_' + uuidv4().replace(/-/g, '');

          // Insert into cortex_entities.persons
          await this.db.query(`
            INSERT INTO cortex_entities.persons (
              id, first_name, last_name, display_name, profession, 
              description, avatar, status, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, 'active', $8, $9
            )
          `, [
            cortexPersonId,
            contact.full_name?.split(' ')[0] || '',
            contact.full_name?.split(' ').slice(1).join(' ') || '',
            contact.full_name,
            contact.profession,
            contact.notes,
            contact.profile_picture_url,
            contact.created_at,
            contact.updated_at
          ]);

          // Migrate contact phones
          const phones = await this.db.query(`
            SELECT * FROM crm.contact_phones WHERE contact_id = $1
          `, [contact.contact_id]);

          for (const phone of phones.rows) {
            await this.db.query(`
              INSERT INTO cortex_entities.person_phones (
                person_id, phone_number, label, is_primary, is_whatsapp_linked
              ) VALUES ($1, $2, $3, $4, $5)
            `, [
              cortexPersonId,
              phone.phone_number,
              phone.label,
              phone.is_primary,
              phone.is_whatsapp_linked
            ]);
          }

          // Migrate contact emails
          const emails = await this.db.query(`
            SELECT * FROM crm.contact_emails WHERE contact_id = $1
          `, [contact.contact_id]);

          for (const email of emails.rows) {
            await this.db.query(`
              INSERT INTO cortex_entities.person_emails (
                person_id, email_address, label, is_primary
              ) VALUES ($1, $2, $3, $4)
            `, [
              cortexPersonId,
              email.email_address,
              email.label,
              email.is_primary
            ]);
          }

          // Migrate contact addresses
          const addresses = await this.db.query(`
            SELECT * FROM crm.contact_addresses WHERE contact_id = $1
          `, [contact.contact_id]);

          for (const address of addresses.rows) {
            await this.db.query(`
              INSERT INTO cortex_entities.person_addresses (
                person_id, label, street, city, state, postal_code, country, is_primary
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              cortexPersonId,
              address.label,
              address.street,
              address.city,
              address.state,
              address.postal_code,
              address.country,
              address.is_primary
            ]);
          }

          // Create bridge record
          await this.db.query(`
            INSERT INTO crm.crm_to_person_bridge (
              crm_contact_id, cortex_person_id, migration_status, migrated_at
            ) VALUES ($1, $2, 'completed', NOW())
          `, [contact.contact_id, cortexPersonId]);

          result.migrated++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Contact ${contact.contact_id}: ${error.message}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Migrate CRM companies to cortex_entities.companies
   */
  async migrateCompanies(): Promise<MigrationResult> {
    const result: MigrationResult = { success: true, migrated: 0, failed: 0, errors: [] };

    try {
      const crmCompanies = await this.db.query(`
        SELECT * FROM crm.companies
        ORDER BY created_at ASC
      `);

      for (const company of crmCompanies.rows) {
        try {
          const cortexCompanyId = 'cc_' + uuidv4().replace(/-/g, '');

          await this.db.query(`
            INSERT INTO cortex_entities.companies (
              id, name, business_type, tax_id, email, phone, website,
              description, status, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10
            )
          `, [
            cortexCompanyId,
            company.company_name,
            company.business_type,
            company.tax_id,
            company.email,
            company.phone,
            company.website,
            company.notes,
            company.created_at,
            company.updated_at
          ]);

          await this.db.query(`
            INSERT INTO crm.crm_to_company_bridge (
              crm_company_id, cortex_company_id, migration_status, migrated_at
            ) VALUES ($1, $2, 'completed', NOW())
          `, [company.company_id, cortexCompanyId]);

          result.migrated++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Company ${company.company_id}: ${error.message}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Companies migration failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Migrate CRM tasks to cortex_projects.tasks
   */
  async migrateTasks(): Promise<MigrationResult> {
    const result: MigrationResult = { success: true, migrated: 0, failed: 0, errors: [] };

    try {
      const crmTasks = await this.db.query(`
        SELECT * FROM crm.tasks
        ORDER BY created_at ASC
      `);

      for (const task of crmTasks.rows) {
        try {
          const cortexTaskId = uuidv4();

          await this.db.query(`
            INSERT INTO cortex_projects.tasks (
              id, title, description, status, priority, due_date,
              estimated_hours, actual_hours, tags, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )
          `, [
            cortexTaskId,
            task.title,
            task.description,
            task.status || 'to_do',
            task.priority || 'medium',
            task.due_date,
            task.estimated_hours,
            task.actual_hours,
            JSON.stringify(task.tags || []),
            task.created_at,
            task.updated_at
          ]);

          // Migrate task-message links
          const taskLinks = await this.db.query(`
            SELECT * FROM crm.task_message_links WHERE task_id = $1
          `, [task.id]);

          for (const link of taskLinks.rows) {
            await this.db.query(`
              INSERT INTO cortex_communication.message_tasks (
                task_id, message_id, instance_id, link_type, created_at
              ) VALUES ($1, $2, $3, $4, $5)
            `, [
              cortexTaskId,
              link.message_id,
              link.instance_id,
              link.link_type,
              new Date()
            ]);
          }

          await this.db.query(`
            INSERT INTO crm.crm_to_task_bridge (
              crm_task_id, cortex_task_id, migration_status, migrated_at
            ) VALUES ($1, $2, 'completed', NOW())
          `, [task.id, cortexTaskId]);

          result.migrated++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Task ${task.id}: ${error.message}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Tasks migration failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Migrate CRM projects to cortex_projects.projects
   */
  async migrateProjects(): Promise<MigrationResult> {
    const result: MigrationResult = { success: true, migrated: 0, failed: 0, errors: [] };

    try {
      const crmProjects = await this.db.query(`
        SELECT * FROM crm.projects
        ORDER BY created_at ASC
      `);

      for (const project of crmProjects.rows) {
        try {
          const cortexProjectId = 'cj_' + uuidv4().replace(/-/g, '');

          await this.db.query(`
            INSERT INTO cortex_projects.projects (
              id, name, description, status, priority, start_date, end_date,
              budget, spent_amount, progress, tags, color, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )
          `, [
            cortexProjectId,
            project.name,
            project.description,
            project.status || 'planning',
            project.priority || 'medium',
            project.start_date,
            project.end_date,
            project.budget,
            project.spent_amount,
            project.progress,
            JSON.stringify(project.tags || []),
            project.color,
            project.created_at,
            project.updated_at
          ]);

          await this.db.query(`
            INSERT INTO crm.crm_to_project_bridge (
              crm_project_id, cortex_project_id, migration_status, migrated_at
            ) VALUES ($1, $2, 'completed', NOW())
          `, [project.id, cortexProjectId]);

          result.migrated++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Project ${project.id}: ${error.message}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Projects migration failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Migrate CRM calendar events to cortex_scheduling.events
   */
  async migrateEvents(): Promise<MigrationResult> {
    const result: MigrationResult = { success: true, migrated: 0, failed: 0, errors: [] };

    try {
      const crmEvents = await this.db.query(`
        SELECT * FROM crm.calendar_events
        ORDER BY created_at ASC
      `);

      for (const event of crmEvents.rows) {
        try {
          const cortexEventId = uuidv4();

          await this.db.query(`
            INSERT INTO cortex_scheduling.events (
              id, title, description, event_type, start_time, end_time,
              location, all_day, timezone, status, priority, created_at, updated_at
            ) VALUES (
              $1, $2, $3, 'meeting', $4, $5, $6, $7, 'UTC', 'scheduled', 'medium', $8, $9
            )
          `, [
            cortexEventId,
            event.title,
            event.description,
            event.start_time,
            event.end_time,
            event.location,
            event.is_all_day || false,
            event.created_at,
            event.updated_at
          ]);

          await this.db.query(`
            INSERT INTO crm.crm_to_event_bridge (
              crm_event_id, cortex_event_id, migration_status, migrated_at
            ) VALUES ($1, $2, 'completed', NOW())
          `, [event.event_id, cortexEventId]);

          result.migrated++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Event ${event.event_id}: ${error.message}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Events migration failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Migrate CRM notes to cortex_knowledge.notes
   */
  async migrateNotes(): Promise<MigrationResult> {
    const result: MigrationResult = { success: true, migrated: 0, failed: 0, errors: [] };

    try {
      const crmNotes = await this.db.query(`
        SELECT * FROM crm.notes
        ORDER BY created_at ASC
      `);

      for (const note of crmNotes.rows) {
        try {
          const cortexNoteId = uuidv4();

          await this.db.query(`
            INSERT INTO cortex_knowledge.notes (
              id, title, content, content_type, word_count, note_type,
              is_pinned, is_archived, view_count, tags, created_at, updated_at
            ) VALUES (
              $1, $2, $3, 'markdown', $4, 'general', false, false, 0, $5, $6, $7
            )
          `, [
            cortexNoteId,
            note.title || 'Untitled Note',
            note.content,
            (note.content || '').split(' ').length,
            JSON.stringify([]),
            note.created_at,
            note.updated_at
          ]);

          await this.db.query(`
            INSERT INTO crm.crm_to_note_bridge (
              crm_note_id, cortex_note_id, migration_status, migrated_at
            ) VALUES ($1, $2, 'completed', NOW())
          `, [note.note_id, cortexNoteId]);

          result.migrated++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Note ${note.note_id}: ${error.message}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Notes migration failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Migrate CRM documents to cortex_knowledge.documents
   */
  async migrateDocuments(): Promise<MigrationResult> {
    const result: MigrationResult = { success: true, migrated: 0, failed: 0, errors: [] };

    try {
      const crmDocuments = await this.db.query(`
        SELECT * FROM crm.documents
        ORDER BY created_at ASC
      `);

      for (const document of crmDocuments.rows) {
        try {
          const cortexDocumentId = uuidv4();

          await this.db.query(`
            INSERT INTO cortex_knowledge.documents (
              id, title, filename, original_filename, mime_type, file_size,
              file_path, version, description, is_archived, tags, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
          `, [
            cortexDocumentId,
            document.original_name,
            document.filename,
            document.original_name,
            document.mime_type,
            document.file_size,
            document.file_path,
            document.version || 1,
            document.description,
            document.is_archived || false,
            JSON.stringify(document.tags || []),
            document.created_at,
            document.updated_at
          ]);

          await this.db.query(`
            INSERT INTO crm.crm_to_document_bridge (
              crm_document_id, cortex_document_id, migration_status, migrated_at
            ) VALUES ($1, $2, 'completed', NOW())
          `, [document.id, cortexDocumentId]);

          result.migrated++;
        } catch (error) {
          result.failed++;
          result.errors.push(`Document ${document.id}: ${error.message}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Documents migration failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Migrate CRM groups to cortex_entities.groups (placeholder)
   */
  async migrateGroups(): Promise<MigrationResult> {
    // For now, return empty result as group structure needs to be defined
    return { success: true, migrated: 0, failed: 0, errors: [] };
  }
}

export async function runCortexCrmMigration() {
  const { db } = await import('./storage');
  const migrator = new CortexCrmMigrator(db);
  return await migrator.migrateAll();
}