/**
 * Cortex Performance Indexes Migration
 * Creates comprehensive indexes across all Cortex schemas for optimal performance
 */

import { sql } from 'drizzle-orm';
import { db } from './db';

export async function createCortexPerformanceIndexes() {
  console.log('🔧 Creating comprehensive performance indexes across all Cortex schemas...');

  try {
    // Foundation indexes
    console.log('📊 Creating Foundation schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON cortex_foundation.users(email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_active ON cortex_foundation.users(is_active) WHERE is_active = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spaces_parent ON cortex_foundation.spaces(parent_space_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spaces_owner ON cortex_foundation.spaces(owner_user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entity_relationships_from ON cortex_foundation.entity_relationships(from_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entity_relationships_to ON cortex_foundation.entity_relationships(to_entity_id) WHERE to_entity_id IS NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entity_relationships_content ON cortex_foundation.entity_relationships(content_type, content_id) WHERE content_type IS NOT NULL`);

    console.log('✅ Foundation indexes created (7 indexes)');

    // Entities indexes
    console.log('📊 Creating Entities schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_name ON cortex_entities.persons(full_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_whatsapp ON cortex_entities.persons(primary_whatsapp_jid, whatsapp_instance_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_name ON cortex_entities.companies(name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_objects_owner ON cortex_entities.objects(current_owner_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_objects_type ON cortex_entities.objects(object_type, category)`);

    console.log('✅ Entities indexes created (5 indexes)');

    // Projects indexes
    console.log('📊 Creating Projects schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_status ON cortex_projects.projects(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON cortex_projects.tasks(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON cortex_projects.tasks(assigned_to_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON cortex_projects.tasks(project_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON cortex_projects.tasks(due_date)`);

    console.log('✅ Projects indexes created (5 indexes)');

    // Finance indexes
    console.log('📊 Creating Finance schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_owner ON cortex_finance.accounts(owner_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_date ON cortex_finance.transactions(transaction_date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_vendor ON cortex_finance.transactions(vendor_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_payable_vendor ON cortex_finance.bills_payable(vendor_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_payable_due ON cortex_finance.bills_payable(due_date)`);

    console.log('✅ Finance indexes created (5 indexes)');

    // Scheduling indexes
    console.log('📊 Creating Scheduling schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_time ON cortex_scheduling.events(start_time, end_time)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON cortex_scheduling.reminders(remind_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_status ON cortex_scheduling.reminders(status)`);

    console.log('✅ Scheduling indexes created (3 indexes)');

    // Knowledge indexes
    console.log('📊 Creating Knowledge schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notes_created_by ON cortex_knowledge.notes(created_by_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_google_drive ON cortex_knowledge.documents(google_drive_file_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_type ON cortex_knowledge.documents(document_type, document_subtype)`);

    console.log('✅ Knowledge indexes created (3 indexes)');

    // Communication indexes
    console.log('📊 Creating Communication schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON cortex_communication.messages_unified(timestamp DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_channel_entity_links_entity ON cortex_communication.channel_entity_links(entity_id)`);

    console.log('✅ Communication indexes created (2 indexes)');

    // Automation indexes
    console.log('📊 Creating Automation schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rules_active ON cortex_automation.rules(is_active) WHERE is_active = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_executions_rule ON cortex_automation.rule_executions(rule_id, executed_at DESC)`);

    console.log('✅ Automation indexes created (2 indexes)');

    const totalIndexes = 7 + 5 + 5 + 5 + 3 + 3 + 2 + 2;
    console.log(`🎉 Performance optimization completed! Created ${totalIndexes} comprehensive indexes across all Cortex schemas.`);
    
    return {
      success: true,
      message: 'Performance indexes created successfully',
      totalIndexes,
      schemaBreakdown: {
        foundation: 7,
        entities: 5,
        projects: 5,
        finance: 5,
        scheduling: 3,
        knowledge: 3,
        communication: 2,
        automation: 2
      }
    };

  } catch (error) {
    console.error('❌ Error creating performance indexes:', error);
    throw error;
  }
}