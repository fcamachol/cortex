/**
 * Test the corrected media download implementation with proper Evolution API format
 */

import { db } from './server/db.ts';
import { messages } from './shared/schema.ts';
import { eq, and } from 'drizzle-orm';
import { getEvolutionApi } from './server/evolution-api.ts';

async function testCorrectedMediaDownload() {
    console.log('🎯 Testing corrected media download with Evolution API...\n');
    
    try {
        // Get a recent audio message from the database
        const recentAudioMessage = await db
            .select()
            .from(messages)
            .where(and(
                eq(messages.instanceId, 'live-test-1750199771'),
                eq(messages.messageType, 'audio')
            ))
            .orderBy(messages.timestamp)
            .limit(1);
        
        if (recentAudioMessage.length === 0) {
            console.log('❌ No audio messages found in database');
            return;
        }
        
        const message = recentAudioMessage[0];
        console.log(`📱 Testing media download for message: ${message.messageId}`);
        console.log(`📝 Message type: ${message.messageType}`);
        console.log(`📅 Timestamp: ${message.timestamp}`);
        
        // Parse the raw API payload to get the correct structure
        const rawPayload = JSON.parse(message.rawApiPayload);
        console.log(`🔍 Raw payload structure:`, {
            hasKey: !!rawPayload.key,
            hasMessage: !!rawPayload.message,
            keyStructure: rawPayload.key,
            messageType: rawPayload.message ? Object.keys(rawPayload.message)[0] : 'none'
        });
        
        // Test the Evolution API download with correct format
        const evolutionApi = getEvolutionApi();
        const instanceApiKey = process.env.EVOLUTION_API_KEY;
        
        console.log('\n📥 Attempting media download with corrected format...');
        
        const mediaData = await evolutionApi.downloadMedia(
            message.instanceId,
            instanceApiKey,
            {
                key: rawPayload.key,
                message: rawPayload.message
            }
        );
        
        console.log('✅ Media download successful!');
        console.log('📋 Response structure:', {
            hasBase64: !!mediaData.base64,
            hasMimetype: !!mediaData.mimetype,
            base64Length: mediaData.base64 ? mediaData.base64.length : 0,
            mimetype: mediaData.mimetype
        });
        
        if (mediaData.base64) {
            console.log(`📊 Base64 data length: ${mediaData.base64.length} characters`);
            console.log(`🎵 Mimetype: ${mediaData.mimetype}`);
            
            // Test base64 decoding
            const fileBuffer = Buffer.from(mediaData.base64, 'base64');
            console.log(`📁 Decoded file size: ${fileBuffer.length} bytes`);
            
            console.log('\n🎉 Media download test completed successfully!');
            console.log('✅ Evolution API is working correctly with the proper request format');
        }
        
    } catch (error) {
        console.error('❌ Media download test failed:', error.message);
        
        if (error.message.includes('404')) {
            console.log('\n💡 Possible solutions:');
            console.log('1. Check if the Evolution API version supports media download');
            console.log('2. Verify the correct endpoint URL');
            console.log('3. Ensure the message data format is correct');
        }
    }
}

testCorrectedMediaDownload()
    .then(() => {
        console.log('\n🏁 Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });