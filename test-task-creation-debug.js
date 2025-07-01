/**
 * DEBUG TASK CREATION ISSUE
 * Tests the complete reaction-to-task creation flow to identify why wrong messages are being used
 */

import { storage, db } from './server/storage.ts';
import { ActionService } from './server/action-service.ts';

async function debugTaskCreation() {
    console.log('🔍 DEBUG: Task creation regression analysis');
    
    try {
        // 1. Check recent tasks created from WhatsApp reactions
        const recentTasks = await db.execute(`
            SELECT 
                id,
                title,
                description,
                triggering_message_id,
                triggering_instance_name,
                created_at
            FROM cortex_projects.tasks 
            WHERE triggering_message_id IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        console.log('📋 Recent WhatsApp-triggered tasks:');
        recentTasks.rows.forEach(task => {
            console.log(`  Task: "${task.title}" - Message: ${task.triggering_message_id} - Created: ${task.created_at}`);
        });
        
        // 2. Check recent reactions
        const recentReactions = await db.execute(`
            SELECT 
                reaction_id,
                message_id,
                instance_name,
                reactor_jid,
                reaction_emoji,
                timestamp
            FROM whatsapp.message_reactions 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        
        console.log('\n👍 Recent reactions:');
        recentReactions.rows.forEach(reaction => {
            console.log(`  ${reaction.reaction_emoji} on message ${reaction.message_id} by ${reaction.reactor_jid} at ${reaction.timestamp}`);
        });
        
        // 3. Get the specific messages being reacted to vs the messages that tasks are created from
        if (recentTasks.rows.length > 0 && recentReactions.rows.length > 0) {
            const taskMessageId = recentTasks.rows[0].triggering_message_id;
            const reactionMessageId = recentReactions.rows[0].message_id;
            
            console.log('\n🔍 COMPARISON:');
            console.log(`  Latest task created from message: ${taskMessageId}`);
            console.log(`  Latest reaction was on message: ${reactionMessageId}`);
            console.log(`  Match: ${taskMessageId === reactionMessageId ? '✅ YES' : '❌ NO'}`);
            
            // Get the actual message content for both
            if (taskMessageId) {
                const taskMessage = await db.execute(`
                    SELECT content, sender_jid, timestamp 
                    FROM whatsapp.messages 
                    WHERE message_id = '${taskMessageId}' 
                    LIMIT 1
                `);
                console.log(`\n📝 Task-triggering message: "${taskMessage.rows[0]?.content || 'No content'}" from ${taskMessage.rows[0]?.sender_jid} at ${taskMessage.rows[0]?.timestamp}`);
            }
            
            if (reactionMessageId && reactionMessageId !== taskMessageId) {
                const reactionMessage = await db.execute(`
                    SELECT content, sender_jid, timestamp 
                    FROM whatsapp.messages 
                    WHERE message_id = '${reactionMessageId}' 
                    LIMIT 1
                `);
                console.log(`📝 Reacted message: "${reactionMessage.rows[0]?.content || 'No content'}" from ${reactionMessage.rows[0]?.sender_jid} at ${reactionMessage.rows[0]?.timestamp}`);
            }
        }
        
        // 4. Check action rules configuration
        const actionRules = await db.execute(`
            SELECT 
                name, 
                trigger_conditions, 
                action_config,
                is_active
            FROM cortex_automation.rules 
            WHERE trigger_type = 'whatsapp_message'
            AND is_active = true
        `);
        
        console.log('\n⚙️ Active action rules:');
        actionRules.rows.forEach(rule => {
            console.log(`  Rule: "${rule.name}" - Active: ${rule.is_active}`);
            console.log(`    Conditions: ${JSON.stringify(rule.trigger_conditions)}`);
            console.log(`    Config: ${JSON.stringify(rule.action_config)}`);
        });
        
    } catch (error) {
        console.error('❌ Error in debug analysis:', error);
    }
}

// Run the debug
debugTaskCreation();