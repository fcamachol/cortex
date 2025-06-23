/**
 * Clean up invalid JID formats from the contacts database
 * Keep only proper WhatsApp JID formats:
 * - Groups: 120363402262963541@g.us  
 * - Individuals: 15103165094@s.whatsapp.net
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function cleanupInvalidJids() {
  console.log('🧹 Cleaning up invalid JID formats from contacts database...');
  
  try {
    // First, let's see what we have
    const countQuery = `
      SELECT 
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN id LIKE '%@s.whatsapp.net' OR id LIKE '%@g.us' THEN 1 END) as valid_jids,
        COUNT(CASE WHEN id NOT LIKE '%@s.whatsapp.net' AND id NOT LIKE '%@g.us' THEN 1 END) as invalid_jids
      FROM whatsapp_contacts;
    `;
    
    const countResult = await pool.query(countQuery);
    const stats = countResult.rows[0];
    
    console.log(`📊 Current database state:`);
    console.log(`   Total contacts: ${stats.total_contacts}`);
    console.log(`   Valid JIDs: ${stats.valid_jids}`);
    console.log(`   Invalid JIDs: ${stats.invalid_jids}`);
    
    if (stats.invalid_jids === '0') {
      console.log('✅ No invalid JIDs found - database is already clean!');
      return;
    }
    
    // Show some examples of invalid JIDs
    const examplesQuery = `
      SELECT id, name, instance_id 
      FROM whatsapp_contacts 
      WHERE id NOT LIKE '%@s.whatsapp.net' AND id NOT LIKE '%@g.us'
      LIMIT 10;
    `;
    
    const examplesResult = await pool.query(examplesQuery);
    console.log(`\n🔍 Examples of invalid JIDs to be removed:`);
    examplesResult.rows.forEach(row => {
      console.log(`   - ${row.id} (${row.name || 'No name'}) [${row.instance_id}]`);
    });
    
    // Delete contacts with invalid JID formats
    const deleteQuery = `
      DELETE FROM whatsapp_contacts 
      WHERE id NOT LIKE '%@s.whatsapp.net' AND id NOT LIKE '%@g.us';
    `;
    
    console.log(`\n🗑️ Removing invalid JID contacts...`);
    const deleteResult = await pool.query(deleteQuery);
    console.log(`✅ Removed ${deleteResult.rowCount} contacts with invalid JIDs`);
    
    // Also clean up related data if needed
    console.log(`\n🧹 Cleaning up related tables...`);
    
    // Clean invalid JIDs from messages
    const cleanMessagesQuery = `
      DELETE FROM whatsapp_messages 
      WHERE (sender_jid NOT LIKE '%@s.whatsapp.net' AND sender_jid NOT LIKE '%@g.us' AND sender_jid IS NOT NULL)
         OR (chat_id NOT LIKE '%@s.whatsapp.net' AND chat_id NOT LIKE '%@g.us' AND chat_id IS NOT NULL);
    `;
    
    const messagesResult = await pool.query(cleanMessagesQuery);
    console.log(`✅ Removed ${messagesResult.rowCount} messages with invalid JIDs`);
    
    // Clean invalid JIDs from chats
    const cleanChatsQuery = `
      DELETE FROM whatsapp_chats 
      WHERE id NOT LIKE '%@s.whatsapp.net' AND id NOT LIKE '%@g.us';
    `;
    
    const chatsResult = await pool.query(cleanChatsQuery);
    console.log(`✅ Removed ${chatsResult.rowCount} chats with invalid JIDs`);
    
    // Final count verification
    const finalCountResult = await pool.query(countQuery);
    const finalStats = finalCountResult.rows[0];
    
    console.log(`\n📊 Database after cleanup:`);
    console.log(`   Total contacts: ${finalStats.total_contacts}`);
    console.log(`   Valid JIDs: ${finalStats.valid_jids}`);
    console.log(`   Invalid JIDs: ${finalStats.invalid_jids}`);
    
    console.log(`\n✅ Cleanup completed successfully!`);
    console.log(`📱 Now only proper WhatsApp JID formats remain:`);
    console.log(`   - Individual contacts: [phone]@s.whatsapp.net`);
    console.log(`   - Group contacts: [groupid]@g.us`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    await pool.end();
  }
}

// Run cleanup
cleanupInvalidJids().catch(console.error);