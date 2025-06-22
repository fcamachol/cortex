/**
 * Direct test of Evolution API group name updates
 */

const fetch = require('node-fetch');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function testEvolutionGroupUpdate() {
    console.log('\n🔄 Testing Evolution API group update...');
    
    try {
        // Step 1: Fetch all groups from Evolution API
        console.log('\n1. Fetching groups from Evolution API...');
        const groupsResponse = await fetch(`${EVOLUTION_API_URL}/group/fetchAllGroups/instance-1750433520122`, {
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (!groupsResponse.ok) {
            console.error('❌ Failed to fetch groups:', groupsResponse.status, await groupsResponse.text());
            return;
        }
        
        const groupsData = await groupsResponse.json();
        console.log('✅ Groups response format:', Object.keys(groupsData));
        
        // Handle different response formats
        let groups = [];
        if (Array.isArray(groupsData)) {
            groups = groupsData;
        } else if (groupsData.groups && Array.isArray(groupsData.groups)) {
            groups = groupsData.groups;
        } else if (groupsData.data && Array.isArray(groupsData.data)) {
            groups = groupsData.data;
        }
        
        console.log(`📊 Found ${groups.length} groups in Evolution API`);
        
        // Step 2: Look for our target group
        const targetGroupJid = '120363420038831248@g.us';
        const targetGroup = groups.find(g => g.id === targetGroupJid);
        
        if (targetGroup) {
            console.log(`🎯 Found target group:`, {
                id: targetGroup.id,
                subject: targetGroup.subject,
                owner: targetGroup.owner,
                creation: targetGroup.creation
            });
            
            // Step 3: Update via backend API
            console.log('\n2. Updating group via backend API...');
            const updateResponse = await fetch('http://localhost:5000/api/debug/update-group', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    groupJid: targetGroupJid,
                    instanceId: 'instance-1750433520122',
                    evolutionData: targetGroup
                })
            });
            
            if (updateResponse.ok) {
                const updateResult = await updateResponse.json();
                console.log('✅ Group update result:', updateResult);
            } else {
                console.error('❌ Failed to update group:', await updateResponse.text());
            }
            
        } else {
            console.log(`❌ Target group ${targetGroupJid} not found in Evolution API response`);
            
            // Show first few groups for debugging
            console.log('\n📋 First 3 groups from Evolution API:');
            groups.slice(0, 3).forEach((group, index) => {
                console.log(`${index + 1}. ${group.id} -> "${group.subject}"`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error testing Evolution API group update:', error.message);
    }
}

testEvolutionGroupUpdate();