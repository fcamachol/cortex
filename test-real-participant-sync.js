/**
 * Test real participant synchronization with Evolution API
 * This will verify that participants are being fetched and processed correctly
 */

const EVOLUTION_API_URL = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
const EVOLUTION_API_KEY = '28AACF7E-8C0C-42D1-8139-E47418746C55';
const INSTANCE_ID = 'instance-1750433520122';

async function testRealParticipantSync() {
    console.log('🧪 Testing real participant synchronization with Evolution API...');
    
    // Step 1: Fetch groups directly from Evolution API with participants
    console.log('\n1. Fetching groups from Evolution API with participants...');
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/group/fetchAllGroups/${INSTANCE_ID}?getParticipants=true`, {
            method: 'GET',
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const groups = await response.json();
            console.log(`✅ Successfully fetched ${groups.length} groups from Evolution API`);
            
            // Count groups with participants
            const groupsWithParticipants = groups.filter(g => g.participants && g.participants.length > 0);
            console.log(`📊 Groups with participants: ${groupsWithParticipants.length}`);
            
            if (groupsWithParticipants.length > 0) {
                const sampleGroup = groupsWithParticipants[0];
                console.log(`👥 Sample group "${sampleGroup.subject}" has ${sampleGroup.participants.length} participants`);
                
                // Show participant details
                sampleGroup.participants.slice(0, 3).forEach(p => {
                    console.log(`   - ${p.id} (Admin: ${p.admin || 'none'})`);
                });
            }
        } else {
            console.log(`❌ Failed to fetch groups: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.log(`❌ Error fetching groups: ${error.message}`);
    }
    
    // Step 2: Trigger webhook processing to simulate real Evolution API updates
    console.log('\n2. Triggering webhook processing for real group data...');
    try {
        const webhookResponse = await fetch(`http://localhost:5000/api/evolution/webhook/${INSTANCE_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'groups.upsert',
                instance: INSTANCE_ID,
                data: [{
                    id: '120363419575637974@g.us',
                    subject: 'Test Real Group Sync',
                    participants: [
                        { id: '5215579188699@s.whatsapp.net', admin: 'superadmin' },
                        { id: '5214422501780@s.whatsapp.net', admin: null },
                        { id: '5211234567890@s.whatsapp.net', admin: 'admin' }
                    ]
                }]
            })
        });
        
        if (webhookResponse.ok) {
            console.log('✅ Webhook processing triggered successfully');
        } else {
            console.log(`❌ Webhook processing failed: ${webhookResponse.status}`);
        }
    } catch (error) {
        console.log(`❌ Error triggering webhook: ${error.message}`);
    }
    
    // Step 3: Verify participant data in database
    console.log('\n3. Verifying participant data in database...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for processing
    
    try {
        const dbResponse = await fetch(`http://localhost:5000/api/whatsapp/groups/120363419575637974@g.us/participants?instanceId=${INSTANCE_ID}`);
        
        if (dbResponse.ok) {
            const participants = await dbResponse.json();
            console.log(`📊 Database contains ${participants.length} participants for test group`);
            
            participants.forEach(p => {
                console.log(`   - ${p.participantJid} (Admin: ${p.isAdmin}, SuperAdmin: ${p.isSuperAdmin})`);
            });
        } else {
            console.log(`❌ Failed to verify database: ${dbResponse.status}`);
        }
    } catch (error) {
        console.log(`❌ Error verifying database: ${error.message}`);
    }
    
    // Step 4: Test group sync endpoint
    console.log('\n4. Testing group sync endpoint...');
    try {
        const syncResponse = await fetch(`http://localhost:5000/api/whatsapp/groups/${INSTANCE_ID}/sync-from-api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            console.log(`✅ Group sync completed: ${syncResult.message}`);
            console.log(`📊 Groups synced: ${syncResult.count || 0}`);
        } else {
            console.log(`❌ Group sync failed: ${syncResponse.status}`);
        }
    } catch (error) {
        console.log(`❌ Error during group sync: ${error.message}`);
    }
    
    console.log('\n✅ Real participant synchronization test completed');
}

testRealParticipantSync().catch(console.error);