/**
 * DIRECT TASK CREATION TEST
 * Tests task creation directly to isolate database constraint issues
 */

import fetch from 'node-fetch';

async function testDirectTaskCreation() {
    console.log('🧪 TESTING DIRECT TASK CREATION');
    console.log('=' .repeat(40));
    
    try {
        // Test 1: Create task directly via API
        console.log('\n📝 Test 1: Creating task via API...');
        const taskData = {
            title: 'Test Task from Direct API',
            description: 'Testing direct task creation to verify database constraints',
            status: 'todo',
            priority: 'medium',
            userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'
        };
        
        const createResponse = await fetch('http://localhost:5000/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        
        if (createResponse.ok) {
            const createdTask = await createResponse.json();
            console.log('✅ Task created successfully:', {
                id: createdTask.id,
                title: createdTask.title,
                status: createdTask.status
            });
        } else {
            const error = await createResponse.text();
            console.log('❌ Task creation failed:', error);
        }
        
        // Test 2: Fetch recent tasks
        console.log('\n📋 Test 2: Fetching recent tasks...');
        const tasksResponse = await fetch('http://localhost:5000/api/tasks');
        
        if (tasksResponse.ok) {
            const tasks = await tasksResponse.json();
            const recentTasks = tasks.filter(task => 
                new Date(task.createdAt) > new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
            );
            
            console.log(`Found ${recentTasks.length} recent tasks:`);
            recentTasks.forEach((task, index) => {
                console.log(`  ${index + 1}. "${task.title}" (${task.status})`);
                console.log(`     Created: ${task.createdAt}`);
                console.log(`     ID: ${task.id}`);
            });
        } else {
            console.log('❌ Failed to fetch tasks:', await tasksResponse.text());
        }
        
        // Test 3: Test action rules
        console.log('\n🎯 Test 3: Checking action rules...');
        const rulesResponse = await fetch('http://localhost:5000/api/actions/rules');
        
        if (rulesResponse.ok) {
            const rules = await rulesResponse.json();
            console.log(`Found ${rules.length} action rules:`);
            rules.forEach((rule, index) => {
                console.log(`  ${index + 1}. "${rule.name}" (${rule.triggerType})`);
                console.log(`     Active: ${rule.isActive}`);
                console.log(`     Executions: ${rule.executionCount}, Success: ${rule.successCount}, Failures: ${rule.failureCount}`);
            });
        } else {
            console.log('❌ Failed to fetch rules:', await rulesResponse.text());
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testDirectTaskCreation();