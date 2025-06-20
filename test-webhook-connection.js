import fetch from 'node-fetch';

async function testWebhookConnection() {
  const serverUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  const apiKey = '119FA240-45ED-46A7-AE13-5A1B7C909D7D';
  const instanceId = 'instance-1750433520122';
  
  try {
    // Test if we can get instance connection status
    console.log(`Testing connection for instance: ${instanceId}`);
    
    const statusResponse = await fetch(`${serverUrl}/instance/connectionState/${instanceId}`, {
      headers: { 'apikey': apiKey }
    });
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('Instance connection status:', JSON.stringify(statusData, null, 2));
    } else {
      console.log('Connection status check failed:', statusResponse.status);
    }
    
    // Test webhook configuration
    const webhookResponse = await fetch(`${serverUrl}/webhook/find/${instanceId}`, {
      headers: { 'apikey': apiKey }
    });
    
    if (webhookResponse.ok) {
      const webhookData = await webhookResponse.json();
      console.log('Webhook configuration:', JSON.stringify(webhookData, null, 2));
    } else {
      console.log('Webhook check failed:', webhookResponse.status);
    }
    
  } catch (error) {
    console.log('Test error:', error.message);
  }
}

testWebhookConnection();