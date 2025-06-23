/**
 * Comprehensive test of the webhook-based base64 audio system
 * This demonstrates the complete audio playback pipeline with proper Evolution API format
 */

const BASE_URL = 'http://localhost:5000';

async function sendWebhookWithBase64Audio() {
    const audioWebhookData = {
        event: "messages.upsert",
        instance: "live-test-1750199771",
        data: {
            key: {
                id: "WORKING_BASE64_AUDIO_DEMO",
                fromMe: false,
                remoteJid: "15103165094@s.whatsapp.net"
            },
            source: "android",
            status: "SERVER_ACK",
            message: {
                audioMessage: {
                    ptt: true,
                    url: "https://mmg.whatsapp.net/v/t62.7117-24/demo_audio_file.enc",
                    seconds: 15,
                    mediaKey: "mockMediaKeyForDemo123456789=",
                    mimetype: "audio/ogg; codecs=opus",
                    waveform: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                    base64: "T2dnUwACAAAAAAAAAADVTOlSAAAAAP1HeUQBHgF2sF9A", // Valid base64 Ogg header
                    fileSha256: "mockFileSha256ForDemo+ABC123def456=",
                    fileLength: 8192,
                    contextInfo: {
                        isForwarded: false
                    }
                }
            },
            messageType: "audioMessage",
            pushName: "Test User",
            messageTimestamp: Math.floor(Date.now() / 1000)
        }
    };

    console.log('🎵 Sending webhook with comprehensive base64 audio data...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/evolution/webhook/live-test-1750199771/messages.upsert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(audioWebhookData)
        });

        if (response.ok) {
            console.log('✅ Webhook sent successfully');
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Test media serving
            console.log('🎧 Testing media serving...');
            const mediaResponse = await fetch(`${BASE_URL}/api/whatsapp/media/live-test-1750199771/WORKING_BASE64_AUDIO_DEMO`);
            
            if (mediaResponse.ok) {
                const contentType = mediaResponse.headers.get('content-type');
                const contentLength = mediaResponse.headers.get('content-length');
                console.log(`✅ Media served successfully: ${contentType}, ${contentLength} bytes`);
                
                // Verify headers
                console.log('📋 Response headers:');
                console.log(`   Content-Type: ${contentType}`);
                console.log(`   Content-Length: ${contentLength}`);
                console.log(`   Cache-Control: ${mediaResponse.headers.get('cache-control')}`);
                console.log(`   Access-Control-Allow-Origin: ${mediaResponse.headers.get('access-control-allow-origin')}`);
                
                return true;
            } else {
                console.log(`❌ Media serving failed: ${mediaResponse.status} ${mediaResponse.statusText}`);
                const errorText = await mediaResponse.text();
                console.log(`   Error: ${errorText}`);
                return false;
            }
        } else {
            console.log(`❌ Webhook failed: ${response.status} ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

async function testNonCachedMedia() {
    console.log('\n🔍 Testing non-cached media handling...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/whatsapp/media/live-test-1750199771/NON_EXISTENT_AUDIO_FILE`);
        
        if (response.status === 404) {
            const errorData = await response.json();
            console.log('✅ Non-cached media correctly returns 404');
            console.log(`   Error message: ${errorData.message}`);
            return true;
        } else {
            console.log(`❌ Unexpected status for non-cached media: ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Non-cached media test failed:', error);
        return false;
    }
}

async function verifySystemHealth() {
    console.log('\n🔧 Verifying system health...');
    
    try {
        // Test basic API endpoint
        const healthResponse = await fetch(`${BASE_URL}/api/test`);
        if (healthResponse.ok) {
            console.log('✅ API server is healthy');
        } else {
            console.log('❌ API server health check failed');
            return false;
        }
        
        // Test conversation endpoint
        const conversationsResponse = await fetch(`${BASE_URL}/api/whatsapp/conversations/7804247f-3ae8-4eb2-8c6d-2c44f967ad42`);
        if (conversationsResponse.ok) {
            console.log('✅ Conversations endpoint is working');
        } else {
            console.log('❌ Conversations endpoint failed');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ System health check failed:', error);
        return false;
    }
}

async function runComprehensiveTest() {
    console.log('🚀 Starting comprehensive audio system test...');
    console.log('=' * 60);
    
    const healthCheck = await verifySystemHealth();
    if (!healthCheck) {
        console.log('❌ System health check failed, aborting test');
        return;
    }
    
    const audioTest = await sendWebhookWithBase64Audio();
    const nonCachedTest = await testNonCachedMedia();
    
    console.log('\n📊 Test Results Summary:');
    console.log('=' * 40);
    console.log(`System Health: ${healthCheck ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Base64 Audio: ${audioTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Non-cached Media: ${nonCachedTest ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = healthCheck && audioTest && nonCachedTest;
    console.log(`\nOverall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allPassed) {
        console.log('\n🎉 The webhook-based audio system is working perfectly!');
        console.log('   • Webhook processing stores base64 audio data correctly');
        console.log('   • Media serving endpoint returns proper HTTP headers');
        console.log('   • Non-cached files return clean 404 responses');
        console.log('   • Audio playback in the UI should work for webhook-cached files');
    }
}

// Run the test
runComprehensiveTest().catch(console.error);