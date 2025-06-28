/**
 * Cortex Automations and Intel Schema Migration
 * Creates comprehensive automation and business intelligence capabilities
 */

import { sql } from 'drizzle-orm';
import { db } from './db';

export async function runCortexAutomationsIntelMigration() {
  console.log('🚀 Starting Cortex Automations and Intel schema migration...');

  try {
    // Create cortex_automation schema
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS cortex_automation`);
    console.log('✅ Created cortex_automation schema');

    // Create cortex_intel schema
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS cortex_intel`);
    console.log('✅ Created cortex_intel schema');

    // Create enums for automation
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE cortex_automation.trigger_type AS ENUM (
          'whatsapp_message', 'schedule', 'entity_change', 'manual', 'webhook'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE cortex_automation.operator AS ENUM (
          'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 
          'ends_with', 'matches_regex', 'greater_than', 'less_than', 'in_list'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE cortex_automation.group_operator AS ENUM ('AND', 'OR');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE cortex_automation.action_type AS ENUM (
          'create_task', 'create_note', 'send_message', 'create_reminder', 
          'update_entity', 'send_email', 'webhook_call', 'create_event'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE cortex_automation.execution_status AS ENUM (
          'success', 'failed', 'partial', 'skipped'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE cortex_automation.template_type AS ENUM (
          'message', 'task', 'note', 'email', 'document'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE cortex_automation.step_type AS ENUM (
          'action', 'condition', 'wait', 'human_approval', 'loop', 'parallel'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('✅ Created automation enums');

    // Create Automation Rules table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_automation.rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        trigger_type cortex_automation.trigger_type NOT NULL,
        priority INTEGER DEFAULT 100,
        created_by VARCHAR(50) NOT NULL,
        space_id VARCHAR(50),
        last_executed_at TIMESTAMP,
        execution_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Rule Conditions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_automation.rule_conditions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id UUID NOT NULL REFERENCES cortex_automation.rules(id) ON DELETE CASCADE,
        condition_type VARCHAR(50) NOT NULL,
        operator cortex_automation.operator NOT NULL,
        field_name VARCHAR(100),
        value TEXT,
        condition_group INTEGER DEFAULT 1,
        group_operator cortex_automation.group_operator DEFAULT 'AND',
        is_negated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Rule Actions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_automation.rule_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id UUID NOT NULL REFERENCES cortex_automation.rules(id) ON DELETE CASCADE,
        action_type cortex_automation.action_type NOT NULL,
        action_order INTEGER NOT NULL,
        target_entity_id VARCHAR(50),
        parameters JSONB NOT NULL DEFAULT '{}',
        template_id UUID,
        is_conditional BOOLEAN DEFAULT FALSE,
        condition_expression TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Rule Executions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_automation.rule_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id UUID NOT NULL REFERENCES cortex_automation.rules(id),
        trigger_data JSONB,
        execution_result JSONB,
        status cortex_automation.execution_status NOT NULL,
        error_message TEXT,
        actions_executed INTEGER DEFAULT 0,
        actions_failed INTEGER DEFAULT 0,
        execution_time_ms INTEGER,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'
      )
    `);

    // Create Templates table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_automation.templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        template_type cortex_automation.template_type NOT NULL,
        content TEXT NOT NULL,
        variables JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        category VARCHAR(100),
        created_by VARCHAR(50),
        usage_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Workflows table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_automation.workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_event VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        version INTEGER DEFAULT 1,
        created_by VARCHAR(50),
        total_executions INTEGER DEFAULT 0,
        successful_executions INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Workflow Steps table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_automation.workflow_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES cortex_automation.workflows(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        step_name VARCHAR(255),
        step_type cortex_automation.step_type NOT NULL,
        step_config JSONB NOT NULL DEFAULT '{}',
        success_step_id UUID,
        failure_step_id UUID,
        timeout_seconds INTEGER,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Triggers table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_automation.triggers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trigger_name VARCHAR(255) NOT NULL,
        trigger_type VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50),
        event_type VARCHAR(50),
        conditions JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Created automation tables');

    // Create Intel Views
    await db.execute(sql`
      CREATE OR REPLACE VIEW cortex_intel.all_entities AS
      SELECT 
          p.id, 'person' as entity_type, p.full_name as name, 
          p.primary_whatsapp_jid as primary_contact, p.created_at, p.updated_at,
          jsonb_build_object(
              'first_name', p.first_name, 'profession', p.profession,
              'whatsapp_linked', p.is_whatsapp_linked
          ) as metadata
      FROM cortex_entities.persons p WHERE p.is_active = TRUE
      UNION ALL
      SELECT 
          c.id, 'company' as entity_type, c.name,
          COALESCE(c.main_email, c.main_phone) as primary_contact, c.created_at, c.updated_at,
          jsonb_build_object(
              'business_type', c.business_type, 'industry', c.industry,
              'is_client', c.is_client, 'is_vendor', c.is_vendor
          ) as metadata
      FROM cortex_entities.companies c WHERE c.status = 'active'
      UNION ALL
      SELECT 
          pr.id, 'project' as entity_type, pr.name,
          pr.description as primary_contact, pr.created_at, pr.updated_at,
          jsonb_build_object(
              'status', pr.status, 'progress', pr.progress_percentage,
              'budget', pr.budget, 'owner_id', pr.owner_entity_id
          ) as metadata
      FROM cortex_projects.projects pr
      UNION ALL
      SELECT 
          o.id, 'object' as entity_type, o.name,
          o.location as primary_contact, o.created_at, o.updated_at,
          jsonb_build_object(
              'object_type', o.object_type, 'brand', o.brand,
              'current_value', o.current_value, 'owner_id', o.current_owner_entity_id
          ) as metadata
      FROM cortex_entities.objects o WHERE o.status = 'active'
      UNION ALL
      SELECT 
          g.id, 'group' as entity_type, g.name,
          g.description as primary_contact, g.created_at, g.updated_at,
          jsonb_build_object(
              'group_type', g.group_type, 'whatsapp_linked', g.is_whatsapp_linked
          ) as metadata
      FROM cortex_entities.groups g WHERE g.status = 'active'
      UNION ALL
      SELECT 
          a.id, 'account' as entity_type, a.name,
          a.institution_name as primary_contact, a.created_at, a.updated_at,
          jsonb_build_object(
              'account_type', a.account_type, 'balance', a.current_balance,
              'currency', a.currency
          ) as metadata
      FROM cortex_finance.accounts a WHERE a.status = 'active'
      UNION ALL
      SELECT 
          s.id, 'space' as entity_type, s.name,
          s.description as primary_contact, s.created_at, s.updated_at,
          jsonb_build_object(
              'space_type', s.space_type, 'privacy', s.privacy,
              'is_starred', s.is_starred
          ) as metadata
      FROM cortex_foundation.spaces s WHERE s.is_archived = FALSE
    `);

    await db.execute(sql`
      CREATE OR REPLACE VIEW cortex_intel.all_content AS
      SELECT 
          t.id, 'task' as content_type, t.title, t.description,
          t.created_at, t.updated_at,
          jsonb_build_object(
              'status', t.status, 'priority', t.priority,
              'assigned_to', t.assigned_to_entity_id, 'project_id', t.project_entity_id
          ) as metadata
      FROM cortex_projects.tasks t
      UNION ALL
      SELECT 
          n.id, 'note' as content_type, n.title, LEFT(n.content, 200) as description,
          n.created_at, n.updated_at,
          jsonb_build_object(
              'note_type', n.note_type, 'word_count', n.word_count,
              'is_pinned', n.is_pinned
          ) as metadata
      FROM cortex_knowledge.notes n WHERE n.is_archived = FALSE
      UNION ALL
      SELECT 
          d.id, 'document' as content_type, COALESCE(d.title, d.filename) as title, d.description,
          d.created_at, d.updated_at,
          jsonb_build_object(
              'document_type', d.document_type, 'mime_type', d.mime_type,
              'google_drive_id', d.google_drive_file_id
          ) as metadata
      FROM cortex_knowledge.documents d WHERE d.is_deleted = FALSE
      UNION ALL
      SELECT 
          e.id, 'event' as content_type, e.title, e.description,
          e.created_at, e.updated_at,
          jsonb_build_object(
              'start_time', e.start_time, 'end_time', e.end_time,
              'location', e.location, 'status', e.status
          ) as metadata
      FROM cortex_scheduling.events e
      UNION ALL
      SELECT 
          tr.id, 'transaction' as content_type, tr.description as title,
          'Amount: ' || tr.amount || ' ' || 
          COALESCE((SELECT currency FROM cortex_finance.accounts WHERE id = tr.from_account_entity_id), 'USD') as description,
          tr.created_at, tr.updated_at,
          jsonb_build_object(
              'amount', tr.amount, 'transaction_type', tr.transaction_type,
              'vendor_id', tr.vendor_entity_id
          ) as metadata
      FROM cortex_finance.transactions tr
    `);

    await db.execute(sql`
      CREATE OR REPLACE VIEW cortex_intel.all_relationships AS
      SELECT 
          er.id, er.from_entity_id,
          ae1.entity_type as from_entity_type, ae1.name as from_entity_name,
          er.to_entity_id, ae2.entity_type as to_entity_type, ae2.name as to_entity_name,
          er.content_type, er.content_id, ac.title as content_title,
          er.relationship_type, er.metadata, er.weight, er.created_at, er.is_bidirectional,
          CASE 
              WHEN er.to_entity_id IS NOT NULL THEN 'entity_to_entity'
              ELSE 'entity_to_content'
          END as link_type
      FROM cortex_foundation.entity_relationships er
      LEFT JOIN cortex_intel.all_entities ae1 ON er.from_entity_id = ae1.id
      LEFT JOIN cortex_intel.all_entities ae2 ON er.to_entity_id = ae2.id
      LEFT JOIN cortex_intel.all_content ac ON er.content_id::text = ac.id::text 
          AND er.content_type = ac.content_type
      WHERE er.is_active = TRUE
    `);

    await db.execute(sql`
      CREATE OR REPLACE VIEW cortex_intel.entity_activity AS
      WITH entity_counts AS (
        SELECT 
          from_entity_id as entity_id,
          COUNT(*) as total_relationships,
          COUNT(CASE WHEN content_type = 'task' THEN 1 END) as task_count,
          COUNT(CASE WHEN content_type = 'note' THEN 1 END) as note_count,
          COUNT(CASE WHEN content_type = 'event' THEN 1 END) as event_count,
          COUNT(CASE WHEN content_type = 'transaction' THEN 1 END) as transaction_count,
          COUNT(CASE WHEN to_entity_id IS NOT NULL THEN 1 END) as entity_relationships,
          MAX(created_at) as last_activity
        FROM cortex_foundation.entity_relationships
        WHERE is_active = TRUE
        GROUP BY from_entity_id
      )
      SELECT 
        ae.id as entity_id,
        ae.entity_type,
        ae.name as entity_name,
        ae.primary_contact,
        COALESCE(ec.total_relationships, 0) as total_relationships,
        COALESCE(ec.task_count, 0) as task_count,
        COALESCE(ec.note_count, 0) as note_count,
        COALESCE(ec.event_count, 0) as event_count,
        COALESCE(ec.transaction_count, 0) as transaction_count,
        COALESCE(ec.entity_relationships, 0) as entity_relationships,
        ec.last_activity,
        CASE 
          WHEN ec.last_activity > NOW() - INTERVAL '7 days' THEN 'high'
          WHEN ec.last_activity > NOW() - INTERVAL '30 days' THEN 'medium'
          WHEN ec.last_activity IS NOT NULL THEN 'low'
          ELSE 'none'
        END as activity_level
      FROM cortex_intel.all_entities ae
      LEFT JOIN entity_counts ec ON ae.id = ec.entity_id
    `);

    await db.execute(sql`
      CREATE OR REPLACE VIEW cortex_intel.content_network AS
      WITH content_connections AS (
        SELECT 
          er.content_id,
          er.content_type,
          COUNT(DISTINCT er.from_entity_id) as connected_entities,
          ARRAY_AGG(DISTINCT ae.entity_type) as entity_types,
          ARRAY_AGG(DISTINCT ae.name) as entity_names,
          MAX(er.created_at) as last_connection
        FROM cortex_foundation.entity_relationships er
        JOIN cortex_intel.all_entities ae ON er.from_entity_id = ae.id
        WHERE er.content_id IS NOT NULL AND er.is_active = TRUE
        GROUP BY er.content_id, er.content_type
      )
      SELECT 
        ac.id as content_id,
        ac.content_type,
        ac.title,
        ac.description,
        ac.created_at,
        ac.updated_at,
        COALESCE(cc.connected_entities, 0) as connected_entities,
        COALESCE(cc.entity_types, ARRAY[]::text[]) as connected_entity_types,
        COALESCE(cc.entity_names, ARRAY[]::text[]) as connected_entity_names,
        cc.last_connection,
        CASE 
          WHEN cc.connected_entities >= 5 THEN 'highly_connected'
          WHEN cc.connected_entities >= 2 THEN 'connected'
          WHEN cc.connected_entities = 1 THEN 'single_connection'
          ELSE 'isolated'
        END as connectivity_level
      FROM cortex_intel.all_content ac
      LEFT JOIN content_connections cc ON ac.id::text = cc.content_id::text 
        AND ac.content_type = cc.content_type
    `);

    await db.execute(sql`
      CREATE OR REPLACE VIEW cortex_intel.business_intel AS
      SELECT 
        'summary' as metric_type,
        'total_entities' as metric_name,
        COUNT(*)::text as metric_value,
        'Total entities across all types' as description,
        NOW() as calculated_at
      FROM cortex_intel.all_entities
      UNION ALL
      SELECT 
        'summary' as metric_type,
        'total_content' as metric_name,
        COUNT(*)::text as metric_value,
        'Total content items across all types' as description,
        NOW() as calculated_at
      FROM cortex_intel.all_content
      UNION ALL
      SELECT 
        'summary' as metric_type,
        'total_relationships' as metric_name,
        COUNT(*)::text as metric_value,
        'Total active relationships' as description,
        NOW() as calculated_at
      FROM cortex_intel.all_relationships
      UNION ALL
      SELECT 
        'entity_distribution' as metric_type,
        entity_type as metric_name,
        COUNT(*)::text as metric_value,
        'Count of ' || entity_type || ' entities' as description,
        NOW() as calculated_at
      FROM cortex_intel.all_entities
      GROUP BY entity_type
      UNION ALL
      SELECT 
        'content_distribution' as metric_type,
        content_type as metric_name,
        COUNT(*)::text as metric_value,
        'Count of ' || content_type || ' items' as description,
        NOW() as calculated_at
      FROM cortex_intel.all_content
      GROUP BY content_type
      UNION ALL
      SELECT 
        'activity_level' as metric_type,
        activity_level as metric_name,
        COUNT(*)::text as metric_value,
        'Entities with ' || activity_level || ' activity level' as description,
        NOW() as calculated_at
      FROM cortex_intel.entity_activity
      GROUP BY activity_level
    `);

    console.log('✅ Created intel views');

    // Create comprehensive indexing for automation tables
    console.log('🔧 Creating automation indexes...');

    // Rules indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON cortex_automation.rules(is_active) WHERE is_active = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_type ON cortex_automation.rules(trigger_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_rules_priority ON cortex_automation.rules(priority DESC) WHERE is_active = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_rules_created_by ON cortex_automation.rules(created_by)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_rules_space_id ON cortex_automation.rules(space_id) WHERE space_id IS NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_rules_last_executed ON cortex_automation.rules(last_executed_at DESC NULLS LAST)`);

    // Rule conditions indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_conditions_rule_id ON cortex_automation.rule_conditions(rule_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_conditions_type_operator ON cortex_automation.rule_conditions(condition_type, operator)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_conditions_field_value ON cortex_automation.rule_conditions(field_name, value) WHERE field_name IS NOT NULL`);

    // Rule actions indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_actions_rule_id_order ON cortex_automation.rule_actions(rule_id, action_order)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_actions_type ON cortex_automation.rule_actions(action_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_actions_target_entity ON cortex_automation.rule_actions(target_entity_id) WHERE target_entity_id IS NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_actions_template_id ON cortex_automation.rule_actions(template_id) WHERE template_id IS NOT NULL`);

    // Rule executions indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_id_executed ON cortex_automation.rule_executions(rule_id, executed_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_executions_status ON cortex_automation.rule_executions(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_executions_executed_at ON cortex_automation.rule_executions(executed_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rule_executions_performance ON cortex_automation.rule_executions(execution_time_ms DESC NULLS LAST) WHERE execution_time_ms IS NOT NULL`);

    // Templates indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_templates_active ON cortex_automation.templates(is_active) WHERE is_active = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_templates_type ON cortex_automation.templates(template_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_templates_category ON cortex_automation.templates(category) WHERE category IS NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_templates_usage ON cortex_automation.templates(usage_count DESC, last_used_at DESC NULLS LAST)`);

    // Workflows indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_workflows_active ON cortex_automation.workflows(is_active) WHERE is_active = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_workflows_trigger ON cortex_automation.workflows(trigger_event)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_workflows_performance ON cortex_automation.workflows(successful_executions DESC, total_executions DESC)`);

    // Workflow steps indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_order ON cortex_automation.workflow_steps(workflow_id, step_order)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_workflow_steps_type ON cortex_automation.workflow_steps(step_type)`);

    // Triggers indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_triggers_active ON cortex_automation.triggers(is_active) WHERE is_active = TRUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_triggers_type_entity ON cortex_automation.triggers(trigger_type, entity_type) WHERE entity_type IS NOT NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_automation_triggers_event_type ON cortex_automation.triggers(event_type) WHERE event_type IS NOT NULL`);

    console.log('✅ Created 24 automation indexes');

    // Add foreign key constraints for template references
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE cortex_automation.rule_actions 
        ADD CONSTRAINT fk_rule_actions_template 
        FOREIGN KEY (template_id) REFERENCES cortex_automation.templates(id);
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE cortex_automation.workflow_steps 
        ADD CONSTRAINT fk_workflow_steps_success 
        FOREIGN KEY (success_step_id) REFERENCES cortex_automation.workflow_steps(id);
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE cortex_automation.workflow_steps 
        ADD CONSTRAINT fk_workflow_steps_failure 
        FOREIGN KEY (failure_step_id) REFERENCES cortex_automation.workflow_steps(id);
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('✅ Added foreign key constraints');

    console.log('🎉 Cortex Automations and Intel schema migration completed successfully!');
    
    return {
      success: true,
      message: 'Cortex Automations and Intel schemas created successfully',
      automationTables: 8,
      intelViews: 6,
      indexes: 24
    };

  } catch (error) {
    console.error('❌ Error in Cortex Automations and Intel migration:', error);
    throw error;
  }
}