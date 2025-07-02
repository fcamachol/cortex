/**
 * TEST REAL CALENDAR REACTION
 * Tests calendar event creation from real message with 📅 reaction
 */

async function testRealCalendarReaction() {
    console.log('🚀 TESTING REAL CALENDAR REACTION PROCESSING');
    console.log('═══════════════════════════════════════════════════');
    
    // Real message: "Comemos mañana de 2-4 en la casa"
    const messageId = '3A723A7C7CBD2A5FBD64';
    const instanceName = 'instance-1750433520122';
    
    try {
        console.log('🎯 Sending 📅 reaction to real message:', messageId);
        
        const reactionData = {
            data: {
                reaction: {
                    text: '📅',
                    key: {
                        id: messageId,
                        fromMe: false,
                        remoteJid: '5214611239748@s.whatsapp.net'
                    }
                },
                key: {
                    id: messageId,
                    fromMe: false,
                    remoteJid: '5214611239748@s.whatsapp.net'
                },
                instanceId: instanceName
            },
            event: 'messages.reaction',
            instanceId: instanceName,
            instanceName: instanceName,
            reliabilityId: `${Date.now()}-test-real-reaction`
        };
        
        const response = await fetch('http://localhost:5000/api/evolution/webhook/instance-1750433520122/messages-reaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reactionData)
        });
        
        if (response.ok) {
            console.log('🎯 Reaction sent successfully!');
            console.log('📅 Expected: Calendar event for "Comemos mañana de 2-4 en la casa"');
            console.log('⏰ Expected: 2:00 PM - 4:00 PM time range');
            console.log('📍 Expected: Location "casa"');
            console.log('🤖 Expected: Google Meet detection (familia keyword)');
        } else {
            console.error('❌ Failed to send reaction:', response.status);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🔍 Check server logs for NLP processing');
    console.log('📅 Check cortex_scheduling.events table for calendar event');
}

testRealCalendarReaction();
