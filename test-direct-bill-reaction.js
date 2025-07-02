/**
 * DIRECT BILL REACTION TEST
 * Tests the enhanced Spanish vendor parsing directly with Evolution API webhook format
 */

async function testDirectBillReaction() {
    console.log('🧪 Testing direct bill reaction with Evolution API format...');
    
    const webhookPayload = {
        event: "messages.upsert",
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
            instanceId: "c5215849-bfb9-413c-aa94-dfa911c8310a"
        }
    };

    try {
        const response = await fetch('https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'B6D711FCDE4D4FD5936544120E713976'
            },
            body: JSON.stringify(webhookPayload)
        });

        const result = await response.text();
        console.log('✅ Webhook sent successfully:', response.status);
        
        if (response.status === 200) {
            console.log('✅ Bill reaction webhook processed successfully');
        } else {
            console.log('❌ Unexpected response:', response.status);
            console.log('Response body:', result);
        }
        
    } catch (error) {
        console.error('❌ Error sending webhook:', error);
    }
}

async function checkBillPayables() {
    console.log('🔍 Checking bill payables in database...');
    
    try {
        const response = await fetch('https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/finance/payables');
        
        if (response.ok) {
            const bills = await response.json();
            console.log(`📊 Total bills in database: ${bills.length}`);
            
            // Show the most recent bill
            if (bills.length > 0) {
                const recentBill = bills[0];
                console.log('📋 Most recent bill:');
                console.log(`   - Description: ${recentBill.description}`);
                console.log(`   - Amount: $${recentBill.amount}`);
                console.log(`   - Vendor ID: ${recentBill.vendor_entity_id}`);
                console.log(`   - Status: ${recentBill.status}`);
                
                // Check if description contains vendor name
                if (recentBill.description && recentBill.description.includes('Lalo')) {
                    console.log('✅ SUCCESS: Vendor "Lalo" correctly extracted!');
                } else {
                    console.log('❌ Vendor extraction needs improvement');
                }
            }
        } else {
            console.log('❌ Failed to fetch bills:', response.status);
        }
        
    } catch (error) {
        console.error('❌ Error checking bills:', error);
    }
}

async function main() {
    console.log('🧪 DIRECT BILL REACTION TEST');
    console.log('============================');
    
    console.log('📤 Step 1: Sending 💳 reaction webhook...');
    await testDirectBillReaction();
    
    console.log('⏳ Step 2: Waiting 5 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🔍 Step 3: Checking results...');
    await checkBillPayables();
    
    console.log('✅ Test completed!');
}

main().catch(console.error);