/**
 * DEBUG ACTION RULES DATA STRUCTURE
 * Check the actual structure of cortex_automation.action_rules
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function debugActionRules() {
    try {
        console.log('🔍 DEBUGGING ACTION RULES DATA STRUCTURE');
        console.log('═════════════════════════════════════════');
        
        // Get all action rules
        const result = await pool.query(`
            SELECT 
                id,
                name,
                trigger_type,
                trigger_conditions,
                action_type,
                action_config,
                performer_filter,
                instance_filter_type,
                selected_instances,
                is_active
            FROM cortex_automation.action_rules 
            WHERE trigger_type = 'whatsapp_message'
            ORDER BY name
        `);
        
        console.log(`📊 Found ${result.rows.length} whatsapp_message rules:`);
        
        result.rows.forEach((rule, index) => {
            console.log(`\n--- RULE ${index + 1}: ${rule.name} ---`);
            console.log(`ID: ${rule.id}`);
            console.log(`Trigger Type: ${rule.trigger_type}`);
            console.log(`Action Type: ${rule.action_type}`);
            console.log(`Is Active: ${rule.is_active}`);
            console.log(`Performer Filter: ${rule.performer_filter}`);
            console.log(`Instance Filter Type: ${rule.instance_filter_type}`);
            console.log(`Selected Instances: ${JSON.stringify(rule.selected_instances)}`);
            
            console.log(`\n🔍 TRIGGER CONDITIONS (raw):`, rule.trigger_conditions);
            console.log(`Type: ${typeof rule.trigger_conditions}`);
            console.log(`Is Array: ${Array.isArray(rule.trigger_conditions)}`);
            
            if (rule.trigger_conditions) {
                console.log(`Stringified:`, JSON.stringify(rule.trigger_conditions, null, 2));
            }
            
            console.log(`\n🔍 ACTION CONFIG (raw):`, rule.action_config);
            console.log(`Type: ${typeof rule.action_config}`);
            
            if (rule.action_config) {
                console.log(`Stringified:`, JSON.stringify(rule.action_config, null, 2));
            }
        });
        
    } catch (error) {
        console.error('❌ Error debugging action rules:', error);
    } finally {
        await pool.end();
    }
}

debugActionRules();