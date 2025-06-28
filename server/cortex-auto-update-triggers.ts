/**
 * Cortex Auto-Update Triggers Migration
 * Creates comprehensive auto-update triggers for all Cortex schemas
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

export async function createCortexAutoUpdateTriggers() {
  console.log('🔧 Creating auto-update triggers across all Cortex schemas...');

  try {
    // First, ensure the update_updated_at_column function exists
    console.log('📊 Creating update_updated_at_column function...');
    
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION app.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Foundation Schema Triggers
    console.log('📊 Creating Foundation schema triggers...');
    
    await db.execute(sql`CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON cortex_foundation.users FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON cortex_foundation.workspaces FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_spaces_updated_at BEFORE UPDATE ON cortex_foundation.spaces FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_workspace_members_updated_at BEFORE UPDATE ON cortex_foundation.workspace_members FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_space_members_updated_at BEFORE UPDATE ON cortex_foundation.space_members FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_entity_relationships_updated_at BEFORE UPDATE ON cortex_foundation.entity_relationships FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Foundation triggers created (6 triggers)');

    // Entities Schema Triggers
    console.log('📊 Creating Entities schema triggers...');
    
    await db.execute(sql`CREATE TRIGGER trg_persons_updated_at BEFORE UPDATE ON cortex_entities.persons FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON cortex_entities.companies FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_groups_updated_at BEFORE UPDATE ON cortex_entities.groups FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_objects_updated_at BEFORE UPDATE ON cortex_entities.objects FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Entities triggers created (4 triggers)');

    // Projects Schema Triggers
    console.log('📊 Creating Projects schema triggers...');
    
    await db.execute(sql`CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON cortex_projects.projects FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON cortex_projects.tasks FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_milestones_updated_at BEFORE UPDATE ON cortex_projects.milestones FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_time_entries_updated_at BEFORE UPDATE ON cortex_projects.time_entries FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_resources_updated_at BEFORE UPDATE ON cortex_projects.resources FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON cortex_projects.comments FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Projects triggers created (6 triggers)');

    // Finance Schema Triggers
    console.log('📊 Creating Finance schema triggers...');
    
    await db.execute(sql`CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON cortex_finance.accounts FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON cortex_finance.transactions FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_bills_payable_updated_at BEFORE UPDATE ON cortex_finance.bills_payable FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_bills_receivable_updated_at BEFORE UPDATE ON cortex_finance.bills_receivable FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON cortex_finance.categories FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_budget_categories_updated_at BEFORE UPDATE ON cortex_finance.budget_categories FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Finance triggers created (6 triggers)');

    // Scheduling Schema Triggers
    console.log('📊 Creating Scheduling schema triggers...');
    
    await db.execute(sql`CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON cortex_scheduling.events FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_event_participants_updated_at BEFORE UPDATE ON cortex_scheduling.event_participants FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_reminders_updated_at BEFORE UPDATE ON cortex_scheduling.reminders FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_reminder_links_updated_at BEFORE UPDATE ON cortex_scheduling.reminder_links FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_calendar_integrations_updated_at BEFORE UPDATE ON cortex_scheduling.calendar_integrations FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Scheduling triggers created (5 triggers)');

    // Knowledge Schema Triggers
    console.log('📊 Creating Knowledge schema triggers...');
    
    await db.execute(sql`CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON cortex_knowledge.notes FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON cortex_knowledge.documents FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_document_types_updated_at BEFORE UPDATE ON cortex_knowledge.document_types FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_folders_updated_at BEFORE UPDATE ON cortex_knowledge.folders FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_bookmarks_updated_at BEFORE UPDATE ON cortex_knowledge.bookmarks FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_google_drive_config_updated_at BEFORE UPDATE ON cortex_knowledge.google_drive_config FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_google_drive_folders_updated_at BEFORE UPDATE ON cortex_knowledge.google_drive_folders FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Knowledge triggers created (7 triggers)');

    // Communication Schema Triggers
    console.log('📊 Creating Communication schema triggers...');
    
    await db.execute(sql`CREATE TRIGGER trg_channels_updated_at BEFORE UPDATE ON cortex_communication.channels FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON cortex_communication.conversations FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_messages_unified_updated_at BEFORE UPDATE ON cortex_communication.messages_unified FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_participants_updated_at BEFORE UPDATE ON cortex_communication.participants FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_channel_entity_links_updated_at BEFORE UPDATE ON cortex_communication.channel_entity_links FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_message_templates_updated_at BEFORE UPDATE ON cortex_communication.message_templates FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_communication_events_updated_at BEFORE UPDATE ON cortex_communication.communication_events FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_automations_updated_at BEFORE UPDATE ON cortex_communication.automations FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Communication triggers created (8 triggers)');

    // Automation Schema Triggers
    console.log('📊 Creating Automation schema triggers...');
    
    await db.execute(sql`CREATE TRIGGER trg_rules_updated_at BEFORE UPDATE ON cortex_automation.rules FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_workflows_updated_at BEFORE UPDATE ON cortex_automation.workflows FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_workflow_steps_updated_at BEFORE UPDATE ON cortex_automation.workflow_steps FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON cortex_automation.templates FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_rule_executions_updated_at BEFORE UPDATE ON cortex_automation.rule_executions FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_workflow_executions_updated_at BEFORE UPDATE ON cortex_automation.workflow_executions FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_triggers_updated_at BEFORE UPDATE ON cortex_automation.triggers FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE TRIGGER trg_trigger_executions_updated_at BEFORE UPDATE ON cortex_automation.trigger_executions FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Automation triggers created (8 triggers)');

    const totalTriggers = 6 + 4 + 6 + 6 + 5 + 7 + 8 + 8;
    console.log(`🎉 Auto-update triggers completed! Created ${totalTriggers} comprehensive triggers across all Cortex schemas.`);
    
    return {
      success: true,
      message: 'Auto-update triggers created successfully',
      totalTriggers,
      schemaBreakdown: {
        foundation: 6,
        entities: 4,
        projects: 6,
        finance: 6,
        scheduling: 5,
        knowledge: 7,
        communication: 8,
        automation: 8
      }
    };

  } catch (error) {
    console.error('❌ Error creating auto-update triggers:', error);
    throw error;
  }
}