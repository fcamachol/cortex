import fetch from 'node-fetch';

async function configureWebhook() {
  try {
    const instanceName = 'live-test-1750199771';
    const apiKey = '119FA240-45ED-46A7-AE13-5A1B7C909D7D';
    
    // Configure webhook for the active instance
    const webhookResponse = await fetch(`https://evolution-api-evolution-api.vuswn0.easypanel.host/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        webhook: {
          url: 'https://rest-express-repl.replit.app/api/whatsapp/webhook/' + instanceName,
          webhook_by_events: false,
          events: [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED', 
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'MESSAGES_DELETE',
            'SEND_MESSAGE',
            'CONTACTS_UPDATE',
            'CONTACTS_UPSERT',
            'PRESENCE_UPDATE',
            'CHATS_UPDATE',
            'CHATS_UPSERT',
            'CHATS_DELETE',
            'GROUPS_UPSERT',
            'GROUP_UPDATE',
            'GROUP_PARTICIPANTS_UPDATE',
            'MESSAGE_REACTION',
            'CALL'
          ]
        }
      })
    });

    const result = await webhookResponse.json();
    console.log('Webhook configuration result:', result);

    // Verify webhook is set
    const verifyResponse = await fetch(`https://evolution-api-evolution-api.vuswn0.easypanel.host/webhook/find/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });

    const verifyResult = await verifyResponse.json();
    console.log('Webhook verification:', verifyResult);

  } catch (error) {
    console.error('Error configuring webhook:', error);
  }
}

configureWebhook();