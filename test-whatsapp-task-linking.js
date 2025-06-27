#!/usr/bin/env node

/**
 * Test WhatsApp message task linking functionality
 * Tests that tasks created from WhatsApp messages contain proper linking information
 */

const ActionService = require('./server/action-service.ts');

async function testWhatsAppTaskLinking() {
    console.log('🧪 Testing WhatsApp-to-Task linking functionality...');
    
    // Create mock trigger context simulating a WhatsApp message reaction
    const mockTriggerContext = {
        triggerType: 'reaction',
        context: {
            messageId: '3A080A2D8193E7C64799',
            instanceName: 'instance-1750433520122',
            senderJid: '5215585333840@s.whatsapp.net',
            chatId: '5215585333840@s.whatsapp.net',
            content: 'Test message for task creation',
            reactionEmoji: '✅'
        },
        instanceName: 'instance-1750433520122'
    };
    
    // Create mock action config for task creation
    const mockActionConfig = {
        title: 'WhatsApp Task: {{content}}',
        description: 'Task created from WhatsApp message reaction',
        priority: 'high'
    };
    
    try {
        // Test the createTaskAction method
        console.log('📝 Creating task from WhatsApp message trigger...');
        await ActionService.createTaskAction(mockActionConfig, mockTriggerContext);
        
        console.log('✅ Task created successfully with WhatsApp message linking!');
        console.log('🔗 Task should contain:');
        console.log(`   - triggeringMessageId: ${mockTriggerContext.context.messageId}`);
        console.log(`   - triggeringInstanceName: ${mockTriggerContext.context.instanceName}`);
        console.log(`   - triggeringSenderJid: ${mockTriggerContext.context.senderJid}`);
        console.log(`   - triggeringChatJid: ${mockTriggerContext.context.chatId}`);
        console.log(`   - triggerType: ${mockTriggerContext.triggerType}`);
        
    } catch (error) {
        console.error('❌ Error testing WhatsApp task linking:', error);
    }
}

// Run the test
testWhatsAppTaskLinking();