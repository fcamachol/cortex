/**
 * Investigate missing messages for phone number 5214611239748
 * Check database, webhook logs, and message processing
 */

// Using built-in fetch for Node.js 18+

async function investigateMissingMessages() {
    const phoneNumber = '5214611239748';
    const expectedJid = `${phoneNumber}@s.whatsapp.net`;
    
    console.log(`🔍 Investigating missing messages for phone number: ${phoneNumber}`);
    console.log(`📱 Expected JID: ${expectedJid}`);
    
    try {
        // 1. Check if contact exists in database
        console.log('\n📋 Step 1: Checking contact in database...');
        const contactsResponse = await fetch('http://localhost:5000/api/contacts/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        const contacts = await contactsResponse.json();
        
        const matchingContact = contacts.find(contact => 
            contact.id === expectedJid || 
            contact.phone === phoneNumber || 
            (contact.id && contact.id.includes(phoneNumber))
        );
        
        if (matchingContact) {
            console.log('✅ Contact found:', matchingContact.id);
            console.log(`   Name: ${matchingContact.name || 'No name'}`);
            console.log(`   Phone: ${matchingContact.phone || 'No phone'}`);
        } else {
            console.log('❌ Contact NOT found in database');
        }
        
        // 2. Check conversations for this contact
        console.log('\n📱 Step 2: Checking conversations...');
        const conversationsResponse = await fetch('http://localhost:5000/api/whatsapp/conversations/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        const conversations = await conversationsResponse.json();
        
        const matchingConversation = conversations.find(conv => 
            conv.chatId === expectedJid || 
            conv.chatId.includes(phoneNumber)
        );
        
        if (matchingConversation) {
            console.log('✅ Conversation found:', matchingConversation.chatId);
            console.log(`   Instance: ${matchingConversation.instanceId}`);
            console.log(`   Last message: ${matchingConversation.lastMessage || 'None'}`);
            console.log(`   Unread count: ${matchingConversation.unreadCount || 0}`);
        } else {
            console.log('❌ Conversation NOT found');
        }
        
        // 3. Search for messages with this JID pattern
        console.log('\n💬 Step 3: Searching for messages...');
        
        // Try different JID variations
        const jidVariations = [
            expectedJid,
            phoneNumber,
            `+${phoneNumber}`,
            `521${phoneNumber.substring(3)}@s.whatsapp.net`, // Remove country code
            `52${phoneNumber.substring(2)}@s.whatsapp.net`   // Different format
        ];
        
        console.log('🔄 Trying JID variations:');
        jidVariations.forEach(jid => console.log(`   - ${jid}`));
        
        // 4. Check if there are any webhook events for this number
        console.log('\n🌐 Step 4: Testing webhook simulation...');
        
        // Simulate a message webhook to see if it gets processed
        const testWebhook = {
            event: 'messages.upsert',
            instance: 'live-test-1750199771',
            data: {
                key: {
                    id: `TEST_INVESTIGATION_${Date.now()}`,
                    fromMe: false,
                    remoteJid: expectedJid
                },
                message: {
                    conversation: 'Test message to investigate processing'
                },
                messageType: 'conversation',
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: 'Test Contact'
            }
        };
        
        const webhookResponse = await fetch('http://localhost:5000/api/evolution/webhook/live-test-1750199771/messages-upsert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testWebhook)
        });
        
        if (webhookResponse.ok) {
            console.log('✅ Test webhook processed successfully');
            console.log('   This suggests webhook processing is working');
        } else {
            console.log('❌ Test webhook failed');
        }
        
        // Wait and check if test message appeared
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 5. Re-check conversations after test
        console.log('\n🔄 Step 5: Re-checking after test message...');
        const updatedConversationsResponse = await fetch('http://localhost:5000/api/whatsapp/conversations/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        const updatedConversations = await updatedConversationsResponse.json();
        
        const foundAfterTest = updatedConversations.find(conv => 
            conv.chatId === expectedJid || 
            conv.chatId.includes(phoneNumber)
        );
        
        if (foundAfterTest) {
            console.log('✅ Conversation found after test:', foundAfterTest.chatId);
            console.log('   This means webhook processing is working correctly');
        } else {
            console.log('❌ Still no conversation found after test');
        }
        
        // 6. Summary and recommendations
        console.log('\n📊 INVESTIGATION SUMMARY');
        console.log('='.repeat(50));
        
        if (!matchingContact) {
            console.log('❌ Issue: Contact not in database');
            console.log('   Possible causes:');
            console.log('   - Messages from this number never received');
            console.log('   - Webhook not configured for the correct instance');
            console.log('   - JID format mismatch');
        }
        
        if (!matchingConversation) {
            console.log('❌ Issue: No conversation exists');
            console.log('   Possible causes:');
            console.log('   - No messages ever received from this contact');
            console.log('   - Messages being filtered out during processing');
            console.log('   - Instance mismatch');
        }
        
        console.log('\n🔧 RECOMMENDED ACTIONS:');
        console.log('1. Check Evolution API webhook configuration');
        console.log('2. Verify the correct instance is receiving webhooks');
        console.log('3. Check if messages are being sent to the correct phone number');
        console.log('4. Monitor webhook logs for incoming messages from this number');
        console.log('5. Verify the phone number format matches WhatsApp JID conventions');
        
    } catch (error) {
        console.error('❌ Investigation failed:', error.message);
    }
}

// Run investigation
investigateMissingMessages().catch(console.error);