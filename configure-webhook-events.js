import fetch from 'node-fetch';

async function configureWebhookEvents() {
    const instanceId = 'instance-1750433520122';
    const apiKey = '28AACF7E-8C0C-42D1-8139-E47418746C55';
    const serverUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
    const webhookUrl = `https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/${instanceId}`;

    const webhookConfig = {
        webhookUrl: webhookUrl,
        enabled: true,
        events: [
            "messages.upsert",
            "groups.update",  
            "chats.update",
            "contacts.update",
            "connection.update",
            "groups.upsert",
            "chats.upsert",
            "contacts.upsert"
        ]
    };

    try {
        console.log(`🔧 Configuring webhook for instance: ${instanceId}`);
        console.log(`📡 Webhook URL: ${webhookUrl}`);
        console.log(`📋 Events: ${webhookConfig.events.join(', ')}`);

        const response = await fetch(`${serverUrl}/instance/update-webhook/${instanceId}`, {
            method: 'PUT',
            headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookConfig)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Webhook configuration updated successfully:');
            console.log(JSON.stringify(result, null, 2));
        } else {
            const error = await response.text();
            console.error(`❌ Failed to update webhook configuration:`, error);
            console.error(`Status: ${response.status} ${response.statusText}`);
        }

        // Also get current webhook status for verification
        const statusResponse = await fetch(`${serverUrl}/instance/webhook/${instanceId}`, {
            method: 'GET',
            headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (statusResponse.ok) {
            const status = await statusResponse.json();
            console.log('\n📊 Current webhook configuration:');
            console.log(JSON.stringify(status, null, 2));
        } else {
            console.log('⚠️ Could not retrieve current webhook status');
        }

    } catch (error) {
        console.error('❌ Error configuring webhook:', error.message);
    }
}

configureWebhookEvents();