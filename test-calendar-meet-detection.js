/**
 * TEST GOOGLE MEET INVITE DETECTION
 * Tests the enhanced calendar system with Meet invite detection capability
 */

const API_BASE = 'http://localhost:5000';
const INSTANCE_ID = '28AACF7E-8C0C-42D1-8139-E47418746C55';

async function sendMessage(messageId, content) {
    const payload = {
        key: {
            remoteJid: '5214611239748@s.whatsapp.net',
            fromMe: false,
            id: messageId
        },
        message: {
            conversation: content,
            messageTimestamp: Date.now()
        },
        messageTimestamp: Date.now(),
        pushName: 'Test User',
        instanceId: INSTANCE_ID
    };

    const response = await fetch(`${API_BASE}/api/evolution/webhook/${INSTANCE_ID}/messages-upsert`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    return response.ok ? 'SUCCESS' : 'FAILED';
}

async function sendReaction(messageId, emoji) {
    const payload = {
        key: {
            remoteJid: '5214611239748@s.whatsapp.net',
            fromMe: false,
            id: messageId
        },
        reaction: {
            text: emoji,
            key: {
                remoteJid: '5214611239748@s.whatsapp.net',
                fromMe: false,
                id: messageId
            }
        },
        instanceId: INSTANCE_ID
    };

    const response = await fetch(`${API_BASE}/api/evolution/webhook/${INSTANCE_ID}/messages-reaction`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    return response.ok ? 'SUCCESS' : 'FAILED';
}

async function testVirtualMeeting() {
    console.log('\n🧪 TEST: VIRTUAL MEETING WITH GOOGLE MEET DETECTION');
    console.log('📝 Message: "Team standup tomorrow at 2pm via Google Meet with Sarah and Mike"');
    
    const messageId = `virtual-meeting-${Date.now()}`;
    const message = "Team standup tomorrow at 2pm via Google Meet with Sarah and Mike";
    
    console.log(`📤 Sending message: ${await sendMessage(messageId, message)}`);
    console.log(`🎯 Sending 📅 reaction: ${await sendReaction(messageId, '📅')}`);
    
    console.log('🧠 Expected NLP analysis:');
    console.log('   • Title: "Team standup"');
    console.log('   • Time: Tomorrow 2pm');
    console.log('   • Attendees: Sarah, Mike');
    console.log('   📹 Should create Google Meet invite: YES (virtual keywords detected)');
}

async function testPhysicalMeeting() {
    console.log('\n🧪 TEST: PHYSICAL MEETING (NO MEET INVITE)');
    console.log('📝 Message: "Client meeting tomorrow at 3pm in conference room A"');
    
    const messageId = `physical-meeting-${Date.now()}`;
    const message = "Client meeting tomorrow at 3pm in conference room A";
    
    console.log(`📤 Sending message: ${await sendMessage(messageId, message)}`);
    console.log(`🎯 Sending 📅 reaction: ${await sendReaction(messageId, '📅')}`);
    
    console.log('🧠 Expected NLP analysis:');
    console.log('   • Title: "Client meeting"');
    console.log('   • Time: Tomorrow 3pm');
    console.log('   • Location: Conference room A');
    console.log('   📹 Should create Google Meet invite: NO (physical location detected)');
}

async function runTest() {
    console.log('🚀 TESTING GOOGLE MEET INVITE DETECTION');
    console.log('═══════════════════════════════════════════════════');
    
    await testVirtualMeeting();
    await testPhysicalMeeting();
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🎯 TEST COMPLETE - Check server logs for NLP processing');
    console.log('📅 Check cortex_scheduling.events table for created events');
    console.log('📹 Virtual meetings should have Meet invite detection logged');
}

runTest().catch(console.error);