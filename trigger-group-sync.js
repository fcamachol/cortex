import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'instance-1750433520122';

async function triggerGroupSync() {
  try {
    console.log('🔄 Triggering group metadata sync via Evolution API...');
    
    // Get all current groups from database
    const dbResponse = await fetch('http://localhost:5000/api/whatsapp/groups/instance-1750433520122');
    if (!dbResponse.ok) {
      console.log('❌ Failed to get groups from database');
      return;
    }
    
    const groups = await dbResponse.json();
    console.log(`📊 Found ${groups.length} groups in database`);
    
    // Try different message sending endpoints to trigger group updates
    const messageEndpoints = [
      { path: '/message/sendText', method: 'POST' },
      { path: '/sendText', method: 'POST' },
      { path: '/chat/sendMessage', method: 'POST' },
      { path: '/send/text', method: 'POST' }
    ];
    
    let workingEndpoint = null;
    
    // Test endpoints with a single group first
    const testGroup = groups[0];
    if (testGroup) {
      for (const endpoint of messageEndpoints) {
        try {
          console.log(`🧪 Testing ${endpoint.path}...`);
          
          const response = await fetch(`${EVOLUTION_API_URL}${endpoint.path}`, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
              instanceName: INSTANCE_NAME,
              number: testGroup.group_jid,
              text: '.',
              textMessage: {
                text: '.'
              }
            })
          });
          
          if (response.ok) {
            workingEndpoint = endpoint;
            console.log(`✅ Found working endpoint: ${endpoint.path}`);
            break;
          } else {
            console.log(`❌ ${endpoint.path}: ${response.status}`);
          }
        } catch (error) {
          console.log(`❌ ${endpoint.path} error: ${error.message}`);
        }
      }
    }
    
    if (workingEndpoint) {
      // Use working endpoint to send messages to all groups
      // This will trigger group metadata updates via webhooks
      console.log('📤 Sending sync messages to trigger group updates...');
      
      for (const group of groups.slice(0, 5)) { // Limit to first 5 for testing
        try {
          const response = await fetch(`${EVOLUTION_API_URL}${workingEndpoint.path}`, {
            method: workingEndpoint.method,
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
              instanceName: INSTANCE_NAME,
              number: group.group_jid,
              textMessage: {
                text: '🔄 Sync'
              }
            })
          });
          
          if (response.ok) {
            console.log(`✅ Triggered sync for ${group.group_jid}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
          } else {
            console.log(`❌ Failed sync for ${group.group_jid}: ${response.status}`);
          }
        } catch (error) {
          console.log(`❌ Error syncing ${group.group_jid}: ${error.message}`);
        }
      }
    } else {
      console.log('⚠️ No working message endpoints found');
      
      // Try alternative approach - use instance status to trigger refresh
      try {
        console.log('🔄 Trying instance status refresh...');
        const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          }
        });
        
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          console.log('📱 Instance status:', JSON.stringify(status, null, 2));
        }
      } catch (error) {
        console.log('❌ Status check failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error triggering group sync:', error.message);
  }
}

triggerGroupSync();