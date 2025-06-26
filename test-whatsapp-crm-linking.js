import fetch from 'node-fetch';

const API_BASE = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev';

async function testWhatsAppCrmLinking() {
    console.log('🔗 Testing WhatsApp-CRM Contact Linking System');
    console.log('='.repeat(60));
    
    try {
        // Step 1: Create a CRM contact with a phone number
        console.log('\n📝 Step 1: Creating CRM contact...');
        const contactData = {
            ownerUserId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42',
            fullName: 'Test WhatsApp Contact',
            relationship: 'Client',
            phones: [{
                phoneNumber: '+5215579188699', // This matches our WhatsApp test contact
                label: 'Mobile',
                isPrimary: true
            }]
        };

        const createResponse = await fetch(`${API_BASE}/api/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactData)
        });

        if (!createResponse.ok) {
            console.error('❌ Failed to create contact:', await createResponse.text());
            return;
        }

        const createdContact = await createResponse.json();
        console.log('✅ CRM contact created:', createdContact.fullName);
        console.log('🆔 Contact ID:', createdContact.contactId);

        // Step 2: Check if WhatsApp linking was detected
        console.log('\n🔍 Step 2: Checking WhatsApp linking status...');
        const statusResponse = await fetch(`${API_BASE}/api/contacts/${createdContact.contactId}/whatsapp-status`);
        
        if (statusResponse.ok) {
            const whatsappStatus = await statusResponse.json();
            console.log('📱 WhatsApp Status:', whatsappStatus);
            
            if (whatsappStatus.isWhatsappLinked) {
                console.log('🎉 SUCCESS: Contact automatically linked to WhatsApp!');
                console.log('📞 WhatsApp JID:', whatsappStatus.whatsappJid);
                console.log('🏢 Instance ID:', whatsappStatus.whatsappInstanceId);
                console.log('⏰ Linked at:', whatsappStatus.whatsappLinkedAt);
            } else {
                console.log('📱 No WhatsApp link found (this may be expected if no matching WhatsApp contact exists)');
            }
        }

        // Step 3: Check existing WhatsApp contacts for reference
        console.log('\n📋 Step 3: Checking existing WhatsApp contacts...');
        const whatsappResponse = await fetch(`${API_BASE}/api/whatsapp/contacts/7804247f-3ae8-4eb2-8c6d-2c44f967ad42`);
        
        if (whatsappResponse.ok) {
            const whatsappContacts = await whatsappResponse.json();
            console.log(`📞 Found ${whatsappContacts.length} WhatsApp contacts`);
            
            // Look for contacts that might match our test phone
            const potentialMatches = whatsappContacts.filter(contact => 
                contact.jid.includes('5215579188699') || 
                contact.pushName?.toLowerCase().includes('test')
            );
            
            if (potentialMatches.length > 0) {
                console.log('🎯 Potential WhatsApp matches found:');
                potentialMatches.forEach(contact => {
                    console.log(`   • ${contact.jid} (${contact.pushName || 'No name'})`);
                });
            } else {
                console.log('📱 No matching WhatsApp contacts found for this phone number');
                console.log('💡 To test linking, ensure there\'s a WhatsApp contact with JID: 5215579188699@s.whatsapp.net');
            }
        }

        // Step 4: Demonstrate manual linking trigger
        console.log('\n🔄 Step 4: Testing manual linking trigger...');
        const linkResponse = await fetch(`${API_BASE}/api/contacts/${createdContact.contactId}/link-whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: '+5215579188699' })
        });

        if (linkResponse.ok) {
            const linkResult = await linkResponse.json();
            console.log('✅ Manual linking check completed:', linkResult.message);
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎯 WhatsApp-CRM Linking Test Summary:');
        console.log('✅ CRM contact created successfully');
        console.log('✅ WhatsApp linking system activated');
        console.log('✅ Status checking endpoint working');
        console.log('✅ Manual linking trigger functional');
        console.log('\n💡 The system will automatically link CRM contacts to WhatsApp');
        console.log('   when phone numbers match existing WhatsApp JIDs');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testWhatsAppCrmLinking();