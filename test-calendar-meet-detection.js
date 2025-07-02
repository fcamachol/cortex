/**
 * TEST MEAL DETECTION AND TIME RANGE PARSING
 * Tests the enhanced NLP system with meal detection and time range parsing
 */

const API_BASE = 'http://localhost:5000';
const INSTANCE_ID = 'instance-1750433520122';

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

async function testMealWithTimeRange() {
    console.log('\n🧪 TEST: MEAL WITH TIME RANGE "DE 2-4"');
    console.log('📝 Message: "comemos de 2-4 en casa con la familia"');
    
    const messageId = `meal-range-${Date.now()}`;
    const message = "comemos de 2-4 en casa con la familia";
    
    console.log(`📤 Sending message: ${await sendMessage(messageId, message)}`);
    console.log(`🎯 Sending 📅 reaction: ${await sendReaction(messageId, '📅')}`);
    
    console.log('🧠 Expected NLP analysis:');
    console.log('   • Title: "Comemos"');
    console.log('   • Start time: 2:00 PM');
    console.log('   • End time: 4:00 PM');
    console.log('   • Duration: 120 minutes');
    console.log('   • Location: Casa');
}

async function testMealWithoutTime() {
    console.log('\n🧪 TEST: MEAL WITHOUT TIME (60MIN DEFAULT)');
    console.log('📝 Message: "almuerzo con mi hermana"');
    
    const messageId = `meal-notime-${Date.now()}`;
    const message = "almuerzo con mi hermana";
    
    console.log(`📤 Sending message: ${await sendMessage(messageId, message)}`);
    console.log(`🎯 Sending 📅 reaction: ${await sendReaction(messageId, '📅')}`);
    
    console.log('🧠 Expected NLP analysis:');
    console.log('   • Title: "Almuerzo"');
    console.log('   • Duration: 60 minutes (default)');
    console.log('   • End time: start_time + 60 minutes');
}

async function runTest() {
    console.log('🚀 TESTING MEAL DETECTION AND TIME RANGE PARSING');
    console.log('═══════════════════════════════════════════════════');
    
    await testMealWithTimeRange();
    await testMealWithoutTime();
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🎯 TEST COMPLETE - Check server logs for NLP processing');
    console.log('📅 Check cortex_scheduling.events table for created events');
    console.log('🕐 Time range events should show correct start/end times');
    console.log('⏰ Events without times should default to 60 minutes');
}

runTest().catch(console.error);