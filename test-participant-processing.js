/**
 * Test script to verify group participant processing functionality
 */

async function testParticipantProcessing() {
    console.log('🧪 Testing group participant processing...');
    
    const WEBHOOK_URL = 'http://localhost:5000/api/evolution/webhook/instance-1750433520122';
    const TEST_GROUP_JID = '120363401289456998@g.us';
    
    // Test 1: Groups upsert with participants
    console.log('\n1. Testing groups.upsert with participant data...');
    const groupsUpsertPayload = {
        event: 'groups.upsert',
        instance: 'instance-1750433520122',
        data: [{
            id: TEST_GROUP_JID,
            subject: 'Prueba final groups',
            owner: '5215579188699@s.whatsapp.net',
            desc: 'Test group description',
            participants: [
                {
                    id: '5215579188699@s.whatsapp.net',
                    admin: 'superadmin',
                    isAdmin: true,
                    isSuperAdmin: true
                },
                {
                    id: '5214422501780@s.whatsapp.net',
                    admin: null,
                    isAdmin: false,
                    isSuperAdmin: false
                },
                {
                    id: '5211234567890@s.whatsapp.net',
                    admin: 'admin',
                    isAdmin: true,
                    isSuperAdmin: false
                }
            ]
        }]
    };

    try {
        const response1 = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(groupsUpsertPayload)
        });
        
        if (response1.ok) {
            console.log('✅ Groups upsert with participants webhook sent successfully');
        } else {
            console.log('❌ Failed to send groups upsert webhook:', response1.status);
        }
    } catch (error) {
        console.log('❌ Error sending groups upsert webhook:', error.message);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Group participants update
    console.log('\n2. Testing group.participants.update...');
    const participantsUpdatePayload = {
        event: 'group.participants.update',
        instance: 'instance-1750433520122',
        data: {
            id: TEST_GROUP_JID,
            participants: ['5219876543210@s.whatsapp.net'],
            action: 'add'
        }
    };

    try {
        const response2 = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(participantsUpdatePayload)
        });
        
        if (response2.ok) {
            console.log('✅ Group participants update webhook sent successfully');
        } else {
            console.log('❌ Failed to send participants update webhook:', response2.status);
        }
    } catch (error) {
        console.log('❌ Error sending participants update webhook:', error.message);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Admin promotion
    console.log('\n3. Testing admin promotion...');
    const promotionPayload = {
        event: 'group.participants.update',
        instance: 'instance-1750433520122',
        data: {
            id: TEST_GROUP_JID,
            participants: ['5219876543210@s.whatsapp.net'],
            action: 'promote'
        }
    };

    try {
        const response3 = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(promotionPayload)
        });
        
        if (response3.ok) {
            console.log('✅ Admin promotion webhook sent successfully');
        } else {
            console.log('❌ Failed to send promotion webhook:', response3.status);
        }
    } catch (error) {
        console.log('❌ Error sending promotion webhook:', error.message);
    }

    // Wait before final verification
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 4: Verify participant data via API
    console.log('\n4. Verifying participant data in database...');
    try {
        const verifyResponse = await fetch(`http://localhost:5000/api/whatsapp/groups/${TEST_GROUP_JID}/participants?instanceId=instance-1750433520122`);
        
        if (verifyResponse.ok) {
            const participantData = await verifyResponse.json();
            console.log('📊 Current participants in database:', participantData.length || 0);
            
            if (participantData.length > 0) {
                console.log('👥 Participants found:');
                participantData.forEach(p => {
                    console.log(`   - ${p.participantJid} (Admin: ${p.isAdmin}, SuperAdmin: ${p.isSuperAdmin})`);
                });
            }
        } else {
            console.log('❌ Failed to verify participant data:', verifyResponse.status);
        }
    } catch (error) {
        console.log('❌ Error verifying participant data:', error.message);
    }

    console.log('\n✅ Participant processing test completed');
}

testParticipantProcessing().catch(console.error);