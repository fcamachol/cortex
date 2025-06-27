/**
 * Test the fixed task creation system from action rules
 * This validates that ActionService can now create tasks with proper unified entity schema
 */

import { db } from './server/db.js';
import { ActionService } from './server/action-service.js';
import { storage } from './server/storage.js';

async function testTaskCreation() {
    console.log('🧪 Testing task creation from action rules...');
    
    try {
        // Create a test action rule for task creation
        const actionRule = {
            instanceName: 'test-instance',
            triggerType: 'keyword',
            triggerValue: 'create task',
            ruleName: 'Test Task Creation',
            actionType: 'create_task',
            actionConfig: {
                title: 'Test Task from Action Rule',
                description: 'This task was created automatically from a test action rule',
                priority: 'high'
            },
            isActive: true
        };

        console.log('📝 Creating test action rule...');
        const createdRule = await storage.createActionRule(actionRule);
        console.log(`✅ Action rule created: ${createdRule.ruleId}`);

        // Simulate a message trigger that should create a task
        const triggerContext = {
            instanceName: 'test-instance',
            triggerType: 'keyword',
            triggerValue: 'create task',
            context: {
                messageId: 'test-message-123',
                content: 'create task for testing system',
                senderJid: '5215585333840@s.whatsapp.net',
                chatId: '120363402262963541@g.us'
            },
            rule: createdRule
        };

        console.log('🎯 Executing createTaskAction...');
        await ActionService.createTaskAction(actionRule.actionConfig, triggerContext);
        
        // Verify task was created
        const tasks = await storage.getAllTasks();
        console.log(`📊 Total tasks in database: ${tasks.length}`);
        
        const testTask = tasks.find(t => t.title.includes('Test Task from Action Rule'));
        if (testTask) {
            console.log(`✅ Task creation successful!`);
            console.log(`   - Task ID: ${testTask.id}`);
            console.log(`   - Title: ${testTask.title}`);
            console.log(`   - Description: ${testTask.description}`);
            console.log(`   - Priority: ${testTask.priority}`);
            console.log(`   - Status: ${testTask.status}`);
            console.log(`   - User ID: ${testTask.userId}`);
        } else {
            console.log('❌ Task creation failed - no matching task found');
        }

        console.log('🧹 Cleaning up test data...');
        // Clean up the test action rule
        await storage.deleteActionRule(createdRule.ruleId);
        
        if (testTask) {
            // Clean up the test task if it was created
            await storage.deleteTask(testTask.id);
        }

        console.log('✅ Test completed successfully');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

testTaskCreation();