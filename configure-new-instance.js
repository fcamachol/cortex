import fetch from 'node-fetch';

async function configureNewInstance() {
  const instanceName = 'instance-1750433520122';
  const apiKey = 'B6D711FCDE4D4FD5936544120E713976';
  const baseUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  const webhookUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122';

  try {
    // Configure webhook
    console.log('🔗 Configuring webhook for:', instanceName);
    const webhookResponse = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        webhook: {
          url: webhookUrl,
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

    if (webhookResponse.ok) {
      const webhookData = await webhookResponse.json();
      console.log('✅ Webhook configured:', webhookData);
    } else {
      console.error('❌ Webhook configuration failed:', await webhookResponse.text());
    }

    // Get instance info
    console.log('🔍 Getting instance info...');
    const infoResponse = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
      headers: { 'apikey': apiKey }
    });
    
    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      console.log('📊 Instance info:', JSON.stringify(infoData, null, 2));
    }

  } catch (error) {
    console.error('❌ Configuration error:', error);
  }
}

configureNewInstance();