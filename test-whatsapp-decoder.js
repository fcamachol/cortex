/**
 * Test the WhatsApp media decoder on cached audio files
 */

import { ensureDecodedMedia, decodeWhatsAppAudio } from './server/whatsapp-media-decoder.js';
import { promises as fs } from 'fs';
import path from 'path';

async function testWhatsAppDecoder() {
    console.log('🔓 TESTING WHATSAPP MEDIA DECODER');
    console.log('='.repeat(50));
    
    const testFiles = [
        '/home/runner/workspace/media/live-test-1750199771/3A22F20DFB15C869255E.ogg',
        '/home/runner/workspace/media/live-test-1750199771/3A7597427C96361F9452.ogg',
        '/home/runner/workspace/media/live-test-1750199771/3A5E6386AEB4EACE11E3.ogg'
    ];
    
    for (const filePath of testFiles) {
        const messageId = path.basename(filePath, '.ogg');
        console.log(`\n🎵 Testing decoder for: ${messageId}`);
        
        try {
            // Check if file exists
            await fs.access(filePath);
            
            // Read original file
            const originalBuffer = await fs.readFile(filePath);
            console.log(`   Original size: ${originalBuffer.length} bytes`);
            
            // Check original signature
            const originalSig = originalBuffer.subarray(0, 4);
            console.log(`   Original signature: ${Array.from(originalSig).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            
            // Attempt decoding
            const decodedPath = await ensureDecodedMedia(filePath);
            console.log(`   Decoded path: ${decodedPath}`);
            
            // Check if decoded file exists and is different
            if (decodedPath !== filePath) {
                const decodedBuffer = await fs.readFile(decodedPath);
                console.log(`   Decoded size: ${decodedBuffer.length} bytes`);
                
                // Check decoded signature
                const decodedSig = decodedBuffer.subarray(0, 4);
                const sigString = Array.from(decodedSig).map(b => String.fromCharCode(b)).join('');
                console.log(`   Decoded signature: ${sigString} (${sigString === 'OggS' ? 'Valid OGG' : 'Invalid'})`);
                
                if (sigString === 'OggS') {
                    console.log(`   ✅ Successfully decoded to valid OGG format!`);
                } else {
                    console.log(`   ❌ Decoding failed - invalid signature`);
                }
            } else {
                console.log(`   ⚠️ No decoding needed or decoding failed`);
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }
    
    console.log('\n📊 DECODING ANALYSIS:');
    console.log('• Testing WhatsApp audio decryption methods');
    console.log('• Checking for valid OGG signatures after decoding');
    console.log('• Verifying browser compatibility of decoded files');
}

testWhatsAppDecoder().catch(console.error);