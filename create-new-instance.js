import fetch from 'node-fetch';

async function createNewInstance() {
  const baseUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  const globalApiKey = 'B6D711FCDE4D4FD5936544120E713976';
  const instanceName = 'instance-1750433520122';
  const webhookUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122';

  try {
    console.log(`🚀 Creating new WhatsApp instance: ${instanceName}`);
    
    // Create the instance in Evolution API
    const createResponse = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': globalApiKey
      },
      body: JSON.stringify({
        instanceName: instanceName,
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
      console.log('✅ Instance created successfully');
      console.log(`   Instance ID: ${createData.instance?.instanceId || 'Unknown'}`);
      console.log(`   API Key: ${createData.hash?.apikey ? createData.hash.apikey.substring(0, 8) + '...' : 'Not provided'}`);
      
      if (createData.hash?.apikey) {
        console.log(`\n📝 Update database with API key: ${createData.hash.apikey}`);
        return createData.hash.apikey;
      }
    } else {
      const errorText = await createResponse.text();
      console.log(`❌ Failed to create instance: ${createResponse.status}`);
      console.log(`   Error: ${errorText}`);
    }

    // If creation failed, try to connect to existing instance
    console.log('\n🔌 Attempting to connect to existing instance...');
    const connectResponse = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      headers: { 'apikey': globalApiKey }
    });

    if (connectResponse.ok) {
      const connectData = await connectResponse.json();
      console.log('✅ Connected to existing instance');
      console.log('   QR Code available for scanning');
      return true;
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  return false;
}

createNewInstance();