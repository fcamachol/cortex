import fetch from 'node-fetch';

async function testGroupsWebhookConfiguration() {
    const instanceId = 'instance-1750433520122';
    const apiKey = '28AACF7E-8C0C-42D1-8139-E47418746C55';
    const serverUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';

    try {
        // Test different webhook configuration endpoints that might work
        const configEndpoints = [
            '/webhook/set',
            '/webhook',
            '/instance/webhook/set',
            '/instance/webhook'
        ];

        const webhookConfig = {
            url: `https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/${instanceId}`,
            enabled: true,
            webhookUrl: `https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/${instanceId}`,
            events: [
                "APPLICATION_STARTUP",
                "QRCODE_UPDATED", 
                "MESSAGES_SET",
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "MESSAGES_DELETE",
                "SEND_MESSAGE",
                "CONTACTS_SET",
                "CONTACTS_UPSERT", 
                "CONTACTS_UPDATE",
                "PRESENCE_UPDATE",
                "CHATS_SET",
                "CHATS_UPSERT",
                "CHATS_UPDATE", 
                "CHATS_DELETE",
                "GROUPS_UPSERT",
                "GROUP_UPDATE",
                "GROUP_PARTICIPANTS_UPDATE",
                "CONNECTION_UPDATE"
            ]
        };

        console.log(`Testing webhook configuration for instance: ${instanceId}`);
        
        for (const endpoint of configEndpoints) {
            try {
                const url = `${serverUrl}${endpoint}/${instanceId}`;
                console.log(`Trying: ${url}`);
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'apikey': apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(webhookConfig)
                });

                const responseText = await response.text();
                console.log(`Response from ${endpoint}: ${response.status}`);
                console.log(`Body: ${responseText}`);
                
                if (response.ok) {
                    console.log(`✅ Successfully configured webhook via ${endpoint}`);
                    break;
                }
            } catch (error) {
                console.log(`Error with ${endpoint}: ${error.message}`);
            }
        }

        // Try to get current webhook configuration
        const statusEndpoints = [
            '/webhook/find',
            '/instance/webhook/find',
            '/webhook/status'
        ];

        for (const endpoint of statusEndpoints) {
            try {
                const url = `${serverUrl}${endpoint}/${instanceId}`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'apikey': apiKey,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const status = await response.json();
                    console.log(`\nCurrent webhook status via ${endpoint}:`);
                    console.log(JSON.stringify(status, null, 2));
                    break;
                }
            } catch (error) {
                // Continue to next endpoint
            }
        }

    } catch (error) {
        console.error('Error testing webhook configuration:', error);
    }
}

testGroupsWebhookConfiguration();