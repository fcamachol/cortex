/**
 * Test Evolution API connectivity and health
 */
import fetch from 'node-fetch';

async function testEvolutionApiHealth() {
    try {
        console.log('🔍 Testing Evolution API Health...\n');

        const apiKey = process.env.EVOLUTION_API_KEY;
        const baseUrl = process.env.EVOLUTION_API_URL || 'https://api.evolutionapi.com';
        
        if (!apiKey) {
            console.log('❌ EVOLUTION_API_KEY not found in environment');
            return;
        }

        console.log(`🌐 Testing API at: ${baseUrl}`);
        console.log(`🔑 Using API key: ${apiKey.substring(0, 8)}...`);

        // Test basic API health
        try {
            const healthResponse = await fetch(`${baseUrl}/manager/findInstances`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey
                }
            });

            console.log(`\n📡 API Health Check: ${healthResponse.status} ${healthResponse.statusText}`);
            
            if (healthResponse.ok) {
                const instances = await healthResponse.json();
                console.log(`✅ Found ${Array.isArray(instances) ? instances.length : 0} instances`);
                
                if (Array.isArray(instances)) {
                    instances.forEach(instance => {
                        console.log(`  - ${instance.instanceName}: ${instance.state || 'unknown state'}`);
                    });
                }
            } else {
                const errorText = await healthResponse.text();
                console.log(`❌ API Error: ${errorText}`);
            }
        } catch (healthError) {
            console.log(`❌ API Connection Error: ${healthError.message}`);
        }

        // Test webhook endpoints
        console.log('\n🔗 Testing Webhook Endpoints:');
        const webhookUrls = [
            'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122',
            'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/live-test-1750199771'
        ];

        for (const url of webhookUrls) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    timeout: 5000
                });
                console.log(`  ${url}: ${response.status} ${response.statusText}`);
            } catch (error) {
                console.log(`  ${url}: ❌ ${error.message}`);
            }
        }

        console.log('\n✅ Evolution API health test complete');

    } catch (error) {
        console.error('❌ Error testing Evolution API:', error);
    }
}

testEvolutionApiHealth();