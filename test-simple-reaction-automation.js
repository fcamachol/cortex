/**
 * SIMPLE REACTION AUTOMATION TEST
 * Tests ✅ checkmark reaction → task creation flow
 */

import fetch from 'node-fetch';

async function testSimpleReactionAutomation() {
    console.log('🧪 TESTING SIMPLE REACTION AUTOMATION');
    console.log('=' .repeat(40));
    
    try {
        const testMessageId = `test-${Date.now()}`;
        const testChatId = '5214611239748@s.whatsapp.net';
        const instanceName = 'instance-1750433520122';
        
        // Step 1: Send a test message
        console.log('\n📨 Step 1: Sending test message...');
        const messageWebhook = {
            event: 'messages.upsert',
            instance: instanceName,
            data: {
                instanceName: instanceName,
                key: {
                    id: testMessageId,
                    remoteJid: testChatId,
                    fromMe: false
                },
                message: {
                    conversation: 'Test message for automation ✅'
                },
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: 'Test User',
                messageType: 'conversation'
            }
        };
        
        const messageResponse = await fetch(`http://localhost:5000/api/evolution/webhook/${instanceName}/messages-upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageWebhook)
        });
        
        if (messageResponse.ok) {
            console.log('✅ Message webhook sent successfully');
        } else {
            console.log('❌ Message webhook failed:', await messageResponse.text());
            return;
        }
        
        // Wait for message processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Step 2: Send checkmark reaction
        console.log('\n🎯 Step 2: Sending ✅ reaction...');
        const reactionWebhook = {
            event: 'messages.reaction',
            instance: instanceName,
            data: {
                instanceName: instanceName,
                key: {
                    id: `reaction-${Date.now()}`,
                    remoteJid: testChatId,
                    fromMe: false
                },
                reaction: {
                    key: {
                        id: testMessageId,
                        remoteJid: testChatId,
                        fromMe: false
                    },
                    text: '✅',
                    senderTimestampMs: Date.now()
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
            }
        };
        
        const reactionResponse = await fetch(`http://localhost:5000/api/evolution/webhook/${instanceName}/messages-reaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reactionWebhook)
        });
        
        if (reactionResponse.ok) {
            console.log('✅ Reaction webhook sent successfully');
        } else {
            console.log('❌ Reaction webhook failed:', await reactionResponse.text());
            return;
        }
        
        // Step 3: Wait and check for task creation
        console.log('\n⏳ Step 3: Waiting for task creation (15 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        // Step 4: Check if task was created
        console.log('\n📋 Step 4: Checking for created tasks...');
        const tasksResponse = await fetch(`http://localhost:5000/api/tasks`);
        
        if (tasksResponse.ok) {
            const tasks = await tasksResponse.json();
            const recentTasks = tasks.filter(task => 
                new Date(task.createdAt) > new Date(Date.now() - 20 * 60 * 1000) // Last 20 minutes
            );
            
            console.log(`Found ${recentTasks.length} recent tasks:`);
            recentTasks.forEach((task, index) => {
                console.log(`  ${index + 1}. "${task.title}" (${task.status})`);
                console.log(`     Created: ${task.createdAt}`);
            });
            
            if (recentTasks.length > 0) {
                console.log('\n✅ SUCCESS: Task automation is working!');
            } else {
                console.log('\n⚠️ No recent tasks found - automation may have issues');
            }
        } else {
            console.log('❌ Failed to fetch tasks:', await tasksResponse.text());
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testSimpleReactionAutomation();