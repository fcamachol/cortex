/**
 * Test script to demonstrate real-time group updates via webhooks
 * This simulates Evolution API webhook events for group changes
 */

import fetch from 'node-fetch';

const WEBHOOK_BASE_URL = 'http://localhost:5000';
const INSTANCE_ID = 'instance-1750433520122';
const TEST_GROUP_JID = '120363420038831248@g.us';

async function testRealtimeGroupUpdates() {
    console.log('🧪 Testing real-time group updates via webhooks...\n');

    // Test 1: Group subject change
    console.log('1. Testing group subject change...');
    const subjectChangePayload = {
        data: {
            id: TEST_GROUP_JID,
            subject: 'Updated Group Name - Real-time Test',
            desc: 'This group was updated via webhook',
            restrict: false
        }
    };

    try {
        const response1 = await fetch(`${WEBHOOK_BASE_URL}/webhook/${INSTANCE_ID}/group-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subjectChangePayload)
        });
        
        if (response1.ok) {
            console.log('✅ Group subject change webhook sent successfully');
        } else {
            console.log('❌ Failed to send group subject change webhook:', response1.status);
        }
    } catch (error) {
        console.log('❌ Error sending group subject change webhook:', error.message);
    }

    // Wait a moment between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Group participants change
    console.log('\n2. Testing group participants change...');
    const participantsChangePayload = {
        data: { 
            id: TEST_GROUP_JID,
            participants: ['5521999887766@s.whatsapp.net', '5521888776655@s.whatsapp.net'],
            action: 'add'
        }
    };

    try {
        const response2 = await fetch(`${WEBHOOK_BASE_URL}/webhook/${INSTANCE_ID}/group-participants-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(participantsChangePayload)
        });
        
        if (response2.ok) {
            console.log('✅ Group participants change webhook sent successfully');
        } else {
            console.log('❌ Failed to send group participants change webhook:', response2.status);
        }
    } catch (error) {
        console.log('❌ Error sending group participants change webhook:', error.message);
    }

    // Wait a moment between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Group description change
    console.log('\n3. Testing group description change...');
    const descriptionChangePayload = {
        data: {
            id: TEST_GROUP_JID,
            subject: 'Updated Group Name - Real-time Test',
            desc: 'This is a new description updated via real-time webhook',
            restrict: true
        }
    };

    try {
        const response3 = await fetch(`${WEBHOOK_BASE_URL}/webhook/${INSTANCE_ID}/group-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(descriptionChangePayload)
        });
        
        if (response3.ok) {
            console.log('✅ Group description change webhook sent successfully');
        } else {
            console.log('❌ Failed to send group description change webhook:', response3.status);
        }
    } catch (error) {
        console.log('❌ Error sending group description change webhook:', error.message);
    }

    // Test 4: Group settings change
    console.log('\n4. Testing group settings change...');
    const settingsChangePayload = {
        data: {
            id: TEST_GROUP_JID,
            subject: 'Updated Group Name - Real-time Test',
            desc: 'This is a new description updated via real-time webhook',
            restrict: false,
            announce: true
        }
    };

    try {
        const response4 = await fetch(`${WEBHOOK_BASE_URL}/webhook/${INSTANCE_ID}/group-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settingsChangePayload)
        });
        
        if (response4.ok) {
            console.log('✅ Group settings change webhook sent successfully');
        } else {
            console.log('❌ Failed to send group settings change webhook:', response4.status);
        }
    } catch (error) {
        console.log('❌ Error sending group settings change webhook:', error.message);
    }

    console.log('\n🎉 Real-time group updates test completed!');
    console.log('\n📋 Expected behavior:');
    console.log('- Group data should be updated in the database');
    console.log('- Real-time notifications should be sent via SSE');
    console.log('- Frontend clients should receive toast notifications');
    console.log('- Group list should refresh automatically');
    console.log('\n💡 To see real-time updates:');
    console.log('1. Open the Group Management page in your browser');
    console.log('2. Keep the page open while running this test');
    console.log('3. Watch for toast notifications appearing in real-time');
}

// Run the test
testRealtimeGroupUpdates().catch(console.error);