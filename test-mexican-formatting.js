/**
 * TEST MEXICAN FINANCE FORMATTING
 * Tests that amounts like "5,000" are parsed as 5000 (not 5) using comma as thousands separator
 */

// Import the enhanced NLP parser
import { parseEnhancedBill } from './server/nlp.js';

async function testMexicanFormatting() {
    console.log('🧪 TESTING MEXICAN FINANCE FORMATTING');
    console.log('====================================\n');

    const testCases = [
        'Pago 5,000 a Carlos del Taller mecánico',
        'Factura 1,234 a Juan electricista',
        'Pagar 10,500 a Maria dentista',
        'Bill 2,750 to vendor ABC',
        'Payment $15,000 to supplier XYZ'
    ];

    for (const testCase of testCases) {
        console.log(`🔍 Testing: "${testCase}"`);
        
        try {
            const result = await parseEnhancedBill(testCase);
            
            if (result && result.amount) {
                console.log(`   ✅ Amount: ${result.amount} ${result.currency || 'MXN'}`);
                console.log(`   ✅ Vendor: ${result.vendor || 'Unknown'}`);
                
                // Check if amount is correctly parsed (should be thousands, not single digits)
                if (result.amount >= 1000) {
                    console.log(`   ✅ CORRECT: Thousands separator handled properly`);
                } else {
                    console.log(`   ❌ ERROR: Amount too small - thousands separator not handled`);
                }
            } else {
                console.log(`   ❌ ERROR: No amount extracted`);
            }
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
        }
        
        console.log('');
    }
}

// Run the test
testMexicanFormatting().catch(console.error);