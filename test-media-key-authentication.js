/**
 * Test media_key authentication for Evolution API media downloads
 * This validates that the system properly uses stored media_key from database
 */

import { storage } from './server/storage.ts';
import { getEvolutionApi } from './server/evolution-api.ts';

async function testMediaKeyAuthentication() {
    console.log('🔑 Testing media_key authentication for Evolution API downloads...');
    
    try {
        // Get some media messages from database that have media_key stored
        const mediaMessages = await storage.getAllWhatsappMessageMedia();
        
        if (mediaMessages.length === 0) {
            console.log('❌ No media messages found in database');
            return;
        }
        
        console.log(`Found ${mediaMessages.length} media messages with stored media_key`);
        
        // Test with a few media messages that have media_key
        const testMessages = mediaMessages.filter(m => m.mediaKey).slice(0, 3);
        
        if (testMessages.length === 0) {
            console.log('❌ No media messages with media_key found');
            return;
        }
        
        console.log(`Testing with ${testMessages.length} media messages that have media_key:`);
        
        for (const mediaMsg of testMessages) {
            console.log(`\n🧪 Testing message: ${mediaMsg.messageId}`);
            console.log(`   Instance: ${mediaMsg.instanceName}`);
            console.log(`   Media Key: ${mediaMsg.mediaKey ? mediaMsg.mediaKey.substring(0, 15) + '...' : 'MISSING'}`);
            console.log(`   MIME Type: ${mediaMsg.mimetype}`);
            console.log(`   File Size: ${mediaMsg.fileSizeBytes} bytes`);
            
            // Get instance API key
            const instance = await storage.getWhatsappInstance(mediaMsg.instanceName);
            if (!instance?.apiKey) {
                console.log(`   ❌ No API key found for instance: ${mediaMsg.instanceName}`);
                continue;
            }
            
            // Test download with stored media_key
            try {
                const evolutionApi = getEvolutionApi();
                
                console.log(`   🔑 Attempting download with stored media_key authentication...`);
                
                const downloadResponse = await evolutionApi.downloadMedia(
                    mediaMsg.instanceName,
                    instance.apiKey,
                    {
                        key: { id: mediaMsg.messageId },
                        message: {}, // Empty message object
                        mediaKey: mediaMsg.mediaKey  // Use stored media_key for authentication
                    }
                );
                
                if (downloadResponse?.base64) {
                    console.log(`   ✅ Download successful with media_key authentication!`);
                    console.log(`   📁 Base64 length: ${downloadResponse.base64.length} characters`);
                    console.log(`   📋 MIME Type: ${downloadResponse.mimetype || 'unknown'}`);
                } else {
                    console.log(`   ⚠️ Download response received but no base64 data`);
                    console.log(`   Response keys:`, Object.keys(downloadResponse || {}));
                }
                
            } catch (error) {
                console.log(`   ❌ Download failed: ${error.message}`);
            }
        }
        
        console.log('\n🏁 Media key authentication test completed');
        
    } catch (error) {
        console.error('Error testing media key authentication:', error);
    }
}

testMediaKeyAuthentication();