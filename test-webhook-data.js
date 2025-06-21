import fetch from 'node-fetch';

async function testWebhookDataExtraction() {
    const baseUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122';
    
    // Test message webhook with Evolution API structure
    const messagePayload = {
        event: 'messages.upsert',
        instance: 'instance-1750433520122',
        data: {
            key: {
                id: 'TEST_MESSAGE_123',
                remoteJid: '5215579188699@s.whatsapp.net',
                fromMe: false,
                participant: '5215579188699@s.whatsapp.net'
            },
            message: {
                conversation: 'Test message from Evolution API'
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: 'Test User',
            status: 'SENT'
        },
        destination: baseUrl,
        date_time: new Date().toISOString(),
        sender: '5215579188699@s.whatsapp.net'
    };

    // Test chat webhook with Evolution API structure
    const chatPayload = {
        event: 'chats.upsert',
        instance: 'instance-1750433520122',
        data: [{
            id: '5215579188699@s.whatsapp.net',
            remoteJid: '5215579188699@s.whatsapp.net',
            name: 'Test Chat',
            unreadMessages: 0,
            archived: false,
            pinned: false,
            muted: false
        }],
        destination: baseUrl,
        date_time: new Date().toISOString(),
        sender: '5215579188699@s.whatsapp.net'
    };

    // Test contact webhook with Evolution API structure
    const contactPayload = {
        event: 'contacts.update',
        instance: 'instance-1750433520122',
        data: [{
            remoteJid: '5215579188699@s.whatsapp.net',
            pushName: 'Test Contact',
            verifiedName: 'Test Business',
            profilePicUrl: 'https://example.com/pic.jpg',
            isBusiness: true
        }],
        destination: baseUrl,
        date_time: new Date().toISOString(),
        sender: '5215579188699@s.whatsapp.net'
    };

    const tests = [
        { name: 'Message', url: `${baseUrl}/messages-upsert`, payload: messagePayload },
        { name: 'Chat', url: `${baseUrl}/chats-upsert`, payload: chatPayload },
        { name: 'Contact', url: `${baseUrl}/contacts-update`, payload: contactPayload }
    ];

    for (const test of tests) {
        try {
            console.log(`Testing ${test.name} webhook...`);
            const response = await fetch(test.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(test.payload)
            });

            console.log(`${test.name} Response:`, response.status, await response.text());
        } catch (error) {
            console.error(`${test.name} Error:`, error);
        }
    }
}

testWebhookDataExtraction();