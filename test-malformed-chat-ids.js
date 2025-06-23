/**
 * Test script to simulate malformed chat IDs where Evolution API combines group JID with owner JID
 */

async function testMalformedChatIds() {
    const instanceId = 'instance-1750433520122';
    const webhookUrl = `http://localhost:5000/api/evolution/webhook/${instanceId}/messages-upsert`;
    
    console.log('🧪 Testing malformed chat ID detection and correction...\n');

    // Test Case 1: Group message with malformed chat ID (simulating Evolution API bug)
    // Based on your example, this shows how a malformed remoteJid should be corrected
    const malformedGroupMessage = {
        key: {
            id: 'TEST_MALFORMED_GROUP_REAL',
            fromMe: false,
            // This malformed ID represents Evolution API combining group JID + owner JID
            remoteJid: 'cmc4yy03m10s6k34q3j768pan',  // Malformed - should be group JID
            participant: '5215551053317@s.whatsapp.net'  // Sender JID (like your example)
        },
        messageType: 'conversation',
        message: {
            conversation: 'Test group message - should correct malformed remoteJid to proper group JID'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Test Group Member',
        source: 'android',
        // The correct group JID should be embedded somewhere in the message data
        // Simulating where Evolution API might include the real group JID
        metadata: {
            groupInfo: {
                jid: '5215551053317-1438010896@g.us',  // Real group JID that should be extracted
                subject: 'Test Group Chat'
            }
        }
    };

    // Test Case 2: Individual chat with malformed ID
    const malformedIndividualMessage = {
        key: {
            id: 'TEST_MALFORMED_INDIVIDUAL_456',
            fromMe: true,
            remoteJid: 'xyz789abc123def456ghi',  // Malformed individual chat ID
            participant: null
        },
        messageType: 'conversation',
        message: {
            conversation: 'Test message with malformed individual chat ID'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Owner',
        source: 'android',
        // Additional data that might contain the correct individual JID
        contact: {
            id: '5214422501780@s.whatsapp.net',  // Correct individual JID
            name: 'Contact Name'
        }
    };

    const testCases = [
        { name: 'Malformed Group Chat ID', data: malformedGroupMessage },
        { name: 'Malformed Individual Chat ID', data: malformedIndividualMessage }
    ];

    for (const testCase of testCases) {
        try {
            console.log(`🧪 Testing: ${testCase.name}`);
            console.log(`   Malformed ID: ${testCase.data.key.remoteJid}`);
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testCase.data)
            });

            if (response.ok) {
                console.log(`✅ ${testCase.name}: Webhook processed successfully (${response.status})`);
            } else {
                console.log(`❌ ${testCase.name}: Failed (${response.status})`);
                const errorText = await response.text();
                console.log(`   Error: ${errorText}`);
            }
        } catch (error) {
            console.log(`❌ ${testCase.name}: Error - ${error.message}`);
        }
        console.log('');
    }

    console.log('📊 Malformed chat ID testing completed!');
}

// Run the test
testMalformedChatIds().catch(console.error);