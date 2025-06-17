import fetch from 'node-fetch';

async function configureWebhook() {
  try {
    const response = await fetch('https://evolution-api-evolution-api.vuswn0.easypanel.host/webhook/set/live-test-1750199771', {
      method: 'POST',
      headers: {
        'apikey': '119FA240-45ED-46A7-AE13-5A1B7C909D7D',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/live-test-1750199771',
          by_events: false,
          base64: false,
          events: [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE', 
            'CONTACTS_UPSERT',
            'CHATS_UPSERT',
            'PRESENCE_UPDATE',
            'CONNECTION_UPDATE'
          ]
        }
      })
    });

    const result = await response.json();
    console.log('Webhook configuration result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Webhook configuration failed:', error);
  }
}

configureWebhook();