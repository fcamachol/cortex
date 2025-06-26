import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122';

async function testCrmContactCreation() {
    console.log('🧪 Testing automatic CRM contact creation from WhatsApp individual chat...');
    
    // Create a webhook payload for a new individual chat
    const testJid = `5521${Math.floor(Math.random() * 900000000) + 100000000}@s.whatsapp.net`;
    const pushName = `Test Contact ${Math.floor(Math.random() * 1000)}`;
    
    const webhookPayload = {
        event: 'chats.upsert',
        instance: 'instance-1750433520122',
        data: [
            {
                id: testJid,
                remoteJid: testJid,
                name: pushName,
                unreadMessages: 0,
                archived: false,
                pinned: false,
                muteExpiration: 0,
                ephemeralExpiration: 0,
                ephemeralSettingTimestamp: 0,
                endOfHistoryTransfer: false,
                endOfHistoryTransferType: 'INITIAL_BOOTSTRAP',
                conversationTimestamp: 1750907000,
                messageCount: 0,
                notSpam: true,
                displayName: pushName,
                phoneNumber: testJid.split('@')[0],
                instanceId: 'c5215849-bfb9-413c-aa94-dfa911c8310a'
            }
        ],
        destination: WEBHOOK_URL,
        date_time: new Date().toISOString(),
        sender: testJid,
        server_url: 'https://evolution-api-evolution-api.vuswn0.easypanel.host',
        apikey: 'B6D0E5A2-4F7A-4B8E-9C3D-1E2F3A4B5C6D'
    };

    try {
        console.log(`📤 Sending webhook for new individual chat: ${testJid}`);
        
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookPayload)
        });

        if (response.ok) {
            console.log('✅ Webhook sent successfully');
            console.log(`📱 New individual chat should create CRM contact: ${pushName}`);
            
            // Wait a moment for processing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if CRM contact was created
            const contactsResponse = await fetch('https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/contacts/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
            const contactsData = await contactsResponse.json();
            
            const newContact = contactsData.find(contact => 
                contact.whatsappJid === testJid || 
                contact.displayName === pushName
            );
            
            if (newContact) {
                console.log(`✅ CRM contact created successfully: ${newContact.displayName} (ID: ${newContact.contactId})`);
                console.log(`📱 WhatsApp JID: ${newContact.whatsappJid}`);
                console.log(`🏷️ Labels: ${JSON.stringify(newContact.labels)}`);
            } else {
                console.log('❌ CRM contact was not created');
            }
            
        } else {
            console.log('❌ Failed to send webhook:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('❌ Error testing CRM contact creation:', error.message);
    }
}

testCrmContactCreation();