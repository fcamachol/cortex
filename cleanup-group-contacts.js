/**
 * Direct SQL-based cleanup script to fix incorrect group contact data
 * This preserves authentic group JIDs while fixing contact names
 */

import pkg from 'pg';
const { Client } = pkg;

async function cleanupGroupContacts() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('🧹 Starting cleanup of group contact data...');

        // Step 1: Sync group contact names with authentic group subjects
        const syncResult = await client.query(`
            UPDATE whatsapp.contacts 
            SET push_name = groups.subject,
                last_updated_at = NOW()
            FROM whatsapp.groups 
            WHERE contacts.jid = groups.group_jid 
            AND contacts.instance_id = groups.instance_id
            AND contacts.instance_id = 'instance-1750433520122'
            AND groups.subject IS NOT NULL 
            AND groups.subject != ''
            AND groups.subject != 'Group'
            AND groups.subject != 'New Group'
            AND (contacts.push_name IS NULL 
                 OR contacts.push_name != groups.subject 
                 OR contacts.push_name = 'Group'
                 OR contacts.push_name = 'New Group'
                 OR contacts.push_name = 'Inactive Group'
                 OR LENGTH(contacts.push_name) < 3)
        `);

        console.log(`✅ Updated ${syncResult.rowCount} group contact names with authentic subjects`);

        // Step 2: Mark contacts for groups that don't exist in groups table
        const markUnknownResult = await client.query(`
            UPDATE whatsapp.contacts 
            SET push_name = 'Unknown Group',
                last_updated_at = NOW()
            WHERE jid LIKE '%@g.us' 
            AND instance_id = 'instance-1750433520122'
            AND jid NOT IN (
                SELECT group_jid 
                FROM whatsapp.groups 
                WHERE instance_id = 'instance-1750433520122'
            )
            AND (push_name IS NULL 
                 OR push_name != 'Unknown Group'
                 OR LENGTH(push_name) < 3)
        `);

        console.log(`⚠️ Marked ${markUnknownResult.rowCount} contacts as 'Unknown Group'`);

        // Step 3: Show summary of cleaned data
        const summaryResult = await client.query(`
            SELECT 
                COUNT(*) as total_group_contacts,
                COUNT(CASE WHEN push_name IS NOT NULL AND LENGTH(push_name) > 2 THEN 1 END) as contacts_with_names,
                COUNT(CASE WHEN push_name = 'Unknown Group' THEN 1 END) as unknown_groups
            FROM whatsapp.contacts 
            WHERE jid LIKE '%@g.us' 
            AND instance_id = 'instance-1750433520122'
        `);

        const summary = summaryResult.rows[0];
        console.log('\n📊 Cleanup Summary:');
        console.log(`   Total group contacts: ${summary.total_group_contacts}`);
        console.log(`   Contacts with names: ${summary.contacts_with_names}`);
        console.log(`   Unknown groups: ${summary.unknown_groups}`);

        // Step 4: Show sample of cleaned records
        const sampleResult = await client.query(`
            SELECT jid, push_name 
            FROM whatsapp.contacts 
            WHERE jid LIKE '%@g.us' 
            AND instance_id = 'instance-1750433520122'
            AND push_name IS NOT NULL
            ORDER BY last_updated_at DESC
            LIMIT 10
        `);

        console.log('\n📋 Sample of cleaned group contacts:');
        sampleResult.rows.forEach(row => {
            console.log(`   ${row.jid} -> "${row.push_name}"`);
        });

        const totalCleaned = syncResult.rowCount + markUnknownResult.rowCount;
        console.log(`\n✅ Cleanup completed successfully! Fixed ${totalCleaned} contact records.`);

        return {
            success: true,
            cleaned: totalCleaned,
            summary: summary
        };

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await client.end();
    }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
    cleanupGroupContacts()
        .then(result => {
            if (result.success) {
                console.log(`\n🎉 Cleanup successful! ${result.cleaned} records fixed.`);
                process.exit(0);
            } else {
                console.error(`\n💥 Cleanup failed: ${result.error}`);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Script error:', error);
            process.exit(1);
        });
}

module.exports = { cleanupGroupContacts };