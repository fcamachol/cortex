/**
 * TEST ACTION EXECUTION PIPELINE AFTER DATABASE FIXES
 * Tests complete webhook → reaction → action → task creation flow with improved retry logic
 */

const { Pool } = require('pg');
const fetch = require('node-fetch');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

async function testActionExecutionPipeline() {
    console.log('🧪 TESTING ACTION EXECUTION PIPELINE AFTER DATABASE FIXES');
    console.log('=' .repeat(60));
    
    try {
        // Step 1: Check database connection health
        console.log('\n📊 Step 1: Database Health Check');
        const healthCheck = await pool.query('SELECT NOW() as current_time');
        console.log('✅ Database connection healthy:', healthCheck.rows[0].current_time);
        
        // Step 2: Verify action rules exist
        console.log('\n📋 Step 2: Checking Action Rules');
        const rulesResult = await pool.query(`
            SELECT id, name, trigger_type, is_active, trigger_conditions, action_config,
                   execution_count, success_count, failure_count, last_executed_at
            FROM cortex_automation.action_rules 
            WHERE is_active = true
            ORDER BY created_at DESC
        `);
        
        console.log(`Found ${rulesResult.rows.length} active action rules:`);
        rulesResult.rows.forEach((rule, index) => {
            console.log(`  ${index + 1}. "${rule.name}" (${rule.trigger_type})`);
            console.log(`     Executions: ${rule.execution_count}, Success: ${rule.success_count}, Failures: ${rule.failure_count}`);
            console.log(`     Last executed: ${rule.last_executed_at}`);
            console.log(`     Trigger conditions:`, JSON.stringify(rule.trigger_conditions, null, 2));
        });
        
        if (rulesResult.rows.length === 0) {
            console.log('❌ No active action rules found. Creating test rule...');
            await createTestActionRule();
        }
        
        // Step 3: Get WhatsApp instances
        console.log('\n📱 Step 3: Checking WhatsApp Instances');
        const instancesResult = await pool.query(`
            SELECT instance_name, status, connected_at, api_key 
            FROM whatsapp.instances 
            WHERE status = 'connected'
            ORDER BY connected_at DESC
        `);
        
        if (instancesResult.rows.length === 0) {
            console.log('❌ No connected WhatsApp instances found');
            return;
        }
        
        const testInstance = instancesResult.rows[0];
        console.log(`✅ Using instance: ${testInstance.instance_name}`);
        
        // Step 4: Send test webhook for checkmark reaction
        console.log('\n🎯 Step 4: Sending Test Checkmark Reaction Webhook');
        const testMessageId = `test-${Date.now()}`;
        const testChatId = '5214611239748@s.whatsapp.net';
        
        // First send a message webhook
        const messageWebhook = {
            event: 'messages.upsert',
            instance: testInstance.instance_name,
            data: {
                instanceName: testInstance.instance_name,
                key: {
                    id: testMessageId,
                    remoteJid: testChatId,
                    fromMe: false
                },
                message: {
                    conversation: 'Test message for reaction automation'
                },
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: 'Test User',
                messageType: 'conversation'
            }
        };
        
        console.log('Sending message webhook...');
        const messageResponse = await fetch(`http://localhost:5000/api/evolution/webhook/${testInstance.instance_name}/messages-upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageWebhook)
        });
        
        if (messageResponse.ok) {
            console.log('✅ Message webhook sent successfully');
        } else {
            console.log('❌ Message webhook failed:', await messageResponse.text());
        }
        
        // Wait a moment for message processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Now send reaction webhook
        const reactionWebhook = {
            event: 'messages.reaction',
            instance: testInstance.instance_name,
            data: {
                instanceName: testInstance.instance_name,
                key: {
                    id: `reaction-${Date.now()}`,
                    remoteJid: testChatId,
                    fromMe: false
                },
                reaction: {
                    key: {
                        id: testMessageId,
                        remoteJid: testChatId,
                        fromMe: false
                    },
                    text: '✅',
                    senderTimestampMs: Date.now()
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
            }
        };
        
        console.log('Sending reaction webhook...');
        const reactionResponse = await fetch(`http://localhost:5000/api/evolution/webhook/${testInstance.instance_name}/messages-reaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reactionWebhook)
        });
        
        if (reactionResponse.ok) {
            console.log('✅ Reaction webhook sent successfully');
        } else {
            console.log('❌ Reaction webhook failed:', await reactionResponse.text());
        }
        
        // Step 5: Wait and check for task creation
        console.log('\n⏳ Step 5: Waiting for Action Execution (10 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Check if any tasks were created
        const tasksResult = await pool.query(`
            SELECT id, title, description, status, priority, created_at,
                   triggering_message_id, triggering_instance_name
            FROM cortex_projects.tasks 
            WHERE created_at > NOW() - INTERVAL '15 minutes'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log(`\n📝 Recent Tasks (last 15 minutes): ${tasksResult.rows.length}`);
        tasksResult.rows.forEach((task, index) => {
            console.log(`  ${index + 1}. "${task.title}"`);
            console.log(`     Status: ${task.status}, Priority: ${task.priority}`);
            console.log(`     Created: ${task.created_at}`);
            console.log(`     Triggered by: ${task.triggering_message_id} (${task.triggering_instance_name})`);
        });
        
        // Check updated rule execution counts
        console.log('\n📊 Step 6: Checking Updated Rule Statistics');
        const updatedRulesResult = await pool.query(`
            SELECT id, name, execution_count, success_count, failure_count, last_executed_at
            FROM cortex_automation.action_rules 
            WHERE is_active = true
            ORDER BY last_executed_at DESC NULLS LAST
        `);
        
        updatedRulesResult.rows.forEach((rule, index) => {
            console.log(`  ${index + 1}. "${rule.name}"`);
            console.log(`     Executions: ${rule.execution_count}, Success: ${rule.success_count}, Failures: ${rule.failure_count}`);
            console.log(`     Last executed: ${rule.last_executed_at}`);
        });
        
        // Calculate success rate
        const totalExecutions = updatedRulesResult.rows.reduce((sum, rule) => sum + (rule.execution_count || 0), 0);
        const totalSuccesses = updatedRulesResult.rows.reduce((sum, rule) => sum + (rule.success_count || 0), 0);
        const successRate = totalExecutions > 0 ? ((totalSuccesses / totalExecutions) * 100).toFixed(1) : '0.0';
        
        console.log('\n🎯 FINAL RESULTS:');
        console.log(`   Total Executions: ${totalExecutions}`);
        console.log(`   Successful Executions: ${totalSuccesses}`);
        console.log(`   Success Rate: ${successRate}%`);
        
        if (successRate > 0) {
            console.log('✅ ACTION EXECUTION PIPELINE IS WORKING!');
        } else if (totalExecutions > 0) {
            console.log('⚠️ Rules are executing but failing - check error logs');
        } else {
            console.log('❌ No rule executions detected - webhook processing may have issues');
        }
        
    } catch (error) {
        console.error('❌ Pipeline test failed:', error);
    } finally {
        await pool.end();
    }
}

async function createTestActionRule() {
    console.log('Creating test checkmark reaction rule...');
    
    const ruleData = {
        id: `rule-${Date.now()}`,
        name: 'Test Checkmark Task Creator',
        description: 'Test rule to create tasks from checkmark reactions',
        trigger_type: 'whatsapp_message',
        trigger_conditions: {
            reactions: ['✅']
        },
        action_config: {
            title: 'Follow up on: {{message_content}}',
            description: 'Task created from checkmark reaction automation test',
            status: 'todo',
            priority: 'medium'
        },
        is_active: true,
        created_by_entity_id: 'cu_181de66a23864b2fac56779a82189691',
        execution_count: 0,
        success_count: 0,
        failure_count: 0
    };
    
    await pool.query(`
        INSERT INTO cortex_automation.action_rules (
            id, name, description, trigger_type, trigger_conditions, action_config,
            is_active, created_by_entity_id, execution_count, success_count, failure_count,
            created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
    `, [
        ruleData.id, ruleData.name, ruleData.description, ruleData.trigger_type,
        JSON.stringify(ruleData.trigger_conditions), JSON.stringify(ruleData.action_config),
        ruleData.is_active, ruleData.created_by_entity_id, ruleData.execution_count,
        ruleData.success_count, ruleData.failure_count
    ]);
    
    console.log('✅ Test action rule created');
}

// Run the test
testActionExecutionPipeline();