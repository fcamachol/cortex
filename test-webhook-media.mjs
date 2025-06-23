/**
 * Test webhook media download functionality
 */

import { storage } from './server/storage.ts';
import { WhatsAppWebhookAdapter } from './server/whatsapp-api-adapter.ts';

async function testWebhookMediaDownload() {
    console.log('Testing webhook media download functionality...');
    
    try {
        // Simulate an audio message webhook payload
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

        console.log('Processing webhook...');
        
        // Process the webhook
        await WhatsAppWebhookAdapter.processWebhookEvent(
            mockAudioWebhook.event,
            mockAudioWebhook.instance,
            mockAudioWebhook.data
        );
        
        console.log('Webhook processing completed');
        
        // Check if media metadata was stored
        const mediaRecord = await storage.getWhatsappMessageMedia('WEBHOOK_AUDIO_TEST_001', 'live-test-1750199771');
        
        if (mediaRecord) {
            console.log('Media metadata stored successfully:');
            console.log(`  Message ID: ${mediaRecord.messageId}`);
            console.log(`  MIME Type: ${mediaRecord.mimetype}`);
            console.log(`  Duration: ${mediaRecord.durationSeconds}s`);
            console.log(`  Media Key: ${mediaRecord.mediaKey ? 'Present' : 'Missing'}`);
            console.log(`  File URL: ${mediaRecord.fileUrl ? 'Present' : 'Missing'}`);
        } else {
            console.log('Media metadata not found in database');
        }
        
        // Check if message was stored
        const messageRecord = await storage.getWhatsappMessageById('WEBHOOK_AUDIO_TEST_001', 'live-test-1750199771');
        
        if (messageRecord) {
            console.log('Message stored successfully:');
            console.log(`  Message ID: ${messageRecord.messageId}`);
            console.log(`  Type: ${messageRecord.messageType}`);
            console.log(`  Content: ${messageRecord.content}`);
        } else {
            console.log('Message not found in database');
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testWebhookMediaDownload();