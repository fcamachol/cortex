import fetch from 'node-fetch';

async function createMexicanInstance() {
  const serverUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  const apiKey = '119FA240-45ED-46A7-AE13-5A1B7C909D7D';
  const instanceName = 'mexican-instance-' + Date.now();
  const destinationUrl = `https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/${instanceName}`;

  try {
    console.log(`Creating Mexican WhatsApp instance: ${instanceName}`);
    console.log(`Server URL: ${serverUrl}`);
    console.log(`Destination URL: ${destinationUrl}`);
    
    // Create instance with webhook configuration
    const createResponse = await fetch(`${serverUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        instanceName: instanceName,
        integration: 'WHATSAPP-BAILEYS',
        webhook_url: destinationUrl,
        events: [
          'APPLICATION_STARTUP',
          'QRCODE_UPDATED', 
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONTACTS_UPSERT',
          'CHATS_UPSERT'
        ]
      })
    });

    if (createResponse.ok) {
      const createResult = await createResponse.json();
      console.log('✅ Mexican instance created successfully');
      console.log('Instance data:', JSON.stringify(createResult, null, 2));
      
      const instanceApiKey = createResult.hash?.apikey || apiKey;
      console.log(`API Key: ${instanceApiKey.substring(0, 8)}...`);
      
      // Get QR code for connection
      const qrResponse = await fetch(`${serverUrl}/instance/connect/${instanceName}`, {
        headers: { 'apikey': instanceApiKey }
      });
      
      if (qrResponse.ok) {
        const qrData = await qrResponse.json();
        console.log('✅ QR code available for scanning');
        console.log('QR Code info:', qrData.base64 ? 'QR code generated' : 'No QR code yet');
      }
      
      return {
        instanceName,
        apiKey: instanceApiKey,
        webhookUrl: destinationUrl,
        serverUrl
      };
    } else {
      const errorText = await createResponse.text();
      console.log('❌ Failed to create Mexican instance');
      console.log('Status:', createResponse.status);
      console.log('Error:', errorText);
      return null;
    }

  } catch (error) {
    console.log('❌ Error creating Mexican instance:', error.message);
    return null;
  }
}

createMexicanInstance().then(result => {
  if (result) {
    console.log('\n=== Mexican Instance Created ===');
    console.log(`Instance Name: ${result.instanceName}`);
    console.log(`API Key: ${result.apiKey}`);
    console.log(`Webhook URL: ${result.webhookUrl}`);
    console.log(`Server URL: ${result.serverUrl}`);
    console.log('\nUpdate database with these values');
  }
});