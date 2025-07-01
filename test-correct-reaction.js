/**
 * TEST CORRECT REACTION FROM INSTANCE OWNER
 * This should create a task because it comes from the correct instance owner
 */

import fetch from 'node-fetch';

async function testCorrectReaction() {
    console.log('🧪 Testing reaction from correct instance owner');
    
    try {
        // Step 1: Create a test message from the correct instance owner
        const messagePayload = {
            event: "messages.upsert",
            instance: "live-test-1750199771", 
            data: {
                key: {
                    remoteJid: "5215579188699@s.whatsapp.net", // This matches the instance owner
                    fromMe: false,
                    id: "CORRECT_TEST_MSG_" + Date.now()
                },
                message: {
                    conversation: "Testing correct reaction - " + new Date().toISOString()
                },
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: "Instance Owner"
            }
        };
        
        console.log('📤 Creating message from instance owner');
        const messageResponse = await fetch('http://localhost:5000/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messagePayload)
        });
        
        console.log('📥 Message creation:', messageResponse.status);
        
        // Step 2: Wait, then react from the SAME user (instance owner)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const reactionPayload = {
            event: "messages.update",
            instance: "live-test-1750199771",
            data: {
                key: {
                    remoteJid: "5215579188699@s.whatsapp.net", // Same as instance owner
                    fromMe: false,
                    id: "REACTION_FROM_OWNER_" + Date.now()
                },
                message: {
                    reactionMessage: {
                        key: {
                            remoteJid: "5215579188699@s.whatsapp.net", 
                            fromMe: false,
                            id: messagePayload.data.key.id // React to our test message
                        },
                        text: "✔️", // This should trigger the action rule
                        senderTimestampMs: Date.now()
                    }
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
            }
        };
        
        console.log('📤 Adding ✔️ reaction from instance owner');
        console.log('🎯 Reacting to message:', messagePayload.data.key.id);
        console.log('👤 Reactor JID:', reactionPayload.data.key.remoteJid);
        
        const reactionResponse = await fetch('http://localhost:5000/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reactionPayload)
        });
        
        console.log('📥 Reaction response:', reactionResponse.status);
        console.log('✅ This should create a task since reactor matches instance owner');
        console.log('⏰ Check server logs for task creation debug output');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testCorrectReaction();