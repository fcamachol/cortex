/**
 * TEST 5,000 MXN PARSING FIX
 * Specific test for the user's reported issue where 5,000 was parsed as 5
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const INSTANCE_ID = '28AACF7E-8C0C-42D1-8139-E47418746C55';
const SENDER_JID = '15103165094@s.whatsapp.net';

async function sendWebhook(eventType, data) {
    const payload = {
        event: eventType,
        instance: INSTANCE_ID,
        data: data
    };

    try {
        const response = await fetch(`${BASE_URL}/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (error) {
        console.error('Webhook error:', error.message);
        return false;
    }
}

async function test5000Fix() {
    console.log('🧪 TESTING 5,000 MXN PARSING FIX');
    console.log('===============================\n');

    // Step 1: Send bill message with 5,000
    console.log('📤 Step 1: Sending bill message with "5,000"...');
    const messageId = `test-msg-${Date.now()}`;
    const chatId = `${SENDER_JID}`;
    
    const billMessage = await sendWebhook('messages.upsert', {
        key: {
            remoteJid: chatId,
            fromMe: false,
            id: messageId
        },
        message: {
            conversation: 'Pago 5,000 a Carlos del Taller mecánico por reparación del carro'
        },
        messageType: 'conversation',
        instanceId: INSTANCE_ID
    });

    if (billMessage) {
        console.log('✅ Bill message sent');
    } else {
        console.log('❌ Failed to send bill message');
        return;
    }

    // Step 2: Send 💳 reaction
    console.log('📤 Step 2: Sending 💳 reaction to create bill...');
    const reactionSuccess = await sendWebhook('messages.reaction', {
        key: {
            remoteJid: chatId,
            fromMe: false,
            id: messageId
        },
        reaction: {
            text: '💳',
            key: {
                remoteJid: chatId,
                fromMe: false,
                id: messageId
            }
        },
        instanceId: INSTANCE_ID,
        pushName: 'Test User',
        participant: SENDER_JID
    });

    if (reactionSuccess) {
        console.log('✅ Bill creation reaction sent');
    } else {
        console.log('❌ Failed to send reaction');
        return;
    }

    // Step 3: Wait for processing and check bills
    console.log('⏳ Step 3: Waiting 8 seconds for bill processing...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Step 4: Check bills for correct amount
    console.log('🔍 Step 4: Checking created bills...');
    try {
        const response = await fetch(`${BASE_URL}/api/finance/payables`);
        if (response.ok) {
            const bills = await response.json();
            const recentBills = bills.filter(bill => 
                Date.now() - new Date(bill.created_at).getTime() < 60000 && // Last minute
                bill.vendor === 'Carlos'
            );

            if (recentBills.length > 0) {
                const latestBill = recentBills[0];
                console.log('📋 Bill found:');
                console.log(`   Amount: ${latestBill.amount} ${latestBill.currency}`);
                console.log(`   Vendor: ${latestBill.vendor}`);
                console.log(`   Description: ${latestBill.description}`);
                
                if (latestBill.amount == 5000) {
                    console.log('✅ SUCCESS: Amount correctly parsed as 5000 (not 5)!');
                    console.log('✅ Mexican thousands separator fix working!');
                } else if (latestBill.amount == 5) {
                    console.log('❌ FAILURE: Amount parsed as 5 - thousands separator bug still exists');
                } else {
                    console.log(`⚠️  UNEXPECTED: Amount parsed as ${latestBill.amount}`);
                }
            } else {
                console.log('❌ No recent bills found from Carlos');
            }
        } else {
            console.log('❌ Failed to fetch bills');
        }
    } catch (error) {
        console.log(`❌ Error checking bills: ${error.message}`);
    }
}

// Run the test
test5000Fix().catch(console.error);