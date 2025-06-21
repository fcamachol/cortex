import fetch from 'node-fetch';

async function testCheckmarkReaction() {
    console.log('Testing ✅ reaction with correct payload structure...');
    
    const checkmarkPayload = {
        event: "messages.upsert",
        instance: "instance-1750433520122",
        data: [{
            key: {
                remoteJid: "5215579188699@s.whatsapp.net",
                id: "TEST_MESSAGE_CHECKMARK",
                participant: "5215579188699@s.whatsapp.net"
            },
            message: {
                reactionMessage: {
                    key: {
                        remoteJid: "5215579188699@s.whatsapp.net",
                        id: "TEST_MESSAGE_CHECKMARK"
                    },
                    text: "✅"
                }
            },
            messageTimestamp: Math.floor(Date.now() / 1000)
        }],
        destination: "http://localhost:5000/api/evolution/webhook/instance-1750433520122",
        date_time: new Date().toISOString(),
        sender: "5215579188699@s.whatsapp.net"
    };

    try {
        const response = await fetch('http://localhost:5000/api/evolution/webhook/instance-1750433520122/messages-upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(checkmarkPayload)
        });
        console.log('✅ Reaction test:', response.status, '-', JSON.stringify(await response.json()));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testCheckmarkReaction();
