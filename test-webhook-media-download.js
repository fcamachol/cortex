/**
 * Test script to verify webhook media download functionality
 * This simulates receiving an audio message webhook and tests the complete flow
 */

import { storage } from './server/storage.js';

async function testWebhookMediaDownload() {
    console.log('🧪 Testing webhook media download functionality...');
    
    try {
        // Simulate an audio message webhook payload with proper media data
        const mockAudioWebhook = {
            event: 'messages.upsert',
            instance: 'live-test-1750199771',
            data: {
                messages: [{
                    key: {
                        id: 'WEBHOOK_AUDIO_TEST_001',
                        fromMe: false,
                        remoteJid: '521234567890@s.whatsapp.net'
                    },
                    message: {
                        audioMessage: {
                            url: 'https://evolution-api-server.com/media/audio/test.ogg',
                            mediaKey: 'Af7CjNjH+P/q9k6NCw8Ii5hmP4EW7wAwN/Zc+M+0G4k=',
                            mimetype: 'audio/ogg; codecs=opus',
                            fileLength: '25648',
                            seconds: 12,
                            contextInfo: {
                                stanzaId: 'WEBHOOK_AUDIO_TEST_001',
                                quotedMessage: null
                            }
                        }
                    },
                    messageTimestamp: Math.floor(Date.now() / 1000),
                    pushName: 'Test Sender',
                    broadcast: false
                }]
            }
        };

        console.log('📤 Simulating webhook processing...');
        
        // Import and use the webhook adapter
        const { WhatsAppWebhookAdapter } = await import('./server/whatsapp-api-adapter');
        
        // Process the webhook
        await WhatsAppWebhookAdapter.processWebhookEvent(
            mockAudioWebhook.event,
            mockAudioWebhook.instance,
            mockAudioWebhook.data
        );
        
        console.log('✅ Webhook processing completed');
        
        // Check if media metadata was stored
        console.log('🔍 Checking stored media metadata...');
        const mediaRecord = await storage.getWhatsappMessageMedia('WEBHOOK_AUDIO_TEST_001', 'live-test-1750199771');
        
        if (mediaRecord) {
            console.log('✅ Media metadata stored successfully:');
            console.log(`   - Message ID: ${mediaRecord.messageId}`);
            console.log(`   - MIME Type: ${mediaRecord.mimetype}`);
            console.log(`   - Duration: ${mediaRecord.durationSeconds}s`);
            console.log(`   - Media Key: ${mediaRecord.mediaKey ? 'Present' : 'Missing'}`);
            console.log(`   - File URL: ${mediaRecord.fileUrl ? 'Present' : 'Missing'}`);
            console.log(`   - Local Path: ${mediaRecord.fileLocalPath || 'Not cached'}`);
        } else {
            console.log('❌ Media metadata not found in database');
        }
        
        // Check if message was stored
        console.log('🔍 Checking stored message...');
        const messageRecord = await storage.getWhatsappMessageById('WEBHOOK_AUDIO_TEST_001', 'live-test-1750199771');
        
        if (messageRecord) {
            console.log('✅ Message stored successfully:');
            console.log(`   - Message ID: ${messageRecord.messageId}`);
            console.log(`   - Type: ${messageRecord.messageType}`);
            console.log(`   - Content: ${messageRecord.content}`);
            console.log(`   - From: ${messageRecord.senderJid}`);
        } else {
            console.log('❌ Message not found in database');
        }
        
        // Test media serving endpoint
        console.log('🔍 Testing media serving endpoint...');
        const response = await fetch('http://localhost:5000/api/whatsapp/media/live-test-1750199771/WEBHOOK_AUDIO_TEST_001');
        console.log(`📡 Media endpoint response: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');
            console.log(`✅ Media served successfully: ${contentType}, ${contentLength} bytes`);
        } else {
            console.log('⚠️ Media not available via endpoint (expected for Evolution API limitations)');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testWebhookMediaDownload();