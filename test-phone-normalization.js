/**
 * Test phone number normalization logic to ensure proper WhatsApp JID conversion
 */

import fetch from 'node-fetch';

const API_BASE = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev';
const USER_ID = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';

async function testPhoneNormalization() {
    console.log('🧪 Testing Phone Number Normalization for WhatsApp JID Conversion');
    console.log('=' .repeat(70));

    try {
        // Step 1: Check available instance owner JIDs
        console.log('\n📱 Step 1: Checking available WhatsApp instance owner JIDs...');
        const instancesResponse = await fetch(`${API_BASE}/api/whatsapp/instances/${USER_ID}`);
        
        if (!instancesResponse.ok) {
            console.log('❌ Failed to fetch instances');
            return;
        }

        const instances = await instancesResponse.json();
        console.log('Available Instance Owner JIDs:');
        instances.forEach(instance => {
            console.log(`  • ${instance.instanceName}: ${instance.ownerJid}`);
        });

        // Step 2: Test different phone number formats that should match the first instance
        // Instance: 5215579188699@s.whatsapp.net
        const testPhoneNumbers = [
            '525579188699',    // Current format in contact
            '5215579188699',   // Correct format matching instance
            '+525579188699',   // With plus sign
            '+5215579188699',  // Full international format
            '5579188699',      // Without country code
        ];

        console.log('\n🔄 Step 2: Testing different phone number formats...');
        
        for (const phoneNumber of testPhoneNumbers) {
            console.log(`\n📞 Testing phone: ${phoneNumber}`);
            
            // Create a test main contact with this phone number
            const contactData = {
                ownerUserId: USER_ID,
                fullName: `Test Phone ${phoneNumber}`,
                relationship: 'Self',
                notes: 'Phone normalization test',
                phones: [
                    {
                        phoneNumber: phoneNumber,
                        label: 'Mobile',
                        isPrimary: true
                    }
                ]
            };

            const createResponse = await fetch(`${API_BASE}/api/crm/contacts/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contactData)
            });

            if (createResponse.ok) {
                const contact = await createResponse.json();
                
                // Get contact details to check linking
                const detailsResponse = await fetch(`${API_BASE}/api/crm/contacts/${contact.contactId}/details`);
                if (detailsResponse.ok) {
                    const details = await detailsResponse.json();
                    
                    const linked = details.isWhatsappLinked;
                    const jid = details.whatsappJid;
                    const instanceId = details.whatsappInstanceId;
                    
                    console.log(`  Result: ${linked ? '✅' : '❌'} Linked = ${linked}`);
                    if (linked) {
                        console.log(`    • JID: ${jid}`);
                        console.log(`    • Instance: ${instanceId}`);
                    }
                    
                    // Check the phone record too
                    if (details.phones && details.phones.length > 0) {
                        const phone = details.phones[0];
                        console.log(`    • Phone WhatsApp Linked: ${phone.isWhatsappLinked}`);
                        if (phone.whatsappJid) {
                            console.log(`    • Phone WhatsApp JID: ${phone.whatsappJid}`);
                        }
                    }
                } else {
                    console.log('  ❌ Failed to get contact details');
                }
                
                // Clean up - delete the test contact
                await fetch(`${API_BASE}/api/crm/contacts/${contact.contactId}`, {
                    method: 'DELETE'
                });
                
            } else {
                console.log(`  ❌ Failed to create contact: ${await createResponse.text()}`);
            }
        }

        // Step 3: Test the US number format
        console.log('\n🇺🇸 Step 3: Testing US number format...');
        const usPhoneNumbers = [
            '15103165094',     // Should match instance owner JID 15103165094@s.whatsapp.net
            '+15103165094',
            '5103165094',      // Without country code
        ];

        for (const phoneNumber of usPhoneNumbers) {
            console.log(`\n📞 Testing US phone: ${phoneNumber}`);
            
            const contactData = {
                ownerUserId: USER_ID,
                fullName: `Test US Phone ${phoneNumber}`,
                relationship: 'Self',
                notes: 'US phone normalization test',
                phones: [
                    {
                        phoneNumber: phoneNumber,
                        label: 'Mobile',
                        isPrimary: true
                    }
                ]
            };

            const createResponse = await fetch(`${API_BASE}/api/crm/contacts/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(contactData)
            });

            if (createResponse.ok) {
                const contact = await createResponse.json();
                
                const detailsResponse = await fetch(`${API_BASE}/api/crm/contacts/${contact.contactId}/details`);
                if (detailsResponse.ok) {
                    const details = await detailsResponse.json();
                    
                    const linked = details.isWhatsappLinked;
                    console.log(`  Result: ${linked ? '✅' : '❌'} Linked = ${linked}`);
                    if (linked) {
                        console.log(`    • JID: ${details.whatsappJid}`);
                        console.log(`    • Instance: ${details.whatsappInstanceId}`);
                    }
                }
                
                // Clean up
                await fetch(`${API_BASE}/api/crm/contacts/${contact.contactId}`, {
                    method: 'DELETE'
                });
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('🎯 Phone Number Normalization Test Complete');
        console.log('The test shows which phone formats successfully link to WhatsApp instances');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testPhoneNormalization();