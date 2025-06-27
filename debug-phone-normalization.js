/**
 * Debug phone number normalization to understand exact issue
 */

function phoneToWhatsAppJid(phoneNumber) {
    // Remove all non-digit characters
    let digits = phoneNumber.replace(/\D/g, '');
    
    // Remove leading zeros
    digits = digits.replace(/^0+/, '');
    
    console.log(`Processing phone: ${phoneNumber}`);
    console.log(`Digits after cleaning: ${digits}`);
    console.log(`Length: ${digits.length}`);
    console.log(`Starts with 521: ${digits.startsWith('521')}`);
    console.log(`Starts with 52: ${digits.startsWith('52')}`);
    
    // Handle different phone number formats
    if (digits.startsWith('521') && digits.length >= 13) {
        // Mexican mobile with proper country code (521)
        console.log(`Match: Mexican mobile with proper country code`);
        return `${digits}@s.whatsapp.net`;
    } else if (digits.startsWith('52') && digits.length === 12) {
        // Mexican number with country code but missing mobile prefix
        // Convert 525579188699 to 5215579188699 
        console.log(`Match: Mexican with country code but missing mobile prefix`);
        const result = `521${digits.substring(2)}@s.whatsapp.net`;
        console.log(`Result: ${result}`);
        return result;
    } else if (digits.startsWith('1') && digits.length === 11) {
        // US/Canada number
        console.log(`Match: US/Canada number`);
        return `${digits}@s.whatsapp.net`;
    } else if (digits.length === 10) {
        // 10-digit number, could be US without country code or Mexican without country code
        if (digits.startsWith('55') || digits.startsWith('56') || digits.startsWith('81') || digits.startsWith('33')) {
            // Common Mexican area codes, add Mexican mobile prefix
            console.log(`Match: Mexican area code, adding mobile prefix`);
            return `521${digits}@s.whatsapp.net`;
        } else {
            // Could be US number without country code, add US country code
            console.log(`Match: US number without country code`);
            return `1${digits}@s.whatsapp.net`;
        }
    }
    
    // Default: use as provided
    console.log(`Match: Default case`);
    return `${digits}@s.whatsapp.net`;
}

// Test the problematic cases
const testCases = [
    '525579188699',
    '5215579188699',
    '+525579188699',
    '5579188699'
];

console.log('='.repeat(50));
console.log('Phone Number Normalization Debug');
console.log('='.repeat(50));

testCases.forEach(testCase => {
    console.log('\n' + '-'.repeat(30));
    const result = phoneToWhatsAppJid(testCase);
    console.log(`Final result: ${result}`);
    console.log(`Expected: 5215579188699@s.whatsapp.net`);
    console.log(`Match: ${result === '5215579188699@s.whatsapp.net' ? 'YES' : 'NO'}`);
});