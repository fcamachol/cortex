-- PHASE 1: Migrate APP_USERS to APP.USERS
BEGIN;

-- Insert users from public.app_users to app.users
INSERT INTO app.users (user_id, email, password_hash, full_name, avatar_url, created_at, updated_at)
SELECT 
    id as user_id,
    email,
    COALESCE('placeholder_hash', 'temp_hash') as password_hash, -- Will need proper password handling
    display_name as full_name,
    avatar_url,
    COALESCE(created_at, NOW()) as created_at,
    COALESCE(updated_at, NOW()) as updated_at
FROM public.app_users
WHERE NOT EXISTS (
    SELECT 1 FROM app.users WHERE app.users.user_id = public.app_users.id
);

-- Create user preferences for each user
INSERT INTO app.user_preferences (user_id, theme, language, timezone, notifications, updated_at)
SELECT 
    id as user_id,
    COALESCE((preferences->>'theme')::varchar, 'light') as theme,
    COALESCE(language, 'en') as language,
    COALESCE(timezone, 'UTC') as timezone,
    COALESCE(preferences, '{}') as notifications,
    NOW() as updated_at
FROM public.app_users
WHERE NOT EXISTS (
    SELECT 1 FROM app.user_preferences WHERE app.user_preferences.user_id = public.app_users.id
);

-- Create default workspaces for users who don't have one
INSERT INTO app.workspaces (workspace_id, workspace_name, owner_id, created_at, updated_at)
SELECT 
    gen_random_uuid() as workspace_id,
    'Default Workspace' as workspace_name,
    id as owner_id,
    COALESCE(created_at, NOW()) as created_at,
    COALESCE(updated_at, NOW()) as updated_at
FROM public.app_users
WHERE NOT EXISTS (
    SELECT 1 FROM app.workspaces WHERE app.workspaces.owner_id = public.app_users.id
);

COMMIT;

-- PHASE 2: Migrate WHATSAPP_INSTANCES to WHATSAPP.INSTANCES
BEGIN;

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
    COALESCE(created_at, NOW()) as created_at,
    COALESCE(updated_at, NOW()) as updated_at
FROM public.whatsapp_instances
WHERE NOT EXISTS (
    SELECT 1 FROM whatsapp.instances WHERE whatsapp.instances.instance_id = public.whatsapp_instances.instance_name
);

COMMIT;

-- PHASE 3: Migrate WHATSAPP_CONTACTS to WHATSAPP.CONTACTS
BEGIN;

INSERT INTO whatsapp.contacts (jid, instance_id, push_name, verified_name, profile_picture_url, is_business, is_me, is_blocked, first_seen_at, last_updated_at)
SELECT DISTINCT
    wc.remote_jid as jid,
    wi.instance_name as instance_id,
    COALESCE(wc.push_name, wc.profile_name) as push_name,
    wc.display_name as verified_name,
    wc.profile_picture_url,
    COALESCE(wc.is_business, false) as is_business,
    false as is_me,
    COALESCE(wc.is_blocked, false) as is_blocked,
    COALESCE(wc.created_at, NOW()) as first_seen_at,
    COALESCE(wc.updated_at, NOW()) as last_updated_at
FROM public.whatsapp_contacts wc
JOIN public.whatsapp_instances wi ON wi.id = wc.instance_id
WHERE NOT EXISTS (
    SELECT 1 FROM whatsapp.contacts 
    WHERE whatsapp.contacts.jid = wc.remote_jid 
    AND whatsapp.contacts.instance_id = wi.instance_name
);

COMMIT;

-- PHASE 4: Migrate WHATSAPP_CONVERSATIONS to WHATSAPP.CHATS
BEGIN;

INSERT INTO whatsapp.chats (chat_id, instance_id, type, unread_count, is_archived, is_pinned, is_muted, mute_end_timestamp, last_message_timestamp, created_at, updated_at)
SELECT 
    wc.remote_jid as chat_id,
    wi.instance_name as instance_id,
    CASE 
        WHEN wc.chat_type = 'group' THEN 'group'::whatsapp.chat_type
        ELSE 'individual'::whatsapp.chat_type
    END as type,
    COALESCE(wc.unread_count, 0) as unread_count,
    COALESCE(wc.is_archived, false) as is_archived,
    COALESCE(wc.is_pinned, false) as is_pinned,
    COALESCE(wc.is_muted, false) as is_muted,
    wc.mute_until as mute_end_timestamp,
    CASE 
        WHEN wc.last_message_timestamp IS NOT NULL 
        THEN to_timestamp(wc.last_message_timestamp / 1000.0)
        ELSE NULL
    END as last_message_timestamp,
    COALESCE(wc.created_at, NOW()) as created_at,
    COALESCE(wc.updated_at, NOW()) as updated_at
FROM public.whatsapp_conversations wc
JOIN public.whatsapp_instances wi ON wi.id = wc.instance_id
WHERE NOT EXISTS (
    SELECT 1 FROM whatsapp.chats 
    WHERE whatsapp.chats.chat_id = wc.remote_jid 
    AND whatsapp.chats.instance_id = wi.instance_name
);

COMMIT;

-- PHASE 5: Migrate WHATSAPP_MESSAGES to WHATSAPP.MESSAGES
BEGIN;

INSERT INTO whatsapp.messages (message_id, instance_id, chat_id, sender_jid, from_me, message_type, content, timestamp, quoted_message_id, is_forwarded, forwarding_score, is_starred, is_edited, source_platform, raw_api_payload, created_at)
SELECT 
    wm.evolution_message_id as message_id,
    wi.instance_name as instance_id,
    wm.remote_jid as chat_id,
    CASE WHEN wm.from_me THEN wi.phone_number ELSE wm.remote_jid END as sender_jid,
    wm.from_me,
    CASE 
        WHEN wm.message_type = 'text' THEN 'text'::whatsapp.message_type
        WHEN wm.message_type = 'image' THEN 'image'::whatsapp.message_type
        WHEN wm.message_type = 'video' THEN 'video'::whatsapp.message_type
        WHEN wm.message_type = 'audio' THEN 'audio'::whatsapp.message_type
        WHEN wm.message_type = 'document' THEN 'document'::whatsapp.message_type
        ELSE 'unsupported'::whatsapp.message_type
    END as message_type,
    COALESCE(wm.text_content, wm.media_caption) as content,
    to_timestamp(wm.timestamp / 1000.0) as timestamp,
    wm.quoted_message_id,
    COALESCE(wm.is_forwarded, false) as is_forwarded,
    COALESCE(wm.forward_score, 0) as forwarding_score,
    false as is_starred,
    false as is_edited,
    'evolution-api' as source_platform,
    wm.message_content as raw_api_payload,
    COALESCE(wm.created_at, NOW()) as created_at
FROM public.whatsapp_messages wm
JOIN public.whatsapp_instances wi ON wi.id = wm.instance_id
WHERE NOT EXISTS (
    SELECT 1 FROM whatsapp.messages 
    WHERE whatsapp.messages.message_id = wm.evolution_message_id 
    AND whatsapp.messages.instance_id = wi.instance_name
);

COMMIT;

-- PHASE 6: Migrate TASKS to CRM.TASKS
BEGIN;

INSERT INTO crm.tasks (task_id, user_id, workspace_id, space_id, title, description, status, priority, due_date, completed_at, assigned_to, tags, metadata, created_at, updated_at)
SELECT 
    t.id as task_id,
    t.user_id,
    w.workspace_id,
    NULL as space_id,
    t.title,
    t.description,
    CASE 
        WHEN t.status = 'pending' THEN 'pending'::crm.task_status
        WHEN t.status = 'in_progress' THEN 'in_progress'::crm.task_status
        WHEN t.status = 'completed' THEN 'completed'::crm.task_status
        WHEN t.status = 'cancelled' THEN 'cancelled'::crm.task_status
        ELSE 'pending'::crm.task_status
    END as status,
    CASE 
        WHEN t.priority = 'low' THEN 'low'::crm.task_priority
        WHEN t.priority = 'high' THEN 'high'::crm.task_priority
        WHEN t.priority = 'urgent' THEN 'urgent'::crm.task_priority
        ELSE 'medium'::crm.task_priority
    END as priority,
    t.due_date,
    t.completed_at,
    t.assigned_to,
    t.tags,
    t.metadata,
    COALESCE(t.created_at, NOW()) as created_at,
    COALESCE(t.updated_at, NOW()) as updated_at
FROM public.tasks t
JOIN app.workspaces w ON w.owner_id = t.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM crm.tasks WHERE crm.tasks.task_id = t.id
);

COMMIT;

-- VALIDATION QUERIES
SELECT 'Migration Summary:' as info;

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
    (SELECT COUNT(DISTINCT remote_jid, instance_id) FROM public.whatsapp_contacts) as old_count;

SELECT 
    'whatsapp.chats' as table_name,
    (SELECT COUNT(*) FROM whatsapp.chats) as new_count,
    (SELECT COUNT(*) FROM public.whatsapp_conversations) as old_count;

SELECT 
    'whatsapp.messages' as table_name,
    (SELECT COUNT(*) FROM whatsapp.messages) as new_count,
    (SELECT COUNT(*) FROM public.whatsapp_messages) as old_count;

SELECT 
    'crm.tasks' as table_name,
    (SELECT COUNT(*) FROM crm.tasks) as new_count,
    (SELECT COUNT(*) FROM public.tasks) as old_count;