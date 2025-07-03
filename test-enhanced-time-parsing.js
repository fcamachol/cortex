/**
 * TEST ENHANCED TIME PARSING WITH CONTEXT
 * Tests the improved Spanish evening time detection
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'http://localhost:5000/webhook/whatsapp';

async function sendWebhook(eventType, data) {
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event: eventType,
                instance: 'live-test-1750199771',
                data: data
            })
        });
        
        if (!response.ok) {
            console.error(`❌ Webhook failed: ${response.status}`);
            return false;
        }
        console.log(`✅ ${eventType} webhook sent successfully`);
        return true;
    } catch (error) {
        console.error(`❌ Webhook error:`, error.message);
        return false;
    }
}

async function testEnhancedTimeParsing() {
    console.log('🕐 TESTING ENHANCED TIME PARSING WITH CONTEXT');
    console.log('=============================================');
    console.log(`Current time: ${new Date().toLocaleTimeString()}`);
    
    // Test case: Message sent in evening about 6:30 (should be PM)
    const messageData = {
        key: {
            remoteJid: '15103165094@s.whatsapp.net',
            fromMe: false,
            id: `time-context-test-${Date.now()}`
        },
        message: {
            conversation: 'Evento importante hoy 6:30 por meet con cliente'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Test User'
    };
    
    console.log('📤 Step 1: Sending calendar message...');
    console.log(`   Content: "${messageData.message.conversation}"`);
    await sendWebhook('messages.upsert', messageData);
    
    // Send calendar reaction
    const reactionData = {
        key: messageData.key,
        message: {
            reactionMessage: {
                text: '📅',
                senderTimestampMs: Date.now()
            }
        },
        messageTimestamp: Math.floor(Date.now() / 1000)
    };
    
    console.log('📤 Step 2: Sending 📅 reaction...');
    await sendWebhook('messages.reaction', reactionData);
    
    console.log('⏳ Step 3: Waiting for processing...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Check for created events
    console.log('🔍 Step 4: Checking for correct time parsing...');
    try {
        const response = await fetch('http://localhost:5000/api/calendar/events');
        if (response.ok) {
            const events = await response.json();
            
            // Look for the most recent event
            const recentEvents = events
                .filter(event => new Date(event.created_at) > new Date(Date.now() - 2 * 60 * 1000))
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            if (recentEvents.length > 0) {
                const event = recentEvents[0];
                const startTime = new Date(event.start_time);
                const hour = startTime.getHours();
                const minute = startTime.getMinutes();
                
                console.log('✅ Event created!');
                console.log(`   Title: ${event.title}`);
                console.log(`   Start time: ${startTime.toLocaleTimeString()}`);
                console.log(`   Hour: ${hour}, Minute: ${minute}`);
                
                // Check if it's correctly parsed as PM (18:30 = 6:30 PM)
                if (hour === 18 && minute === 30) {
                    console.log('🎉 SUCCESS: Time correctly parsed as 6:30 PM!');
                    console.log('   ✅ Context-aware time parsing is working');
                } else if (hour === 6 && minute === 30) {
                    console.log('❌ FAILED: Time still parsed as 6:30 AM');
                    console.log('   ❌ Context logic needs improvement');
                } else {
                    console.log(`❓ UNEXPECTED: Time parsed as ${hour}:${minute}`);
                }
            } else {
                console.log('❌ No recent events found');
            }
        } else {
            console.log(`❌ Failed to fetch events: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Error checking events:', error.message);
    }
}

// Run the test
testEnhancedTimeParsing().catch(console.error);