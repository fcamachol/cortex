/**
 * TEST TEMPLATE PROCESSING
 * Tests the template variable processing system with sample context data
 */

// Mock the ActionService processTemplate method
function processTemplate(template, context) {
    if (!template) return '';
    
    // Extract sender name from JID (e.g., "5215579188699@s.whatsapp.net" -> "5215579188699")
    const senderName = context.senderJid ? context.senderJid.split('@')[0] : 'Unknown';
    
    // Generate task number (simple timestamp-based approach)
    const taskNumber = `TASK-${Date.now().toString().slice(-6)}`;
    
    return template
        .replace(/\{\{content\}\}/g, context.content || '')
        .replace(/\{\{emoji\}\}/g, context.emoji || '')
        .replace(/\{\{messageId\}\}/g, context.messageId || '')
        .replace(/\{\{chatId\}\}/g, context.chatId || '')
        .replace(/\{\{sender\}\}/g, senderName)
        .replace(/\{\{senderJid\}\}/g, context.senderJid || '')
        .replace(/\{\{taskNumber\}\}/g, taskNumber);
}

// Test data similar to what would come from a WhatsApp reaction
const testContext = {
    messageId: '3ADEE270337398CB5AF1',
    reactorJid: '5215579188699@s.whatsapp.net',
    chatId: '5215579188699@s.whatsapp.net',
    content: 'Hello, this is a test message',
    senderJid: '5215579188699@s.whatsapp.net',
    timestamp: new Date(),
    instanceName: 'live-test-1750199771',
    emoji: '✅'
};

// Test templates
const testTemplates = [
    'new task {{sender}}',
    'Task from {{sender}}: {{content}}',
    '{{taskNumber}} - {{emoji}} reaction from {{sender}}',
    'Contact: {{sender}} ({{senderJid}}) reacted with {{emoji}}'
];

console.log('🧪 TESTING TEMPLATE PROCESSING');
console.log('=' .repeat(50));

console.log('\n📋 Test Context Data:');
Object.entries(testContext).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
});

console.log('\n✨ Template Processing Results:');
testTemplates.forEach((template, index) => {
    const processed = processTemplate(template, testContext);
    console.log(`\n${index + 1}. Template: "${template}"`);
    console.log(`   Result:   "${processed}"`);
});

console.log('\n✅ Template processing test completed');