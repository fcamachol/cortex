import fetch from 'node-fetch';

async function testReactorDebug() {
    const baseUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122';
    
    // Test with realistic Evolution API reaction payload based on real webhook structure
    const reactionPayload = {
        event: 'messages.upsert',
        instance: 'instance-1750433520122',
        data: {
            key: {
                id: 'REACTION_DEBUG_TEST_001',
                remoteJid: '5215579188699@s.whatsapp.net',
                fromMe: true,
                // participant field might not exist for direct chats
            },
            message: {
                reactionMessage: {
                    text: '🔧',
                    key: {
                        id: 'TARGET_MESSAGE_ID_001',
                        remoteJid: '5215579188699@s.whatsapp.net',
                        fromMe: false
                    }
                }
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: 'Test User'
        },
        destination: baseUrl,
        date_time: new Date().toISOString(),
        sender: '5215579188699@s.whatsapp.net',
        server_url: 'https://evolution-api-evolution-api.vuswn0.easypanel.host',
        apikey: '28AACF7E-8C0C-42D1-8139-E47418746C55'
    };

    console.log('Testing reactor JID debug extraction...\n');

    try {
        const response = await fetch(`${baseUrl}/messages-upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reactionPayload)
        });

        console.log(`Response: ${response.status} - ${await response.text()}`);
    } catch (error) {
        console.log(`Error: ${error.message}`);
    }
}

testReactorDebug();