/**
 * TEST FIXED CALENDAR AUTOMATION AFTER FIELD MAPPING FIXES
 * Tests the complete calendar event creation automation after fixing database field name mismatches
 */

async function sendReactionWebhook() {
    const webhookData = {
        event: "messages.upsert",
        instance: "live-test-1750199771",
        data: {
            key: {
                remoteJid: "5215579188699@s.whatsapp.net",
                fromMe: false,
                id: "REACTION_TEST_" + Date.now(),
                participant: "5215579188699@s.whatsapp.net"
            },
            message: {
                reactionMessage: {
                    text: "📅",
                    key: {
                        remoteJid: "5215579188699@s.whatsapp.net",
                        fromMe: true,
                        id: "3AA3BAAF8A5B9610E00E"
                    }
                }
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: "Test User"
        },
        destination: "https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev",
        date_time: new Date().toISOString(),
        sender: "5215579188699@s.whatsapp.net"
    };

    console.log('🧪 Sending 📅 reaction webhook to test calendar automation...');
    
    try {
        const response = await fetch('http://localhost:5000/api/evolution/webhook/live-test-1750199771/messages-upsert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookData)
        });

        console.log(`📡 Webhook response: ${response.status}`);
        
        if (response.ok) {
            console.log('✅ Webhook sent successfully');
            
            // Wait a bit for processing
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check if calendar event was created
            console.log('🔍 Checking if calendar event was created...');
            
            const eventsResponse = await fetch('http://localhost:5000/api/calendar/events');
            if (eventsResponse.ok) {
                const events = await eventsResponse.json();
                console.log(`📅 Found ${events.length} calendar events in database`);
                
                // Look for recently created events
                const recentEvents = events.filter(event => {
                    const eventTime = new Date(event.created_at || event.createdAt);
                    const now = new Date();
                    const diff = now - eventTime;
                    return diff < 60000; // Within last minute
                });
                
                if (recentEvents.length > 0) {
                    console.log('🎉 SUCCESS! Calendar automation is working');
                    console.log('📅 Recent events created:');
                    recentEvents.forEach(event => {
                        console.log(`  - ${event.title || event.event_title}`);
                        console.log(`  - Start: ${event.start_time || event.startTime}`);
                        console.log(`  - Location: ${event.location || event.location_details || 'None'}`);
                    });
                } else {
                    console.log('❌ No recent calendar events found - automation may not be working');
                }
            } else {
                console.log('⚠️ Could not fetch calendar events');
            }
            
        } else {
            console.log('❌ Webhook failed');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

sendReactionWebhook();