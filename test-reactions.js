import fetch from 'node-fetch';

async function testReactionDetection() {
    const baseUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122';
    
    // Test reaction in messages.upsert with Evolution API nested structure
    const reactionUpsertPayload = {
        event: 'messages.upsert',
        instance: 'instance-1750433520122',
        data: {
            key: {
                id: 'REACTION_TEST_MESSAGE_001',
                remoteJid: '5215579188699@s.whatsapp.net',
                fromMe: false,
                participant: '5215579188699@s.whatsapp.net'
            },
            message: {
                reactionMessage: {
                    text: '👍',
                    key: {
                        id: 'ORIGINAL_MESSAGE_FOR_REACTION',
                        remoteJid: '5215579188699@s.whatsapp.net',
                        fromMe: false,
                        participant: '5214422501780@s.whatsapp.net'
                    }
                }
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: 'Reactor User'
        },
        destination: baseUrl,
        date_time: new Date().toISOString(),
        sender: '5215579188699@s.whatsapp.net'
    };

    // Test reaction in messages.update format
    const reactionUpdatePayload = {
        event: 'messages.update',
        instance: 'instance-1750433520122',
        data: {
            message: {
                reactionMessage: {
                    text: '❤️',
                    key: {
                        id: 'ANOTHER_MESSAGE_FOR_REACTION',
                        remoteJid: '5215579188699@s.whatsapp.net',
                        fromMe: true
                    }
                }
            },
            key: {
                id: 'REACTION_UPDATE_TEST_001',
                remoteJid: '5215579188699@s.whatsapp.net',
                fromMe: false,
                participant: '5214422501780@s.whatsapp.net'
            },
            messageTimestamp: Math.floor(Date.now() / 1000)
        },
        destination: baseUrl,
        date_time: new Date().toISOString(),
        sender: '5214422501780@s.whatsapp.net'
    };

    console.log('Testing reaction detection fixes...\n');

    // Test reactions in messages.upsert
    try {
        console.log('Testing reaction in messages.upsert...');
        const response1 = await fetch(`${baseUrl}/messages-upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reactionUpsertPayload)
        });

        console.log(`Reaction Upsert: ${response1.status} - ${await response1.text()}`);
    } catch (error) {
        console.log(`Reaction Upsert Error: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    // Test reactions in messages.update
    try {
        console.log('Testing reaction in messages.update...');
        const response2 = await fetch(`${baseUrl}/messages-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reactionUpdatePayload)
        });

        console.log(`Reaction Update: ${response2.status} - ${await response2.text()}`);
    } catch (error) {
        console.log(`Reaction Update Error: ${error.message}`);
    }

    console.log('\nReaction detection testing completed!');
}

testReactionDetection();