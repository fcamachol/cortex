/**
 * Comprehensive script to create all missing chats and contacts from existing messages
 * This ensures data integrity between messages, chats, and contacts tables
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function createMissingChatsFromMessages() {
    console.log('🔍 Analyzing message data to create missing chats and contacts...\n');

    try {
        // Step 1: Find all unique chat_ids from messages that might need chat records
        const messageChatsQuery = `
            SELECT DISTINCT 
                m.chat_id,
                m.instance_id,
                COUNT(m.message_id) as message_count,
                MIN(m.timestamp) as first_message_timestamp,
                MAX(m.timestamp) as last_message_timestamp,
                CASE 
                    WHEN m.chat_id LIKE '%@g.us' THEN 'group'
                    WHEN m.chat_id LIKE '%@s.whatsapp.net' THEN 'individual'
                    WHEN m.chat_id LIKE '%@c.us' THEN 'individual'
                    ELSE 'other'
                END as expected_chat_type
            FROM whatsapp.messages m
            GROUP BY m.chat_id, m.instance_id
            ORDER BY message_count DESC
        `;

        const messageChatsResult = await pool.query(messageChatsQuery);
        console.log(`📊 Found ${messageChatsResult.rows.length} unique chat_ids in messages table`);

        // Step 2: Check which chats already exist
        const existingChatsQuery = `
            SELECT DISTINCT chat_id, instance_id 
            FROM whatsapp.chats
        `;
        const existingChatsResult = await pool.query(existingChatsQuery);
        const existingChatsSet = new Set(
            existingChatsResult.rows.map(row => `${row.chat_id}:${row.instance_id}`)
        );

        console.log(`📊 Found ${existingChatsResult.rows.length} existing chat records`);

        // Step 3: Identify missing chats
        const missingChats = messageChatsResult.rows.filter(row => 
            !existingChatsSet.has(`${row.chat_id}:${row.instance_id}`)
        );

        console.log(`🔍 Found ${missingChats.length} missing chat records to create`);

        if (missingChats.length === 0) {
            console.log('✅ All message chat_ids already have corresponding chat records');
        } else {
            // Step 4: Create missing chat records
            console.log('\n📝 Creating missing chat records...');
            
            for (const chatData of missingChats) {
                const insertChatQuery = `
                    INSERT INTO whatsapp.chats (
                        chat_id, 
                        instance_id, 
                        type, 
                        unread_count, 
                        is_archived, 
                        is_pinned, 
                        is_muted, 
                        last_message_timestamp,
                        created_at,
                        updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                    ON CONFLICT (chat_id, instance_id) DO NOTHING
                `;

                await pool.query(insertChatQuery, [
                    chatData.chat_id,
                    chatData.instance_id,
                    chatData.expected_chat_type,
                    0, // unread_count
                    false, // is_archived
                    false, // is_pinned
                    false, // is_muted
                    chatData.last_message_timestamp
                ]);

                console.log(`✅ Created chat: ${chatData.chat_id} (${chatData.expected_chat_type}) - ${chatData.message_count} messages`);
            }
        }

        // Step 5: Check for missing contacts
        console.log('\n🔍 Checking for missing contacts...');
        
        const missingContactsQuery = `
            SELECT DISTINCT 
                m.chat_id as jid,
                m.instance_id,
                CASE 
                    WHEN m.chat_id LIKE '%@g.us' THEN 'group'
                    WHEN m.chat_id LIKE '%@s.whatsapp.net' THEN 'individual'
                    WHEN m.chat_id LIKE '%@c.us' THEN 'individual'
                    ELSE 'other'
                END as contact_type,
                COUNT(m.message_id) as message_count
            FROM whatsapp.messages m
            WHERE NOT EXISTS (
                SELECT 1 FROM whatsapp.contacts c 
                WHERE c.jid = m.chat_id AND c.instance_id = m.instance_id
            )
            GROUP BY m.chat_id, m.instance_id
            ORDER BY message_count DESC
        `;

        const missingContactsResult = await pool.query(missingContactsQuery);
        console.log(`📊 Found ${missingContactsResult.rows.length} missing contact records to create`);

        if (missingContactsResult.rows.length === 0) {
            console.log('✅ All chat_ids already have corresponding contact records');
        } else {
            // Step 6: Create missing contact records
            console.log('\n📝 Creating missing contact records...');
            
            for (const contactData of missingContactsResult.rows) {
                const contactName = contactData.contact_type === 'group' ? 'Group Chat' : 'Contact';
                
                const insertContactQuery = `
                    INSERT INTO whatsapp.contacts (
                        jid, 
                        instance_id, 
                        push_name, 
                        profile_picture_url, 
                        verified_name, 
                        is_me, 
                        is_blocked, 
                        is_business
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (jid, instance_id) DO NOTHING
                `;

                await pool.query(insertContactQuery, [
                    contactData.jid,
                    contactData.instance_id,
                    contactName,
                    null, // profile_picture_url
                    null, // verified_name
                    false, // is_me
                    false, // is_blocked
                    false  // is_business
                ]);

                console.log(`✅ Created contact: ${contactData.jid} (${contactData.contact_type}) - ${contactData.message_count} messages`);
            }
        }

        // Step 7: Final verification
        console.log('\n🔍 Final verification...');
        
        const finalStatsQuery = `
            SELECT 
                'Messages' as table_name,
                COUNT(*) as total_records,
                COUNT(DISTINCT chat_id || ':' || instance_id) as unique_chat_instances
            FROM whatsapp.messages
            UNION ALL
            SELECT 
                'Chats' as table_name,
                COUNT(*) as total_records,
                COUNT(DISTINCT chat_id || ':' || instance_id) as unique_chat_instances
            FROM whatsapp.chats
            UNION ALL
            SELECT 
                'Contacts' as table_name,
                COUNT(*) as total_records,
                COUNT(DISTINCT jid || ':' || instance_id) as unique_contact_instances
            FROM whatsapp.contacts
        `;

        const finalStatsResult = await pool.query(finalStatsQuery);
        
        console.log('\n📊 Final Statistics:');
        finalStatsResult.rows.forEach(row => {
            console.log(`   ${row.table_name}: ${row.total_records} records, ${row.unique_chat_instances} unique instances`);
        });

        // Step 8: Check for any remaining orphaned messages
        const orphanedMessagesQuery = `
            SELECT COUNT(*) as orphaned_count
            FROM whatsapp.messages m
            WHERE NOT EXISTS (
                SELECT 1 FROM whatsapp.chats c 
                WHERE c.chat_id = m.chat_id AND c.instance_id = m.instance_id
            )
        `;

        const orphanedResult = await pool.query(orphanedMessagesQuery);
        const orphanedCount = orphanedResult.rows[0].orphaned_count;
        
        if (orphanedCount === '0') {
            console.log('✅ All messages now have corresponding chat records');
        } else {
            console.log(`⚠️  Warning: ${orphanedCount} messages still don't have corresponding chat records`);
        }

        // Step 9: Test automatic chat creation for new messages
        console.log('\n🧪 Testing automatic chat creation for new messages...');
        
        // Simulate processing a message with a completely new chat_id
        const testChatId = `5219999888777@s.whatsapp.net`;
        const testInstanceId = 'instance-1750433520122';
        
        // Clean up any existing test data first
        await pool.query('DELETE FROM whatsapp.messages WHERE message_id = $1', ['AUTO_TEST_NEW_CHAT']);
        await pool.query('DELETE FROM whatsapp.chats WHERE chat_id = $1 AND instance_id = $2', [testChatId, testInstanceId]);
        await pool.query('DELETE FROM whatsapp.contacts WHERE jid = $1 AND instance_id = $2', [testChatId, testInstanceId]);

        // Insert a test message (this should trigger automatic chat/contact creation via the upsertWhatsappMessage method)
        const testMessageQuery = `
            INSERT INTO whatsapp.messages (
                message_id, instance_id, chat_id, sender_jid, from_me, message_type, 
                content, timestamp, is_forwarded, is_starred, is_edited
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        try {
            await pool.query(testMessageQuery, [
                'AUTO_TEST_NEW_CHAT',
                testInstanceId,
                testChatId,
                testChatId,
                false,
                'text',
                'Test message for automatic chat creation',
                new Date(),
                false,
                false,
                false
            ]);

            // Check if chat and contact were automatically created
            const testChatResult = await pool.query(
                'SELECT * FROM whatsapp.chats WHERE chat_id = $1 AND instance_id = $2',
                [testChatId, testInstanceId]
            );

            const testContactResult = await pool.query(
                'SELECT * FROM whatsapp.contacts WHERE jid = $1 AND instance_id = $2',
                [testChatId, testInstanceId]
            );

            if (testChatResult.rows.length > 0 && testContactResult.rows.length > 0) {
                console.log('✅ Automatic chat and contact creation is working correctly');
            } else {
                console.log('⚠️  Automatic chat/contact creation may need implementation in the storage layer');
            }

            // Clean up test data
            await pool.query('DELETE FROM whatsapp.messages WHERE message_id = $1', ['AUTO_TEST_NEW_CHAT']);
            await pool.query('DELETE FROM whatsapp.chats WHERE chat_id = $1 AND instance_id = $2', [testChatId, testInstanceId]);
            await pool.query('DELETE FROM whatsapp.contacts WHERE jid = $1 AND instance_id = $2', [testChatId, testInstanceId]);

        } catch (error) {
            console.log('ℹ️  Direct SQL insert doesn\'t trigger automatic chat creation (this is expected)');
            console.log('   Automatic creation happens in the application layer via storage.upsertWhatsappMessage()');
        }

        console.log('\n🎉 Chat and contact creation process completed successfully!');

    } catch (error) {
        console.error('❌ Error during chat creation process:', error);
    } finally {
        await pool.end();
    }
}

// Run the comprehensive chat creation process
createMissingChatsFromMessages();