import fetch from 'node-fetch';

async function verifyGroupNames() {
    const instanceId = 'instance-1750433520122';
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;

    try {
        console.log('🔍 Fetching authentic group names from Evolution API...');
        
        const response = await fetch(`${apiUrl}/group/fetchAllGroups/${instanceId}?getParticipants=false`, {
            method: 'GET',
            headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const groups = await response.json();
        console.log(`✅ Found ${groups.length} groups from Evolution API`);

        // Filter groups with cleaned JID format (numeric only before @g.us)
        const cleanedJidGroups = groups.filter(group => 
            group.id && group.id.match(/^[0-9]+@g\.us$/)
        );

        console.log(`📋 Groups with cleaned JID format: ${cleanedJidGroups.length}`);
        console.log('\n🔍 Real names for cleaned group JIDs:');
        console.log('─'.repeat(80));
        
        cleanedJidGroups.forEach(group => {
            console.log(`${group.id.padEnd(25)} → "${group.subject || 'No Subject'}"`);
        });

        return {
            success: true,
            totalGroups: groups.length,
            cleanedJidGroups: cleanedJidGroups.length,
            groups: cleanedJidGroups
        };

    } catch (error) {
        console.error('❌ Error fetching group names:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the verification
verifyGroupNames().then(result => {
    if (result.success) {
        console.log(`\n✅ Verification completed successfully!`);
        process.exit(0);
    } else {
        console.error(`\n💥 Verification failed: ${result.error}`);
        process.exit(1);
    }
});