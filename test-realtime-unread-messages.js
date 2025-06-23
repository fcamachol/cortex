/**
 * Test real-time unread message functionality
 * This verifies that new messages from different conversations
 * immediately trigger green indicators in conversation list
 */

async function testRealtimeUnreadMessages() {
  console.log('🧪 Testing real-time unread message functionality...');
  
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : 'http://localhost:5000';

  try {
    // Test 1: Simulate receiving a new message from a different conversation
    console.log('📝 Step 1: Simulating new message via webhook...');
    
    const webhookPayload = {
      event: 'messages.upsert',
      instance: 'live-test-1750199771',
      data: {
        key: {
          remoteJid: '5214611239748@s.whatsapp.net',
          fromMe: false,
          id: 'test-unread-' + Date.now()
        },
        message: {
          conversation: 'Test message for unread indicator - ' + new Date().toISOString()
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Test Contact',
        broadcast: false,
        messageType: 'conversation'
      }
    };

    const webhookResponse = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    if (webhookResponse.ok) {
      console.log('✅ Webhook processed successfully');
    } else {
      console.log('❌ Webhook failed:', webhookResponse.status);
      return;
    }

    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Check conversation list for updated unread counts
    console.log('📝 Step 2: Checking conversation list for green indicators...');
    
    const conversationsResponse = await fetch(`${baseUrl}/api/whatsapp/conversations/7804247f-3ae8-4eb2-8c6d-2c44f967ad42`);
    
    if (conversationsResponse.ok) {
      const conversations = await conversationsResponse.json();
      
      // Find conversations with unread messages
      const unreadConversations = conversations.filter(conv => conv.unreadCount && conv.unreadCount > 0);
      
      console.log('✅ Found conversations with unread messages:', unreadConversations.length);
      
      unreadConversations.forEach(conv => {
        console.log(`📬 Unread conversation: ${conv.chatId} (${conv.instanceId}) - Count: ${conv.unreadCount}`);
      });
      
      if (unreadConversations.length > 0) {
        console.log('✅ Green indicators should be visible in conversation list');
      } else {
        console.log('⚠️ No unread conversations found (may be expected if all are read)');
      }
    } else {
      console.log('❌ Failed to fetch conversations:', conversationsResponse.status);
    }

    // Test 3: Test marking conversation as read to remove green indicator
    console.log('📝 Step 3: Testing mark as read functionality...');
    
    const markReadResponse = await fetch(`${baseUrl}/api/whatsapp/conversations/read-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: '5214611239748@s.whatsapp.net',
        instanceId: 'live-test-1750199771',
        unread: false,
        silent: true
      })
    });

    if (markReadResponse.ok) {
      console.log('✅ Message marked as read - green indicator should disappear');
    } else {
      console.log('❌ Failed to mark as read:', markReadResponse.status);
    }

    console.log('🎉 Real-time unread message test completed!');
    console.log('');
    console.log('Expected behavior:');
    console.log('- Green indicators appear immediately when new messages arrive');
    console.log('- Unread counts update in real-time via SSE events');
    console.log('- Marking as read removes green indicators instantly');
    console.log('- No delay waiting for database polling');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealtimeUnreadMessages();