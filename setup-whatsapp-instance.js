import fetch from 'node-fetch';

async function setupWhatsAppInstance() {
  const baseUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  const workingApiKey = '119FA240-45ED-46A7-AE13-5A1B7C909D7D'; // Use the working instance's API key
  const newInstanceName = 'instance-mexico-' + Date.now();
  const webhookUrl = `https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/${newInstanceName}`;

  try {
    console.log(`Creating new WhatsApp instance: ${newInstanceName}`);
    
    // Create the new instance using the working API key pattern
    const createResponse = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': workingApiKey
      },
      body: JSON.stringify({
        instanceName: newInstanceName,
        integration: 'WHATSAPP-BAILEYS',
        webhook_url: webhookUrl,
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
      const createData = await createResponse.json();
      console.log('Instance created successfully');
      console.log(`Instance Name: ${newInstanceName}`);
      
      const instanceApiKey = createData.hash?.apikey || createData.token || workingApiKey;
      console.log(`API Key: ${instanceApiKey.substring(0, 8)}...`);
      
      // Return the instance data for database insertion
      return {
        instanceName: newInstanceName,
        apiKey: instanceApiKey,
        webhookUrl: webhookUrl
      };
    } else {
      const errorText = await createResponse.text();
      console.log(`Failed to create instance: ${createResponse.status}`);
      console.log(`Error: ${errorText}`);
    }

  } catch (error) {
    console.log('Error:', error.message);
  }
  
  return null;
}

setupWhatsAppInstance().then(result => {
  if (result) {
    console.log('\nNew instance created successfully:');
    console.log(`INSERT INTO database:`);
    console.log(`Instance Name: ${result.instanceName}`);
    console.log(`API Key: ${result.apiKey}`);
    console.log(`Webhook URL: ${result.webhookUrl}`);
  }
});