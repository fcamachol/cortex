// Debug script to test direct database access
import pg from 'pg';

const { Client } = pg;

async function debugGroups() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    
    try {
        await client.connect();
        console.log('Database connected successfully');
        
        // Test direct query
        const result = await client.query(`
            SELECT g.group_jid, g.instance_id, g.subject, g.description, g.is_locked, g.creation_timestamp,
                   COUNT(p.participant_jid) as participant_count
            FROM whatsapp.groups g
            LEFT JOIN whatsapp.group_participants p ON g.group_jid = p.group_jid AND g.instance_id = p.instance_id
            GROUP BY g.group_jid, g.instance_id, g.subject, g.description, g.is_locked, g.creation_timestamp
            ORDER BY g.subject
            LIMIT 5
        `);
        
        console.log(`Found ${result.rows.length} groups:`);
        result.rows.forEach(row => {
            console.log(`- ${row.subject} (${row.group_jid}) - ${row.participant_count} participants`);
        });
        
    } catch (error) {
        console.error('Database error:', error);
    } finally {
        await client.end();
    }
}

debugGroups();