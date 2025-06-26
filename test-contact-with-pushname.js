/**
 * Test creating a WhatsApp contact with push name and then verify it appears correctly in CRM
 */

async function testContactWithPushName() {
    console.log('🧪 Testing WhatsApp contact creation with push name...');
    
    const testContact = {
        jid: '5521888999000@s.whatsapp.net',
        pushName: 'Ana Silva',
        phone: '5521888999000'
    };
    
    // Create WhatsApp contact with push name
    const contactWebhook = {
        event: 'contacts.upsert',
        instance: 'instance-1750433520122',
        data: {
            contacts: [{
                id: testContact.jid,
                pushName: testContact.pushName,
                verifiedName: null,
                profilePictureUrl: null,
                instanceId: 'c5215849-bfb9-413c-aa94-dfa911c8310a'
            }]
        }
    };
    
    // Create chat (triggers CRM contact creation)
    const chatWebhook = {
        event: 'chats.upsert',
        instance: 'instance-1750433520122',
        data: {
            chats: [{
                id: testContact.jid,
                remoteJid: testContact.jid,
                name: testContact.pushName,
                unreadMessages: 0,
                archived: false,
                pinned: false,
                muteExpiration: 0,
                ephemeralExpiration: 0,
                ephemeralSettingTimestamp: 0,
                endOfHistoryTransfer: false,
                endOfHistoryTransferType: 'INITIAL_BOOTSTRAP',
                conversationTimestamp: Date.now(),
                messageCount: 0,
                notSpam: true,
                displayName: testContact.pushName,
                phoneNumber: testContact.phone,
                instanceId: 'c5215849-bfb9-413c-aa94-dfa911c8310a'
            }]
        }
    };
    
    try {
        console.log(`📤 Creating WhatsApp contact: ${testContact.pushName}`);
        await fetch('http://localhost:5000/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactWebhook)
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('📤 Creating chat (triggers CRM contact creation)');
        await fetch('http://localhost:5000/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatWebhook)
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check CRM contacts
        const crmResponse = await fetch('http://localhost:5000/api/crm/contacts?ownerUserId=7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        const contacts = await crmResponse.json();
        
        const newContact = contacts.find(c => 
            c.fullName === testContact.pushName || 
            c.fullName === testContact.phone
        );
        
        if (newContact) {
            console.log('✅ CRM contact created:');
            console.log(`   - Name: ${newContact.fullName}`);
            console.log(`   - Expected: ${testContact.pushName}`);
            console.log(`   - Uses push name: ${newContact.fullName === testContact.pushName}`);
            
            // Get phone details
            const phoneResponse = await fetch(`http://localhost:5000/api/crm/contacts/${newContact.contactId}/phones`);
            const phones = await phoneResponse.json();
            
            if (phones.length > 0) {
                console.log(`   - Phone: ${phones[0].phoneNumber}`);
                console.log(`   - WhatsApp Linked: ${phones[0].isWhatsappLinked}`);
                console.log(`   - Label: ${phones[0].label}`);
            }
        } else {
            console.log('❌ CRM contact not found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testContactWithPushName().catch(console.error);
