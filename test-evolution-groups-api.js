import fetch from 'node-fetch';

async function testEvolutionGroupsAPI() {
    try {
        console.log('Testing Evolution API groups endpoint...');
        
        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
        const instanceId = 'instance-1750433520122';
        
        console.log(`Calling: ${EVOLUTION_API_URL}/group/fetchAllGroups/${instanceId}?getParticipants=false`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('Request timed out after 30 seconds');
            controller.abort();
        }, 30000);
        
        const response = await fetch(`${EVOLUTION_API_URL}/group/fetchAllGroups/${instanceId}?getParticipants=false`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const groups = await response.json();
        
        console.log(`✅ Successfully fetched ${groups.length} groups`);
        
        // Show first few groups to understand structure
        if (groups.length > 0) {
            console.log('\nFirst group structure:');
            console.log(JSON.stringify(groups[0], null, 2));
            
            if (groups.length > 1) {
                console.log('\nSecond group structure:');
                console.log(JSON.stringify(groups[1], null, 2));
            }
        }
        
        // Count groups with subjects
        const groupsWithSubjects = groups.filter(g => g.subject && g.subject !== 'Group Chat');
        console.log(`\n📊 Groups with valid subjects: ${groupsWithSubjects.length}/${groups.length}`);
        
        return groups;
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ Request was aborted due to timeout');
        } else {
            console.error('❌ Error:', error.message);
        }
        return null;
    }
}

testEvolutionGroupsAPI();