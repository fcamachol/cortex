import fetch from 'node-fetch';

async function fixInstanceAuth() {
  const baseUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  const globalApiKey = 'B6D711FCDE4D4FD5936544120E713976';
  const instanceName = 'instance-1750433520122';
  
  try {
    // First, try to get the instance with the global API key to see if it exists
    console.log('🔍 Checking if instance exists...');
    const checkResponse = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { 'apikey': globalApiKey }
    });
    
    if (checkResponse.ok) {
      const instances = await checkResponse.json();
      console.log('✅ Retrieved instances list');
      
      // Look for our specific instance
      const ourInstance = instances.find(inst => 
        inst.instance?.instanceName === instanceName || 
        inst.instanceName === instanceName
      );
      
      if (ourInstance) {
        console.log(`✅ Found instance: ${instanceName}`);
        const actualApiKey = ourInstance.hash?.apikey || ourInstance.apikey;
        console.log(`   API Key: ${actualApiKey ? actualApiKey.substring(0, 8) + '...' : 'Not found'}`);
        
        if (actualApiKey) {
          // Test the actual API key
          const testResponse = await fetch(`${baseUrl}/chat/findChats/${instanceName}`, {
            headers: { 'apikey': actualApiKey }
          });
          
          if (testResponse.ok) {
            console.log('✅ Chat endpoint accessible with correct API key');
            const chats = await testResponse.json();
            console.log(`   Found ${Array.isArray(chats) ? chats.length : 0} chats`);
            
            // Return the correct API key for database update
            console.log(`\nCorrect API key for ${instanceName}: ${actualApiKey}`);
            return actualApiKey;
          } else {
            console.log(`❌ Chat endpoint failed: ${testResponse.status}`);
          }
        }
      } else {
        console.log(`❌ Instance ${instanceName} not found in Evolution API`);
      }
    } else {
      console.log(`❌ Failed to get instances list: ${checkResponse.status}`);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

fixInstanceAuth();