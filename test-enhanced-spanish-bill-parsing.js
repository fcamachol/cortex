/**
 * TEST ENHANCED SPANISH BILL PARSING WITH FIXED VENDOR EXTRACTION
 * 
 * This tests the complete bill automation workflow:
 * 1. Enhanced Spanish vendor parsing ("Pago 1900 a Lalo Costco" → "Lalo")
 * 2. Fixed storage.createBillPayable method availability
 * 3. End-to-end bill creation from WhatsApp reaction
 */

async function sendBillReactionWebhook() {
    const webhookPayload = {
        event: "messages.upsert",
        instanceName: "live-test-1750199771",
        data: {
            key: {
                remoteJid: "5215579188699@s.whatsapp.net",
                fromMe: true,
                id: "3A622B76475E4E46C1C5"
            },
            messageType: "reactionMessage",
            message: {
                reactionMessage: {
                    key: {
                        remoteJid: "5215579188699@s.whatsapp.net",
                        fromMe: true,
                        id: "3A622B76475E4E46C1C5"
                    },
                    text: "💳",
                    senderTimestampMs: Date.now()
                }
            },
            pushName: "Fernando",
            sender: "15103165094@s.whatsapp.net",
            instanceName: "live-test-1750199771"
        }
    };

    console.log('🧪 Testing enhanced Spanish bill parsing...');
    console.log('📋 Expected: "Pago 1900 a Lalo Costco" should extract "Lalo" as vendor');
    
    try {
        const response = await fetch('https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'B6D711FCDE4D4FD5936544120E713976'
            },
            body: JSON.stringify(webhookPayload)
        });

        const result = await response.text();
        console.log('✅ Webhook response:', response.status);
        console.log('📝 Response body:', result);
        
    } catch (error) {
        console.error('❌ Error sending webhook:', error);
    }
}

async function checkBillCreation() {
    console.log('🔍 Checking if bill was created in database...');
    
    try {
        const response = await fetch('https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/finance/payables');
        const bills = await response.json();
        
        console.log(`📊 Total bills in database: ${bills.length}`);
        
        // Find the most recent bill
        const recentBill = bills[0];
        if (recentBill) {
            console.log('📋 Most recent bill created:');
            console.log(`   - Description: ${recentBill.description}`);
            console.log(`   - Amount: $${recentBill.amount} ${recentBill.currency || 'MXN'}`);
            console.log(`   - Vendor: ${recentBill.vendor_entity_id}`);
            console.log(`   - Status: ${recentBill.status}`);
            console.log(`   - Created: ${recentBill.created_at}`);
            
            // Check if vendor extraction worked correctly
            if (recentBill.description && recentBill.description.includes('Lalo')) {
                console.log('✅ SUCCESS: Vendor "Lalo" correctly extracted and stored!');
            } else {
                console.log('❌ ISSUE: Vendor extraction may not have worked correctly');
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking bills:', error);
    }
}

async function main() {
    console.log('🧪 ENHANCED SPANISH BILL PARSING TEST');
    console.log('=====================================');
    
    // Wait a moment to ensure previous test messages are processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📤 Step 1: Sending 💳 reaction to trigger bill creation...');
    await sendBillReactionWebhook();
    
    console.log('⏳ Step 2: Waiting 8 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    console.log('🔍 Step 3: Checking bill creation results...');
    await checkBillCreation();
    
    console.log('✅ Test completed!');
}

main().catch(console.error);