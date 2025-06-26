/**
 * Check group names in database to debug display issues
 */

import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function checkGroupNames() {
    console.log('🔍 Checking group names in database...');
    
    try {
        // Check groups table
        const groups = await db.execute(sql`
            SELECT group_jid, subject, instance_id 
            FROM whatsapp.groups 
            WHERE group_jid LIKE '%@g.us'
            ORDER BY group_jid
        `);
        
        console.log('📊 Groups in whatsapp.groups table:');
        groups.rows.forEach(group => {
            console.log(`  - ${group.group_jid}: "${group.subject}" (Instance: ${group.instance_id})`);
        });
        
        // Check contacts table for groups 
        const groupContacts = await db.execute(sql`
            SELECT jid, push_name, verified_name, instance_id
            FROM whatsapp.contacts 
            WHERE jid LIKE '%@g.us'
            ORDER BY jid
        `);
        
        console.log('\n📞 Group contacts in whatsapp.contacts table:');
        groupContacts.rows.forEach(contact => {
            console.log(`  - ${contact.jid}: "${contact.push_name || contact.verified_name || 'No name'}" (Instance: ${contact.instance_id})`);
        });
        
        // Check chats table for groups (remove name column that doesn't exist)
        const groupChats = await db.execute(sql`
            SELECT chat_id, instance_id
            FROM whatsapp.chats 
            WHERE chat_id LIKE '%@g.us'
            ORDER BY chat_id
        `);
        
        console.log('\n💬 Group chats in whatsapp.chats table:');
        groupChats.rows.forEach(chat => {
            console.log(`  - ${chat.chat_id} (Instance: ${chat.instance_id})`);
        });
        
        // Test the actual conversation query
        const conversations = await db.execute(sql`
            SELECT 
                c.chat_id as "chatId",
                c.instance_id as "instanceId", 
                c.type,
                CASE 
                    WHEN c.type = 'group' THEN COALESCE(g.subject, 'Group')
                    WHEN ct.push_name IS NOT NULL AND ct.push_name != '' AND ct.push_name != c.chat_id 
                        THEN ct.push_name
                    ELSE REPLACE(REPLACE(c.chat_id, '@s.whatsapp.net', ''), '@g.us', '')
                END as "displayName"
            FROM whatsapp.chats c
            LEFT JOIN whatsapp.contacts ct ON c.chat_id = ct.jid AND c.instance_id = ct.instance_id
            LEFT JOIN whatsapp.groups g ON c.chat_id = g.group_jid AND c.instance_id = g.instance_id
            WHERE c.chat_id LIKE '%@g.us'
            ORDER BY c.chat_id
        `);
        
        console.log('\n🔍 Actual conversation query results for groups:');
        conversations.rows.forEach(conv => {
            console.log(`  - ${conv.chatId}: "${conv.displayName}" (Instance: ${conv.instanceId})`);
        });
        
        // Check specific group mentioned in screenshot
        const aiGovGroup = await db.execute(sql`
            SELECT 
                c.chat_id,
                c.instance_id,
                g.subject as group_subject,
                ct.push_name as contact_push_name
            FROM whatsapp.chats c
            LEFT JOIN whatsapp.groups g ON c.chat_id = g.group_jid AND c.instance_id = g.instance_id
            LEFT JOIN whatsapp.contacts ct ON c.chat_id = ct.jid AND c.instance_id = ct.instance_id
            WHERE c.chat_id LIKE '%@g.us'
            AND (g.subject ILIKE '%ai%gov%' OR ct.push_name ILIKE '%ai%gov%')
        `);
        
        console.log('\n🎯 Looking for "Ai Gov" group specifically:');
        if (aiGovGroup.rows.length > 0) {
            aiGovGroup.rows.forEach(group => {
                console.log(`  - Chat ID: ${group.chat_id}`);
                console.log(`  - Instance: ${group.instance_id}`);
                console.log(`  - Chat name: ${group.chat_name || 'None'}`);
                console.log(`  - Group subject: ${group.group_subject || 'None'}`);
                console.log(`  - Contact push name: ${group.contact_push_name || 'None'}`);
            });
        } else {
            console.log('  - No "Ai Gov" group found in database');
        }
        
    } catch (error) {
        console.error('❌ Error checking group names:', error);
    }
}

checkGroupNames();