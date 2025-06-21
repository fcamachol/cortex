#!/usr/bin/env node

// Test script to verify action processing and template interpolation

const fetch = require('node-fetch');

async function testActionProcessing() {
    console.log('🧪 Testing action processing and template interpolation...');
    
    const testWebhookData = {
        event: 'messages.upsert',
        instance: 'instance-1750433520122',
        data: {
            key: {
                id: 'TEST_MESSAGE_' + Date.now(),
                fromMe: false,
                remoteJid: '5214422501780@s.whatsapp.net'
            },
            message: {
                conversation: 'Hello #task test message for template processing'
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: 'Test User'
        }
    };
    
    try {
        console.log('📤 Sending test webhook message...');
        const response = await fetch('http://localhost:5000/api/evolution/webhook/instance-1750433520122', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testWebhookData)
        });
        
        const result = await response.text();
        console.log('📥 Webhook response:', response.status, result);
        
        // Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if a task was created with proper template processing
        const tasksResponse = await fetch('http://localhost:5000/api/crm/tasks');
        const tasks = await tasksResponse.json();
        
        console.log('\n📋 Recent tasks:');
        tasks.slice(0, 3).forEach(task => {
            console.log(`- ID: ${task.task_id}`);
            console.log(`  Title: ${task.title}`);
            console.log(`  Description: ${task.description}`);
            console.log(`  Message ID: ${task.triggering_message_id}`);
            console.log(`  Chat JID: ${task.related_chat_jid}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testActionProcessing();