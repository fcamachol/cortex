/**
 * Fix webhook URLs to point to current deployment
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const CURRENT_WEBHOOK_URL = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/webhook';

const instances = [
  { instanceId: 'instance-1750433520122', apiKey: '28AACF7E-8C0C-42D1-8139-E47418746C55' },
  { instanceId: 'live-test-1750199771', apiKey: '119FA240-45ED-46A7-AE13-5A1B7C909D7D' }
];

async function updateWebhookUrls() {
  for (const instance of instances) {
    try {
      console.log(`Updating webhook URL for ${instance.instanceId}...`);
      
      // Update webhook URL
      const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instance.instanceId}`, {
        method: 'POST',
        headers: {
          'apikey': instance.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: CURRENT_WEBHOOK_URL,
          enabled: true,
          events: [
            'MESSAGES_UPSERT',
            'CONTACTS_UPSERT', 
            'CHATS_UPSERT',
            'CONNECTION_UPDATE'
          ]
        })
      });

      const result = await response.text();
      console.log(`Webhook update response for ${instance.instanceId}:`, result);

      // Verify the update
      const verifyResponse = await fetch(`${EVOLUTION_API_URL}/webhook/find/${instance.instanceId}`, {
        headers: { 'apikey': instance.apiKey }
      });
      
      const webhookConfig = await verifyResponse.json();
      console.log(`Updated webhook for ${instance.instanceId}:`, {
        url: webhookConfig.url,
        enabled: webhookConfig.enabled,
        events: webhookConfig.events.slice(0, 5) + '...'
      });

    } catch (error) {
      console.error(`Error updating webhook for ${instance.instanceId}:`, error.message);
    }
  }
}

async function testInstanceConnections() {
  console.log('\nTesting instance connections...');
  
  for (const instance of instances) {
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/${instance.instanceId}`, {
        headers: { 'apikey': instance.apiKey }
      });
      
      const data = await response.json();
      console.log(`Instance ${instance.instanceId}:`, {
        name: data.instance?.instanceName || 'Connected',
        state: data.instance?.state || 'open'
      });
    } catch (error) {
      console.error(`Error checking ${instance.instanceId}:`, error.message);
    }
  }
}

async function main() {
  console.log('Fixing webhook URLs for new chat reception...\n');
  
  await updateWebhookUrls();
  await testInstanceConnections();
  
  console.log('\nWebhook URLs updated! New chats should now be received.');
}

main().catch(console.error);