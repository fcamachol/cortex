/**
 * Test to debug the instance_name null issue in message_media table
 */

async function testMediaInstanceDebug() {
    console.log('🐛 DEBUGGING MEDIA INSTANCE NAME ISSUE');

    const webhookUrl = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/live-test-1750199771';
    
    // Send a simple image message webhook
    const webhook = {
        event: 'messages.upsert',
        instance: 'live-test-1750199771',
        data: {
            key: {
                remoteJid: '5215579188699@s.whatsapp.net',
                fromMe: false,
                id: 'DEBUG_MEDIA_INSTANCE_' + Date.now()
            },
            pushName: 'Debug User',
            status: 'DELIVERY_ACK',
            message: {
                imageMessage: {
                    url: 'https://mmg.whatsapp.net/v/t62.7117-24/debug_image.enc',
                    mimetype: 'image/jpeg',
                    fileSha256: 'debugsha256hash',
                    fileLength: '12345',
                    width: 800,
                    height: 600,
                    mediaKey: 'debugmediakey123',
                    fileEncSha256: 'debugencsha256',
                    directPath: '/v/t62.7117-24/debug_image.enc',
                    mediaKeyTimestamp: '1750673000'
                }
            },
            messageType: 'imageMessage',
            messageTimestamp: 1750673000,
            instanceId: 'debug-instance-id',
            source: 'android'
        }
    };

    console.log('📤 Sending debug image webhook...');
    
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhook)
        });

        if (response.ok) {
            console.log('✅ Debug webhook sent successfully');
            console.log('🔍 Check server logs for debug output showing instance_name values');
        } else {
            console.log('❌ Debug webhook failed:', response.status);
        }
    } catch (error) {
        console.error('❌ Error sending debug webhook:', error.message);
    }
}

testMediaInstanceDebug();