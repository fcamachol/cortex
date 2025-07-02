/**
 * TEST BILL-TO-CONTACT LINKING FUNCTIONALITY
 * Tests that bills are properly linked to the contact that created them via WhatsApp
 */

const BASE_URL = 'http://localhost:5000';

async function sendWebhook(eventType, data) {
    const response = await fetch(`${BASE_URL}/api/evolution/webhook/live-test-1750199771/${eventType.replace('.', '-')}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            event: eventType,
            instance: "live-test-1750199771",
            data: data
        })
    });
    
    if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
    }
    
    return response.json();
}

async function testBillToContactLinking() {
    console.log('🧪 TESTING BILL-TO-CONTACT LINKING');
    console.log('===================================');
    
    const senderJid = "15103165094@s.whatsapp.net"; // Instance owner who can trigger reactions
    const messageId = `bill-contact-test-${Date.now()}`;
    
    // Step 1: Send a bill-related message
    console.log('📤 Step 1: Sending bill message...');
    const messageData = {
        key: {
            remoteJid: senderJid,
            fromMe: false,
            id: messageId
        },
        message: {
            conversation: "Pago 2500 a Carlos del Taller mecánico por reparación del carro"
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: "Fernando",
        sender: senderJid
    };
    
    await sendWebhook("messages.upsert", messageData);
    console.log('✅ Bill message sent');
    
    // Wait a moment for message processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Send 💳 reaction to trigger bill creation
    console.log('📤 Step 2: Sending 💳 reaction to create bill...');
    const reactionData = {
        key: {
            remoteJid: senderJid,
            fromMe: true,
            id: messageId
        },
        messageType: "reactionMessage",
        message: {
            reactionMessage: {
                key: {
                    remoteJid: senderJid,
                    fromMe: false,
                    id: messageId
                },
                text: "💳",
                senderTimestampMs: Date.now()
            }
        },
        pushName: "Fernando",
        sender: senderJid
    };
    
    await sendWebhook("messages.upsert", reactionData);
    console.log('✅ Bill creation reaction sent');
    
    // Wait for bill processing
    console.log('⏳ Step 3: Waiting 8 seconds for bill processing...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Step 3: Check created bills and their contact linking
    console.log('🔍 Step 4: Checking bill-to-contact linking...');
    
    try {
        const billsResponse = await fetch(`${BASE_URL}/api/finance/payables`);
        const bills = await billsResponse.json();
        
        // Find recently created bills (last 2 minutes)
        const recentBills = bills.filter(bill => 
            new Date(bill.createdAt) > new Date(Date.now() - 120000)
        );
        
        console.log(`📊 Total bills: ${bills.length}, Recent bills: ${recentBills.length}`);
        
        if (recentBills.length > 0) {
            console.log('\n🔗 BILL-TO-CONTACT LINKING ANALYSIS:');
            recentBills.forEach((bill, index) => {
                console.log(`\n   Bill ${index + 1}:`);
                console.log(`   📄 Vendor: ${bill.vendor || 'Unknown'}`);
                console.log(`   💰 Amount: $${bill.amount} ${bill.currency || 'MXN'}`);
                console.log(`   📅 Due Date: ${bill.dueDate}`);
                console.log(`   🔗 Created By Entity ID: ${bill.createdByEntityId}`);
                console.log(`   📝 Description: ${bill.description}`);
                
                if (bill.createdByEntityId && bill.createdByEntityId !== '7804247f-3ae8-4eb2-8c6d-2c44f967ad42') {
                    console.log(`   ✅ SUCCESS: Bill linked to contact: ${bill.createdByEntityId}`);
                } else if (bill.createdByEntityId === '7804247f-3ae8-4eb2-8c6d-2c44f967ad42') {
                    console.log(`   ⚠️  FALLBACK: Bill using default user ID (no contact found)`);
                } else {
                    console.log(`   ❌ ERROR: No created_by_entity_id found`);
                }
            });
            
            console.log('\n✅ BILL-TO-CONTACT LINKING TEST COMPLETED');
        } else {
            console.log('❌ No recent bills found - bill creation may have failed');
        }
        
    } catch (error) {
        console.error('❌ Error checking bills:', error);
    }
}

async function checkContactLookup() {
    console.log('\n🔍 CHECKING CONTACT LOOKUP BY WHATSAPP JID');
    console.log('==========================================');
    
    const testJid = "15103165094@s.whatsapp.net";
    
    try {
        const response = await fetch(`${BASE_URL}/api/whatsapp/contacts/lookup/${encodeURIComponent(testJid)}`);
        
        if (response.ok) {
            const contact = await response.json();
            console.log(`✅ Contact found for ${testJid}:`);
            console.log(`   ID: ${contact.id}`);
            console.log(`   Name: ${contact.name}`);
            console.log(`   Cortex Linked: ${contact.isCortexLinked}`);
        } else {
            console.log(`📝 No contact found for ${testJid} (${response.status})`);
            console.log('   This means bills will use default user ID');
        }
    } catch (error) {
        console.log(`⚠️  Could not lookup contact: ${error.message}`);
    }
}

async function main() {
    console.log('🚀 BILL-TO-CONTACT LINKING TEST SUITE');
    console.log('=====================================\n');
    
    // First check if contact lookup works
    await checkContactLookup();
    
    // Then test bill creation with contact linking
    await testBillToContactLinking();
    
    console.log('\n🏁 Test completed!');
}

main().catch(console.error);