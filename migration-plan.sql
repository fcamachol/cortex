-- MIGRATION PLAN: Public Schema to Schema-Organized Tables
-- This file contains the complete migration strategy (DO NOT EXECUTE YET)

-- =====================================================
-- PHASE 1: APP SCHEMA MIGRATIONS
-- =====================================================

-- 1.1 Migrate app_users to app.users
INSERT INTO app.users (user_id, email, full_name, avatar_url, created_at, updated_at)
SELECT 
    id as user_id,
    email,
    display_name as full_name,
    avatar_url,
    COALESCE(created_at, NOW()) as created_at,
    COALESCE(updated_at, NOW()) as updated_at
FROM public.app_users;

-- 1.2 Create user_preferences for migrated users
INSERT INTO app.user_preferences (user_id, theme, language, timezone, notifications, updated_at)
SELECT 
    id as user_id,
    COALESCE(preferences->>'theme', 'light') as theme,
    COALESCE(language, 'en') as language,
    COALESCE(timezone, 'UTC') as timezone,
    COALESCE(preferences, '{}') as notifications,
    NOW() as updated_at
FROM public.app_users;

-- 1.3 Migrate spaces to app.spaces (if they exist in public schema)
INSERT INTO app.spaces (space_id, workspace_id, space_name, icon, color, display_order, created_at, updated_at, creator_user_id)
SELECT 
    space_id,
    workspace_id,
    name as space_name,
    icon,
    color,
    display_order,
    created_at,
    updated_at,
    creator_user_id
FROM public.spaces;

-- 1.4 Migrate workspace data
INSERT INTO app.workspaces (workspace_id, workspace_name, owner_id, created_at, updated_at)
SELECT DISTINCT
    COALESCE(workspace_id, gen_random_uuid()),
    'Default Workspace',
    id,
    created_at,
    updated_at
FROM public.app_users
WHERE NOT EXISTS (SELECT 1 FROM app.workspaces);

-- =====================================================
-- PHASE 2: WHATSAPP SCHEMA MIGRATIONS  
-- =====================================================

-- 2.1 Migrate whatsapp_instances to whatsapp.instances
INSERT INTO whatsapp.instances (instance_id, client_id, display_name, owner_jid, api_key, webhook_url, is_connected, last_connection_at, created_at, updated_at)
SELECT 
    instance_name as instance_id,
    user_id as client_id,
    display_name,
    phone_number as owner_jid,
    instance_api_key as api_key,
    webhook_url,
    CASE WHEN status = 'connected' THEN true ELSE false END as is_connected,
    last_connected_at,
    created_at,
    updated_at
FROM public.whatsapp_instances;

-- 2.2 Migrate whatsapp_contacts to whatsapp.contacts
INSERT INTO whatsapp.contacts (jid, instance_id, push_name, verified_name, profile_picture_url, is_business, is_me, is_blocked, first_seen_at, last_updated_at)
SELECT DISTINCT
    remote_jid as jid,
    (SELECT instance_name FROM public.whatsapp_instances wi WHERE wi.id = wc.instance_id) as instance_id,
    COALESCE(push_name, profile_name) as push_name,
    display_name as verified_name,
    profile_picture_url,
    COALESCE(is_business, false) as is_business,
    false as is_me,
    COALESCE(is_blocked, false) as is_blocked,
    COALESCE(created_at, NOW()) as first_seen_at,
    COALESCE(updated_at, NOW()) as last_updated_at
FROM public.whatsapp_contacts wc;

-- 2.3 Migrate whatsapp_conversations to whatsapp.chats
INSERT INTO whatsapp.chats (chat_id, instance_id, type, unread_count, is_archived, is_pinned, is_muted, mute_end_timestamp, last_message_timestamp, created_at, updated_at)
SELECT 
    remote_jid as chat_id,
    (SELECT instance_name FROM public.whatsapp_instances wi WHERE wi.id = wc.instance_id) as instance_id,
    CASE 
        WHEN chat_type = 'group' THEN 'group'::whatsapp.chat_type
        ELSE 'individual'::whatsapp.chat_type
    END as type,
    COALESCE(unread_count, 0) as unread_count,
    COALESCE(is_archived, false) as is_archived,
    COALESCE(is_pinned, false) as is_pinned,
    COALESCE(is_muted, false) as is_muted,
    mute_until as mute_end_timestamp,
    CASE 
        WHEN last_message_timestamp IS NOT NULL 
        THEN to_timestamp(last_message_timestamp / 1000)
        ELSE NULL
    END as last_message_timestamp,
    created_at,
    updated_at
FROM public.whatsapp_conversations wc;

-- 2.4 Migrate whatsapp_messages to whatsapp.messages
INSERT INTO whatsapp.messages (message_id, instance_id, chat_id, sender_jid, from_me, message_type, content, timestamp, quoted_message_id, is_forwarded, forwardin_score, is_starred, is_edited, source_platform, raw_api_payload, created_at)
SELECT 
    evolution_message_id as message_id,
    (SELECT instance_name FROM public.whatsapp_instances wi WHERE wi.id = wm.instance_id) as instance_id,
    remote_jid as chat_id,
    CASE WHEN from_me THEN 'me' ELSE remote_jid END as sender_jid,
    from_me,
    CASE 
        WHEN message_type = 'text' THEN 'text'::whatsapp.message_type
        WHEN message_type = 'image' THEN 'image'::whatsapp.message_type
        WHEN message_type = 'video' THEN 'video'::whatsapp.message_type
        WHEN message_type = 'audio' THEN 'audio'::whatsapp.message_type
        WHEN message_type = 'document' THEN 'document'::whatsapp.message_type
        ELSE 'unsupported'::whatsapp.message_type
    END as message_type,
    COALESCE(text_content, media_caption) as content,
    to_timestamp(timestamp / 1000) as timestamp,
    quoted_message_id,
    COALESCE(is_forwarded, false) as is_forwarded,
    COALESCE(forward_score, 0) as forwarding_score,
    false as is_starred,
    false as is_edited,
    'evolution-api' as source_platform,
    message_content as raw_api_payload,
    created_at
FROM public.whatsapp_messages wm;

-- =====================================================
-- PHASE 3: ACTIONS SCHEMA MIGRATIONS
-- =====================================================

-- 3.1 Action rules are already in actions schema, but verify structure
-- INSERT INTO actions.action_rules (rule_id, user_id, workspace_id, space_id, rule_name, description, is_active, trigger_type, trigger_conditions, action_type, action_config, instance_filters, contact_filters, time_filters, cooldown_minutes, max_executions_per_day, total_executions, last_executed_at, created_at, updated_at, performer_filters)
-- SELECT * FROM public.action_rules; -- Only if they exist in public

-- 3.2 Action executions migration
-- INSERT INTO actions.action_executions (execution_id, rule_id, triggered_by, trigger_data, status, result, error_message, executed_at, processing_time_ms)
-- SELECT * FROM public.action_executions; -- Only if they exist in public

-- 3.3 Action templates migration  
-- INSERT INTO actions.action_templates (template_id, template_name, description, category, trigger_type, action_type, default_config, is_public, usage_count, rating, created_at, updated_at)
-- SELECT * FROM public.action_templates; -- Only if they exist in public

-- =====================================================
-- PHASE 4: CRM SCHEMA MIGRATIONS
-- =====================================================

-- 4.1 Migrate tasks to CRM schema
INSERT INTO crm.tasks (task_id, user_id, workspace_id, space_id, title, description, status, priority, due_date, completed_at, assigned_to, tags, metadata, created_at, updated_at)
SELECT 
    id as task_id,
    user_id,
    NULL as workspace_id, -- Will need to be populated based on user's default workspace
    NULL as space_id,
    title,
    description,
    COALESCE(status, 'pending') as status,
    COALESCE(priority, 'medium') as priority,
    due_date,
    completed_at,
    assigned_to,
    tags,
    metadata,
    created_at,
    updated_at
FROM public.tasks;

-- =====================================================
-- PHASE 5: DATA VALIDATION QUERIES
-- =====================================================

-- Validate migration counts
SELECT 
    'app.users' as table_name, 
    (SELECT COUNT(*) FROM app.users) as new_count,
    (SELECT COUNT(*) FROM public.app_users) as old_count;

SELECT 
    'whatsapp.instances' as table_name,
    (SELECT COUNT(*) FROM whatsapp.instances) as new_count,
    (SELECT COUNT(*) FROM public.whatsapp_instances) as old_count;

SELECT 
    'whatsapp.contacts' as table_name,
    (SELECT COUNT(*) FROM whatsapp.contacts) as new_count,
    (SELECT COUNT(*) FROM public.whatsapp_contacts) as old_count;

SELECT 
    'whatsapp.chats' as table_name,
    (SELECT COUNT(*) FROM whatsapp.chats) as new_count,
    (SELECT COUNT(*) FROM public.whatsapp_conversations) as old_count;

SELECT 
    'whatsapp.messages' as table_name,
    (SELECT COUNT(*) FROM whatsapp.messages) as new_count,
    (SELECT COUNT(*) FROM public.whatsapp_messages) as old_count;

-- =====================================================
-- PHASE 6: CLEANUP (ONLY AFTER VALIDATION)
-- =====================================================

-- Drop public schema tables (EXECUTE ONLY AFTER FULL VALIDATION)
-- DROP TABLE IF EXISTS public.app_users CASCADE;
-- DROP TABLE IF EXISTS public.whatsapp_instances CASCADE;
-- DROP TABLE IF EXISTS public.whatsapp_contacts CASCADE;
-- DROP TABLE IF EXISTS public.whatsapp_conversations CASCADE;
-- DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
-- DROP TABLE IF EXISTS public.tasks CASCADE;
-- DROP TABLE IF EXISTS public.spaces CASCADE;
-- And other public tables...

-- =====================================================
-- NOTES FOR IMPLEMENTATION:
-- =====================================================
-- 1. Execute phases sequentially, not all at once
-- 2. Validate each phase before proceeding to next
-- 3. Handle enum type conversions carefully
-- 4. Ensure foreign key relationships are maintained
-- 5. Update application code to use schema-prefixed tables
-- 6. Test application functionality after each phase
-- 7. Keep backups of original data until migration is fully validated