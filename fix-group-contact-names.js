/**
 * Fix group contact names that are incorrectly combining user JIDs with group JIDs
 */

const instanceId = 'instance-1750433520122';

async function fixGroupContactNames() {
  try {
    console.log('🔄 Starting group contact name synchronization...');
    
    // Import the required modules
    const { storage } = await import('./server/storage.js');
    
    // Get all groups for the instance
    const groups = await storage.getWhatsappGroups(instanceId);
    console.log(`📊 Found ${groups.length} groups to process`);
    
    let syncedCount = 0;
    
    for (const group of groups) {
      if (group.subject && group.subject !== 'Group') {
        const contact = await storage.getWhatsappContact(group.groupJid, instanceId);
        
        if (contact && contact.pushName !== group.subject) {
          console.log(`🔄 Syncing contact for group ${group.groupJid}:`);
          console.log(`   Old contact name: "${contact.pushName}"`);
          console.log(`   New contact name: "${group.subject}"`);
          
          const updatedContact = {
            ...contact,
            pushName: group.subject,
            verifiedName: group.subject
          };
          
          await storage.upsertWhatsappContact(updatedContact);
          syncedCount++;
        }
      }
    }
    
    console.log(`✅ Successfully synchronized ${syncedCount} group contact names`);
    console.log('🎉 Group contact name fix completed');
    
  } catch (error) {
    console.error('❌ Error fixing group contact names:', error);
  }
}

// Run the fix
fixGroupContactNames();