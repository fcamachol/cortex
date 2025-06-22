import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'instance-1750433520122';

async function forceGroupMetadataRefresh() {
  try {
    console.log('🔄 Forcing group metadata refresh by sending messages...');
    
    // Get all groups with synthetic names from database
    const response = await fetch('http://localhost:5000/api/whatsapp/groups/instance-1750433520122');
    if (!response.ok) {
      console.log('❌ Failed to fetch groups from database');
      return;
    }
    
    const groups = await response.json();
    const syntheticGroups = groups.filter(group => 
      group.subject.includes('Actualizado') || 
      group.subject.includes('Sincronizado') ||
      group.subject.includes('Test Group') ||
      group.subject.includes('Business Group') ||
      group.subject.includes('Development Group')
    );
    
    console.log(`📊 Found ${syntheticGroups.length} groups with synthetic names`);
    console.log(`📊 Total groups: ${groups.length}`);
    
    // Send message to each group to trigger metadata refresh
    for (let i = 0; i < syntheticGroups.length; i++) {
      const group = syntheticGroups[i];
      
      try {
        console.log(`📤 ${i + 1}/${syntheticGroups.length} Triggering refresh for: ${group.groupJid}`);
        console.log(`   Current name: ${group.subject}`);
        
        const messageResponse = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          },
          body: JSON.stringify({
            number: group.groupJid,
            text: '.',
            options: {
              delay: 1200,
              presence: 'composing'
            }
          })
        });
        
        if (messageResponse.ok) {
          const result = await messageResponse.json();
          console.log(`✅ Message sent to ${group.groupJid} - Status: ${result.status || 'sent'}`);
          
          // Wait 2 seconds between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          const errorText = await messageResponse.text();
          console.log(`❌ Failed to send message to ${group.groupJid}: ${messageResponse.status} - ${errorText.substring(0, 100)}`);
        }
        
      } catch (error) {
        console.log(`❌ Error processing ${group.groupJid}: ${error.message}`);
      }
    }
    
    console.log('\n🎯 Metadata refresh triggered for all groups with synthetic names');
    console.log('📡 Waiting for webhooks to update group subjects with real names...');
    console.log('⏱️  Allow 10-30 seconds for all webhook events to process');
    
    // Wait a moment then check for updates
    setTimeout(async () => {
      console.log('\n🔍 Checking for updated group names...');
      const updatedResponse = await fetch('http://localhost:5000/api/whatsapp/groups/instance-1750433520122');
      if (updatedResponse.ok) {
        const updatedGroups = await updatedResponse.json();
        const stillSynthetic = updatedGroups.filter(group => 
          group.subject.includes('Actualizado') || 
          group.subject.includes('Sincronizado')
        );
        
        console.log(`📈 Groups updated: ${syntheticGroups.length - stillSynthetic.length}/${syntheticGroups.length}`);
        console.log(`📋 Groups still with synthetic names: ${stillSynthetic.length}`);
        
        if (stillSynthetic.length > 0) {
          console.log('\n📝 Groups still needing real names:');
          stillSynthetic.forEach(group => {
            console.log(`   ${group.groupJid}: ${group.subject}`);
          });
        }
      }
    }, 15000); // Check after 15 seconds
    
  } catch (error) {
    console.error('❌ Error forcing group metadata refresh:', error.message);
  }
}

forceGroupMetadataRefresh();