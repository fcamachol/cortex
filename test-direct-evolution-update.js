/**
 * Direct test to force Evolution API group name updates
 */

import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

async function testDirectEvolutionUpdate() {
    console.log('Testing direct Evolution API group update...');
    
    try {
        // Step 1: Fetch groups directly from Evolution API
        console.log('1. Fetching groups from Evolution API...');
        const response = await fetch(`${EVOLUTION_API_URL}/group/fetchAllGroups/instance-1750433520122?getParticipants=false`, {
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error('Failed to fetch groups:', response.status, await response.text());
            return;
        }
        
        const data = await response.json();
        console.log('Groups response format:', Object.keys(data));
        
        // Handle different response formats
        let groups = [];
        if (Array.isArray(data)) {
            groups = data.filter(item => item.id && item.id.endsWith('@g.us'));
        } else if (data.groups && Array.isArray(data.groups)) {
            groups = data.groups.filter(item => item.id && item.id.endsWith('@g.us'));
        } else if (data.data && Array.isArray(data.data)) {
            groups = data.data.filter(item => item.id && item.id.endsWith('@g.us'));
        }
        
        console.log(`Found ${groups.length} groups in Evolution API`);
        
        // Step 2: Find target group and show its authentic data
        const targetGroupJid = '120363420038831248@g.us';
        const targetGroup = groups.find(g => g.id === targetGroupJid);
        
        if (targetGroup) {
            console.log('Target group from Evolution API:', {
                id: targetGroup.id,
                subject: targetGroup.subject,
                owner: targetGroup.owner
            });
            
            // Step 3: Force update via direct database call
            console.log('2. Forcing database update...');
            const updateResponse = await fetch('http://localhost:5000/api/debug/force-group-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    groupJid: targetGroupJid,
                    instanceId: 'instance-1750433520122',
                    subject: targetGroup.subject,
                    force: true
                })
            });
            
            if (updateResponse.ok) {
                const result = await updateResponse.json();
                console.log('Database update result:', result);
            } else {
                console.error('Database update failed:', await updateResponse.text());
            }
            
        } else {
            console.log(`Target group ${targetGroupJid} not found in Evolution API`);
            
            // Show first few groups for debugging
            console.log('First 3 groups from Evolution API:');
            groups.slice(0, 3).forEach((group, index) => {
                console.log(`${index + 1}. ${group.id} -> "${group.subject}"`);
            });
        }
        
    } catch (error) {
        console.error('Error in direct Evolution API test:', error.message);
    }
}

testDirectEvolutionUpdate();