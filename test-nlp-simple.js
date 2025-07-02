/**
 * SIMPLE NLP AUTOMATION TEST
 * Tests the complete webhook → NLP → enhanced action flow
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev';

async function testNLPTaskCreation() {
    console.log('🧪 Testing NLP-enhanced task creation...');
    
    const messageId = `nlp-test-${Date.now()}`;
    
    // Send message with task content
    const messageData = {
        event: "messages.upsert",
        instance: "live-test-1750199771",
        data: {
            key: {
                remoteJid: "5214611239748@s.whatsapp.net",
                fromMe: false,
                id: messageId
            },
            message: {
                conversation: "High priority: Review client presentation for Monday meeting with detailed notes"
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: "Test User"
        }
    };

    console.log('📤 Sending message...');
    const messageResponse = await fetch(`${BASE_URL}/webhook/evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
    });

    if (!messageResponse.ok) {
        console.error('❌ Message failed:', messageResponse.status);
        return;
    }

    console.log('✅ Message sent successfully');
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send reaction to trigger NLP
    const reactionData = {
        event: "messages.reaction",
        instance: "live-test-1750199771",
        data: {
            key: {
                remoteJid: "5214611239748@s.whatsapp.net",
                fromMe: false,
                id: messageId
            },
            reaction: {
                text: "✅",
                key: {
                    remoteJid: "5214611239748@s.whatsapp.net",
                    fromMe: false,
                    id: messageId
                }
            },
            messageTimestamp: Math.floor(Date.now() / 1000)
        }
    };

    console.log('🎯 Sending checkmark reaction...');
    const reactionResponse = await fetch(`${BASE_URL}/webhook/evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reactionData)
    });

    if (!reactionResponse.ok) {
        console.error('❌ Reaction failed:', reactionResponse.status);
        return;
    }

    console.log('✅ Reaction sent - NLP processing should be triggered');
    console.log('🧠 Expected: Task creation with extracted title, priority, and due date');
    console.log('📋 Check server logs for NLP processing details');
}

testNLPTaskCreation().catch(console.error);