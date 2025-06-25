/**
 * Test calendar event creation from reactions in production deployment
 */

async function testCalendarReactionInProduction() {
    try {
        console.log('🧪 Testing calendar event creation from 📅 reaction...');
        
        // Send a webhook with 📅 reaction to trigger calendar event creation
        const webhookData = {
            instanceId: 'instance-1750433520122',
            event: 'messages.reaction',
            data: {
                instanceId: 'instance-1750433520122',
                messageId: `TEST_${Date.now()}`,
                chatId: '5214611239748@s.whatsapp.net',
                reactorJid: '5214611239748@s.whatsapp.net',
                reaction: '📅',
                timestamp: new Date().toISOString(),
                fromMe: false
            }
        };
        
        console.log('📤 Sending webhook for calendar reaction test...');
        
        const response = await fetch('http://localhost:5000/webhook/evolution', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.EVOLUTION_API_KEY || 'default-key'
            },
            body: JSON.stringify(webhookData)
        });
        
        if (response.ok) {
            console.log('✅ Webhook sent successfully');
            console.log('📅 Calendar event should be created in CRM schema');
            
            // Wait a moment for processing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if calendar event was created
            const checkResponse = await fetch('http://localhost:5000/api/crm/calendar-events', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (checkResponse.ok) {
                const events = await checkResponse.json();
                console.log('📋 Current calendar events:', events.length);
                
                // Look for recently created events
                const recentEvents = events.filter(event => {
                    const eventTime = new Date(event.created_at);
                    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                    return eventTime > fiveMinutesAgo;
                });
                
                if (recentEvents.length > 0) {
                    console.log('🎉 SUCCESS: Calendar event created from 📅 reaction!');
                    console.log('📅 Event details:', recentEvents[0]);
                } else {
                    console.log('❌ No recent calendar events found');
                }
            } else {
                console.log('⚠️ Could not check calendar events:', checkResponse.status);
            }
            
        } else {
            console.error('❌ Failed to send webhook:', response.status);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testCalendarReactionInProduction();