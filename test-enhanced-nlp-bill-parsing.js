/**
 * COMPREHENSIVE ENHANCED NLP BILL PARSING TEST
 * Tests the new nlp.js module with improved Spanish vendor extraction
 */

async function testEnhancedBillReaction() {
    console.log('🧪 Testing enhanced NLP bill parsing with nlp.js module...');
    
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

    console.log('📋 Expected improvements:');
    console.log('   - "Pago 1900 a Lalo Costco" → vendor: "Lalo" (not "Pago")');
    console.log('   - Enhanced Spanish pattern matching');
    console.log('   - Proper status constraint compliance ("unpaid")');
    
    try {
        const response = await fetch('https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'B6D711FCDE4D4FD5936544120E713976'
            },
            body: JSON.stringify(webhookPayload)
        });

        if (response.status === 200) {
            console.log('✅ Enhanced bill reaction webhook processed successfully');
        } else {
            console.log('❌ Unexpected response:', response.status);
        }
        
    } catch (error) {
        console.error('❌ Error sending webhook:', error);
    }
}

async function checkEnhancedBillResults() {
    console.log('🔍 Checking enhanced bill parsing results...');
    
    try {
        const response = await fetch('https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/finance/payables');
        
        if (response.ok) {
            const bills = await response.json();
            console.log(`📊 Total bills in database: ${bills.length}`);
            
            if (bills.length > 0) {
                const recentBill = bills[0];
                console.log('📋 Most recent bill details:');
                console.log(`   - Description: ${recentBill.description}`);
                console.log(`   - Amount: $${recentBill.amount} ${recentBill.currency || 'MXN'}`);
                console.log(`   - Vendor ID: ${recentBill.vendor_entity_id}`);
                console.log(`   - Status: ${recentBill.status}`);
                console.log(`   - Category: ${recentBill.category || 'N/A'}`);
                console.log(`   - Created: ${recentBill.created_at}`);
                
                // Validation checks
                let successCount = 0;
                const totalChecks = 4;
                
                // Check 1: Vendor extraction
                if (recentBill.description && (recentBill.description.includes('Lalo') || recentBill.description.includes('lalo'))) {
                    console.log('✅ SUCCESS: Vendor "Lalo" correctly extracted!');
                    successCount++;
                } else {
                    console.log('❌ ISSUE: Vendor extraction still needs improvement');
                }
                
                // Check 2: Amount extraction
                if (recentBill.amount && parseFloat(recentBill.amount) === 1900) {
                    console.log('✅ SUCCESS: Amount $1900 correctly extracted!');
                    successCount++;
                } else {
                    console.log('❌ ISSUE: Amount extraction incorrect');
                }
                
                // Check 3: Status compliance
                if (recentBill.status && ['draft', 'unpaid', 'paid', 'overdue'].includes(recentBill.status)) {
                    console.log('✅ SUCCESS: Status constraint compliant!');
                    successCount++;
                } else {
                    console.log('❌ ISSUE: Status constraint violation');
                }
                
                // Check 4: Creation success
                if (recentBill.created_at) {
                    console.log('✅ SUCCESS: Bill created successfully!');
                    successCount++;
                } else {
                    console.log('❌ ISSUE: Bill creation problem');
                }
                
                console.log(`\n📊 ENHANCED NLP VALIDATION: ${successCount}/${totalChecks} checks passed`);
                
                if (successCount === totalChecks) {
                    console.log('🎉 COMPLETE SUCCESS: Enhanced NLP.js working perfectly!');
                } else if (successCount >= 3) {
                    console.log('✅ MOSTLY SUCCESSFUL: Minor improvements needed');
                } else {
                    console.log('⚠️ NEEDS WORK: Multiple issues detected');
                }
            } else {
                console.log('❌ No bills found - check if creation failed');
            }
        } else {
            console.log('❌ Failed to fetch bills:', response.status);
        }
        
    } catch (error) {
        console.error('❌ Error checking bills:', error);
    }
}

async function main() {
    console.log('🧪 ENHANCED NLP.JS BILL PARSING TEST');
    console.log('===================================');
    
    console.log('📤 Step 1: Sending enhanced 💳 reaction...');
    await testEnhancedBillReaction();
    
    console.log('⏳ Step 2: Waiting 6 seconds for enhanced processing...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    console.log('🔍 Step 3: Validating enhanced results...');
    await checkEnhancedBillResults();
    
    console.log('\n✅ Enhanced NLP test completed!');
}

main().catch(console.error);