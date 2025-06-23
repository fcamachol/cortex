/**
 * Test webhook with base64 audio data to verify proper media caching
 */

import fetch from 'node-fetch';

async function sendWebhookWithBase64Audio() {
    console.log('🎯 Testing webhook with base64 audio data...\n');
    
    // Create a minimal base64 audio file for testing
    const minimalOggBase64 = "T2dnUwACAAAAAAAAAADqnjMlAAAAAP+BtXdqRUFEUwAB";
    
    const webhookPayload = {
        event: "messages.upsert",
        instance: "live-test-1750199771",
        data: {
            key: {
                remoteJid: "15103165094@s.whatsapp.net",
                fromMe: true,
                id: "WEBHOOK_BASE64_AUDIO_TEST_2"
            },
            pushName: "Test User",
            status: "SERVER_ACK",
            message: {
                audioMessage: {
                    url: "https://mmg.whatsapp.net/test.enc",
                    mimetype: "audio/ogg; codecs=opus",
                    fileSha256: "testSha256==",
                    fileLength: "50",
                    seconds: 1,
                    ptt: true,
                    mediaKey: "testMediaKey==",
                    fileEncSha256: "testEncSha256==",
                    directPath: "/v/test.enc",
                    mediaKeyTimestamp: "1750669300",
                    waveform: "AAAAAAAAAAAAAAABAQIDBQcKDA4RExYYGBkZGhgWFRMUFhkbHhwZGBUUFBMSEhISExMUFhgaHBsbGhoYFRIPDA==",
                    // Include base64 data in the webhook
                    base64: minimalOggBase64
                }
            },
            contextInfo: null,
            messageType: "audioMessage",
            messageTimestamp: Math.floor(Date.now() / 1000),
            instanceId: "c5215849-bfb9-413c-aa94-dfa911c8310a",
            source: "test"
        },
        destination: "http://localhost:5000/api/evolution/webhook/live-test-1750199771",
        date_time: new Date().toISOString(),
        sender: "15103165094@s.whatsapp.net",
        server_url: "https://evolution-api-evolution-api.vuswn0.easypanel.host",
        apikey: "119FA240-45ED-46A7-AE13-5A1B7C909D7D"
    };
    
    try {
        console.log('📤 Sending webhook with base64 audio data...');
        
        const response = await fetch('http://localhost:5000/api/evolution/webhook/live-test-1750199771', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': '119FA240-45ED-46A7-AE13-5A1B7C909D7D'
            },
            body: JSON.stringify(webhookPayload)
        });
        
        if (response.ok) {
            console.log('✅ Webhook processed successfully');
            
            // Wait a moment for processing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Test if the audio file was cached
            console.log('🔍 Testing if audio file was cached...');
            
            const mediaResponse = await fetch('http://localhost:5000/api/whatsapp/media/live-test-1750199771/WEBHOOK_BASE64_AUDIO_TEST_2');
            
            if (mediaResponse.ok) {
                console.log('✅ Audio file cached and serving correctly!');
                console.log(`📊 File size: ${mediaResponse.headers.get('content-length')} bytes`);
                console.log(`🎵 Content type: ${mediaResponse.headers.get('content-type')}`);
            } else {
                console.log('❌ Audio file not found in cache');
                console.log(`Status: ${mediaResponse.status}`);
            }
            
        } else {
            console.error('❌ Webhook failed:', response.status, await response.text());
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

sendWebhookWithBase64Audio()
    .then(() => {
        console.log('\n🏁 Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });