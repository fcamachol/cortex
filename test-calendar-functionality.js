/**
 * TEST CALENDAR FUNCTIONALITY
 * Tests the complete calendar automation pipeline
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

async function testCalendarEvent() {
    console.log('🗓️ TESTING CALENDAR EVENT CREATION');
    console.log('====================================');
    
    // Step 1: Send calendar message
    const messageData = {
        key: {
            remoteJid: '15103165094@s.whatsapp.net',
            fromMe: false,
            id: `calendar-test-${Date.now()}`
        },
        message: {
            conversation: 'Evento calendario hoy a las 6:30 PM para reunión con cliente'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Test User'
    };
    
    console.log('📤 Step 1: Sending calendar message...');
    await sendWebhook('messages.upsert', messageData);
    
    // Step 2: Send calendar reaction
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
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 4: Check for created events
    console.log('🔍 Step 4: Checking created events...');
    try {
        const response = await fetch('http://localhost:5000/api/calendar/events');
        if (response.ok) {
            const events = await response.json();
            console.log(`📅 Found ${events.length} total events`);
            
            // Look for recent events (within last 5 minutes)
            const recentEvents = events.filter(event => {
                const eventTime = new Date(event.created_at);
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                return eventTime > fiveMinutesAgo;
            });
            
            if (recentEvents.length > 0) {
                console.log('✅ SUCCESS: Calendar event created!');
                recentEvents.forEach(event => {
                    console.log(`   📅 Event: ${event.title}`);
                    console.log(`   🕕 Time: ${event.start_time}`);
                    console.log(`   📍 Location: ${event.location_details || 'No location'}`);
                });
            } else {
                console.log('❌ No recent calendar events found');
            }
        } else {
            console.log(`❌ Failed to fetch events: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Error checking events:', error.message);
    }
}

// Run the test
testCalendarEvent().catch(console.error);