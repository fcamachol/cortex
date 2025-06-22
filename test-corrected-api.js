import fetch from 'node-fetch';

async function testCorrectedEvolutionApi() {
  try {
    console.log('🧪 Testing corrected Evolution API endpoints...');
    
    const instanceName = 'live-test-1750199771';
    const apiKey = '119FA240-45ED-46A7-AE13-5A1B7C909D7D';
    const baseUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
    
    // Test /group/findAll endpoint
    console.log('📋 Testing /group/findAll endpoint...');
    const groupsResponse = await fetch(`${baseUrl}/group/findAll/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Groups endpoint status: ${groupsResponse.status}`);
    if (groupsResponse.ok) {
      const groups = await groupsResponse.json();
      console.log(`✅ Found ${groups.length} groups from API`);
      groups.forEach((group, index) => {
        console.log(`   ${index + 1}. ${group.id} -> "${group.subject || group.name}"`);
      });
    } else {
      const error = await groupsResponse.text();
      console.log(`❌ Groups endpoint error:`, error);
    }
    
    // Test /contact/findAll endpoint
    console.log('\n📞 Testing /contact/findAll endpoint...');
    const contactsResponse = await fetch(`${baseUrl}/contact/findAll/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Contacts endpoint status: ${contactsResponse.status}`);
    if (contactsResponse.ok) {
      const contacts = await contactsResponse.json();
      console.log(`✅ Found ${contacts.length} contacts from API`);
    } else {
      const error = await contactsResponse.text();
      console.log(`❌ Contacts endpoint error:`, error);
    }
    
    // Test /chat/findAll endpoint
    console.log('\n💬 Testing /chat/findAll endpoint...');
    const chatsResponse = await fetch(`${baseUrl}/chat/findAll/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Chats endpoint status: ${chatsResponse.status}`);
    if (chatsResponse.ok) {
      const chats = await chatsResponse.json();
      console.log(`✅ Found ${chats.length} chats from API`);
    } else {
      const error = await chatsResponse.text();
      console.log(`❌ Chats endpoint error:`, error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCorrectedEvolutionApi();