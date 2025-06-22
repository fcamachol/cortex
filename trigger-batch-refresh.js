import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'instance-1750433520122';

async function triggerBatchRefresh() {
  try {
    console.log('Starting batch group metadata refresh...');
    
    // Get groups with synthetic names
    const response = await fetch('http://localhost:5000/api/whatsapp/groups/instance-1750433520122');
    const groups = await response.json();
    const syntheticGroups = groups.filter(group => 
      group.subject.includes('Actualizado') || 
      group.subject.includes('Sincronizado')
    );
    
    console.log(`Processing ${syntheticGroups.length} groups...`);
    
    // Send messages in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < syntheticGroups.length; i += batchSize) {
      const batch = syntheticGroups.slice(i, i + batchSize);
      
      console.log(`Batch ${Math.floor(i/batchSize) + 1}: Processing ${batch.length} groups`);
      
      const promises = batch.map(async (group) => {
        try {
          const messageResponse = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
              number: group.groupJid,
              text: '.',
              options: { delay: 1000, presence: 'composing' }
            })
          });
          
          if (messageResponse.ok) {
            const result = await messageResponse.json();
            return `✅ ${group.groupJid}: ${result.status || 'sent'}`;
          } else {
            return `❌ ${group.groupJid}: ${messageResponse.status}`;
          }
        } catch (error) {
          return `❌ ${group.groupJid}: ${error.message}`;
        }
      });
      
      const results = await Promise.all(promises);
      results.forEach(result => console.log(result));
      
      // Wait between batches
      if (i + batchSize < syntheticGroups.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('\nAll messages sent. Webhook processing should begin shortly.');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

triggerBatchRefresh();