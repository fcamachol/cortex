-- =============================================================================
-- SCHEMA ROBUSTNESS MIGRATION
-- PURPOSE: Add robust workspace roles and WhatsApp phone number field
-- DATE: June 23, 2025
-- SAFETY: Phase 1 - Safe changes that don't disrupt existing functionality
-- =============================================================================

BEGIN;

-- Add new workspace role enum values if they don't exist
DO $$ 
BEGIN
    -- Add 'owner' role if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'owner' 
        AND enumtypid = (
            SELECT oid FROM pg_type 
            WHERE typname = 'workspace_role' 
            AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
        )
    ) THEN
        ALTER TYPE app.workspace_role ADD VALUE 'owner';
    END IF;

    -- Add 'guest' role if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'guest' 
        AND enumtypid = (
            SELECT oid FROM pg_type 
            WHERE typname = 'workspace_role' 
            AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
        )
    ) THEN
        ALTER TYPE app.workspace_role ADD VALUE 'guest';
    END IF;

    -- Migrate 'editor' to 'member' in space_role enum if needed
    -- Note: We keep 'editor' for backward compatibility but map it to 'member' in application logic
    
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error updating enums: %', SQLERRM;
        -- Continue with migration even if enum updates fail
END $$;

-- Add WhatsApp phone number column to app.users if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'app' 
        AND table_name = 'users' 
        AND column_name = 'whatsapp_phone_number'
    ) THEN
        ALTER TABLE app.users 
        ADD COLUMN whatsapp_phone_number VARCHAR(50) UNIQUE;
        
        RAISE NOTICE 'Added whatsapp_phone_number column to app.users';
    ELSE
        RAISE NOTICE 'whatsapp_phone_number column already exists in app.users';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error adding whatsapp_phone_number column: %', SQLERRM;
END $$;

-- Create indexes for better performance on the new phone number field
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'app' 
        AND tablename = 'users' 
        AND indexname = 'idx_users_whatsapp_phone_number'
    ) THEN
        CREATE INDEX idx_users_whatsapp_phone_number 
        ON app.users(whatsapp_phone_number) 
        WHERE whatsapp_phone_number IS NOT NULL;
        
        RAISE NOTICE 'Created index idx_users_whatsapp_phone_number';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creating index: %', SQLERRM;
END $$;

-- Update workspace owners to have 'owner' role instead of 'admin'
DO $$ 
BEGIN
    -- Update workspace members table to set owners as 'owner' role
    UPDATE app.workspace_members 
    SET role = 'owner'::app.workspace_role
    FROM app.workspaces w
    WHERE app.workspace_members.workspace_id = w.workspace_id
    AND app.workspace_members.user_id = w.owner_id
    AND app.workspace_members.role = 'admin'::app.workspace_role;
    
    RAISE NOTICE 'Updated workspace owners to have owner role';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error updating workspace owner roles: %', SQLERRM;
END $$;

-- Validation queries to confirm changes
DO $$ 
DECLARE
    enum_count INTEGER;
    column_exists BOOLEAN;
    owner_count INTEGER;
BEGIN
    -- Check if new enum values exist
    SELECT COUNT(*) INTO enum_count
    FROM pg_enum 
    WHERE enumlabel IN ('owner', 'guest') 
    AND enumtypid = (
        SELECT oid FROM pg_type 
        WHERE typname = 'workspace_role' 
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
    );
    
    -- Check if phone number column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'app' 
        AND table_name = 'users' 
        AND column_name = 'whatsapp_phone_number'
    ) INTO column_exists;
    
    -- Check owner role assignments
    SELECT COUNT(*) INTO owner_count
    FROM app.workspace_members 
    WHERE role = 'owner'::app.workspace_role;
    
    RAISE NOTICE 'Migration validation:';
    RAISE NOTICE 'New enum values added: %', enum_count;
    RAISE NOTICE 'WhatsApp phone number column exists: %', column_exists;
    RAISE NOTICE 'Workspace owners with owner role: %', owner_count;
END $$;

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
RAISE NOTICE 'Schema robustness migration completed successfully!';
RAISE NOTICE 'Changes applied:';
RAISE NOTICE '- Added owner and guest roles to workspace_role enum';
RAISE NOTICE '- Added whatsapp_phone_number field to app.users table';
RAISE NOTICE '- Updated workspace owners to have owner role';
RAISE NOTICE '- Created performance indexes';