/**
 * COMPREHENSIVE ACTION EXECUTION TEST
 * Tests the complete flow from reaction to calendar event creation
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function testCompleteActionExecution() {
    try {
        console.log('🔄 TESTING COMPLETE ACTION EXECUTION WORKFLOW');
        console.log('═══════════════════════════════════════════════');
        
        // 1. Check initial state
        const beforeEventsResult = await pool.query(`
            SELECT COUNT(*) as count FROM cortex_scheduling.events
        `);
        const beforeCount = parseInt(beforeEventsResult.rows[0].count);
        console.log(`📊 Calendar events before test: ${beforeCount}`);
        
        // 2. Verify action rule exists
        console.log('\n🔍 Checking action rule configuration...');
        const ruleResult = await pool.query(`
            SELECT name, trigger_conditions, action_config, performer_filter, selected_instances
            FROM cortex_automation.action_rules 
            WHERE action_type = 'create_calendar_event'
            AND is_active = true
        `);
        
        if (ruleResult.rows.length === 0) {
            console.log('❌ No active calendar action rules found');
            return;
        }
        
        const rule = ruleResult.rows[0];
        console.log(`📋 Found active rule: "${rule.name}"`);
        console.log(`   Trigger conditions:`, rule.trigger_conditions);
        console.log(`   Action config:`, rule.action_config);
        console.log(`   Performer filter:`, rule.performer_filter);
        console.log(`   Selected instances:`, rule.selected_instances);
        
        // 3. Test direct ActionService execution (simulating webhook processing)
        console.log('\n🎯 Testing ActionService triggerSimpleAction...');
        
        // Simulate the context that would come from a webhook
        const testContext = {
            messageId: 'test-message-123',
            instanceName: '28AACF7E-8C0C-42D1-8139-E47418746C55',
            senderJid: '5214611239748@s.whatsapp.net',
            senderName: 'Fernando',
            content: 'Comemos mañana de 2-4 en la casa',
            reactionEmoji: '📅',
            timestamp: new Date()
        };
        
        // Import and test ActionService directly
        const { ActionService } = await import('./server/action-service.ts');
        
        try {
            await ActionService.triggerSimpleAction(
                'whatsapp_message',
                '📅',
                testContext
            );
            console.log('✅ ActionService.triggerSimpleAction executed successfully');
        } catch (serviceError) {
            console.error('❌ ActionService execution failed:', serviceError);
            
            // Let's test the storage layer directly instead
            console.log('\n🔧 Testing storage layer directly...');
            const { storage } = await import('./server/storage.ts');
            
            const directEventData = {
                title: testContext.content,
                start_time: new Date('2025-07-03 14:00:00'),
                end_time: new Date('2025-07-03 16:00:00'),
                location: 'en la casa',
                description: 'Created from WhatsApp automation test',
                created_by_entity_id: 'cu_181de66a23864b2fac56779a82189691',
                status: 'confirmed',
                is_all_day: false
            };
            
            const directEvent = await storage.createCalendarEvent(directEventData);
            console.log('✅ Direct storage createCalendarEvent successful:', directEvent.title);
        }
        
        // 4. Check final state
        const afterEventsResult = await pool.query(`
            SELECT COUNT(*) as count FROM cortex_scheduling.events
        `);
        const afterCount = parseInt(afterEventsResult.rows[0].count);
        console.log(`\n📊 Calendar events after test: ${afterCount}`);
        console.log(`📈 Events added: ${afterCount - beforeCount}`);
        
        // 5. Show recent events created
        if (afterCount > beforeCount) {
            console.log('\n📅 Recent calendar events created:');
            const recentEvents = await pool.query(`
                SELECT title, start_time, end_time, location, created_at
                FROM cortex_scheduling.events 
                ORDER BY created_at DESC 
                LIMIT 3
            `);
            
            recentEvents.rows.forEach((event, index) => {
                console.log(`   ${index + 1}. "${event.title}" (${event.start_time} - ${event.end_time})`);
                if (event.location) console.log(`      Location: ${event.location}`);
                console.log(`      Created: ${event.created_at}`);
            });
        }
        
        console.log('\n✅ Complete action execution test finished!');
        
    } catch (error) {
        console.error('❌ Error in complete action execution test:', error);
    } finally {
        await pool.end();
    }
}

testCompleteActionExecution();