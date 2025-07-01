/**
 * TEST REACTION-TO-TASK CREATION WITH DEBUG
 * Simulates a real reaction to see the exact data flow
 */

import fetch from 'node-fetch';

async function testReactionTaskCreation() {
    console.log('🧪 Testing reaction-to-task creation with debug output');
    
    try {
        // Simulate a reaction webhook from the Personal instance (5215579188699@s.whatsapp.net)
        const webhookPayload = {
            event: "messages.update",
            instance: "live-test-1750199771",
            data: {
                key: {
                    remoteJid: "5215579188699@s.whatsapp.net",
                    fromMe: false,
                    id: "TEST_MESSAGE_" + Date.now()
                },
                message: {
                    reactionMessage: {
                        key: {
                            remoteJid: "5215579188699@s.whatsapp.net",
                            fromMe: false,
                            id: "ORIGINAL_MSG_" + Date.now()
                        },
                        text: "✔️",
                        senderTimestampMs: Date.now()
                    }
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
            }
        };
        
        console.log('📤 Sending webhook payload:', JSON.stringify(webhookPayload, null, 2));
        
        // Send to webhook endpoint
        const response = await fetch('http://localhost:5000/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookPayload)
        });
        
        console.log('📥 Webhook response:', response.status, response.statusText);
        
        if (response.ok) {
            console.log('✅ Webhook processed successfully');
            console.log('⏳ Check server logs for debug output showing task creation process');
        } else {
            const errorText = await response.text();
            console.error('❌ Webhook failed:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Create a test message first, then react to it
async function createTestMessageAndReact() {
    console.log('🧪 Creating test message and reaction scenario');
    
    try {
        // Step 1: Create a test message
        const messagePayload = {
            event: "messages.upsert",
            instance: "live-test-1750199771", 
            data: {
                key: {
                    remoteJid: "5215579188699@s.whatsapp.net",
                    fromMe: false,
                    id: "TEST_MSG_FOR_REACTION_" + Date.now()
                },
                message: {
                    conversation: "Test message for reaction - " + new Date().toISOString()
                },
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: "Test User"
            }
        };
        
        console.log('📤 Step 1: Creating test message');
        const messageResponse = await fetch('http://localhost:5000/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messagePayload)
        });
        
        console.log('📥 Message creation response:', messageResponse.status);
        
        // Step 2: Wait a moment, then react to the message
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const reactionPayload = {
            event: "messages.update",
            instance: "live-test-1750199771",
            data: {
                key: {
                    remoteJid: "5215579188699@s.whatsapp.net",
                    fromMe: false,
                    id: "REACTION_" + Date.now()
                },
                message: {
                    reactionMessage: {
                        key: {
                            remoteJid: "5215579188699@s.whatsapp.net",
                            fromMe: false,
                            id: messagePayload.data.key.id // React to the message we just created
                        },
                        text: "✔️",
                        senderTimestampMs: Date.now()
                    }
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
            }
        };
        
        console.log('📤 Step 2: Adding reaction to test message');
        console.log('🎯 Reacting to message ID:', messagePayload.data.key.id);
        
        const reactionResponse = await fetch('http://localhost:5000/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reactionPayload)
        });
        
        console.log('📥 Reaction response:', reactionResponse.status);
        console.log('✅ Test completed - check server logs for debug output');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the comprehensive test
createTestMessageAndReact();