-- Merge instance_id and instance_name columns in whatsapp.instances table
-- This script renames instance_id to instance_name to match Evolution API format

BEGIN;

-- First, ensure the whatsapp schema exists
CREATE SCHEMA IF NOT EXISTS whatsapp;

-- Check if instances table exists and perform the column merge
DO $$
BEGIN
    -- Check if the instances table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'whatsapp' AND table_name = 'instances') THEN
        
        -- Check if instance_id column exists and instance_name doesn't
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'instances' 
                   AND column_name = 'instance_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_schema = 'whatsapp' AND table_name = 'instances' 
                          AND column_name = 'instance_name') THEN
            
            -- Rename instance_id to instance_name
            ALTER TABLE whatsapp.instances RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Renamed instance_id to instance_name in whatsapp.instances';
            
        END IF;
        
        -- Update all foreign key references across all WhatsApp tables
        
        -- Update contacts table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'contacts' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.contacts RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.contacts';
        END IF;
        
        -- Update chats table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'chats' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.chats RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.chats';
        END IF;
        
        -- Update messages table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'messages' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.messages RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.messages';
        END IF;
        
        -- Update message_edit_history table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'message_edit_history' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.message_edit_history RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.message_edit_history';
        END IF;
        
        -- Update message_media table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'message_media' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.message_media RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.message_media';
        END IF;
        
        -- Update message_reactions table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'message_reactions' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.message_reactions RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.message_reactions';
        END IF;
        
        -- Update message_updates table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'message_updates' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.message_updates RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.message_updates';
        END IF;
        
        -- Update groups table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'groups' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.groups RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.groups';
        END IF;
        
        -- Update group_participants table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'group_participants' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.group_participants RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.group_participants';
        END IF;
        
        -- Update labels table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'labels' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.labels RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.labels';
        END IF;
        
        -- Update chat_labels table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'chat_labels' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.chat_labels RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.chat_labels';
        END IF;
        
        -- Update call_logs table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'call_logs' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.call_logs RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.call_logs';
        END IF;
        
        -- Update message_deletions table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'message_deletions' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.message_deletions RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.message_deletions';
        END IF;
        
        -- Update drafts table
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'drafts' 
                   AND column_name = 'instance_id') THEN
            ALTER TABLE whatsapp.drafts RENAME COLUMN instance_id TO instance_name;
            RAISE NOTICE 'Updated whatsapp.drafts';
        END IF;
        
    ELSE
        RAISE NOTICE 'WhatsApp instances table does not exist yet';
    END IF;
END $$;

COMMIT;

-- Display the updated structure
SELECT 'Column merge completed successfully' as status;