/**
 * TEST STATUS CONFIGURATION SYSTEM
 * Tests that status values configured in action rules properly create tasks with correct status
 */

async function testStatusConfiguration() {
    console.log('🧪 Testing status configuration system...\n');
    
    try {
        // Test 1: Update an existing rule to have status "in_progress" in action_config
        console.log('1. Updating rule to use "in_progress" status...');
        
        const updateResponse = await fetch('http://localhost:5000/api/actions/rules/98b681ee-d30e-4bbf-82e1-2c1bf23cef68', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: '98b681ee-d30e-4bbf-82e1-2c1bf23cef68',
                name: 'Personal task from ✔️ reaction',
                description: 'Personal task with in_progress status',
                isActive: true,
                triggerType: 'reaction',
                actionType: 'create_task',
                triggerConditions: {
                    reactions: ['✔️']
                },
                actionConfig: {
                    title: 'New task from status test',
                    description: 'Test task with specific status',
                    priority: 'medium',
                    status: 'in_progress'  // This should be used for task creation
                },
                performerFilter: 'user_only',
                instanceFilterType: 'all',
                selectedInstances: [],
                cooldownMinutes: 0,
                maxExecutionsPerDay: 100
            })
        });

        if (updateResponse.ok) {
            console.log('✅ Rule updated successfully');
            
            // Test 2: Send test reaction webhook
            console.log('2. Sending test reaction webhook...');
            
            const webhookResponse = await fetch('http://localhost:5000/api/webhook/live-test-1750199771', {
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
                            id: `STATUS-TEST-${Date.now()}`
                        },
                        reaction: {
                            text: '✔️',
                            key: {
                                remoteJid: '5215579188699@s.whatsapp.net',
                                fromMe: false,
                                id: `STATUS-TEST-${Date.now()}`
                            }
                        },
                        messageTimestamp: Math.floor(Date.now() / 1000)
                    }
                })
            });

            if (webhookResponse.ok) {
                console.log('✅ Webhook sent successfully');
                console.log('📋 Expected: Task created with status "in_progress"');
                console.log('⏳ Waiting 3 seconds for processing...');
                
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                console.log('\n🔍 Check server logs for:');
                console.log('   - "status: in_progress" in task creation');
                console.log('   - "✅ Task created from reaction: New task from status test"');
                console.log('   - No database constraint violations');
                
            } else {
                console.error('❌ Webhook failed:', webhookResponse.status);
            }
            
        } else {
            console.error('❌ Rule update failed:', updateResponse.status);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testStatusConfiguration();