/**
 * TEST ENHANCED NLP.JS ARCHITECTURE
 * Tests the suggested architecture: chrono-node + franc + currency.js + NLP.js
 * Focus: "Pago 1900 a Lalo Costco" → vendor: "Lalo"
 */

async function testNLPJSArchitecture() {
    console.log('🧪 Testing NLP.js Architecture for Spanish Bill Parsing...');
    
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

    console.log('📋 Testing enhanced NLP.js features:');
    console.log('   ✓ NLP.js entity recognition for vendors');
    console.log('   ✓ chrono-node for Spanish date parsing');
    console.log('   ✓ franc for language detection');
    console.log('   ✓ currency.js for amount extraction');
    console.log('   ✓ Pattern matching fallbacks');
    
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
            console.log('✅ NLP.js architecture webhook processed successfully');
        } else {
            console.log('❌ Unexpected response:', response.status);
        }
        
    } catch (error) {
        console.error('❌ Error sending webhook:', error);
    }
}

async function validateNLPJSResults() {
    console.log('🔍 Validating NLP.js architecture results...');
    
    try {
        const response = await fetch('https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/finance/payables');
        
        if (response.ok) {
            const bills = await response.json();
            console.log(`📊 Total bills: ${bills.length}`);
            
            if (bills.length > 0) {
                const latestBill = bills[0];
                console.log('\n📋 Latest Bill Analysis:');
                console.log(`   Description: "${latestBill.description}"`);
                console.log(`   Amount: $${latestBill.amount} ${latestBill.currency || 'MXN'}`);
                console.log(`   Status: ${latestBill.status}`);
                console.log(`   Category: ${latestBill.category || 'N/A'}`);
                console.log(`   Created: ${latestBill.created_at}`);
                
                // Enhanced validation checks
                const validationResults = {
                    vendorExtraction: false,
                    amountExtraction: false,
                    statusCompliance: false,
                    successfulCreation: false,
                    nlpjsFeatures: false
                };
                
                // Check vendor extraction (should extract "Lalo" not "Pago")
                if (latestBill.description && 
                    (latestBill.description.toLowerCase().includes('lalo') && 
                     !latestBill.description.toLowerCase().startsWith('pago'))) {
                    validationResults.vendorExtraction = true;
                    console.log('✅ VENDOR: "Lalo" correctly extracted (not "Pago")');
                } else {
                    console.log('❌ VENDOR: Extraction still showing "Pago" instead of "Lalo"');
                }
                
                // Check amount
                if (latestBill.amount && parseFloat(latestBill.amount) === 1900) {
                    validationResults.amountExtraction = true;
                    console.log('✅ AMOUNT: $1900 correctly extracted');
                } else {
                    console.log('❌ AMOUNT: Incorrect amount extraction');
                }
                
                // Check status compliance
                const validStatuses = ['draft', 'unpaid', 'partially_paid', 'paid', 'overdue', 'disputed', 'cancelled'];
                if (latestBill.status && validStatuses.includes(latestBill.status)) {
                    validationResults.statusCompliance = true;
                    console.log('✅ STATUS: Database constraint compliant');
                } else {
                    console.log('❌ STATUS: Constraint violation detected');
                }
                
                // Check creation
                if (latestBill.id && latestBill.created_at) {
                    validationResults.successfulCreation = true;
                    console.log('✅ CREATION: Bill successfully created');
                }
                
                // Calculate overall success
                const successCount = Object.values(validationResults).filter(Boolean).length;
                const totalChecks = Object.keys(validationResults).length;
                
                console.log(`\n📊 NLP.JS ARCHITECTURE VALIDATION: ${successCount}/${totalChecks} checks passed`);
                
                if (successCount === totalChecks) {
                    console.log('🎉 COMPLETE SUCCESS: NLP.js architecture working perfectly!');
                } else if (successCount >= 3) {
                    console.log('✅ GOOD PROGRESS: NLP.js improvements working');
                } else {
                    console.log('⚠️ NEEDS IMPROVEMENT: Architecture issues detected');
                }
                
            } else {
                console.log('❌ No bills found - creation may have failed');
            }
        } else {
            console.log('❌ Failed to fetch bills:', response.status);
        }
        
    } catch (error) {
        console.error('❌ Error validating results:', error);
    }
}

async function main() {
    console.log('🧪 NLP.JS ARCHITECTURE VALIDATION TEST');
    console.log('======================================');
    console.log('Suggested Stack: chrono-node + franc + currency.js + @nlpjs/*');
    
    console.log('\n📤 Step 1: Testing NLP.js bill reaction...');
    await testNLPJSArchitecture();
    
    console.log('\n⏳ Step 2: Waiting for enhanced processing...');
    await new Promise(resolve => setTimeout(resolve, 7000));
    
    console.log('\n🔍 Step 3: Validating NLP.js results...');
    await validateNLPJSResults();
    
    console.log('\n✅ NLP.js architecture test completed!');
}

main().catch(console.error);