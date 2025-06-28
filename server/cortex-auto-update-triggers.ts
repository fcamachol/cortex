/**
 * Cortex Auto-Update Triggers Migration
 * Creates comprehensive auto-update triggers for all Cortex schemas
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

export async function createCortexAutoUpdateTriggers() {
  console.log('🔧 Creating auto-update triggers for Cortex schemas only...');
  
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

    // Foundation Schema Triggers (Cortex only)
    console.log('📊 Creating Foundation schema triggers...');
    
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_users_updated_at BEFORE UPDATE ON cortex_foundation.users FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_workspaces_updated_at BEFORE UPDATE ON cortex_foundation.workspaces FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_spaces_updated_at BEFORE UPDATE ON cortex_foundation.spaces FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_workspace_members_updated_at BEFORE UPDATE ON cortex_foundation.workspace_members FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_space_members_updated_at BEFORE UPDATE ON cortex_foundation.space_members FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_entity_relationships_updated_at BEFORE UPDATE ON cortex_foundation.entity_relationships FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Foundation triggers created (6 triggers)');

    // Entities Schema Triggers
    console.log('📊 Creating Entities schema triggers...');
    
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_persons_updated_at BEFORE UPDATE ON cortex_entities.persons FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_companies_updated_at BEFORE UPDATE ON cortex_entities.companies FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_groups_updated_at BEFORE UPDATE ON cortex_entities.groups FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_objects_updated_at BEFORE UPDATE ON cortex_entities.objects FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Entities triggers created (4 triggers)');

    // Projects Schema Triggers
    console.log('📊 Creating Projects schema triggers...');
    
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_projects_updated_at BEFORE UPDATE ON cortex_projects.projects FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_tasks_updated_at BEFORE UPDATE ON cortex_projects.tasks FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_milestones_updated_at BEFORE UPDATE ON cortex_projects.milestones FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_time_entries_updated_at BEFORE UPDATE ON cortex_projects.time_entries FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_resources_updated_at BEFORE UPDATE ON cortex_projects.resources FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_comments_updated_at BEFORE UPDATE ON cortex_projects.comments FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Projects triggers created (6 triggers)');

    // Finance Schema Triggers
    console.log('📊 Creating Finance schema triggers...');
    
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_accounts_updated_at BEFORE UPDATE ON cortex_finance.accounts FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_transactions_updated_at BEFORE UPDATE ON cortex_finance.transactions FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_bills_payable_updated_at BEFORE UPDATE ON cortex_finance.bills_payable FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_bills_receivable_updated_at BEFORE UPDATE ON cortex_finance.bills_receivable FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_categories_updated_at BEFORE UPDATE ON cortex_finance.categories FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_budget_categories_updated_at BEFORE UPDATE ON cortex_finance.budget_categories FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Finance triggers created (6 triggers)');

    // Scheduling Schema Triggers
    console.log('📊 Creating Scheduling schema triggers...');
    
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_events_updated_at BEFORE UPDATE ON cortex_scheduling.events FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_event_participants_updated_at BEFORE UPDATE ON cortex_scheduling.event_participants FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_reminders_updated_at BEFORE UPDATE ON cortex_scheduling.reminders FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_reminder_links_updated_at BEFORE UPDATE ON cortex_scheduling.reminder_links FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_calendar_integrations_updated_at BEFORE UPDATE ON cortex_scheduling.calendar_integrations FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Scheduling triggers created (5 triggers)');

    // Knowledge Schema Triggers
    console.log('📊 Creating Knowledge schema triggers...');
    
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_notes_updated_at BEFORE UPDATE ON cortex_knowledge.notes FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_documents_updated_at BEFORE UPDATE ON cortex_knowledge.documents FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_document_types_updated_at BEFORE UPDATE ON cortex_knowledge.document_types FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_folders_updated_at BEFORE UPDATE ON cortex_knowledge.folders FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_bookmarks_updated_at BEFORE UPDATE ON cortex_knowledge.bookmarks FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_google_drive_config_updated_at BEFORE UPDATE ON cortex_knowledge.google_drive_config FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_google_drive_folders_updated_at BEFORE UPDATE ON cortex_knowledge.google_drive_folders FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Knowledge triggers created (7 triggers)');

    // Communication Schema Triggers
    console.log('📊 Creating Communication schema triggers...');
    
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_channels_updated_at BEFORE UPDATE ON cortex_communication.channels FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_conversations_updated_at BEFORE UPDATE ON cortex_communication.conversations FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_messages_unified_updated_at BEFORE UPDATE ON cortex_communication.messages_unified FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_participants_updated_at BEFORE UPDATE ON cortex_communication.participants FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_channel_entity_links_updated_at BEFORE UPDATE ON cortex_communication.channel_entity_links FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_message_templates_updated_at BEFORE UPDATE ON cortex_communication.message_templates FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_communication_events_updated_at BEFORE UPDATE ON cortex_communication.communication_events FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_automations_updated_at BEFORE UPDATE ON cortex_communication.automations FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Communication triggers created (8 triggers)');

    // Automation Schema Triggers
    console.log('📊 Creating Automation schema triggers...');
    
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_rules_updated_at BEFORE UPDATE ON cortex_automation.rules FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_workflows_updated_at BEFORE UPDATE ON cortex_automation.workflows FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_workflow_steps_updated_at BEFORE UPDATE ON cortex_automation.workflow_steps FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_templates_updated_at BEFORE UPDATE ON cortex_automation.templates FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_rule_executions_updated_at BEFORE UPDATE ON cortex_automation.rule_executions FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_rule_actions_updated_at BEFORE UPDATE ON cortex_automation.rule_actions FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_rule_conditions_updated_at BEFORE UPDATE ON cortex_automation.rule_conditions FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);
    await db.execute(sql`CREATE OR REPLACE TRIGGER trg_cortex_triggers_updated_at BEFORE UPDATE ON cortex_automation.triggers FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column()`);

    console.log('✅ Automation triggers created (8 triggers)');

    // Final success summary
    console.log('');
    console.log('🎉 CORTEX AUTO-UPDATE TRIGGERS MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('===============================================================');
    console.log('✅ Foundation Schema: 6 triggers');
    console.log('✅ Entities Schema: 4 triggers');
    console.log('✅ Projects Schema: 6 triggers');
    console.log('✅ Finance Schema: 6 triggers');
    console.log('✅ Scheduling Schema: 5 triggers');
    console.log('✅ Knowledge Schema: 7 triggers');
    console.log('✅ Communication Schema: 8 triggers');
    console.log('✅ Automation Schema: 8 triggers');
    console.log('');
    console.log('📈 Total: 50 auto-update triggers active across all Cortex schemas');
    console.log('🔧 All Cortex entities now have automatic updated_at timestamp management');
    console.log('');

  } catch (error) {
    console.error('❌ Error creating auto-update triggers:', error);
    throw error;
  }
}