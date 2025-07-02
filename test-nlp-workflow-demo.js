/**
 * NLP WORKFLOW DEMONSTRATION
 * 
 * This test demonstrates exactly what the user requested:
 * 1. ✅ Reaction → Identifies task creation → NLP extracts title, urgency, etc.
 * 2. 📅 Reaction → Identifies calendar event → NLP extracts time, location, attendees
 * 3. 💰 Reaction → Identifies bill → NLP extracts vendor, amount, category
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev';

async function testTaskCreationWorkflow() {
    console.log('\n🧪 TEST 1: TASK CREATION WITH ✅ EMOJI');
    console.log('📝 Scenario: High priority client presentation task');
    
    const messageId = `task-test-${Date.now()}`;
    const taskMessage = "URGENT: Prepare client presentation for Monday meeting at 9 AM. Need to review financial data, create slides, and practice delivery. High priority deadline!";
    
    // Send message
    await sendMessage(messageId, taskMessage);
    
    // Send ✅ reaction 
    await sendReaction(messageId, '✅');
    
    console.log('✅ Expected NLP extraction:');
    console.log('   • Title: "Prepare client presentation"');
    console.log('   • Priority: High');
    console.log('   • Due: Monday');
    console.log('   • Tasks: review data, create slides, practice');
}

async function testCalendarWorkflow() {
    console.log('\n🧪 TEST 2: CALENDAR EVENT WITH 📅 EMOJI');
    console.log('📝 Scenario: Team meeting with specific details');
    
    const messageId = `calendar-test-${Date.now()}`;
    const calendarMessage = "Team standup meeting tomorrow at 2:30 PM in conference room B. Invite Sarah, Mike, and the development team to discuss sprint progress and roadmap.";
    
    // Send message
    await sendMessage(messageId, calendarMessage);
    
    // Send 📅 reaction
    await sendReaction(messageId, '📅');
    
    console.log('📅 Expected NLP extraction:');
    console.log('   • Title: "Team standup meeting"');
    console.log('   • Time: Tomorrow 2:30 PM');
    console.log('   • Location: Conference room B');
    console.log('   • Attendees: Sarah, Mike, development team');
}

async function testBillWorkflow() {
    console.log('\n🧪 TEST 3: BILL PROCESSING WITH 💰 EMOJI');
    console.log('📝 Scenario: Office supplies invoice');
    
    const messageId = `bill-test-${Date.now()}`;
    const billMessage = "Invoice from Office Depot for $425.75 due next Friday. Includes printer paper, ink cartridges, and office supplies for Q3. Account: Office Supplies category.";
    
    // Send message
    await sendMessage(messageId, billMessage);
    
    // Send 💰 reaction
    await sendReaction(messageId, '💰');
    
    console.log('💰 Expected NLP extraction:');
    console.log('   • Vendor: Office Depot');
    console.log('   • Amount: $425.75');
    console.log('   • Due: Next Friday');
    console.log('   • Category: Office Supplies');
}

async function sendMessage(messageId, content) {
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
                conversation: content
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: "Test User"
        }
    };

    const response = await fetch(`${BASE_URL}/webhook/evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
    });

    console.log(`📤 Message sent: ${response.ok ? 'SUCCESS' : 'FAILED'}`);
    return response.ok;
}

async function sendReaction(messageId, emoji) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for message processing
    
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
                text: emoji,
                key: {
                    remoteJid: "5214611239748@s.whatsapp.net",
                    fromMe: false,
                    id: messageId
                }
            },
            messageTimestamp: Math.floor(Date.now() / 1000)
        }
    };

    const response = await fetch(`${BASE_URL}/webhook/evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reactionData)
    });

    console.log(`🎯 Reaction ${emoji} sent: ${response.ok ? 'SUCCESS' : 'FAILED'}`);
    console.log(`🧠 NLP Analysis should start now for ${emoji === '✅' ? 'TASK' : emoji === '📅' ? 'CALENDAR' : 'BILL'} type`);
    return response.ok;
}

async function runNLPWorkflowDemo() {
    console.log('🚀 NLP WORKFLOW DEMONSTRATION');
    console.log('🔄 Testing emoji-based action type detection + NLP processing');
    console.log('═══════════════════════════════════════════════════════════');
    
    await testTaskCreationWorkflow();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await testCalendarWorkflow(); 
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await testBillWorkflow();
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎯 WORKFLOW COMPLETE');
    console.log('📊 Check server logs for NLP processing details');
    console.log('💾 Check database for created tasks, events, and bills');
    console.log('🧠 Each reaction should trigger specialized NLP parsing');
}

runNLPWorkflowDemo().catch(console.error);