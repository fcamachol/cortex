import fetch from 'node-fetch';

const EVOLUTION_API_BASE_URL = process.env.EVOLUTION_API_URL;
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'instance-1750433520122';

async function syncRealGroupNames() {
  try {
    console.log('🔍 Fetching real group names from Evolution API...');
    console.log(`🔗 API URL: ${EVOLUTION_API_BASE_URL}`);
    
    // Try to get group information using findGroups endpoint
    const groupsResponse = await fetch(`${EVOLUTION_API_BASE_URL}/group/findGroups/${INSTANCE_NAME}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': GLOBAL_API_KEY
      }
    });
    
    if (groupsResponse.ok) {
      const groups = await groupsResponse.json();
      console.log('✅ Found groups:', groups.length);
      
      for (const group of groups) {
        console.log(`📝 Real Group: ${group.id} - ${group.subject || 'No subject'}`);
        
        // Send webhook event to update with real group name
        await fetch('http://localhost:5000/api/evolution/webhook/instance-1750433520122/groups-upsert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event: 'groups.upsert',
            instance: 'instance-1750433520122',
            data: [{
              id: group.id,
              subject: group.subject || 'Group',
              subjectOwner: group.subjectOwner || '5214422501780@s.whatsapp.net',
              subjectTime: group.subjectTime || Math.floor(Date.now() / 1000),
              creation: group.creation || Math.floor(Date.now() / 1000),
              owner: group.owner || '5214422501780@s.whatsapp.net',
              desc: group.desc || '',
              participants: group.participants || [{"id": "5214422501780@s.whatsapp.net", "admin": "superadmin"}]
            }]
          })
        });
      }
      
      return groups;
    }
    
    // Try alternative endpoint
    console.log('🔄 Trying fetchInstances endpoint...');
    const instancesResponse = await fetch(`${EVOLUTION_API_BASE_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': GLOBAL_API_KEY
      }
    });
    
    if (instancesResponse.ok) {
      const instances = await instancesResponse.json();
      console.log('📊 Available instances:', instances.length);
      
      const targetInstance = instances.find(inst => inst.name === INSTANCE_NAME);
      if (targetInstance) {
        console.log('✅ Found target instance:', INSTANCE_NAME);
        console.log('📱 Instance details:', JSON.stringify(targetInstance, null, 2));
      }
    }
    
    // Try chat endpoint to find groups
    console.log('🔄 Trying findChats endpoint...');
    const chatsResponse = await fetch(`${EVOLUTION_API_BASE_URL}/chat/findChats/${INSTANCE_NAME}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': GLOBAL_API_KEY
      }
    });
    
    if (chatsResponse.ok) {
      const chats = await chatsResponse.json();
      console.log('💬 Found chats:', chats.length);
      
      const groups = chats.filter(chat => chat.id && chat.id.includes('@g.us'));
      console.log('👥 Groups found in chats:', groups.length);
      
      for (const group of groups) {
        console.log(`📝 Real Group from chats: ${group.id} - ${group.name || group.subject || 'No subject'}`);
        
        // Send webhook event to update with real group name
        await fetch('http://localhost:5000/api/evolution/webhook/instance-1750433520122/groups-upsert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event: 'groups.upsert',
            instance: 'instance-1750433520122',
            data: [{
              id: group.id,
              subject: group.name || group.subject || 'Group',
              subjectOwner: '5214422501780@s.whatsapp.net',
              subjectTime: Math.floor(Date.now() / 1000),
              creation: Math.floor(Date.now() / 1000),
              owner: '5214422501780@s.whatsapp.net',
              desc: group.desc || '',
              participants: [{"id": "5214422501780@s.whatsapp.net", "admin": "superadmin"}]
            }]
          })
        });
      }
      
      return groups;
    }
    
    console.log('❌ No group data found in any endpoint');
    
  } catch (error) {
    console.error('❌ Error fetching group names:', error.message);
  }
}

syncRealGroupNames();