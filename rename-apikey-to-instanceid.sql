-- Rename api_key column to instance_id in whatsapp.instances table

BEGIN;

-- Check if the instances table exists and perform the column rename
DO $$
BEGIN
    -- Check if the instances table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'whatsapp' AND table_name = 'instances') THEN
        
        -- Check if api_key column exists and instance_id doesn't
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'whatsapp' AND table_name = 'instances' 
                   AND column_name = 'api_key')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                          WHERE table_schema = 'whatsapp' AND table_name = 'instances' 
                          AND column_name = 'instance_id') THEN
            
            -- Rename api_key to instance_id
            ALTER TABLE whatsapp.instances RENAME COLUMN api_key TO instance_id;
            RAISE NOTICE 'Renamed api_key to instance_id in whatsapp.instances';
            
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'whatsapp' AND table_name = 'instances' 
                     AND column_name = 'instance_id') THEN
            RAISE NOTICE 'Column instance_id already exists in whatsapp.instances';
            
        ELSE
            RAISE NOTICE 'Column api_key not found in whatsapp.instances';
        END IF;
        
    ELSE
        RAISE NOTICE 'WhatsApp instances table does not exist';
    END IF;
END $$;

COMMIT;

-- Display the updated structure
SELECT 'Column rename completed successfully' as status;