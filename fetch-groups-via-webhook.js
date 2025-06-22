import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'instance-1750433520122';

async function fetchGroupsViaWebhook() {
  try {
    console.log('🔍 Fetching groups by triggering webhook events...');
    
    // Use the working fetchInstances endpoint to get chat data
    const instancesResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      }
    });
    
    if (!instancesResponse.ok) {
      throw new Error(`Failed to fetch instances: ${instancesResponse.statusText}`);
    }
    
    const instances = await instancesResponse.json();
    const targetInstance = instances.find(inst => inst.name === INSTANCE_NAME);
    
    if (!targetInstance) {
      console.log('❌ Instance not found');
      return;
    }
    
    console.log(`✅ Found instance with ${targetInstance._count.Chat} chats`);
    
    // Since direct group endpoints don't work, let's use a different approach
    // Try to send a broadcast message to trigger group info in webhooks
    const broadcastEndpoints = [
      `/message/sendText`,
      `/chat/sendText`,
      `/send/text`
    ];
    
    for (const endpoint of broadcastEndpoints) {
      try {
        console.log(`🔗 Testing endpoint: ${endpoint}`);
        
        const response = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          },
          body: JSON.stringify({
            instanceName: INSTANCE_NAME,
            number: '120363401361896826@g.us',
            textMessage: {
              text: '.'
            }
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Working endpoint found: ${endpoint}`);
          console.log('Response:', JSON.stringify(result, null, 2));
          return;
        } else {
          console.log(`❌ ${endpoint}: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint} error: ${error.message}`);
      }
    }
    
    console.log('⚠️ No working group endpoints found');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fetchGroupsViaWebhook();