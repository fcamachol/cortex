import fetch from 'node-fetch';

async function testContactWebhook() {
    const webhookUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122/contacts-update';
    
    // Test contact update payload structure based on Evolution API documentation
    const contactPayload = {
        event: 'contacts.update',
        instance: 'instance-1750433520122',
        data: [
            {
                id: '5215579188699@s.whatsapp.net',
                pushName: 'John Doe',
                verifiedName: 'John Doe Business',
                profilePicUrl: 'https://example.com/profile.jpg',
                isBusiness: true,
                isMe: false,
                isBlocked: false,
                notify: 'John'
            },
            {
                id: '5214422501780@s.whatsapp.net', 
                pushName: 'Jane Smith',
                verifiedName: null,
                profilePicUrl: null,
                isBusiness: false,
                isMe: false,
                isBlocked: false,
                notify: 'Jane'
            }
        ],
        destination: webhookUrl,
        date_time: new Date().toISOString(),
        sender: '5215579188699@s.whatsapp.net',
        server_url: 'https://evolution-api-evolution-api.vuswn0.easypanel.host',
        apikey: '28AACF7E-8C0C-42D1-8139-E47418746C55'
    };

    try {
        console.log('📤 Sending contact webhook test...');
        console.log('Payload:', JSON.stringify(contactPayload, null, 2));
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(contactPayload)
        });

        console.log('📨 Response status:', response.status);
        const responseText = await response.text();
        console.log('📨 Response:', responseText);
        
        if (response.ok) {
            console.log('✅ Contact webhook test successful!');
        } else {
            console.log('❌ Contact webhook test failed');
        }
        
    } catch (error) {
        console.error('❌ Error testing contact webhook:', error);
    }
}

testContactWebhook();