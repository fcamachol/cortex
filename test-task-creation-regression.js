/**
 * TEST TASK CREATION REGRESSION FIX
 * This sends a regular message to ensure NO task is created without reactions
 */

import fetch from 'node-fetch';

async function testTaskCreationRegression() {
    console.log('🧪 Testing task creation regression fix');
    
    try {
        // Step 1: Get current task count
        const beforeResponse = await fetch('http://localhost:5000/api/test/tasks-count');
        const beforeData = await beforeResponse.json();
        const tasksBefore = beforeData.count;
        
        console.log(`📊 Tasks before test: ${tasksBefore}`);
        
        // Step 2: Send a regular message that should NOT create a task
        const messagePayload = {
            event: "messages.upsert",
            instance: "live-test-1750199771", 
            data: {
                key: {
                    remoteJid: "5214421055671@s.whatsapp.net",
                    fromMe: false,
                    id: "NO_TASK_TEST_" + Date.now()
                },
                message: {
                    conversation: "This message should NOT create a task - " + new Date().toISOString()
                },
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: "Test User"
            }
        };
        
        console.log('📤 Sending regular message (should NOT create task)');
        const messageResponse = await fetch('http://localhost:5000/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messagePayload)
        });
        
        console.log('📥 Message sent:', messageResponse.status);
        
        // Step 3: Wait and check task count again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterResponse = await fetch('http://localhost:5000/api/test/tasks-count');
        const afterData = await afterResponse.json();
        const tasksAfter = afterData.count;
        
        console.log(`📊 Tasks after test: ${tasksAfter}`);
        
        if (tasksAfter === tasksBefore) {
            console.log('✅ SUCCESS: No unwanted task was created!');
        } else {
            console.log('❌ FAILURE: Task was created from regular message');
            console.log(`❌ Task count increased by: ${tasksAfter - tasksBefore}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testTaskCreationRegression();