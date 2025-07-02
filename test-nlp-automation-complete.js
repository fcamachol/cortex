/**
 * COMPREHENSIVE NLP-ENHANCED AUTOMATION TEST
 * 
 * This test demonstrates the complete WhatsApp NLP automation flow:
 * 1. Reaction triggers rule lookup
 * 2. Rule determines action type (task/calendar/bill)
 * 3. NLP service analyzes message content
 * 4. Enhanced action methods create enriched entities
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev';

// Test scenarios covering all three NLP parsers
const testScenarios = [
    {
        name: "Task Creation with NLP",
        reaction: "✅",
        message: "High priority: Review client presentation for Monday meeting. Need to prepare slides and practice presentation before deadline.",
        expectedType: "task",
        expectedData: {
            priority: "high",
            title: "Review client presentation",
            dueDate: "Monday"
        }
    },
    {
        name: "Calendar Event with NLP", 
        reaction: "📅",
        message: "Team meeting tomorrow at 3 PM in conference room A to discuss project updates and next steps.",
        expectedType: "calendar",
        expectedData: {
            title: "Team meeting",
            startTime: "3 PM",
            location: "conference room A"
        }
    },
    {
        name: "Bill Processing with NLP",
        reaction: "💰", 
        message: "Office supplies invoice from Staples for $250.50 due next Friday - includes paper, pens, and printer cartridges.",
        expectedType: "bill",
        expectedData: {
            vendor: "Staples",
            amount: 250.50,
            dueDate: "next Friday",
            category: "office supplies"
        }
    }
];

async function sendTestWebhook(scenario, index) {
    console.log(`\n🧪 Test ${index + 1}: ${scenario.name}`);
    console.log(`📝 Message: "${scenario.message}"`);
    console.log(`🎯 Reaction: ${scenario.reaction}`);
    
    const webhookData = {
        event: "messages.upsert",
        instance: "live-test-1750199771",
        data: {
            key: {
                remoteJid: "5214611239748@s.whatsapp.net",
                fromMe: false,
                id: `test-nlp-${Date.now()}-${index}`
            },
            message: {
                conversation: scenario.message
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: "Test User"
        }
    };

    // Send message first
    console.log(`📤 Sending message webhook...`);
    const messageResponse = await fetch(`${BASE_URL}/webhook/evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookData)
    });

    if (!messageResponse.ok) {
        console.error(`❌ Message webhook failed: ${messageResponse.status}`);
        return false;
    }

    console.log(`✅ Message webhook sent successfully`);

    // Wait a moment for message processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send reaction to trigger NLP processing
    const reactionData = {
        event: "messages.reaction",
        instance: "live-test-1750199771", 
        data: {
            key: {
                remoteJid: "5214611239748@s.whatsapp.net",
                fromMe: false,
                id: webhookData.data.key.id
            },
            reaction: {
                text: scenario.reaction,
                key: {
                    remoteJid: "5214611239748@s.whatsapp.net",
                    fromMe: false,
                    id: webhookData.data.key.id
                }
            },
            messageTimestamp: Math.floor(Date.now() / 1000)
        }
    };

    console.log(`🎯 Sending reaction webhook (${scenario.reaction})...`);
    const reactionResponse = await fetch(`${BASE_URL}/webhook/evolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reactionData)
    });

    if (!reactionResponse.ok) {
        console.error(`❌ Reaction webhook failed: ${reactionResponse.status}`);
        return false;
    }

    console.log(`✅ Reaction webhook sent successfully`);
    console.log(`🧠 NLP should now process: "${scenario.message}"`);
    console.log(`⚡ Expected to create ${scenario.expectedType} with enhanced data`);
    
    return true;
}

async function verifyNLPIntegration() {
    console.log(`🔍 Verifying NLP service integration...`);
    
    try {
        // Check if NLP service is available
        const healthResponse = await fetch(`${BASE_URL}/api/health`);
        console.log(`✅ Server health check: ${healthResponse.ok ? 'OK' : 'Failed'}`);
        
        // Verify action rules exist for our test reactions
        const rulesResponse = await fetch(`${BASE_URL}/api/action-rules`);
        if (rulesResponse.ok) {
            const rules = await rulesResponse.json();
            console.log(`📋 Found ${rules.length} action rules configured`);
            
            const checkmarkRule = rules.find(r => r.trigger_conditions?.emoji === '✅');
            const calendarRule = rules.find(r => r.trigger_conditions?.emoji === '📅');
            const billRule = rules.find(r => r.trigger_conditions?.emoji === '💰');
            
            console.log(`✅ Checkmark rule: ${checkmarkRule ? 'Found' : 'Missing'}`);
            console.log(`📅 Calendar rule: ${calendarRule ? 'Found' : 'Missing'}`);
            console.log(`💰 Bill rule: ${billRule ? 'Found' : 'Missing'}`);
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Integration verification failed:`, error.message);
        return false;
    }
}

async function runCompleteNLPTest() {
    console.log(`🚀 STARTING COMPREHENSIVE NLP AUTOMATION TEST`);
    console.log(`🔗 Target: ${BASE_URL}`);
    console.log(`📊 Test scenarios: ${testScenarios.length}`);
    
    // Verify system readiness
    const systemReady = await verifyNLPIntegration();
    if (!systemReady) {
        console.error(`❌ System not ready for testing`);
        return;
    }
    
    console.log(`\n🧪 EXECUTING TEST SCENARIOS...`);
    
    let successCount = 0;
    for (let i = 0; i < testScenarios.length; i++) {
        const success = await sendTestWebhook(testScenarios[i], i);
        if (success) {
            successCount++;
        }
        
        // Wait between tests
        if (i < testScenarios.length - 1) {
            console.log(`⏳ Waiting 3 seconds before next test...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    console.log(`\n📊 TEST SUMMARY:`);
    console.log(`✅ Successful webhooks: ${successCount}/${testScenarios.length}`);
    console.log(`🧠 NLP processing should be visible in server logs`);
    console.log(`📋 Check database for created tasks, events, and bills`);
    
    console.log(`\n🔍 EXPECTED RESULTS:`);
    testScenarios.forEach((scenario, index) => {
        console.log(`${index + 1}. ${scenario.reaction} → ${scenario.expectedType} with NLP-extracted data`);
    });
    
    console.log(`\n✨ NLP AUTOMATION TEST COMPLETED`);
    console.log(`Monitor server logs for detailed NLP processing information`);
}

// Run the comprehensive test
runCompleteNLPTest().catch(console.error);