import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'instance-1750433520122';

async function fixWebhookAuth() {
  try {
    console.log('🔧 Fixing webhook authentication configuration...');
    
    // Set webhook with proper configuration
    const webhookResponse = await fetch(`${EVOLUTION_API_URL}/webhook/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        instanceName: INSTANCE_NAME,
        url: 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122',
        enabled: true,
        webhookByEvents: true,
        webhookBase64: false,
        events: [
          'GROUPS_UPSERT',
          'CHATS_UPSERT', 
          'CONTACTS_UPDATE',
          'MESSAGES_UPSERT',
          'GROUP_UPDATE'
        ]
      })
    });
    
    if (webhookResponse.ok) {
      const result = await webhookResponse.json();
      console.log('✅ Webhook configured successfully');
      console.log('Result:', JSON.stringify(result, null, 2));
      
      // Verify the webhook configuration
      const verifyResponse = await fetch(`${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        }
      });
      
      if (verifyResponse.ok) {
        const webhookInfo = await verifyResponse.json();
        console.log('✅ Webhook verification successful');
        console.log('Webhook info:', JSON.stringify(webhookInfo, null, 2));
      }
      
    } else {
      const errorText = await webhookResponse.text();
      console.log('❌ Webhook configuration failed');
      console.log('Status:', webhookResponse.status);
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error fixing webhook auth:', error.message);
  }
}

fixWebhookAuth();