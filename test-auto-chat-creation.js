/**
 * Test script to demonstrate automatic chat creation when processing messages
 * This simulates receiving a message with a new chat_id that doesn't exist in the database
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function testAutoChatCreation() {
    console.log('🧪 Testing automatic chat creation when processing messages...\n');

    try {
        // Generate a new unique chat ID that doesn't exist in the database
        const newChatId = `5214999888777@s.whatsapp.net`;
        const instanceId = 'instance-1750433520122';
        const messageId = `AUTO_CHAT_TEST_${Date.now()}`;

        console.log(`📝 Testing with new chat: ${newChatId}`);

        // First, verify the chat doesn't exist
        const chatCheckResult = await pool.query(
            'SELECT chat_id FROM whatsapp.chats WHERE chat_id = $1 AND instance_id = $2',
            [newChatId, instanceId]
        );

        if (chatCheckResult.rows.length > 0) {
            console.log('❌ Chat already exists, cleaning up first...');
            await pool.query(
                'DELETE FROM whatsapp.chats WHERE chat_id = $1 AND instance_id = $2',
                [newChatId, instanceId]
            );
            await pool.query(
                'DELETE FROM whatsapp.contacts WHERE jid = $1 AND instance_id = $2',
                [newChatId, instanceId]
            );
        }

        console.log('✅ Confirmed chat does not exist in database');

        // Simulate receiving a message via webhook API endpoint
        const messageData = {
            messageId,
            instanceId,
            chatId: newChatId,
            senderJid: newChatId,
            fromMe: false,
            messageType: 'text',
            content: 'This is a test message that should auto-create the chat and contact',
            timestamp: new Date().toISOString()
        };

        console.log('📤 Sending message to webhook endpoint...');

        // Make API call to process the message
        const response = await fetch('http://localhost:5000/api/whatsapp/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event: 'messages.upsert',
                instance: instanceId,
                data: {
                    key: {
                        id: messageId,
                        fromMe: false,
                        remoteJid: newChatId
                    },
                    message: {
                        conversation: messageData.content
                    },
                    messageType: 'conversation',
                    messageTimestamp: Math.floor(new Date().getTime() / 1000),
                    pushName: 'Auto Test Contact'
                }
            })
        });

        if (response.ok) {
            console.log('✅ Message processed successfully via webhook');
        } else {
            console.log('❌ Failed to process message via webhook');
            console.log('Response status:', response.status);
            console.log('Response text:', await response.text());
        }

        // Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify that the chat was automatically created
        const chatResult = await pool.query(
            'SELECT chat_id, type, created_at FROM whatsapp.chats WHERE chat_id = $1 AND instance_id = $2',
            [newChatId, instanceId]
        );

        if (chatResult.rows.length > 0) {
            const chat = chatResult.rows[0];
            console.log('✅ Chat automatically created:');
            console.log(`   - Chat ID: ${chat.chat_id}`);
            console.log(`   - Type: ${chat.type}`);
            console.log(`   - Created: ${chat.created_at}`);
        } else {
            console.log('❌ Chat was NOT automatically created');
        }

        // Verify that the contact was automatically created
        const contactResult = await pool.query(
            'SELECT jid, push_name FROM whatsapp.contacts WHERE jid = $1 AND instance_id = $2',
            [newChatId, instanceId]
        );

        if (contactResult.rows.length > 0) {
            const contact = contactResult.rows[0];
            console.log('✅ Contact automatically created:');
            console.log(`   - JID: ${contact.jid}`);
            console.log(`   - Name: ${contact.push_name}`);
        } else {
            console.log('❌ Contact was NOT automatically created');
        }

        // Verify the message was stored
        const messageResult = await pool.query(
            'SELECT message_id, chat_id, content FROM whatsapp.messages WHERE message_id = $1 AND instance_id = $2',
            [messageId, instanceId]
        );

        if (messageResult.rows.length > 0) {
            const message = messageResult.rows[0];
            console.log('✅ Message stored successfully:');
            console.log(`   - Message ID: ${message.message_id}`);
            console.log(`   - Chat ID: ${message.chat_id}`);
            console.log(`   - Content: ${message.content}`);
        } else {
            console.log('❌ Message was NOT stored');
        }

        // Test with a group chat as well
        console.log('\n🔄 Testing with a new group chat...');
        const newGroupId = `120363999888777666@g.us`;
        const groupMessageId = `AUTO_GROUP_TEST_${Date.now()}`;

        // Clean up if exists
        await pool.query(
            'DELETE FROM whatsapp.chats WHERE chat_id = $1 AND instance_id = $2',
            [newGroupId, instanceId]
        );
        await pool.query(
            'DELETE FROM whatsapp.contacts WHERE jid = $1 AND instance_id = $2',
            [newGroupId, instanceId]
        );

        // Simulate group message
        const groupResponse = await fetch('http://localhost:5000/api/whatsapp/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event: 'messages.upsert',
                instance: instanceId,
                data: {
                    key: {
                        id: groupMessageId,
                        fromMe: false,
                        remoteJid: newGroupId
                    },
                    message: {
                        conversation: 'This is a test group message'
                    },
                    messageType: 'conversation',
                    messageTimestamp: Math.floor(new Date().getTime() / 1000),
                    pushName: 'Test Group Member'
                }
            })
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify group chat creation
        const groupChatResult = await pool.query(
            'SELECT chat_id, type FROM whatsapp.chats WHERE chat_id = $1 AND instance_id = $2',
            [newGroupId, instanceId]
        );

        if (groupChatResult.rows.length > 0) {
            const groupChat = groupChatResult.rows[0];
            console.log('✅ Group chat automatically created:');
            console.log(`   - Chat ID: ${groupChat.chat_id}`);
            console.log(`   - Type: ${groupChat.type}`);
        } else {
            console.log('❌ Group chat was NOT automatically created');
        }

        console.log('\n🎉 Auto-chat creation test completed!');

    } catch (error) {
        console.error('❌ Error during auto-chat creation test:', error);
    } finally {
        await pool.end();
    }
}

// Run the test
testAutoChatCreation();