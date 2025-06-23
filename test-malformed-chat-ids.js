/**
 * Test script to simulate malformed chat IDs where Evolution API combines group JID with owner JID
 */

async function testMalformedChatIds() {
    const instanceId = 'instance-1750433520122';
    const webhookUrl = `http://localhost:5000/api/evolution/webhook/${instanceId}/messages-upsert`;
    
    console.log('🧪 Testing malformed chat ID detection and correction...\n');

    // Test Case 1: Group message with malformed chat ID (combining group JID + owner JID)
    const malformedGroupMessage = {
        key: {
            id: 'TEST_MALFORMED_GROUP_FIXED',
            fromMe: false,
            // This is the malformed ID that combines group + owner
            remoteJid: 'cmc4yy03m10s6k34q3j768pan',  // Malformed combination
            participant: '5215551053317@s.whatsapp.net'  // Actual participant
        },
        messageType: 'conversation',
        message: {
            conversation: 'Test message with malformed group chat ID - should extract correct group JID'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Test Group Member',
        source: 'android',
        // Additional data that contains the correct group JID
        chat: {
            id: '5215551053317-1438010896@g.us',  // Correct group JID embedded in data
            subject: 'Test Group Chat'
        },
        // Simulate Evolution API structure where group JID might be present
        groupData: {
            groupJid: '5215551053317-1438010896@g.us',
            subject: 'Test Group Chat',
            participants: ['5215551053317@s.whatsapp.net', '5214422501780@s.whatsapp.net']
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