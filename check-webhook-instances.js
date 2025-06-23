/**
 * Check webhook instances and configuration for missing messages from 5214611239748
 */

async function checkWebhookInstances() {
    console.log('🔍 Checking webhook instances and configuration...');
    
    try {
        // Get available instances
        const instancesResponse = await fetch('http://localhost:5000/api/whatsapp/instances/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        const instances = await instancesResponse.json();
        
        console.log(`\n📱 Available instances (${instances.length}):`);
        instances.forEach(instance => {
            console.log(`  - ${instance.instanceId} (${instance.name || 'Unnamed'})`);
        });
        
        // Check recent messages to see which instances are active
        console.log('\n💬 Recent message activity by instance:');
        const conversationsResponse = await fetch('http://localhost:5000/api/whatsapp/conversations/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        const conversations = await conversationsResponse.json();
        
        const instanceActivity = {};
        conversations.forEach(conv => {
            if (!instanceActivity[conv.instanceId]) {
                instanceActivity[conv.instanceId] = 0;
            }
            instanceActivity[conv.instanceId]++;
        });
        
        Object.keys(instanceActivity).forEach(instanceId => {
            console.log(`  - ${instanceId}: ${instanceActivity[instanceId]} conversations`);
        });
        
        // Check if there are any contacts with similar phone patterns
        console.log('\n📞 Checking for similar phone number patterns...');
        const contactsResponse = await fetch('http://localhost:5000/api/contacts/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        const contacts = await contactsResponse.json();
        
        const similarContacts = contacts.filter(contact => 
            contact.id && (
                contact.id.includes('52146') || 
                contact.id.includes('461123') ||
                contact.id.includes('1239748')
            )
        );
        
        if (similarContacts.length > 0) {
            console.log('📱 Similar phone number patterns found:');
            similarContacts.forEach(contact => {
                console.log(`  - ${contact.id} (${contact.name || 'No name'})`);
            });
        } else {
            console.log('❌ No similar phone number patterns found');
        }
        
        // Recommendations
        console.log('\n🎯 RECOMMENDATIONS:');
        console.log('1. Verify which Evolution API instance is connected to the WhatsApp account receiving messages from 5214611239748');
        console.log('2. Check if the phone number 5214611239748 has actually sent messages to your WhatsApp');
        console.log('3. Ensure webhook URLs are correctly configured in Evolution API for all instances');
        console.log('4. Monitor webhook logs when expecting messages from this contact');
        
        // Test webhook endpoints for all instances
        console.log('\n🌐 Testing webhook endpoints for all instances...');
        for (const instance of instances) {
            try {
                const testResponse = await fetch(`http://localhost:5000/api/evolution/webhook/${instance.instanceId}/connection-update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'connection.update',
                        instance: instance.instanceId,
                        data: { state: 'open' }
                    })
                });
                
                if (testResponse.ok) {
                    console.log(`✅ ${instance.instanceId}: Webhook endpoint responding`);
                } else {
                    console.log(`❌ ${instance.instanceId}: Webhook endpoint not responding`);
                }
            } catch (error) {
                console.log(`❌ ${instance.instanceId}: Webhook test failed - ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking webhook instances:', error.message);
    }
}

checkWebhookInstances().catch(console.error);