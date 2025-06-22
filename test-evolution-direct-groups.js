import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'instance-1750433520122';

async function testEvolutionDirectGroups() {
    console.log('Testing Evolution API direct group fetching...');
    
    // Test various potential endpoints for fetching groups/chats
    const endpointsToTest = [
        `/chat/findChats/${INSTANCE_NAME}`,
        `/chat/findAll/${INSTANCE_NAME}`,
        `/chat/whatsappNumbers/${INSTANCE_NAME}`,
        `/group/findAll/${INSTANCE_NAME}`,
        `/group/findGroups/${INSTANCE_NAME}`,
        `/group/list/${INSTANCE_NAME}`,
        `/instance/fetchInstances`, // Already know this works, check structure
        `/message/findMessages/${INSTANCE_NAME}`,
        `/contact/findContacts/${INSTANCE_NAME}`
    ];
    
    for (const endpoint of endpointsToTest) {
        try {
            console.log(`\n🔍 Testing endpoint: ${endpoint}`);
            
            const response = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_KEY
                },
                timeout: 10000
            });
            
            console.log(`Status: ${response.status}`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (Array.isArray(data)) {
                    console.log(`✅ Array response with ${data.length} items`);
                    
                    // Look for group-like items
                    const groupItems = data.filter(item => 
                        (item.id && item.id.endsWith('@g.us')) ||
                        (item.jid && item.jid.endsWith('@g.us')) ||
                        (item.remoteJid && item.remoteJid.endsWith('@g.us')) ||
                        (item.Chat && Array.isArray(item.Chat))
                    );
                    
                    if (groupItems.length > 0) {
                        console.log(`🎯 Found ${groupItems.length} potential group items!`);
                        console.log('Sample item structure:', JSON.stringify(groupItems[0], null, 2));
                    } else if (data.length > 0) {
                        console.log('Sample item keys:', Object.keys(data[0]));
                    }
                } else if (typeof data === 'object' && data !== null) {
                    console.log(`✅ Object response with keys:`, Object.keys(data));
                    
                    // Check if object contains chat/group arrays
                    for (const [key, value] of Object.entries(data)) {
                        if (Array.isArray(value) && value.length > 0) {
                            const groupItems = value.filter(item => 
                                (item.id && item.id.endsWith('@g.us')) ||
                                (item.jid && item.jid.endsWith('@g.us'))
                            );
                            if (groupItems.length > 0) {
                                console.log(`🎯 Found ${groupItems.length} groups in property "${key}"`);
                            }
                        }
                    }
                } else {
                    console.log(`Response type: ${typeof data}`);
                }
            } else {
                const errorText = await response.text();
                console.log(`❌ Error: ${errorText}`);
            }
            
        } catch (error) {
            console.log(`❌ Request failed: ${error.message}`);
        }
    }
    
    // Test instance metadata for specific instance
    try {
        console.log(`\n🔍 Testing instance metadata for ${INSTANCE_NAME}...`);
        
        const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            }
        });
        
        if (response.ok) {
            const instances = await response.json();
            const targetInstance = instances.find(inst => inst.name === INSTANCE_NAME);
            
            if (targetInstance) {
                console.log('Target instance found with keys:', Object.keys(targetInstance));
                console.log('Instance _count:', targetInstance._count);
                
                // Check if there are chats/messages
                if (targetInstance._count && targetInstance._count.Chat > 0) {
                    console.log(`Instance has ${targetInstance._count.Chat} chats!`);
                }
            } else {
                console.log(`Instance ${INSTANCE_NAME} not found in list`);
                console.log('Available instances:', instances.map(i => i.name));
            }
        }
    } catch (error) {
        console.log(`Error checking instance metadata: ${error.message}`);
    }
    
    console.log('\n✅ Evolution API endpoint testing complete');
}

testEvolutionDirectGroups().catch(console.error);