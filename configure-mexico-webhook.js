import fetch from 'node-fetch';

async function configureMexicoWebhook() {
  const baseUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  const apiKey = '119FA240-45ED-46A7-AE13-5A1B7C909D7D';
  const instanceName = 'instance-1750433520122';
  const webhookUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122';

  try {
    console.log('Configuring webhook for Mexico instance...');
    
    const response = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
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

    if (response.ok) {
      const result = await response.json();
      console.log('Webhook configured successfully:', result);
      return true;
    } else {
      const errorText = await response.text();
      console.log('Webhook configuration failed:', errorText);
      return false;
    }

  } catch (error) {
    console.log('Error configuring webhook:', error.message);
    return false;
  }
}

configureMexicoWebhook();