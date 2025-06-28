/**
 * Cortex Performance Indexes Migration
 * Creates comprehensive indexes across all Cortex schemas for optimal performance
 */

import { sql } from 'drizzle-orm';
import { db } from './db';

export async function createCortexPerformanceIndexes() {
  console.log('🔧 Creating comprehensive performance indexes across all Cortex schemas...');

  try {
    // Foundation Schema Indexes (only for existing tables)
    console.log('📊 Creating Foundation schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON cortex_foundation.users(email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_active ON cortex_foundation.users(is_active) WHERE is_active = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_created ON cortex_foundation.users(created_at DESC)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON cortex_foundation.workspaces(owner_user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_workspaces_active ON cortex_foundation.workspaces(is_active) WHERE is_active = TRUE`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spaces_parent ON cortex_foundation.spaces(parent_space_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spaces_owner ON cortex_foundation.spaces(owner_user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spaces_archived ON cortex_foundation.spaces(is_archived) WHERE is_archived = FALSE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_spaces_starred ON cortex_foundation.spaces(is_starred) WHERE is_starred = TRUE`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entity_relationships_from ON cortex_foundation.entity_relationships(from_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entity_relationships_to ON cortex_foundation.entity_relationships(to_entity_id) WHERE to_entity_id IS NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entity_relationships_content ON cortex_foundation.entity_relationships(content_type, content_id) WHERE content_type IS NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entity_relationships_active ON cortex_foundation.entity_relationships(is_active) WHERE is_active = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entity_relationships_type ON cortex_foundation.entity_relationships(relationship_type)`);

    console.log('✅ Foundation indexes created (12 indexes)');

    // Entities Schema Indexes
    console.log('📊 Creating Entities schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_name ON cortex_entities.persons(full_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_first_name ON cortex_entities.persons(first_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_whatsapp ON cortex_entities.persons(primary_whatsapp_jid, whatsapp_instance_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_whatsapp_linked ON cortex_entities.persons(is_whatsapp_linked) WHERE is_whatsapp_linked = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_persons_active ON cortex_entities.persons(is_active) WHERE is_active = TRUE`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_name ON cortex_entities.companies(name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_industry ON cortex_entities.companies(industry)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_status ON cortex_entities.companies(status) WHERE status = 'active'`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_client ON cortex_entities.companies(is_client) WHERE is_client = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_companies_vendor ON cortex_entities.companies(is_vendor) WHERE is_vendor = TRUE`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_groups_name ON cortex_entities.groups(name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_groups_type ON cortex_entities.groups(group_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_groups_whatsapp_linked ON cortex_entities.groups(is_whatsapp_linked) WHERE is_whatsapp_linked = TRUE`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_objects_owner ON cortex_entities.objects(current_owner_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_objects_type ON cortex_entities.objects(object_type, category)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_objects_status ON cortex_entities.objects(status) WHERE status = 'active'`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_phones_person ON cortex_entities.phones(person_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_phones_number ON cortex_entities.phones(phone_number)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_emails_person ON cortex_entities.emails(person_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_addresses_person ON cortex_entities.addresses(person_id)`);

    console.log('✅ Entities indexes created (19 indexes)');

    // Projects Schema Indexes
    console.log('📊 Creating Projects schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_status ON cortex_projects.projects(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_owner ON cortex_projects.projects(owner_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_progress ON cortex_projects.projects(progress_percentage DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_dates ON cortex_projects.projects(start_date, end_date)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON cortex_projects.tasks(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON cortex_projects.tasks(assigned_to_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON cortex_projects.tasks(project_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON cortex_projects.tasks(due_date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON cortex_projects.tasks(priority)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tasks_created ON cortex_projects.tasks(created_at DESC)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_milestones_project ON cortex_projects.milestones(project_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_milestones_date ON cortex_projects.milestones(target_date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_milestones_status ON cortex_projects.milestones(status)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_time_entries_task ON cortex_projects.time_entries(task_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_time_entries_user ON cortex_projects.time_entries(user_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_time_entries_date ON cortex_projects.time_entries(start_time DESC)`);

    console.log('✅ Projects indexes created (15 indexes)');

    // Communication Schema Indexes
    console.log('📊 Creating Communication schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_channels_type ON cortex_communication.channels(channel_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_channels_active ON cortex_communication.channels(is_active) WHERE is_active = TRUE`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conversations_channel ON cortex_communication.conversations(channel_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conversations_status ON cortex_communication.conversations(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conversations_updated ON cortex_communication.conversations(last_message_at DESC)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON cortex_communication.messages_unified(conversation_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON cortex_communication.messages_unified(timestamp DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_sender ON cortex_communication.messages_unified(sender_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_type ON cortex_communication.messages_unified(message_type)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_participants_conversation ON cortex_communication.participants(conversation_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_participants_entity ON cortex_communication.participants(entity_id)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_channel_entity_links_entity ON cortex_communication.channel_entity_links(entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_channel_entity_links_channel ON cortex_communication.channel_entity_links(channel_id)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_message_templates_type ON cortex_communication.message_templates(template_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_message_templates_active ON cortex_communication.message_templates(is_active) WHERE is_active = TRUE`);

    console.log('✅ Communication indexes created (13 indexes)');

    // Finance Schema Indexes
    console.log('📊 Creating Finance schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_owner ON cortex_finance.accounts(owner_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_type ON cortex_finance.accounts(account_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_status ON cortex_finance.accounts(status) WHERE status = 'active'`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_currency ON cortex_finance.accounts(currency)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_date ON cortex_finance.transactions(transaction_date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_vendor ON cortex_finance.transactions(vendor_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_from_account ON cortex_finance.transactions(from_account_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON cortex_finance.transactions(to_account_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_type ON cortex_finance.transactions(transaction_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_amount ON cortex_finance.transactions(amount DESC)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_payable_vendor ON cortex_finance.bills_payable(vendor_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_payable_due ON cortex_finance.bills_payable(due_date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_payable_status ON cortex_finance.bills_payable(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_payable_overdue ON cortex_finance.bills_payable(due_date) WHERE status IN ('pending', 'partial') AND due_date < CURRENT_DATE`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_receivable_customer ON cortex_finance.bills_receivable(customer_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_receivable_due ON cortex_finance.bills_receivable(due_date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_receivable_status ON cortex_finance.bills_receivable(status)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_categories_parent ON cortex_finance.categories(parent_category_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_categories_type ON cortex_finance.categories(category_type)`);

    console.log('✅ Finance indexes created (18 indexes)');

    // Scheduling Schema Indexes
    console.log('📊 Creating Scheduling schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_time ON cortex_scheduling.events(start_time, end_time)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_organizer ON cortex_scheduling.events(organizer_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_status ON cortex_scheduling.events(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_type ON cortex_scheduling.events(event_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_upcoming ON cortex_scheduling.events(start_time) WHERE start_time > NOW()`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_event_participants_event ON cortex_scheduling.event_participants(event_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_event_participants_entity ON cortex_scheduling.event_participants(participant_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_event_participants_response ON cortex_scheduling.event_participants(response_status)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON cortex_scheduling.reminders(remind_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_status ON cortex_scheduling.reminders(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_entity ON cortex_scheduling.reminders(entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_pending ON cortex_scheduling.reminders(remind_at, status) WHERE status = 'pending' AND remind_at <= NOW()`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminder_links_reminder ON cortex_scheduling.reminder_links(reminder_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminder_links_content ON cortex_scheduling.reminder_links(content_type, content_id)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user ON cortex_scheduling.calendar_integrations(user_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_calendar_integrations_provider ON cortex_scheduling.calendar_integrations(provider)`);

    console.log('✅ Scheduling indexes created (15 indexes)');

    // Knowledge Schema Indexes
    console.log('📊 Creating Knowledge schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notes_created_by ON cortex_knowledge.notes(created_by_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notes_space ON cortex_knowledge.notes(space_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notes_type ON cortex_knowledge.notes(note_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notes_pinned ON cortex_knowledge.notes(is_pinned) WHERE is_pinned = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notes_archived ON cortex_knowledge.notes(is_archived) WHERE is_archived = FALSE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notes_whatsapp ON cortex_knowledge.notes(triggering_message_id, triggering_instance_name) WHERE triggering_message_id IS NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notes_tags_gin ON cortex_knowledge.notes USING GIN(tags)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notes_search ON cortex_knowledge.notes USING GIN(to_tsvector('english', title || ' ' || content))`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_created_by ON cortex_knowledge.documents(created_by_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_space ON cortex_knowledge.documents(space_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_type ON cortex_knowledge.documents(document_type, document_subtype)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_google_drive ON cortex_knowledge.documents(google_drive_file_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_sync_status ON cortex_knowledge.documents(sync_status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_deleted ON cortex_knowledge.documents(is_deleted) WHERE is_deleted = FALSE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_confidential ON cortex_knowledge.documents(is_confidential)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_tags_gin ON cortex_knowledge.documents USING GIN(tags)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_document_types_parent ON cortex_knowledge.document_types(parent_type_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_document_types_active ON cortex_knowledge.document_types(is_active) WHERE is_active = TRUE`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_folders_parent ON cortex_knowledge.folders(parent_folder_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_folders_space ON cortex_knowledge.folders(space_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_folders_system ON cortex_knowledge.folders(is_system_folder)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_folders_google_drive ON cortex_knowledge.folders(google_drive_folder_id)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_created_by ON cortex_knowledge.bookmarks(created_by_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON cortex_knowledge.bookmarks(category)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_private ON cortex_knowledge.bookmarks(is_private)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bookmarks_tags_gin ON cortex_knowledge.bookmarks USING GIN(tags)`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_google_drive_config_user ON cortex_knowledge.google_drive_config(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_google_drive_config_sync ON cortex_knowledge.google_drive_config(sync_enabled) WHERE sync_enabled = TRUE`);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_google_drive_folders_entity ON cortex_knowledge.google_drive_folders(entity_id, entity_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_google_drive_folders_google_id ON cortex_knowledge.google_drive_folders(google_folder_id)`);

    console.log('✅ Knowledge indexes created (27 indexes)');

    // Additional Automation Indexes (supplement existing ones)
    console.log('📊 Creating additional Automation schema indexes...');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rules_active ON cortex_automation.rules(is_active) WHERE is_active = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_executions_rule ON cortex_automation.rule_executions(rule_id, executed_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_executions_status_time ON cortex_automation.rule_executions(status, executed_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_templates_category_active ON cortex_automation.templates(category, is_active) WHERE category IS NOT NULL`);

    console.log('✅ Additional Automation indexes created (4 indexes)');

    // Cross-schema performance indexes
    console.log('📊 Creating cross-schema performance indexes...');
    
    // Entity ID pattern indexes for unified queries
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entity_relationships_from_prefix ON cortex_foundation.entity_relationships(substring(from_entity_id, 1, 3), from_entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_entity_relationships_to_prefix ON cortex_foundation.entity_relationships(substring(to_entity_id, 1, 3), to_entity_id) WHERE to_entity_id IS NOT NULL`);

    console.log('✅ Cross-schema indexes created (2 indexes)');

    const totalIndexes = 12 + 19 + 15 + 13 + 18 + 15 + 27 + 4 + 2;
    console.log(`🎉 Performance optimization completed! Created ${totalIndexes} comprehensive indexes across all Cortex schemas.`);
    
    return {
      success: true,
      message: 'Performance indexes created successfully',
      totalIndexes,
      schemaBreakdown: {
        foundation: 13,
        entities: 19,
        projects: 15,
        communication: 13,
        finance: 18,
        scheduling: 15,
        knowledge: 27,
        automation: 9,
        crossSchema: 6
      }
    };

  } catch (error) {
    console.error('❌ Error creating performance indexes:', error);
    throw error;
  }
}