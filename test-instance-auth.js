import fetch from 'node-fetch';

async function testInstanceAuth() {
  const instances = [
    { name: 'live-test-1750199771', key: '119FA240-45ED-46A7-AE13-5A1B7C909D7D' },
    { name: 'instance-1750433520122', key: 'B6D711FCDE4D4FD5936544120E713976' }
  ];
  
  const baseUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  
  for (const instance of instances) {
    console.log(`\n🔍 Testing ${instance.name} with key ${instance.key.substring(0, 8)}...`);
    
    try {
      // Test instance info
      const infoResponse = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instance.name}`, {
        headers: { 'apikey': instance.key }
      });
      
      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        console.log(`✅ Instance info retrieved for ${instance.name}`);
        console.log(`   Status: ${infoData[0]?.instance?.state || 'unknown'}`);
        console.log(`   Owner: ${infoData[0]?.instance?.owner || 'unknown'}`);
      } else {
        console.log(`❌ Failed to get instance info: ${infoResponse.status}`);
      }
      
      // Test webhook configuration
      const webhookResponse = await fetch(`${baseUrl}/webhook/find/${instance.name}`, {
        headers: { 'apikey': instance.key }
      });
      
      if (webhookResponse.ok) {
        const webhookData = await webhookResponse.json();
        console.log(`✅ Webhook configured: ${webhookData.webhook?.url ? 'Yes' : 'No'}`);
      } else {
        console.log(`❌ Webhook check failed: ${webhookResponse.status}`);
      }
      
    } catch (error) {
      console.log(`❌ Error testing ${instance.name}:`, error.message);
    }
  }
}

testInstanceAuth();