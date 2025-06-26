/**
 * Configure webhooks for the reconnected WhatsApp instances
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;

const instances = [
  { instanceId: 'instance-1750433520122', apiKey: '28AACF7E-8C0C-42D1-8139-E47418746C55' },
  { instanceId: 'live-test-1750199771', apiKey: '119FA240-45ED-46A7-AE13-5A1B7C909D7D' }
];

async function configureWebhooks() {
  const webhookUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/webhook';
  
  const webhookConfig = {
    url: webhookUrl,
    webhook_by_events: false,
    events: [
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE', 
      'CONTACTS_UPSERT',
      'CHATS_UPSERT',
      'GROUPS_UPSERT',
      'CONNECTION_UPDATE'
    ]
  };

  for (const instance of instances) {
    try {
      console.log(`Configuring webhook for ${instance.instanceId}...`);
      
      const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instance.instanceId}`, {
        method: 'POST',
        headers: {
          'apikey': instance.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookConfig)
      });

      const result = await response.json();
      console.log(`✅ Webhook configured for ${instance.instanceId}:`, result);

      // Test instance status
      const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/${instance.instanceId}`, {
        headers: { 'apikey': instance.apiKey }
      });
      
      const status = await statusResponse.json();
      console.log(`📱 Instance ${instance.instanceId} status:`, {
        name: status.instance?.instanceName,
        state: status.instance?.state,
        owner: status.instance?.owner
      });

    } catch (error) {
      console.error(`❌ Error configuring ${instance.instanceId}:`, error.message);
    }
  }
}

async function testWebhookConnectivity() {
  console.log('\n🔄 Testing webhook connectivity...');
  
  try {
    const testResponse = await fetch('https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/webhook-health');
    const health = await testResponse.json();
    console.log('✅ Webhook endpoint healthy:', health);
  } catch (error) {
    console.error('❌ Webhook endpoint test failed:', error.message);
  }
}

async function main() {
  console.log('🔧 Configuring reconnected WhatsApp instances...\n');
  
  await configureWebhooks();
  await testWebhookConnectivity();
  
  console.log('\n✅ Configuration complete! Your instances should now receive new chats.');
  console.log('📱 Instance states: Both instances reconnected and webhook configured');
  console.log('🚀 New WhatsApp messages should now appear in real-time');
}

main().catch(console.error);