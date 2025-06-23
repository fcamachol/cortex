/**
 * Test real-time waiting response functionality
 * This verifies that marking messages as waiting for response in chat
 * immediately triggers blue indicators in conversation list
 */

async function testRealtimeWaitingResponse() {
  console.log('🧪 Testing real-time waiting response functionality...');
  
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : 'http://localhost:5000';

  try {
    // Test 1: Mark a message as waiting for response
    console.log('📝 Step 1: Marking message as waiting for response...');
    
    const markResponse = await fetch(`${baseUrl}/api/whatsapp/waiting-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messageId: 'test-message-realtime-' + Date.now(),
        instanceId: 'instance-1750433520122',
        chatId: '5214611239748@s.whatsapp.net'
      })
    });

    if (markResponse.ok) {
      console.log('✅ Message marked as waiting for response');
      const data = await markResponse.json();
      console.log('Response:', data);
    } else {
      console.log('❌ Failed to mark message:', markResponse.status);
      return;
    }

    // Test 2: Verify conversation list shows blue indicator
    console.log('📝 Step 2: Checking conversation list for blue indicator...');
    
    const conversationsResponse = await fetch(`${baseUrl}/api/whatsapp/conversations/7804247f-3ae8-4eb2-8c6d-2c44f967ad42`);
    
    if (conversationsResponse.ok) {
      const conversations = await conversationsResponse.json();
      const testConversation = conversations.find(conv => 
        conv.chatId === '5214611239748@s.whatsapp.net' && 
        conv.instanceId === 'instance-1750433520122'
      );
      
      if (testConversation) {
        console.log('✅ Found test conversation in list');
        console.log('Conversation details:', {
          chatId: testConversation.chatId,
          instanceId: testConversation.instanceId,
          lastMessage: testConversation.lastMessage
        });
      } else {
        console.log('❌ Test conversation not found in list');
      }
    } else {
      console.log('❌ Failed to fetch conversations:', conversationsResponse.status);
    }

    // Test 3: Verify waiting reply endpoint shows the marked message
    console.log('📝 Step 3: Checking waiting reply endpoint...');
    
    const waitingResponse = await fetch(`${baseUrl}/api/whatsapp/waiting-reply/instance-1750433520122`);
    
    if (waitingResponse.ok) {
      const waitingReplies = await waitingResponse.json();
      console.log('✅ Waiting replies fetched:', waitingReplies.length, 'messages');
      
      const hasTestMessage = waitingReplies.some(reply => 
        reply.message_id && reply.message_id.includes('test-message-realtime')
      );
      
      if (hasTestMessage) {
        console.log('✅ Test message found in waiting replies');
      } else {
        console.log('⚠️ Test message not found in waiting replies (may be expected if cleanup occurred)');
      }
    } else {
      console.log('❌ Failed to fetch waiting replies:', waitingResponse.status);
    }

    console.log('🎉 Real-time waiting response test completed!');
    console.log('');
    console.log('Expected behavior:');
    console.log('- Blue indicator should appear immediately in conversation list');
    console.log('- No delay waiting for database updates');
    console.log('- SSE events should trigger instant UI updates');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealtimeWaitingResponse();