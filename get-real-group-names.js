import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'instance-1750433520122';

async function getRealGroupNames() {
  try {
    console.log('🔍 Fetching real group names from Evolution API...');
    
    // Try different API endpoints to get group data
    const endpoints = [
      `/group/findGroupInfos/${INSTANCE_NAME}`,
      `/chat/findChats/${INSTANCE_NAME}`,
      `/group/findAll/${INSTANCE_NAME}`,
      `/chat/findMany/${INSTANCE_NAME}`,
      `/instance/${INSTANCE_NAME}/chats`,
      `/instance/${INSTANCE_NAME}/groups`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔗 Trying: ${endpoint}`);
        
        const response = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Success with ${endpoint}`);
          
          if (Array.isArray(data)) {
            // Filter for groups (JIDs ending with @g.us)
            const groups = data.filter(item => 
              (item.id && item.id.includes('@g.us')) ||
              (item.remoteJid && item.remoteJid.includes('@g.us'))
            );
            
            if (groups.length > 0) {
              console.log(`📊 Found ${groups.length} groups:`);
              groups.forEach(group => {
                const jid = group.id || group.remoteJid;
                const name = group.subject || group.name || group.pushName || 'No name';
                console.log(`📝 ${jid} - ${name}`);
              });
              
              // Update groups with real names
              for (const group of groups) {
                const jid = group.id || group.remoteJid;
                const realName = group.subject || group.name || group.pushName;
                
                if (realName && realName !== 'No name') {
                  await updateGroupWithRealName(jid, realName);
                }
              }
              
              return groups;
            }
          } else if (data && typeof data === 'object') {
            console.log('📋 Response data:', JSON.stringify(data, null, 2));
          }
        } else {
          console.log(`❌ ${endpoint}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint} error: ${error.message}`);
      }
    }
    
    // Try POST methods with body
    const postEndpoints = [
      { path: '/chat/find', body: { instanceName: INSTANCE_NAME } },
      { path: '/group/find', body: { instanceName: INSTANCE_NAME } },
      { path: '/chat/findMany', body: { instanceName: INSTANCE_NAME, where: {} } }
    ];
    
    for (const endpoint of postEndpoints) {
      try {
        console.log(`🔗 Trying POST: ${endpoint.path}`);
        
        const response = await fetch(`${EVOLUTION_API_URL}${endpoint.path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          },
          body: JSON.stringify(endpoint.body)
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Success with POST ${endpoint.path}`);
          console.log('📋 Response:', JSON.stringify(data, null, 2));
          
          if (Array.isArray(data)) {
            const groups = data.filter(item => 
              (item.id && item.id.includes('@g.us')) ||
              (item.remoteJid && item.remoteJid.includes('@g.us'))
            );
            
            if (groups.length > 0) {
              console.log(`📊 Found ${groups.length} groups via POST:`);
              groups.forEach(group => {
                const jid = group.id || group.remoteJid;
                const name = group.subject || group.name || group.pushName || 'No name';
                console.log(`📝 ${jid} - ${name}`);
              });
              
              // Update groups with real names
              for (const group of groups) {
                const jid = group.id || group.remoteJid;
                const realName = group.subject || group.name || group.pushName;
                
                if (realName && realName !== 'No name') {
                  await updateGroupWithRealName(jid, realName);
                }
              }
              
              return groups;
            }
          }
        } else {
          console.log(`❌ POST ${endpoint.path}: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ POST ${endpoint.path} error: ${error.message}`);
      }
    }
    
    console.log('⚠️ No group data found in Evolution API');
    
  } catch (error) {
    console.error('❌ Error fetching group names:', error.message);
  }
}

async function updateGroupWithRealName(groupJid, realName) {
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
          id: groupJid,
          subject: realName,
          subjectOwner: '5214422501780@s.whatsapp.net',
          subjectTime: Math.floor(Date.now() / 1000),
          creation: Math.floor(Date.now() / 1000),
          owner: '5214422501780@s.whatsapp.net',
          desc: 'Updated with real group name',
          participants: [{"id": "5214422501780@s.whatsapp.net", "admin": "superadmin"}]
        }]
      })
    });
    
    if (response.ok) {
      console.log(`✅ Updated ${groupJid} with real name: ${realName}`);
    } else {
      console.log(`❌ Failed to update ${groupJid}: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Error updating ${groupJid}: ${error.message}`);
  }
}

getRealGroupNames();