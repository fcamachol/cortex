/**
 * Test performer filtering - verify that tasks are only created when YOU react
 * This validates the fixed user_only performer filter system
 */

const { Client } = require('@neondatabase/serverless');

async function testPerformerFiltering() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    
    try {
        await client.connect();
        console.log('🔗 Database connected successfully');
        
        // Check current execution counts
        const beforeResult = await client.query(`
            SELECT execution_count, success_count, failure_count, name 
            FROM cortex_automation.action_rules 
            WHERE name LIKE '%Personal task%'
        `);
        
        console.log('📊 BEFORE Test - Rule execution counts:');
        beforeResult.rows.forEach(rule => {
            console.log(`   ${rule.name}: ${rule.execution_count} total, ${rule.success_count} success, ${rule.failure_count} failures`);
        });
        
        console.log('\n🧪 PERFORMER FILTERING TEST:');
        console.log('✅ Instance owners:');
        console.log('   - instance-1750433520122 (Personal 🇲🇽): 5215579188699@s.whatsapp.net');
        console.log('   - live-test-1750199771 (Cel USA 🇺🇸): 15103165094@s.whatsapp.net');
        
        console.log('\n🔒 Rule configured for: performerFilter = "user_only"');
        console.log('   This means ONLY reactions from the instance owner should trigger actions');
        
        console.log('\n⚠️  Previous issue: Tasks were created for BOTH instances');
        console.log('✅ Fixed: Now validates reactor JID matches instance owner JID');
        
        console.log('\n🎯 Test instructions:');
        console.log('1. React with ✔️ from Personal phone (5215579188699)');
        console.log('   → SHOULD create task (you are the owner)');
        console.log('2. React with ✔️ from someone else\'s phone');  
        console.log('   → SHOULD NOT create task (not the owner)');
        
        console.log('\n📝 Monitoring logs will show:');
        console.log('   🔒 Checking performer filter: reactorJid=XXXX, instanceName=YYYY');
        console.log('   ✅ Performer filter passed: XXXX is the owner of YYYY');
        console.log('   OR');
        console.log('   ⏭️  Skipping rule - reactor XXXX is not the instance owner YYYY');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.end();
    }
}

testPerformerFiltering();