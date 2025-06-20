import fetch from 'node-fetch';

async function configureMexicanWebhook() {
  const serverUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  const apiKey = '119FA240-45ED-46A7-AE13-5A1B7C909D7D';
  const instanceId = 'instance-1750433520122';
  const destinationUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122';

  try {
    console.log(`Configuring webhook for Mexican instance: ${instanceId}`);
    console.log(`Server URL: ${serverUrl}`);
    console.log(`Destination URL: ${destinationUrl}`);
    
    const response = await fetch(`${serverUrl}/webhook/set/${instanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        webhook: {
          url: destinationUrl,
          by_events: false,
          base64: false,
          events: [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED', 
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONTACTS_UPSERT',
            'CHATS_UPSERT'
          ]
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook configured successfully for Mexican instance');
      console.log('Result:', JSON.stringify(result, null, 2));
      
      // Test the webhook endpoint
      console.log('\nTesting webhook endpoint...');
      const testResponse = await fetch(`${serverUrl}/webhook/find/${instanceId}`, {
        headers: { 'apikey': apiKey }
      });
      
      if (testResponse.ok) {
        const webhookInfo = await testResponse.json();
        console.log('✅ Webhook verification successful');
        console.log('Webhook info:', JSON.stringify(webhookInfo, null, 2));
      }
      
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ Webhook configuration failed');
      console.log('Status:', response.status);
      console.log('Error:', errorText);
      return false;
    }

  } catch (error) {
    console.log('❌ Error configuring webhook:', error.message);
    return false;
  }
}

configureMexicanWebhook();