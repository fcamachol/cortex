/**
 * Comprehensive demonstration of real-time group updates via webhooks
 * This creates a complete test environment showing all webhook functionality
 */

import fetch from 'node-fetch';

const WEBHOOK_BASE_URL = 'http://localhost:5000';
const INSTANCE_ID = 'instance-1750433520122';
const TEST_GROUP_JID = '120363420038831248@g.us';

// Simulate realistic group update scenarios
const scenarios = [
    {
        name: 'Corporate Team Rebranding',
        events: [
            {
                type: 'group-update',
                data: {
                    id: TEST_GROUP_JID,
                    subject: 'Marketing Team - Q1 2025',
                    desc: 'Strategic planning and campaign execution for Q1 2025',
                    restrict: false
                }
            },
            {
                type: 'group-participants-update',
                data: {
                    id: TEST_GROUP_JID,
                    participants: ['5521987654321@s.whatsapp.net', '5521123456789@s.whatsapp.net'],
                    action: 'add'
                }
            }
        ]
    },
    {
        name: 'Team Restructure',
        events: [
            {
                type: 'group-update',
                data: {
                    id: TEST_GROUP_JID,
                    subject: 'Marketing Team - Q1 2025 (Restructured)',
                    desc: 'Reorganized team structure with new leadership',
                    restrict: true
                }
            },
            {
                type: 'group-participants-update',
                data: {
                    id: TEST_GROUP_JID,
                    participants: ['5521987654321@s.whatsapp.net'],
                    action: 'promote'
                }
            }
        ]
    },
    {
        name: 'Project Completion',
        events: [
            {
                type: 'group-update',
                data: {
                    id: TEST_GROUP_JID,
                    subject: 'Marketing Team - Project Archive',
                    desc: 'Archived - Project completed successfully',
                    restrict: true,
                    announce: true
                }
            },
            {
                type: 'group-participants-update',
                data: {
                    id: TEST_GROUP_JID,
                    participants: ['5521123456789@s.whatsapp.net'],
                    action: 'remove'
                }
            }
        ]
    }
];

async function sendWebhook(eventType, data) {
    try {
        const response = await fetch(`${WEBHOOK_BASE_URL}/webhook/${INSTANCE_ID}/${eventType}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data })
        });
        
        if (response.ok) {
            console.log(`  ✅ ${eventType} webhook processed successfully`);
            return true;
        } else {
            console.log(`  ❌ ${eventType} webhook failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`  ❌ ${eventType} webhook error: ${error.message}`);
        return false;
    }
}

async function runScenario(scenario, index) {
    console.log(`\n🎬 Scenario ${index + 1}: ${scenario.name}`);
    console.log('─'.repeat(50));
    
    for (let i = 0; i < scenario.events.length; i++) {
        const event = scenario.events[i];
        console.log(`\n  📝 Step ${i + 1}: Processing ${event.type}...`);
        
        if (event.type === 'group-update') {
            console.log(`     Subject: "${event.data.subject}"`);
            console.log(`     Description: "${event.data.desc}"`);
            console.log(`     Locked: ${event.data.restrict ? 'Yes' : 'No'}`);
        } else if (event.type === 'group-participants-update') {
            console.log(`     Action: ${event.data.action}`);
            console.log(`     Participants: ${event.data.participants.length}`);
        }
        
        await sendWebhook(event.type, event.data);
        
        // Wait between events to show real-time updates
        if (i < scenario.events.length - 1) {
            console.log('     ⏳ Waiting for real-time updates...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

async function verifySystemStatus() {
    console.log('\n🔍 Verifying system status...');
    
    try {
        // Check SSE endpoint
        const sseResponse = await fetch(`${WEBHOOK_BASE_URL}/api/sse`, {
            method: 'GET',
            headers: { 'Accept': 'text/event-stream' }
        });
        
        if (sseResponse.ok) {
            console.log('  ✅ SSE endpoint is available');
        } else {
            console.log('  ❌ SSE endpoint unavailable');
        }
    } catch (error) {
        console.log('  ❌ SSE endpoint error:', error.message);
    }
    
    try {
        // Check groups endpoint
        const groupsResponse = await fetch(`${WEBHOOK_BASE_URL}/api/whatsapp/groups/7804247f-3ae8-4eb2-8c6d-2c44f967ad42`);
        
        if (groupsResponse.ok) {
            const groups = await groupsResponse.json();
            console.log(`  ✅ Groups endpoint working - ${groups.length} groups found`);
        } else {
            console.log('  ❌ Groups endpoint error');
        }
    } catch (error) {
        console.log('  ❌ Groups endpoint error:', error.message);
    }
}

async function demonstrateRealtimeUpdates() {
    console.log('🚀 Comprehensive Real-time Group Updates Demo');
    console.log('='.repeat(50));
    
    await verifySystemStatus();
    
    console.log('\n📋 This demo will simulate realistic group management scenarios:');
    scenarios.forEach((scenario, index) => {
        console.log(`  ${index + 1}. ${scenario.name}`);
    });
    
    console.log('\n💡 To see real-time updates:');
    console.log('  1. Open your browser to the Group Management page');
    console.log('  2. Open a second tab to the Real-time Monitor (/monitor)');
    console.log('  3. Watch for live updates as scenarios execute');
    
    console.log('\n⏳ Starting scenarios in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Execute all scenarios
    for (let i = 0; i < scenarios.length; i++) {
        await runScenario(scenarios[i], i);
        
        if (i < scenarios.length - 1) {
            console.log('\n⏸️  Pausing between scenarios...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\n📊 Expected results:');
    console.log('  - Group subject updated multiple times');
    console.log('  - Participant changes processed');
    console.log('  - Real-time notifications sent via SSE');
    console.log('  - Frontend automatically refreshed');
    console.log('  - Toast notifications displayed');
    
    // Final status check
    console.log('\n🔍 Final system verification...');
    try {
        const finalResponse = await fetch(`${WEBHOOK_BASE_URL}/api/whatsapp/groups/7804247f-3ae8-4eb2-8c6d-2c44f967ad42`);
        if (finalResponse.ok) {
            const groups = await finalResponse.json();
            const testGroup = groups.find(g => g.jid === TEST_GROUP_JID);
            if (testGroup) {
                console.log(`  ✅ Final group state: "${testGroup.subject}"`);
                console.log(`  ✅ Participants: ${testGroup.participantCount}`);
            }
        }
    } catch (error) {
        console.log('  ❌ Final verification failed:', error.message);
    }
}

// Execute the comprehensive demo
demonstrateRealtimeUpdates().catch(console.error);