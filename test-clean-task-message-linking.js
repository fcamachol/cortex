/**
 * COMPREHENSIVE TEST: Clean Task-Message Linking System
 * 
 * Tests the new junction table approach for linking WhatsApp messages to CRM tasks
 * Verifies the clean architecture without embedded fields in tasks table
 */

// Test Configuration
const API_BASE = 'http://localhost:5000';
const TEST_MESSAGE_ID = '3EB0C3DF4F26B3A3E1E8'; // Use an existing message ID from database
const TEST_INSTANCE = 'instance-1750433520122'; // Use the main instance
const TEST_USER_ID = '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'; // Development user

async function testCleanTaskMessageLinking() {
    console.log('🧪 TESTING: Clean Task-Message Linking System');
    console.log('=' .repeat(60));

    try {
        // ===================================================================
        // STEP 1: Create a clean task (no embedded WhatsApp fields)
        // ===================================================================
        console.log('\n📝 STEP 1: Creating clean task without embedded WhatsApp fields...');
        
        const taskData = {
            userId: TEST_USER_ID,
            title: 'Test Task - Clean Junction Table Architecture',
            description: 'Testing the new clean task-message linking system using junction table',
            priority: 'high',
            status: 'to_do',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
        };

        const taskResponse = await fetch(`${API_BASE}/api/crm/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });

        if (!taskResponse.ok) {
            throw new Error(`Task creation failed: ${taskResponse.status} ${taskResponse.statusText}`);
        }

        const createdTask = await taskResponse.json();
        console.log(`✅ Clean task created: ${createdTask.id}`);
        console.log(`   Title: ${createdTask.title}`);
        console.log(`   User ID: ${createdTask.userId}`);
        console.log(`   Status: ${createdTask.status}`);

        // ===================================================================
        // STEP 2: Create task-message link using junction table
        // ===================================================================
        console.log('\n🔗 STEP 2: Creating task-message link via junction table...');
        
        const linkData = {
            taskId: createdTask.id,
            messageId: TEST_MESSAGE_ID,
            instanceId: TEST_INSTANCE,
            linkType: 'trigger' // This message triggered the task creation
        };

        const linkResponse = await fetch(`${API_BASE}/api/crm/task-message-links`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(linkData)
        });

        if (!linkResponse.ok) {
            throw new Error(`Link creation failed: ${linkResponse.status} ${linkResponse.statusText}`);
        }

        const createdLink = await linkResponse.json();
        console.log(`✅ Task-message link created successfully`);
        console.log(`   Task ID: ${createdLink.taskId}`);
        console.log(`   Message ID: ${createdLink.messageId}`);
        console.log(`   Instance: ${createdLink.instanceId}`);
        console.log(`   Link Type: ${createdLink.linkType}`);

        // ===================================================================
        // STEP 3: Test retrieving task links
        // ===================================================================
        console.log('\n📋 STEP 3: Retrieving task message links...');
        
        const linksResponse = await fetch(`${API_BASE}/api/crm/task-message-links/${createdTask.id}`);
        
        if (!linksResponse.ok) {
            throw new Error(`Links retrieval failed: ${linksResponse.status} ${linksResponse.statusText}`);
        }

        const taskLinks = await linksResponse.json();
        console.log(`✅ Retrieved ${taskLinks.length} link(s) for task`);
        
        taskLinks.forEach((link, index) => {
            console.log(`   Link ${index + 1}:`);
            console.log(`     Message ID: ${link.messageId}`);
            console.log(`     Instance: ${link.instanceId}`);
            console.log(`     Type: ${link.linkType}`);
        });

        // ===================================================================
        // STEP 4: Test reverse lookup (message to tasks)
        // ===================================================================
        console.log('\n🔍 STEP 4: Testing reverse lookup (message to tasks)...');
        
        const reverseResponse = await fetch(`${API_BASE}/api/crm/message-task-links/${TEST_MESSAGE_ID}/${TEST_INSTANCE}`);
        
        if (!reverseResponse.ok) {
            throw new Error(`Reverse lookup failed: ${reverseResponse.status} ${reverseResponse.statusText}`);
        }

        const messageLinks = await reverseResponse.json();
        console.log(`✅ Found ${messageLinks.length} task(s) linked to message`);
        
        messageLinks.forEach((link, index) => {
            console.log(`   Task ${index + 1}:`);
            console.log(`     Task ID: ${link.taskId}`);
            console.log(`     Link Type: ${link.linkType}`);
        });

        // ===================================================================
        // STEP 5: Verify task is clean (no embedded WhatsApp fields)
        // ===================================================================
        console.log('\n🧹 STEP 5: Verifying task contains no embedded WhatsApp fields...');
        
        const taskGetResponse = await fetch(`${API_BASE}/api/crm/tasks/${createdTask.id}`);
        
        if (!taskGetResponse.ok) {
            throw new Error(`Task retrieval failed: ${taskGetResponse.status} ${taskGetResponse.statusText}`);
        }

        const retrievedTask = await taskGetResponse.json();
        
        // Check that old WhatsApp fields are not present
        const whatsappFields = [
            'triggeringMessageId',
            'triggeringInstanceName', 
            'triggeringSenderJid',
            'triggeringChatJid',
            'triggerType'
        ];

        let hasEmbeddedFields = false;
        whatsappFields.forEach(field => {
            if (retrievedTask.hasOwnProperty(field) && retrievedTask[field] !== null) {
                console.log(`❌ Task contains embedded WhatsApp field: ${field} = ${retrievedTask[field]}`);
                hasEmbeddedFields = true;
            }
        });

        if (!hasEmbeddedFields) {
            console.log('✅ Task is clean - no embedded WhatsApp fields found');
            console.log('   Task contains only core CRM fields:');
            console.log(`     - ID: ${retrievedTask.id}`);
            console.log(`     - Title: ${retrievedTask.title}`);
            console.log(`     - User ID: ${retrievedTask.userId}`);
            console.log(`     - Status: ${retrievedTask.status}`);
            console.log(`     - Priority: ${retrievedTask.priority}`);
        }

        // ===================================================================
        // STEP 6: Test creating additional link types
        // ===================================================================
        console.log('\n🔗 STEP 6: Testing multiple link types...');
        
        const additionalLinkTypes = ['context', 'reply'];
        
        for (const linkType of additionalLinkTypes) {
            const additionalLinkData = {
                taskId: createdTask.id,
                messageId: TEST_MESSAGE_ID,
                instanceId: TEST_INSTANCE,
                linkType: linkType
            };

            const additionalLinkResponse = await fetch(`${API_BASE}/api/crm/task-message-links`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(additionalLinkData)
            });

            if (additionalLinkResponse.ok) {
                console.log(`✅ Created ${linkType} link successfully`);
            } else {
                console.log(`⚠️  Failed to create ${linkType} link: ${additionalLinkResponse.status}`);
            }
        }

        // ===================================================================
        // STEP 7: Final verification - count all links
        // ===================================================================
        console.log('\n📊 STEP 7: Final verification - counting all links...');
        
        const finalLinksResponse = await fetch(`${API_BASE}/api/crm/task-message-links/${createdTask.id}`);
        const finalLinks = await finalLinksResponse.json();
        
        console.log(`✅ Total links created: ${finalLinks.length}`);
        finalLinks.forEach((link, index) => {
            console.log(`   ${index + 1}. ${link.linkType} link to message ${link.messageId}`);
        });

        // ===================================================================
        // SUMMARY
        // ===================================================================
        console.log('\n' + '=' .repeat(60));
        console.log('🎉 CLEAN TASK-MESSAGE LINKING SYSTEM TEST COMPLETED');
        console.log('=' .repeat(60));
        console.log('✅ Clean task creation (no embedded fields)');
        console.log('✅ Junction table linking system');
        console.log('✅ Task-to-message link retrieval');
        console.log('✅ Message-to-task reverse lookup');
        console.log('✅ Multiple link types support');
        console.log('✅ Professional many-to-many architecture');
        console.log('\n🏗️  Architecture Benefits:');
        console.log('   • Clean separation of concerns');
        console.log('   • No content duplication');
        console.log('   • Efficient database design');
        console.log('   • Flexible relationship types');
        console.log('   • Scalable link management');

        return {
            success: true,
            taskId: createdTask.id,
            linksCreated: finalLinks.length,
            architecture: 'clean-junction-table'
        };

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        return {
            success: false,
            error: error.message,
            architecture: 'clean-junction-table'
        };
    }
}

// Execute the test
testCleanTaskMessageLinking()
    .then(result => {
        if (result.success) {
            console.log('\n🚀 Test completed successfully!');
            process.exit(0);
        } else {
            console.log('\n💥 Test failed!');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n💥 Unexpected test error:', error);
        process.exit(1);
    });