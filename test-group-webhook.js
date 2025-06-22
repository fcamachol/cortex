import fetch from 'node-fetch';

async function testGroupWebhookWithRealSubject() {
  try {
    console.log('🧪 Testing group webhook with real subject...');
    
    const groupWebhookPayload = {
      instance: 'live-test-1750199771',
      data: [{
        id: '120363999888777666@g.us',
        subject: 'Test WhatsApp Business Group',
        owner: '5215579188699@s.whatsapp.net',
        desc: 'Group created for business testing',
        creation: Math.floor(Date.now() / 1000),
        announce: false,
        participants: [
          { id: '5215579188699@s.whatsapp.net', admin: 'superadmin' },
          { id: '5214422501780@s.whatsapp.net', admin: null }
        ]
      }]
    };

    const response = await fetch('http://localhost:5000/api/evolution/webhook/live-test-1750199771/groups-upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(groupWebhookPayload)
    });

    const result = await response.text();
    console.log('✅ Group webhook response:', response.status, result);

    // Test chat upsert with real group subject
    const chatWebhookPayload = {
      instance: 'live-test-1750199771',
      data: [{
        id: '120363999888777666@g.us',
        name: 'Test WhatsApp Business Group',
        subject: 'Test WhatsApp Business Group',
        conversationTimestamp: Math.floor(Date.now() / 1000),
        unreadCount: 0,
        archive: false,
        isGroup: true,
        owner: '5215579188699@s.whatsapp.net'
      }]
    };

    const chatResponse = await fetch('http://localhost:5000/api/evolution/webhook/live-test-1750199771/chats-upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chatWebhookPayload)
    });

    const chatResult = await chatResponse.text();
    console.log('✅ Chat webhook response:', chatResponse.status, chatResult);

  } catch (error) {
    console.error('❌ Webhook test failed:', error);
  }
}

testGroupWebhookWithRealSubject();