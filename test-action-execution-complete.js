/**
 * TEST COMPLETE ACTION EXECUTION PIPELINE
 * Tests the complete fixed webhook → reaction → action → task creation flow
 */

async function testCompleteActionExecution() {
    console.log('🧪 Testing complete action execution pipeline...\n');
    
    try {
        const response = await fetch('http://localhost:5000/api/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event: 'messages.reaction',
                instance: 'live-test-1750199771',
                data: {
                    key: {
                        remoteJid: '5215579188699@s.whatsapp.net',
                        fromMe: false,
                        id: `TEST-COMPLETE-${Date.now()}`
                    },
                    reaction: {
                        text: '✅',
                        key: {
                            remoteJid: '5215579188699@s.whatsapp.net',
                            fromMe: false,
                            id: `TEST-COMPLETE-${Date.now()}`
                        }
                    },
                    messageTimestamp: Math.floor(Date.now() / 1000)
                }
            })
        });

        if (response.ok) {
            console.log('✅ Webhook sent successfully');
            console.log('📋 Expected outcome:');
            console.log('   1. Reaction stored in whatsapp.message_reactions');
            console.log('   2. ActionService.processReaction triggered');
            console.log('   3. Rule matched for ✅ reaction');
            console.log('   4. Task created with status "todo" (not "pending")');
            console.log('   5. SSE notification sent');
            
            // Wait a moment for processing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('\n🔍 Check the server logs for:');
            console.log('   - "Executing simple action: create_task"');
            console.log('   - "✅ Task created from reaction: New task"');
            console.log('   - No database constraint violations');
            
        } else {
            console.error('❌ Webhook failed:', response.status);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testCompleteActionExecution();