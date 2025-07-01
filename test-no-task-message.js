/**
 * SIMPLE TEST: Send message without reaction to verify no task is created
 */

import fetch from 'node-fetch';

async function testNoTaskMessage() {
    console.log('🧪 Testing that regular messages do NOT create tasks');
    
    try {
        const messagePayload = {
            event: "messages.upsert",
            instance: "live-test-1750199771", 
            data: {
                key: {
                    remoteJid: "5214421055671@s.whatsapp.net",
                    fromMe: false,
                    id: "NO_TASK_REGRESSION_TEST_" + Date.now()
                },
                message: {
                    conversation: "Regular message should NOT create task - test " + Date.now()
                },
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: "Test User"
            }
        };
        
        console.log('📤 Sending regular message');
        console.log('📝 Content:', messagePayload.data.message.conversation);
        
        const response = await fetch('http://localhost:5000/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messagePayload)
        });
        
        console.log('📥 Response status:', response.status);
        console.log('✅ Message sent successfully');
        console.log('🔍 Check server logs and database to verify NO task was created');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testNoTaskMessage();