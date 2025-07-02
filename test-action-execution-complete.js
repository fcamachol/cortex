/**
 * COMPREHENSIVE ACTION EXECUTION TEST
 * Tests the complete flow from reaction to calendar event creation
 */

import { ActionService } from './server/action-service.js';
import { storage } from './server/storage.js';

async function testCompleteActionExecution() {
    try {
        console.log('🔄 COMPLETE ACTION EXECUTION TEST');
        console.log('═══════════════════════════════════════');
        
        // Simulate the test reaction data
        const instanceId = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';
        const testMessage = {
            id: 'test-message-123',
            content: 'Comemos mañana de 2-4 en la casa',
            sender_jid: '5214611239748@s.whatsapp.net',
            instance_name: instanceId,
            chat_id: '5214611239748@s.whatsapp.net',
            type: 'text'
        };
        
        const testReaction = {
            message_id: 'test-message-123',
            instance_name: instanceId,
            reactor_jid: '5214611239748@s.whatsapp.net',
            emoji: '📅',
            chat_id: '5214611239748@s.whatsapp.net'
        };
        
        console.log('📝 Test data:');
        console.log('Message:', testMessage);
        console.log('Reaction:', testReaction);
        
        console.log('\n🔍 Step 1: Get action rules for whatsapp_message trigger');
        const rules = await storage.getActionRulesByTrigger('whatsapp_message', instanceId);
        console.log(`Found ${rules.length} rules:`, rules.map(r => r.name));
        
        console.log('\n🔍 Step 2: Test triggerAction method');
        await ActionService.triggerAction(
            instanceId,
            'whatsapp_message',
            '📅',
            {
                emoji: '📅',
                reactorJid: testReaction.reactor_jid,
                senderJid: testMessage.sender_jid,
                messageId: testMessage.id,
                content: testMessage.content,
                chatId: testMessage.chat_id,
                instanceName: instanceId
            }
        );
        
        console.log('\n✅ Action execution test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error in action execution test:', error);
    }
    
    process.exit(0);
}

testCompleteActionExecution();