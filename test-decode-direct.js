/**
 * Direct test of WhatsApp audio decoding without module imports
 */

import { promises as fs } from 'fs';
import path from 'path';

async function testDirectDecoding() {
    console.log('🔓 DIRECT WHATSAPP AUDIO DECODING TEST');
    console.log('='.repeat(50));
    
    const testFile = '/home/runner/workspace/media/live-test-1750199771/3A22F20DFB15C869255E.ogg';
    
    try {
        // Read the encrypted WhatsApp audio file
        const buffer = await fs.readFile(testFile);
        console.log(`📁 Original file size: ${buffer.length} bytes`);
        
        // Check original signature
        const originalSig = buffer.subarray(0, 8);
        console.log(`🔍 Original bytes: ${Array.from(originalSig).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`🔍 Original ASCII: ${Array.from(originalSig).map(b => String.fromCharCode(b)).join('')}`);
        
        // Method 1: Look for OGG signature within the file
        const oggSignature = Buffer.from('OggS');
        const oggIndex = buffer.indexOf(oggSignature);
        
        if (oggIndex > 0) {
            console.log(`✅ Found OGG signature at offset: ${oggIndex}`);
            const decodedBuffer = buffer.subarray(oggIndex);
            const outputPath = testFile.replace('.ogg', '_decoded_method1.ogg');
            await fs.writeFile(outputPath, decodedBuffer);
            console.log(`💾 Saved decoded file: ${outputPath}`);
            return;
        }
        
        // Method 2: Try XOR decoding with common keys
        const commonKeys = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x10, 0x20, 0x40, 0x80, 0xFF];
        
        for (const key of commonKeys) {
            const decoded = Buffer.alloc(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
                decoded[i] = buffer[i] ^ key;
            }
            
            // Check if this produces a valid OGG header
            if (decoded.subarray(0, 4).toString('ascii') === 'OggS') {
                console.log(`✅ Found valid XOR key: 0x${key.toString(16).padStart(2, '0')}`);
                const outputPath = testFile.replace('.ogg', `_decoded_xor_${key.toString(16)}.ogg`);
                await fs.writeFile(outputPath, decoded);
                console.log(`💾 Saved XOR decoded file: ${outputPath}`);
                return;
            }
        }
        
        // Method 3: Try byte shifting (look for patterns)
        for (let offset = 1; offset < Math.min(buffer.length, 100); offset++) {
            const shifted = buffer.subarray(offset);
            if (shifted.length > 4 && shifted.subarray(0, 4).toString('ascii') === 'OggS') {
                console.log(`✅ Found OGG data at byte offset: ${offset}`);
                const outputPath = testFile.replace('.ogg', `_decoded_offset_${offset}.ogg`);
                await fs.writeFile(outputPath, shifted);
                console.log(`💾 Saved offset decoded file: ${outputPath}`);
                return;
            }
        }
        
        // Method 4: Check if it's already valid but misidentified
        if (buffer.subarray(0, 4).toString('ascii') === 'OggS') {
            console.log(`✅ File is already valid OGG format`);
            return;
        }
        
        // Method 5: Check if it's raw Opus data that needs OGG container
        console.log(`🔍 Analyzing as potential raw Opus audio...`);
        
        // Check for Opus identification header patterns
        const opusHeader = Buffer.from('OpusHead');
        const opusIndex = buffer.indexOf(opusHeader);
        
        if (opusIndex >= 0) {
            console.log(`✅ Found Opus header at offset: ${opusIndex}`);
            // Extract from Opus header
            const opusData = buffer.subarray(opusIndex);
            const outputPath = testFile.replace('.ogg', '_opus_extracted.opus');
            await fs.writeFile(outputPath, opusData);
            console.log(`💾 Saved Opus data: ${outputPath}`);
            return;
        }
        
        // Method 6: Check if it's WebM/Matroska container
        const webmHeader = Buffer.from([0x1A, 0x45, 0xDF, 0xA3]); // EBML header
        const webmIndex = buffer.indexOf(webmHeader);
        
        if (webmIndex >= 0) {
            console.log(`✅ Found WebM/EBML header at offset: ${webmIndex}`);
            const webmData = buffer.subarray(webmIndex);
            const outputPath = testFile.replace('.ogg', '_webm_extracted.webm');
            await fs.writeFile(outputPath, webmData);
            console.log(`💾 Saved WebM data: ${outputPath}`);
            return;
        }
        
        // Method 7: Try to create a minimal OGG container around the data
        console.log(`🔧 Attempting to wrap in minimal OGG container...`);
        
        // Create a basic OGG page structure
        const oggPage = createMinimalOggPage(buffer);
        if (oggPage) {
            const outputPath = testFile.replace('.ogg', '_minimal_ogg.ogg');
            await fs.writeFile(outputPath, oggPage);
            console.log(`💾 Created minimal OGG container: ${outputPath}`);
            return;
        }
        
        console.log(`❌ Could not decode WhatsApp audio file`);
        console.log(`🔍 File signature: ${Array.from(buffer.subarray(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        
        // Save hex dump for analysis
        const hexDump = Array.from(buffer.subarray(0, 200)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`🔍 First 200 bytes: ${hexDump}`);
        
    } catch (error) {
        console.error(`❌ Error during decoding test:`, error);
    }
}

function createMinimalOggPage(data) {
    // This is a placeholder - creating proper OGG pages requires complex logic
    // For now, just return null to indicate it's not implemented
    return null;
}

testDirectDecoding();