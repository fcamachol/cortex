// Direct test of the group sync functionality
const { WebhookApiAdapter } = require('./server/whatsapp-api-adapter');

async function testGroupSync() {
    try {
        console.log('Testing group sync functionality...');
        const result = await WebhookApiAdapter.syncAllGroupSubjects('instance-1750433520122');
        console.log('Sync result:', result);
    } catch (error) {
        console.error('Error testing group sync:', error);
    }
}

testGroupSync();