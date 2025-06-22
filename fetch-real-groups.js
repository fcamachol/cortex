import fetch from 'node-fetch';

const EVOLUTION_API_BASE_URL = 'https://evolution.nexuscodesolutions.com';
const GLOBAL_API_KEY = 'B6D711FCDE4D4FD5936544120E713976';
const INSTANCE_NAME = 'instance-1750433520122';

async function fetchRealGroupNames() {
  try {
    console.log('🔍 Fetching real group names from Evolution API...');
    
    // Try to get group information using the fetchInstances endpoint
    const instancesResponse = await fetch(`${EVOLUTION_API_BASE_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': GLOBAL_API_KEY
      }
    });
    
    if (!instancesResponse.ok) {
      throw new Error(`Failed to fetch instances: ${instancesResponse.statusText}`);
    }
    
    const instances = await instancesResponse.json();
    console.log('📊 Available instances:', instances.length);
    
    // Find our specific instance
    const targetInstance = instances.find(inst => inst.name === INSTANCE_NAME);
    if (!targetInstance) {
      console.log('❌ Instance not found');
      return;
    }
    
    console.log('✅ Found target instance:', INSTANCE_NAME);
    console.log('📱 Instance status:', targetInstance.connectionStatus?.state);
    
    // Try to fetch groups using different endpoints
    const endpoints = [
      `/group/findGroups/${INSTANCE_NAME}`,
      `/chat/findChats/${INSTANCE_NAME}`,
      `/instance/fetchInstances`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔗 Trying endpoint: ${endpoint}`);
        const response = await fetch(`${EVOLUTION_API_BASE_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': GLOBAL_API_KEY
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Success with ${endpoint}:`, JSON.stringify(data, null, 2));
          
          // Look for group data in the response
          if (Array.isArray(data)) {
            const groups = data.filter(item => 
              item.id && item.id.includes('@g.us') || 
              item.remoteJid && item.remoteJid.includes('@g.us')
            );
            
            if (groups.length > 0) {
              console.log('🎯 Found groups:', groups.length);
              groups.forEach(group => {
                console.log(`📝 Group: ${group.id || group.remoteJid} - ${group.subject || group.name || 'No subject'}`);
              });
              return groups;
            }
          }
        } else {
          console.log(`❌ Failed ${endpoint}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log(`❌ Error with ${endpoint}:`, error.message);
      }
    }
    
    console.log('⚠️ No group data found in any endpoint');
    
  } catch (error) {
    console.error('❌ Error fetching group names:', error.message);
  }
}

fetchRealGroupNames();