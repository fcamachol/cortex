/**
 * Test improved automatic CRM contact creation with push names
 */

async function testImprovedCrmCreation() {
    console.log('🧪 Testing improved CRM contact creation with push names...');
    
    // First create a WhatsApp contact with push name
    const testContact = {
        jid: '5521333444555@s.whatsapp.net',
        pushName: 'Maria Gonzalez',
        phone: '5521333444555'
    };
    
    // Create WhatsApp contact first
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
    
    // Then create chat (which should trigger CRM contact creation)
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
        console.log('📤 Creating WhatsApp contact with push name...');
        await fetch('http://localhost:5000/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactWebhook)
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('📤 Creating chat (should trigger CRM contact creation)...');
        await fetch('http://localhost:5000/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatWebhook)
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check CRM contacts
        const crmResponse = await fetch('http://localhost:5000/api/crm/contacts?ownerUserId=7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        const crmContacts = await crmResponse.json();
        
        const newContact = crmContacts.find(c => 
            c.relationship === 'WhatsApp Contact' && 
            (c.fullName.includes('Maria') || c.fullName.includes(testContact.phone))
        );
        
        if (newContact) {
            console.log('✅ CRM contact created successfully:');
            console.log(`   - Name: ${newContact.fullName}`);
            console.log(`   - Should use push name: ${testContact.pushName}`);
            
            // Check phone details
            const phoneResponse = await fetch(`http://localhost:5000/api/crm/contacts/${newContact.contactId}/phones`);
            const phones = await phoneResponse.json();
            
            if (phones.length > 0) {
                console.log(`   - Phone: ${phones[0].phoneNumber}`);
                console.log(`   - WhatsApp Linked: ${phones[0].isWhatsappLinked}`);
            }
        } else {
            console.log('❌ CRM contact was not created or found');
        }
        
    } catch (error) {
        console.error('❌ Error testing improved CRM creation:', error.message);
    }
}

testImprovedCrmCreation().catch(console.error);
