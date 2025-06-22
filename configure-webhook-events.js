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

        // Try different Evolution API endpoints for webhook configuration
        const endpoints = [
            `/webhook/set/${instanceId}`,
            `/webhook/${instanceId}`,
            `/${instanceId}/webhook`,
            `/instance/${instanceId}/webhook`
        ];

        let success = false;
        for (const endpoint of endpoints) {
            try {
                console.log(`🔄 Trying endpoint: ${endpoint}`);
                const response = await fetch(`${serverUrl}${endpoint}`, {
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
                    success = true;
                    break;
                } else {
                    console.log(`❌ Endpoint ${endpoint} failed: ${response.status}`);
                }
            } catch (error) {
                console.log(`❌ Error with endpoint ${endpoint}: ${error.message}`);
            }
        }

        if (!success) {
            console.log('⚠️ All webhook configuration endpoints failed, checking current status...');
        }

        // Check current webhook status
        const statusEndpoints = [
            `/webhook/${instanceId}`,
            `/${instanceId}/webhook/find`,
            `/instance/${instanceId}/webhook/find`
        ];

        for (const endpoint of statusEndpoints) {
            try {
                const statusResponse = await fetch(`${serverUrl}${endpoint}`, {
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
                    break;
                }
            } catch (error) {
                // Continue to next endpoint
            }
        }

    } catch (error) {
        console.error('❌ Error configuring webhook:', error.message);
    }
}

configureWebhookEvents();