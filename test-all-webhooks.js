import fetch from 'node-fetch';

async function testAllWebhookTypes() {
    const baseUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/instance-1750433520122';
    
    const tests = [
        {
            name: 'Group Participants Update',
            url: `${baseUrl}/group-participants-update`,
            payload: {
                event: 'group.participants.update',
                instance: 'instance-1750433520122',
                data: {
                    groupId: '120363354223479621@g.us',
                    participants: ['5215579188699@s.whatsapp.net', '5214422501780@s.whatsapp.net'],
                    action: 'add'
                }
            }
        },
        {
            name: 'Labels Update',
            url: `${baseUrl}/labels-edit`,
            payload: {
                event: 'labels.edit',
                instance: 'instance-1750433520122',
                data: {
                    labelId: 'label_123',
                    name: 'Important',
                    color: '#FF0000',
                    action: 'create'
                }
            }
        },
        {
            name: 'Chat Labels Update',
            url: `${baseUrl}/chats-set`,
            payload: {
                event: 'chats.set',
                instance: 'instance-1750433520122',
                data: {
                    chatId: '5215579188699@s.whatsapp.net',
                    labelIds: ['label_123', 'label_456'],
                    action: 'set'
                }
            }
        },
        {
            name: 'Call Logs',
            url: `${baseUrl}/call`,
            payload: {
                event: 'call',
                instance: 'instance-1750433520122',
                data: {
                    callId: 'call_789',
                    from: '5215579188699@s.whatsapp.net',
                    to: '5214422501780@s.whatsapp.net',
                    status: 'missed',
                    duration: 0,
                    timestamp: Math.floor(Date.now() / 1000),
                    isVideo: false
                }
            }
        }
    ];

    for (const test of tests) {
        try {
            console.log(`Testing ${test.name}...`);
            const response = await fetch(test.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(test.payload)
            });

            const responseText = await response.text();
            console.log(`${test.name}: ${response.status} - ${responseText}`);
        } catch (error) {
            console.error(`${test.name} Error:`, error.message);
        }
    }
}

testAllWebhookTypes();