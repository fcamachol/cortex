/**
 * Test the WhatsApp audio processor with cached files
 */

import { processWhatsAppAudio } from './server/whatsapp-audio-processor.js';
import { promises as fs } from 'fs';

async function testWhatsAppProcessor() {
    console.log('Testing WhatsApp audio processor...');
    
    const testFile = '/home/runner/workspace/media/live-test-1750199771/3A22F20DFB15C869255E.ogg';
    
    try {
        console.log(`Processing: ${testFile}`);
        
        // Process the WhatsApp audio file
        const processedPath = await processWhatsAppAudio(testFile);
        
        if (processedPath) {
            console.log(`✅ Processing successful: ${processedPath}`);
            
            // Verify the processed file
            const stats = await fs.stat(processedPath);
            console.log(`Processed file size: ${stats.size} bytes`);
            
            // Check if it's a valid WAV file
            const buffer = await fs.readFile(processedPath);
            const signature = buffer.subarray(0, 4).toString('ascii');
            
            if (signature === 'RIFF') {
                console.log('✅ Successfully created valid WAV file');
                console.log('This audio should now be playable in browsers');
                return true;
            } else {
                console.log(`❌ Invalid WAV signature: ${signature}`);
            }
        } else {
            console.log('❌ Processing failed');
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
    
    return false;
}

testWhatsAppProcessor();