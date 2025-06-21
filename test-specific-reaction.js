const axios = require('axios');

async function testSpecificReaction() {
    console.log('Testing specific configured reaction (✅)...');
    
    // Test with ✅ reaction which should trigger "Task from Check Mark Reaction"
    const checkMarkReactionPayload = {
        event: "messages.upsert",
        instance: "instance-1750433520122",
        data: {
            data: [{
                key: {
                    remoteJid: "5215579188699@s.whatsapp.net",
                    id: "TEST_MESSAGE_FOR_CHECKMARK"
                },
                message: {
                    reactionMessage: {
                        key: {
                            remoteJid: "5215579188699@s.whatsapp.net",
                            id: "TEST_MESSAGE_FOR_CHECKMARK"
                        },
                        text: "✅"
                    }
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
            }]
        },
        destination: "http://localhost:5000/api/evolution/webhook/instance-1750433520122",
        date_time: new Date().toISOString(),
        sender: "5215579188699@s.whatsapp.net"
    };

    try {
        const response = await axios.post('http://localhost:5000/api/evolution/webhook/instance-1750433520122/messages-upsert', checkMarkReactionPayload);
        console.log('Checkmark Reaction:', response.status, '-', JSON.stringify(response.data));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testSpecificReaction();
