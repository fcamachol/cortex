import fetch from 'node-fetch';

async function testComprehensiveWebhooks() {
    const baseUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122';
    
    // Test all webhook types with realistic Evolution API payload structures
    const webhookTests = [
        {
            name: 'Message with Media',
            url: `${baseUrl}/messages-upsert`,
            payload: {
                event: 'messages.upsert',
                instance: 'instance-1750433520122',
                data: {
                    key: {
                        id: 'MESSAGE_MEDIA_TEST_001',
                        remoteJid: '5215579188699@s.whatsapp.net',
                        fromMe: false,
                        participant: '5215579188699@s.whatsapp.net'
                    },
                    message: {
                        imageMessage: {
                            caption: 'Test image with caption',
                            url: 'https://example.com/image.jpg',
                            mimetype: 'image/jpeg'
                        }
                    },
                    messageTimestamp: Math.floor(Date.now() / 1000),
                    pushName: 'Test User Media',
                    status: 'SENT'
                }
            }
        },
        {
            name: 'Message Reaction',
            url: `${baseUrl}/messages-upsert`,
            payload: {
                event: 'messages.upsert',
                instance: 'instance-1750433520122',
                data: {
                    key: {
                        id: 'MESSAGE_REACTION_TEST_001',
                        remoteJid: '5215579188699@s.whatsapp.net',
                        fromMe: false,
                        participant: '5215579188699@s.whatsapp.net'
                    },
                    message: {
                        reactionMessage: {
                            text: '👍',
                            key: {
                                id: 'ORIGINAL_MESSAGE_ID_123',
                                remoteJid: '5215579188699@s.whatsapp.net',
                                fromMe: false
                            }
                        }
                    },
                    messageTimestamp: Math.floor(Date.now() / 1000)
                }
            }
        },
        {
            name: 'Message Edit',
            url: `${baseUrl}/messages-edit`,
            payload: {
                event: 'messages.edit',
                instance: 'instance-1750433520122',
                data: {
                    messageId: 'EDIT_TEST_MESSAGE_456',
                    editedContent: 'This message has been edited',
                    originalContent: 'Original message content',
                    editTimestamp: Math.floor(Date.now() / 1000),
                    chatId: '5215579188699@s.whatsapp.net',
                    fromMe: false
                }
            }
        },
        {
            name: 'Message Deletion',
            url: `${baseUrl}/messages-delete`,
            payload: {
                event: 'messages.delete',
                instance: 'instance-1750433520122',
                data: {
                    messageId: 'DELETE_TEST_MESSAGE_789',
                    chatId: '5215579188699@s.whatsapp.net',
                    deletedBy: '5215579188699@s.whatsapp.net',
                    deletionType: 'sender',
                    deletedAt: Math.floor(Date.now() / 1000)
                }
            }
        },
        {
            name: 'Contact with Business Info',
            url: `${baseUrl}/contacts-update`,
            payload: {
                event: 'contacts.update',
                instance: 'instance-1750433520122',
                data: {
                    remoteJid: '5215551234567@s.whatsapp.net',
                    pushName: 'Business Contact',
                    verifiedName: 'Verified Business LLC',
                    profilePicUrl: 'https://example.com/business.jpg',
                    isBusiness: true,
                    isMe: false,
                    isBlocked: false
                }
            }
        },
        {
            name: 'Group Chat',
            url: `${baseUrl}/chats-upsert`,
            payload: {
                event: 'chats.upsert',
                instance: 'instance-1750433520122',
                data: [{
                    remoteJid: '120363354223479621@g.us',
                    name: 'Test Group Chat',
                    unreadMessages: 5,
                    archived: false,
                    pinned: true,
                    muted: false,
                    subject: 'Test Group Subject',
                    participants: ['5215579188699@s.whatsapp.net', '5214422501780@s.whatsapp.net']
                }]
            }
        }
    ];

    console.log('Testing comprehensive webhook coverage...\n');

    for (const test of webhookTests) {
        try {
            console.log(`🧪 Testing: ${test.name}`);
            const response = await fetch(test.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(test.payload)
            });

            const responseText = await response.text();
            if (response.ok) {
                console.log(`✅ ${test.name}: Success (${response.status})`);
            } else {
                console.log(`❌ ${test.name}: Failed (${response.status}) - ${responseText}`);
            }
        } catch (error) {
            console.log(`❌ ${test.name}: Error - ${error.message}`);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 Comprehensive webhook testing completed!');
}

testComprehensiveWebhooks();