/**
 * Update contact names from message pushName data
 * This fixes contacts that have empty push_name values
 */

import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function updateContactNames() {
    console.log('🔄 Updating contact names from message data...');
    
    try {
        // Find contacts with empty names that have messages with pushName data
        const contactsToUpdate = await db.execute(sql`
            SELECT DISTINCT
                m.sender_jid,
                m.instance_id,
                m.raw_api_payload->>'pushName' as push_name_from_message,
                ct.push_name as current_push_name
            FROM whatsapp.messages m
            LEFT JOIN whatsapp.contacts ct ON m.sender_jid = ct.jid AND m.instance_id = ct.instance_id
            WHERE m.raw_api_payload->>'pushName' IS NOT NULL
            AND m.raw_api_payload->>'pushName' != ''
            AND m.raw_api_payload->>'pushName' != m.sender_jid
            AND (ct.push_name IS NULL OR ct.push_name = '' OR ct.push_name = m.sender_jid)
            AND m.sender_jid LIKE '%@s.whatsapp.net'
            ORDER BY m.sender_jid
        `);

        console.log(`📋 Found ${contactsToUpdate.rows.length} contacts to update`);

        let updatedCount = 0;

        for (const contact of contactsToUpdate.rows) {
            try {
                // Update the contact with the pushName from messages
                await db.execute(sql`
                    UPDATE whatsapp.contacts 
                    SET push_name = ${contact.push_name_from_message},
                        last_updated_at = NOW()
                    WHERE jid = ${contact.sender_jid} 
                    AND instance_id = ${contact.instance_id}
                `);

                console.log(`✅ Updated ${contact.sender_jid}: "${contact.push_name_from_message}"`);
                updatedCount++;

            } catch (error) {
                console.error(`❌ Failed to update ${contact.sender_jid}:`, error);
            }
        }

        console.log(`🎉 Successfully updated ${updatedCount} contact names`);

        // Verify the updates
        const verificationResults = await db.execute(sql`
            SELECT 
                COUNT(*) as total_contacts,
                COUNT(CASE WHEN push_name IS NOT NULL AND push_name != '' AND push_name != jid THEN 1 END) as contacts_with_names,
                COUNT(CASE WHEN push_name IS NULL OR push_name = '' OR push_name = jid THEN 1 END) as contacts_without_names
            FROM whatsapp.contacts 
            WHERE jid LIKE '%@s.whatsapp.net'
        `);

        const stats = verificationResults.rows[0];
        console.log(`📊 Contact name statistics:`);
        console.log(`   Total individual contacts: ${stats.total_contacts}`);
        console.log(`   Contacts with names: ${stats.contacts_with_names}`);
        console.log(`   Contacts without names: ${stats.contacts_without_names}`);

    } catch (error) {
        console.error('❌ Error updating contact names:', error);
    }
}

updateContactNames().then(() => {
    console.log('✨ Contact name update complete');
    process.exit(0);
}).catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
});