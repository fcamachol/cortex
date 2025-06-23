/**
 * Test browser audio compatibility by examining cached OGG files
 */

import { promises as fs } from 'fs';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testBrowserAudioCompatibility() {
    console.log('Testing browser audio compatibility with cached OGG files...');
    
    // Test one of the known cached files
    const testFile = '/home/runner/workspace/media/live-test-1750199771/3A22F20DFB15C869255E.ogg';
    const messageId = '3A22F20DFB15C869255E';
    const instanceId = 'live-test-1750199771';
    
    try {
        // Read the raw file
        const fileBuffer = await fs.readFile(testFile);
        console.log(`Raw file size: ${fileBuffer.length} bytes`);
        
        // Examine file header
        const header = fileBuffer.subarray(0, 32);
        console.log('File header:', Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        // Check if it starts with OGG signature
        const oggSig = fileBuffer.subarray(0, 4).toString('ascii');
        console.log(`File signature: ${oggSig} (${oggSig === 'OggS' ? 'Valid OGG' : 'Invalid OGG'})`);
        
        if (oggSig !== 'OggS') {
            console.log('File is not in standard OGG format - this explains browser compatibility issues');
            
            // Try to find OGG signature within the file
            const oggSignature = Buffer.from('OggS');
            const oggIndex = fileBuffer.indexOf(oggSignature);
            
            if (oggIndex > 0) {
                console.log(`Found OGG signature at offset: ${oggIndex}`);
                
                // Extract the OGG data and save as corrected file
                const correctedBuffer = fileBuffer.subarray(oggIndex);
                const correctedFile = testFile.replace('.ogg', '_corrected.ogg');
                await fs.writeFile(correctedFile, correctedBuffer);
                console.log(`Created corrected OGG file: ${correctedFile}`);
                
                // Test the media endpoint with corrected data
                await testMediaEndpoint(messageId, instanceId);
                
            } else {
                console.log('No OGG signature found - file may be in proprietary WhatsApp format');
            }
        } else {
            console.log('File has valid OGG signature - testing media endpoint');
            await testMediaEndpoint(messageId, instanceId);
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

async function testMediaEndpoint(messageId, instanceId) {
    try {
        console.log(`\nTesting media endpoint for ${messageId}...`);
        
        const response = await fetch(`${BASE_URL}/api/whatsapp/media/${instanceId}/${messageId}`);
        console.log(`Response status: ${response.status}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        console.log(`Content-Length: ${response.headers.get('content-length')}`);
        console.log(`Accept-Ranges: ${response.headers.get('accept-ranges')}`);
        
        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Check served content signature
            const signature = buffer.subarray(0, 4).toString('ascii');
            console.log(`Served content signature: ${signature}`);
            
            if (signature === 'OggS') {
                console.log('✅ Media endpoint is serving valid OGG data');
                console.log('The issue may be browser-specific or codec-related');
                
                // Check OGG stream type
                const streamType = buffer.subarray(28, 35).toString('ascii');
                console.log(`OGG stream type: ${streamType}`);
                
                if (streamType.includes('vorbis')) {
                    console.log('Stream contains Vorbis audio codec');
                } else if (streamType.includes('opus')) {
                    console.log('Stream contains Opus audio codec');
                } else {
                    console.log('Stream contains unknown audio codec');
                }
                
            } else {
                console.log('❌ Media endpoint is serving invalid OGG data');
                console.log('This explains why browsers cannot play the audio');
            }
        } else {
            console.log(`❌ Media endpoint failed: ${response.status}`);
        }
        
    } catch (error) {
        console.error('Media endpoint test failed:', error.message);
    }
}

testBrowserAudioCompatibility();