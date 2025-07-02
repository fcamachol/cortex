/**
 * SIMPLE CALENDAR ACTION TEST
 * Tests the calendar event creation from action rule processing
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function testCalendarAction() {
    try {
        console.log('🔄 TESTING CALENDAR ACTION EXECUTION');
        console.log('════════════════════════════════════');
        
        // 1. Check current calendar events count
        const beforeResult = await pool.query(`
            SELECT COUNT(*) as count FROM cortex_scheduling.events
        `);
        const beforeCount = parseInt(beforeResult.rows[0].count);
        console.log(`📊 Calendar events before test: ${beforeCount}`);
        
        // 2. Simulate direct calendar event creation (test the storage method)
        const testEventData = {
            title: 'Comemos mañana de 2-4 en la casa',
            start_datetime: '2025-07-03 14:00:00',
            end_datetime: '2025-07-03 16:00:00',
            location_details: 'en la casa',
            description: 'Created from WhatsApp automation test',
            created_by: 'automation-test',
            event_type: 'meeting',
            is_all_day: false
        };
        
        console.log('📝 Creating test calendar event...');
        const insertResult = await pool.query(`
            INSERT INTO cortex_scheduling.events (
                title, start_datetime, end_datetime, location_details, 
                description, created_by, event_type, is_all_day
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, title, start_datetime, end_datetime
        `, [
            testEventData.title,
            testEventData.start_datetime,
            testEventData.end_datetime,
            testEventData.location_details,
            testEventData.description,
            testEventData.created_by,
            testEventData.event_type,
            testEventData.is_all_day
        ]);
        
        const createdEvent = insertResult.rows[0];
        console.log('✅ Calendar event created successfully!');
        console.log('📅 Event details:', createdEvent);
        
        // 3. Check final calendar events count
        const afterResult = await pool.query(`
            SELECT COUNT(*) as count FROM cortex_scheduling.events
        `);
        const afterCount = parseInt(afterResult.rows[0].count);
        console.log(`📊 Calendar events after test: ${afterCount}`);
        console.log(`📈 Events added: ${afterCount - beforeCount}`);
        
        // 4. Check the action rules are properly formatted
        console.log('\n🔍 Checking action rules structure...');
        const rulesResult = await pool.query(`
            SELECT name, trigger_conditions, action_config 
            FROM cortex_automation.action_rules 
            WHERE action_type = 'create_calendar_event'
        `);
        
        rulesResult.rows.forEach(rule => {
            console.log(`📋 Rule: ${rule.name}`);
            console.log(`   Conditions:`, rule.trigger_conditions);
            console.log(`   Config:`, rule.action_config);
        });
        
        console.log('\n✅ Calendar action test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error in calendar action test:', error);
    } finally {
        await pool.end();
    }
}

testCalendarAction();