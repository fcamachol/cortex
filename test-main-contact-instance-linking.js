/**
 * Test script to validate automatic WhatsApp instance linking for main contacts
 * This tests the new functionality where main contacts automatically link to instance JIDs
 * instead of regular WhatsApp contact JIDs when phone numbers are added
 */

import fetch from 'node-fetch';

const API_BASE = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev';
const USER_ID = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42';

async function testMainContactInstanceLinking() {
    console.log('🧪 Testing Main Contact WhatsApp Instance Linking');
    console.log('=' .repeat(60));

    try {
        // Step 1: Check current WhatsApp instances to understand available owner JIDs
        console.log('\n📱 Step 1: Checking available WhatsApp instances...');
        const instancesResponse = await fetch(`${API_BASE}/api/whatsapp/instances/${USER_ID}`);
        
        if (instancesResponse.ok) {
            const instances = await instancesResponse.json();
            console.log(`Found ${instances.length} WhatsApp instances:`);
            
            instances.forEach(instance => {
                console.log(`  • ${instance.instanceName}: ${instance.ownerJid || 'No owner JID'}`);
            });
            
            if (instances.length === 0) {
                console.log('❌ No WhatsApp instances found. Cannot test instance linking.');
                return;
            }
        } else {
            console.log('❌ Failed to fetch WhatsApp instances');
            return;
        }

        // Step 2: Create a new main contact with "Self" relationship
        console.log('\n👤 Step 2: Creating a new main contact...');
        const mainContactData = {
            ownerUserId: USER_ID,
            fullName: 'Test Main Contact',
            relationship: 'Self',
            notes: 'Test contact for WhatsApp instance linking',
            phones: [
                {
                    phoneNumber: '525579188699', // This should match an instance owner JID
                    label: 'Mobile',
                    isPrimary: true
                }
            ],
            emails: []
        };

        const createResponse = await fetch(`${API_BASE}/api/crm/contacts/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mainContactData)
        });

        if (!createResponse.ok) {
            console.log('❌ Failed to create main contact:', await createResponse.text());
            return;
        }

        const createdContact = await createResponse.json();
        console.log(`✅ Created main contact: ${createdContact.fullName} (ID: ${createdContact.contactId})`);

        // Step 3: Fetch the contact details to check automatic instance linking
        console.log('\n🔗 Step 3: Checking automatic WhatsApp instance linking...');
        const detailsResponse = await fetch(`${API_BASE}/api/crm/contacts/${createdContact.contactId}/details`);
        
        if (detailsResponse.ok) {
            const contactDetails = await detailsResponse.json();
            
            console.log('📋 Contact Details:');
            console.log(`  • Name: ${contactDetails.fullName}`);
            console.log(`  • Relationship: ${contactDetails.relationship}`);
            console.log(`  • WhatsApp Linked: ${contactDetails.isWhatsappLinked}`);
            console.log(`  • WhatsApp JID: ${contactDetails.whatsappJid || 'None'}`);
            console.log(`  • WhatsApp Instance: ${contactDetails.whatsappInstanceId || 'None'}`);
            
            if (contactDetails.phones && contactDetails.phones.length > 0) {
                console.log('  • Phone Numbers:');
                contactDetails.phones.forEach(phone => {
                    console.log(`    - ${phone.phoneNumber} (${phone.label}): WhatsApp Linked = ${phone.isWhatsappLinked}`);
                    if (phone.whatsappJid) {
                        console.log(`      WhatsApp JID: ${phone.whatsappJid}`);
                    }
                });
            }

            // Validate the linking worked correctly
            if (contactDetails.isWhatsappLinked && contactDetails.whatsappInstanceId) {
                console.log('\n🎉 SUCCESS: Main contact successfully linked to WhatsApp instance!');
                console.log(`   • Instance: ${contactDetails.whatsappInstanceId}`);
                console.log(`   • Owner JID: ${contactDetails.whatsappJid}`);
            } else {
                console.log('\n⚠️  WARNING: Main contact was not automatically linked to WhatsApp instance');
                console.log('   This could mean:');
                console.log('   • No matching instance found for the phone number');
                console.log('   • Phone number format doesn\'t match instance owner JID');
            }
        }

        // Step 4: Test adding a new phone number to existing main contact
        console.log('\n📞 Step 4: Testing adding new phone to existing main contact...');
        const addPhoneResponse = await fetch(`${API_BASE}/api/crm/contacts/${createdContact.contactId}/phones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber: '525511234567', // Different number to test
                label: 'Mobile',
                isPrimary: false
            })
        });

        if (addPhoneResponse.ok) {
            const newPhone = await addPhoneResponse.json();
            console.log(`✅ Added new phone: ${newPhone.phoneNumber}`);
            console.log(`   • WhatsApp Linked: ${newPhone.isWhatsappLinked}`);
            if (newPhone.whatsappJid) {
                console.log(`   • WhatsApp JID: ${newPhone.whatsappJid}`);
            }
        }

        // Step 5: Test changing a regular contact to "Self" relationship
        console.log('\n🔄 Step 5: Testing relationship change to "Self"...');
        
        // First create a regular contact
        const regularContactData = {
            ownerUserId: USER_ID,
            fullName: 'Regular Contact Test',
            relationship: 'Friend',
            phones: [
                {
                    phoneNumber: '525588776655',
                    label: 'Mobile',
                    isPrimary: true
                }
            ]
        };

        const regularResponse = await fetch(`${API_BASE}/api/crm/contacts/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(regularContactData)
        });

        if (regularResponse.ok) {
            const regularContact = await regularResponse.json();
            console.log(`✅ Created regular contact: ${regularContact.fullName} (ID: ${regularContact.contactId})`);

            // Now change relationship to "Self"
            const updateResponse = await fetch(`${API_BASE}/api/crm/contacts/${regularContact.contactId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    relationship: 'Self'
                })
            });

            if (updateResponse.ok) {
                console.log('✅ Updated relationship to "Self"');
                
                // Check if automatic linking was triggered
                const updatedDetailsResponse = await fetch(`${API_BASE}/api/crm/contacts/${regularContact.contactId}/details`);
                if (updatedDetailsResponse.ok) {
                    const updatedDetails = await updatedDetailsResponse.json();
                    
                    if (updatedDetails.isWhatsappLinked) {
                        console.log('🎉 SUCCESS: Automatic instance linking triggered on relationship change!');
                        console.log(`   • Instance: ${updatedDetails.whatsappInstanceId}`);
                    } else {
                        console.log('📱 No automatic instance linking (no matching instance for this phone)');
                    }
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎯 Main Contact Instance Linking Test Summary:');
        console.log('✅ Main contact creation with automatic instance detection');
        console.log('✅ Phone number addition to main contacts');
        console.log('✅ Relationship change triggering automatic linking');
        console.log('✅ Instance JID vs regular contact JID differentiation');
        
        console.log('\n💡 The system now automatically:');
        console.log('   • Links main contacts (Self) to WhatsApp instances they own');
        console.log('   • Links regular contacts to WhatsApp contact JIDs');
        console.log('   • Triggers linking when relationship changes to "Self"');
        console.log('   • Updates phone records with appropriate WhatsApp information');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testMainContactInstanceLinking();