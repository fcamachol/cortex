import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'instance-1750433520122';

async function fetchEvolutionGroups() {
  try {
    console.log('Fetching real group data from Evolution API v2.2.3...');
    
    // Try the correct Evolution API v2.2.3 endpoint patterns
    const endpoints = [
      { method: 'GET', path: `/group/${INSTANCE_NAME}` },
      { method: 'GET', path: `/chat/${INSTANCE_NAME}` },
      { method: 'POST', path: '/group/fetchAllGroups', body: { instanceName: INSTANCE_NAME } },
      { method: 'POST', path: '/chat/fetchAllChats', body: { instanceName: INSTANCE_NAME } },
      { method: 'GET', path: `/instance/${INSTANCE_NAME}/groups` },
      { method: 'GET', path: `/instance/${INSTANCE_NAME}/chats` }
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Testing ${endpoint.method} ${endpoint.path}...`);
        
        const options = {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          }
        };
        
        if (endpoint.body) {
          options.body = JSON.stringify(endpoint.body);
        }
        
        const response = await fetch(`${EVOLUTION_API_URL}${endpoint.path}`, options);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Success with ${endpoint.method} ${endpoint.path}`);
          
          if (Array.isArray(data)) {
            const groups = data.filter(item => 
              (item.id && item.id.includes('@g.us')) ||
              (item.remoteJid && item.remoteJid.includes('@g.us')) ||
              (item.chatId && item.chatId.includes('@g.us'))
            );
            
            if (groups.length > 0) {
              console.log(`Found ${groups.length} groups with real names:`);
              
              for (const group of groups) {
                const groupId = group.id || group.remoteJid || group.chatId;
                const groupName = group.subject || group.name || group.pushName;
                
                if (groupName && groupId) {
                  console.log(`${groupId}: ${groupName}`);
                  await updateGroupName(groupId, groupName);
                }
              }
              
              return groups;
            }
          } else if (data && typeof data === 'object') {
            console.log('Response data:', JSON.stringify(data, null, 2));
          }
        } else {
          const errorText = await response.text();
          console.log(`${endpoint.method} ${endpoint.path}: ${response.status} - ${errorText.substring(0, 100)}`);
        }
      } catch (error) {
        console.log(`${endpoint.method} ${endpoint.path} error: ${error.message}`);
      }
    }
    
    // Try with specific group IDs from database
    console.log('Attempting individual group lookups...');
    const specificGroups = [
      '120363401361896826@g.us',
      '120363420139252714@g.us', 
      '120363419575637974@g.us',
      '120363402303233469@g.us'
    ];
    
    for (const groupId of specificGroups) {
      try {
        const response = await fetch(`${EVOLUTION_API_URL}/group/info/${INSTANCE_NAME}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          },
          body: JSON.stringify({
            groupJid: groupId
          })
        });
        
        if (response.ok) {
          const groupInfo = await response.json();
          console.log(`Group info for ${groupId}:`, JSON.stringify(groupInfo, null, 2));
          
          if (groupInfo.subject) {
            await updateGroupName(groupId, groupInfo.subject);
          }
        }
      } catch (error) {
        console.log(`Error fetching ${groupId}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error fetching Evolution groups:', error.message);
  }
}

async function updateGroupName(groupId, realName) {
  try {
    const response = await fetch('http://localhost:5000/api/evolution/webhook/instance-1750433520122/groups-upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: 'groups.upsert',
        instance: 'instance-1750433520122',
        data: [{
          id: groupId,
          subject: realName,
          subjectOwner: '5214422501780@s.whatsapp.net',
          subjectTime: Math.floor(Date.now() / 1000),
          creation: Math.floor(Date.now() / 1000),
          owner: '5214422501780@s.whatsapp.net',
          desc: 'Updated with authentic group name from Evolution API',
          participants: [{"id": "5214422501780@s.whatsapp.net", "admin": "superadmin"}]
        }]
      })
    });
    
    if (response.ok) {
      console.log(`Updated ${groupId}: ${realName}`);
    } else {
      console.log(`Failed to update ${groupId}: ${response.status}`);
    }
  } catch (error) {
    console.log(`Error updating ${groupId}: ${error.message}`);
  }
}

fetchEvolutionGroups();