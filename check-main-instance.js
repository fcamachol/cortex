/**
 * Check the main instance (instance-1750433520122) for messages from 5214611239748
 */

async function checkMainInstance() {
    const phoneNumber = '5214611239748';
    const expectedJid = `${phoneNumber}@s.whatsapp.net`;
    
    console.log(`🔍 Checking main instance for contact ${phoneNumber}...`);
    
    // Send a test message to the main instance to see if it processes correctly
    const testWebhook = {
        event: 'messages.upsert',
        instance: 'instance-1750433520122', // Main instance
        data: {
            key: {
                id: `MAIN_INSTANCE_TEST_${Date.now()}`,
                fromMe: false,
                remoteJid: expectedJid
            },
            message: {
                conversation: 'Test message to main instance to check processing'
            },
            messageType: 'conversation',
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: 'Test Contact Main'
        }
    };
    
    console.log('📤 Sending test webhook to main instance...');
    const response = await fetch('http://localhost:5000/api/evolution/webhook/instance-1750433520122/messages-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testWebhook)
    });
    
    if (response.ok) {
        console.log('✅ Test webhook to main instance processed successfully');
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if conversation was created
        const conversationsResponse = await fetch('http://localhost:5000/api/whatsapp/conversations/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        const conversations = await conversationsResponse.json();
        
        const foundConversation = conversations.find(conv => 
            conv.chatId === expectedJid && conv.instanceId === 'instance-1750433520122'
        );
        
        if (foundConversation) {
            console.log('✅ Conversation created in main instance:', foundConversation.chatId);
            console.log('🎯 SOLUTION: Configure webhooks to send messages from this contact to instance-1750433520122');
        } else {
            console.log('❌ No conversation found in main instance after test');
        }
    } else {
        console.log('❌ Test webhook to main instance failed');
    }
    
    console.log('\n📋 RECOMMENDED ACTION:');
    console.log('Ask the contact 5214611239748 to send a test message to verify which instance receives it');
    console.log('OR check Evolution API configuration to ensure webhooks from this contact go to the correct instance');
}

checkMainInstance().catch(console.error);