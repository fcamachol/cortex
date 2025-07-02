/**
 * COMPLETE CALENDAR WORKFLOW TEST
 * Tests the entire process: Reaction → Rule Lookup → NLP Processing → Calendar Event Creation
 */

async function sendWebhook(eventType, data) {
    const webhookData = {
        ...data,
        event: eventType,
        instanceId: data.instanceName,
        instanceName: data.instanceName,
        reliabilityId: `${Date.now()}-calendar-test`
    };
    
    const response = await fetch(`http://localhost:5000/api/evolution/webhook/${data.instanceName}/${eventType.replace('.', '-')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookData)
    });
    
    return response.ok;
}

async function testCompleteCalendarWorkflow() {
    console.log('🚀 TESTING COMPLETE CALENDAR WORKFLOW');
    console.log('═══════════════════════════════════════════════════');
    
    // Test message: "Comemos mañana de 2-4 en la casa"
    const messageId = '3A723A7C7CBD2A5FBD64';
    const instanceName = 'instance-1750433520122';
    
    try {
        console.log('📅 Testing reaction to: "Comemos mañana de 2-4 en la casa"');
        console.log('🎯 Message ID:', messageId);
        console.log('📱 Instance:', instanceName);
        
        // Send reaction webhook
        const reactionSuccess = await sendWebhook('messages.reaction', {
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
                }
            },
            instanceName: instanceName
        });
        
        if (reactionSuccess) {
            console.log('✅ Reaction webhook sent successfully');
            console.log('⏳ Waiting 5 seconds for action processing...');
            
            // Wait for action processing
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            console.log('🔍 EXPECTED RESULTS:');
            console.log('  📅 Calendar event created with NLP analysis');
            console.log('  📝 Title: "Comemos" (extracted from content)');
            console.log('  ⏰ Time: 2:00 PM - 4:00 PM (time range parsing)');
            console.log('  📍 Location: "casa" (location detection)');
            console.log('  🤖 Google Meet: Should be enabled (familia context)');
            console.log('  📊 NLP confidence > 0.7');
            
        } else {
            console.error('❌ Failed to send reaction webhook');
        }
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
    
    console.log('═══════════════════════════════════════════════════');
    console.log('🔍 Next steps:');
    console.log('  1. Check server logs for NLP processing');
    console.log('  2. Verify cortex_scheduling.events table');
    console.log('  3. Check actions.nlp_processing_log table');
    console.log('  4. Verify action_queue completion status');
}

testCompleteCalendarWorkflow();
