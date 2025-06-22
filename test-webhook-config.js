/**
 * Test webhook configuration on existing instance
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

async function testWebhookConfiguration() {
    const instanceName = 'live-test-1750199771';
    const webhookUrl = `https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/${instanceName}`;

    console.log(`🔧 Testing webhook configuration for instance: ${instanceName}`);
    console.log(`📡 Webhook URL: ${webhookUrl}`);

    try {
        const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                enabled: true,
                url: webhookUrl,
                webhookByEvents: true,
                webhookBase64: true,
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
                    "CONNECTION_UPDATE",
                    "CALL",
                    "NEW_JWT_TOKEN",
                    "TYPEBOT_START",
                    "TYPEBOT_CHANGE_STATUS"
                ]
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log(`✅ Webhook configured successfully!`);
            console.log(`📋 Response:`, JSON.stringify(result, null, 2));
        } else {
            console.error(`❌ Webhook configuration failed:`, result);
        }

        return response.ok;

    } catch (error) {
        console.error(`💥 Error configuring webhook:`, error.message);
        return false;
    }
}

// Test instance creation approach
async function testInstanceCreation() {
    const instanceName = `test-instance-${Date.now()}`;
    
    console.log(`🚀 Testing instance creation: ${instanceName}`);

    try {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                instanceName: instanceName,
                qrcode: true
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log(`✅ Instance created successfully!`);
            console.log(`📋 Response:`, JSON.stringify(result, null, 2));
            
            // Now configure webhook
            const webhookUrl = `https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/${instanceName}`;
            await testWebhookForInstance(instanceName, webhookUrl);
            
        } else {
            console.error(`❌ Instance creation failed:`, result);
        }

        return response.ok;

    } catch (error) {
        console.error(`💥 Error creating instance:`, error.message);
        return false;
    }
}

async function testWebhookForInstance(instanceName, webhookUrl) {
    console.log(`🔧 Configuring webhook for new instance: ${instanceName}`);
    
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                enabled: true,
                url: webhookUrl,
                webhookByEvents: true,
                webhookBase64: true,
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
                    "CONNECTION_UPDATE",
                    "CALL",
                    "NEW_JWT_TOKEN",
                    "TYPEBOT_START",
                    "TYPEBOT_CHANGE_STATUS"
                ]
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log(`✅ Webhook configured for new instance!`);
            console.log(`📋 Response:`, JSON.stringify(result, null, 2));
        } else {
            console.error(`❌ Webhook configuration failed for new instance:`, result);
        }

    } catch (error) {
        console.error(`💥 Error configuring webhook for new instance:`, error.message);
    }
}

async function main() {
    console.log('🧪 Starting webhook configuration tests...');
    
    // Test 1: Configure webhook on existing instance
    console.log('\n--- Test 1: Configure webhook on existing instance ---');
    await testWebhookConfiguration();
    
    // Test 2: Create new instance and configure webhook
    console.log('\n--- Test 2: Create new instance and configure webhook ---');
    await testInstanceCreation();
}

main().catch(console.error);