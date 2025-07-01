/**
 * Quick diagnostic to check WhatsApp message synchronization status
 */
import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function checkWhatsAppStatus() {
    try {
        console.log('🔍 Checking WhatsApp Integration Status...\n');

        // Check instance status
        const instances = await db.execute(sql`
            SELECT instance_name, is_connected, last_connection_at, created_at
            FROM whatsapp.instances 
            ORDER BY last_connection_at DESC
        `);
        
        console.log('📱 WhatsApp Instances:');
        instances.rows.forEach(instance => {
            console.log(`  - ${instance.instance_name}: ${instance.is_connected ? '✅ Connected' : '❌ Disconnected'}`);
            console.log(`    Last connection: ${instance.last_connection_at || 'Never'}`);
        });

        // Check recent message activity
        const recentMessages = await db.execute(sql`
            SELECT 
                COUNT(*) as count,
                MAX(created_at) as latest,
                MIN(created_at) as earliest,
                instance_name
            FROM whatsapp.messages 
            WHERE created_at > NOW() - INTERVAL '1 hour'
            GROUP BY instance_name
            ORDER BY latest DESC
        `);

        console.log('\n💬 Recent Message Activity (Last Hour):');
        if (recentMessages.rows.length === 0) {
            console.log('  ⚠️  No messages in the last hour');
        } else {
            recentMessages.rows.forEach(activity => {
                console.log(`  - ${activity.instance_name}: ${activity.count} messages`);
                console.log(`    Latest: ${activity.latest}`);
            });
        }

        // Check message gaps (potential sync issues)
        const messageGaps = await db.execute(sql`
            WITH message_intervals AS (
                SELECT 
                    created_at,
                    LAG(created_at) OVER (ORDER BY created_at) as prev_created_at,
                    instance_name
                FROM whatsapp.messages 
                WHERE created_at > NOW() - INTERVAL '24 hours'
                ORDER BY created_at DESC
            )
            SELECT 
                instance_name,
                created_at,
                prev_created_at,
                EXTRACT(EPOCH FROM (created_at - prev_created_at))/60 as gap_minutes
            FROM message_intervals 
            WHERE EXTRACT(EPOCH FROM (created_at - prev_created_at))/60 > 30
            ORDER BY gap_minutes DESC
            LIMIT 5
        `);

        console.log('\n⏰ Large Message Gaps (>30 min):');
        if (messageGaps.rows.length === 0) {
            console.log('  ✅ No significant message gaps detected');
        } else {
            messageGaps.rows.forEach(gap => {
                console.log(`  - ${gap.instance_name}: ${Math.round(gap.gap_minutes)} min gap`);
                console.log(`    From: ${gap.prev_created_at} → ${gap.created_at}`);
            });
        }

        // Check webhook reliability 
        const webhooks = await db.execute(sql`
            SELECT instance_name, webhook_url, is_connected
            FROM whatsapp.instances 
            WHERE webhook_url IS NOT NULL
        `);
        
        console.log('\n🔗 Webhook Status:');
        webhooks.rows.forEach(instance => {
            console.log(`  - ${instance.instance_name}: ✅ Webhook configured`);
            console.log(`    URL: ${instance.webhook_url}`);
            console.log(`    Connected: ${instance.is_connected ? 'Yes' : 'No'}`);
        });

        console.log('\n✅ WhatsApp status check complete');

    } catch (error) {
        console.error('❌ Error checking WhatsApp status:', error);
    }
}

checkWhatsAppStatus();