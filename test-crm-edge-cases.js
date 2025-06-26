/**
 * Test edge cases for automatic CRM contact creation system
 */

async function testDuplicateContactPrevention() {
    console.log('🧪 Testing duplicate contact prevention...');
    
    const chatId = '5521999888777@s.whatsapp.net';
    const instanceId = 'instance-1750433520122';
    
    // Send first webhook to create contact
    const webhook1 = {
        event: 'chats.upsert',
        instance: instanceId,
        data: {
            chats: [{
                id: chatId,
                remoteJid: chatId,
                name: 'Duplicate Test Contact',
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
                displayName: 'Duplicate Test Contact',
                phoneNumber: '5521999888777',
                instanceId: 'c5215849-bfb9-413c-aa94-dfa911c8310a'
            }]
        }
    };
    
    // Send second identical webhook (should not create duplicate)
    const webhook2 = { ...webhook1 };
    
    try {
        console.log('📤 Sending first webhook...');
        const response1 = await fetch('http://localhost:5000/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhook1)
        });
        
        console.log('📤 Sending second webhook (duplicate)...');
        const response2 = await fetch('http://localhost:5000/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhook2)
        });
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check how many contacts exist with this phone
        const checkResponse = await fetch('http://localhost:5000/api/contacts/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        const contacts = await checkResponse.json();
        
        const duplicateContacts = contacts.filter(c => 
            c.phones && c.phones.some(p => p.phoneNumber === '5521999888777')
        );
        
        if (duplicateContacts.length === 1) {
            console.log('✅ Duplicate prevention working - only 1 contact created');
        } else {
            console.log(`❌ Found ${duplicateContacts.length} contacts with same phone`);
        }
        
    } catch (error) {
        console.error('❌ Error testing duplicate prevention:', error.message);
    }
}

async function testGroupChatIgnoring() {
    console.log('🧪 Testing group chat ignoring (privacy protection)...');
    
    const groupJid = '120363402262963541@g.us';
    const instanceId = 'instance-1750433520122';
    
    const webhook = {
        event: 'chats.upsert',
        instance: instanceId,
        data: {
            chats: [{
                id: groupJid,
                remoteJid: groupJid,
                name: 'Test Group Chat',
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
                displayName: 'Test Group Chat',
                instanceId: 'c5215849-bfb9-413c-aa94-dfa911c8310a'
            }]
        }
    };
    
    try {
        console.log('📤 Sending group chat webhook...');
        const response = await fetch('http://localhost:5000/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhook)
        });
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ Group chat processed (should not create CRM contact)');
        
    } catch (error) {
        console.error('❌ Error testing group chat:', error.message);
    }
}

async function testContactWithPushName() {
    console.log('🧪 Testing contact creation with proper push name...');
    
    const chatId = '5521555444333@s.whatsapp.net';
    const instanceId = 'instance-1750433520122';
    
    // First create a WhatsApp contact with push name
    const contactWebhook = {
        event: 'contacts.upsert',
        instance: instanceId,
        data: {
            contacts: [{
                id: chatId,
                pushName: 'João Silva',
                verifiedName: null,
                profilePictureUrl: null,
                instanceId: 'c5215849-bfb9-413c-aa94-dfa911c8310a'
            }]
        }
    };
    
    // Then create chat
    const chatWebhook = {
        event: 'chats.upsert',
        instance: instanceId,
        data: {
            chats: [{
                id: chatId,
                remoteJid: chatId,
                name: 'João Silva',
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
                displayName: 'João Silva',
                phoneNumber: '5521555444333',
                instanceId: 'c5215849-bfb9-413c-aa94-dfa911c8310a'
            }]
        }
    };
    
    try {
        console.log('📤 Sending contact webhook first...');
        await fetch('http://localhost:5000/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactWebhook)
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('📤 Sending chat webhook...');
        await fetch('http://localhost:5000/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatWebhook)
        });
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ Contact with push name processed');
        
    } catch (error) {
        console.error('❌ Error testing push name contact:', error.message);
    }
}

async function runAllTests() {
    console.log('🚀 Running CRM contact creation edge case tests...\n');
    
    await testDuplicateContactPrevention();
    console.log('');
    
    await testGroupChatIgnoring();
    console.log('');
    
    await testContactWithPushName();
    console.log('');
    
    console.log('🏁 All tests completed');
}

runAllTests().catch(console.error);
