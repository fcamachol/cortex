/**
 * TEST GOOGLE MEET INTEGRATION
 * Tests the complete Meet link creation with Google Calendar integration
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

async function testGoogleMeetIntegration() {
    console.log('📹 TESTING GOOGLE MEET INTEGRATION');
    console.log('=================================');
    console.log(`Current time: ${new Date().toLocaleTimeString()}`);
    
    // Test message with clear Meet context and correct time (should be PM)
    const messageData = {
        key: {
            remoteJid: '15103165094@s.whatsapp.net',
            fromMe: false,
            id: `meet-integration-test-${Date.now()}`
        },
        message: {
            conversation: 'Reunión importante mañana 3:00 PM por Google Meet con equipo desarrollo'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Test User'
    };
    
    console.log('📤 Step 1: Sending calendar message with Meet context...');
    console.log(`   Content: "${messageData.message.conversation}"`);
    console.log('   Expected: 3:00 PM time + Google Meet link');
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
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check for created events with Meet links
    console.log('🔍 Step 4: Checking for Google Meet integration...');
    try {
        const response = await fetch('http://localhost:5000/api/calendar/events');
        if (response.ok) {
            const events = await response.json();
            
            // Look for the most recent event
            const recentEvents = events
                .filter(event => new Date(event.created_at) > new Date(Date.now() - 3 * 60 * 1000))
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            if (recentEvents.length > 0) {
                const event = recentEvents[0];
                const startTime = new Date(event.start_time);
                const hour = startTime.getHours();
                
                console.log('✅ Event created!');
                console.log(`   Title: ${event.title}`);
                console.log(`   Start time: ${startTime.toLocaleTimeString()}`);
                console.log(`   Meeting URL: ${event.meeting_url || 'None'}`);
                console.log(`   External ID: ${event.external_event_id || 'None'}`);
                console.log(`   Provider: ${event.calendar_provider || 'local'}`);
                
                // Check time parsing
                if (hour === 15) { // 3:00 PM
                    console.log('✅ Time correctly parsed as 3:00 PM');
                } else {
                    console.log(`❌ Time incorrectly parsed as ${hour}:00 (expected 15:00)`);
                }
                
                // Check Meet link
                if (event.meeting_url && event.meeting_url.includes('meet.google.com')) {
                    console.log('🎉 SUCCESS: Google Meet link created!');
                    console.log(`   Meet URL: ${event.meeting_url}`);
                } else if (event.meeting_url) {
                    console.log(`⚠️ Meeting URL present but not Google Meet: ${event.meeting_url}`);
                } else {
                    console.log('❌ No Google Meet link created');
                }
                
                // Check Google Calendar integration
                if (event.external_event_id && event.calendar_provider === 'google') {
                    console.log('✅ Event synchronized with Google Calendar');
                } else {
                    console.log('⚠️ Event not synchronized with Google Calendar (local only)');
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
testGoogleMeetIntegration().catch(console.error);