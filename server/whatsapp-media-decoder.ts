/**
 * WhatsApp Media Decoder
 * Converts WhatsApp's encrypted/encoded media files to browser-compatible formats
 */

import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

/**
 * Decodes WhatsApp encrypted audio to browser-compatible format
 */
export async function decodeWhatsAppAudio(inputPath: string, outputPath: string): Promise<boolean> {
    try {
        console.log(`🔓 Decoding WhatsApp audio: ${inputPath} -> ${outputPath}`);
        
        // First, try to decode with ffmpeg if available
        const success = await convertWithFFmpeg(inputPath, outputPath);
        if (success) {
            console.log(`✅ Successfully decoded audio file: ${outputPath}`);
            return true;
        }
        
        // Fallback: Try to repair OGG headers
        const repaired = await repairOggHeaders(inputPath, outputPath);
        if (repaired) {
            console.log(`✅ Successfully repaired OGG headers: ${outputPath}`);
            return true;
        }
        
        console.log(`❌ Failed to decode audio file: ${inputPath}`);
        return false;
        
    } catch (error) {
        console.error(`❌ Error decoding WhatsApp audio:`, error);
        return false;
    }
}

/**
 * Convert using FFmpeg (if available)
 */
async function convertWithFFmpeg(inputPath: string, outputPath: string): Promise<boolean> {
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', inputPath,
            '-c:a', 'libopus',
            '-b:a', '64k',
            '-f', 'ogg',
            '-y', // Overwrite output file
            outputPath
        ]);
        
        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ FFmpeg conversion successful`);
                resolve(true);
            } else {
                console.log(`❌ FFmpeg conversion failed (code ${code})`);
                resolve(false);
            }
        });
        
        ffmpeg.on('error', (error) => {
            console.log(`❌ FFmpeg not available: ${error.message}`);
            resolve(false);
        });
    });
}

/**
 * Attempt to repair OGG headers manually
 */
async function repairOggHeaders(inputPath: string, outputPath: string): Promise<boolean> {
    try {
        const inputBuffer = await fs.readFile(inputPath);
        
        // Check if it's already a valid OGG file
        if (inputBuffer.subarray(0, 4).toString() === 'OggS') {
            console.log(`✅ File already has valid OGG headers`);
            await fs.copyFile(inputPath, outputPath);
            return true;
        }
        
        // Try to find OGG signature within the file
        const oggSignature = Buffer.from('OggS');
        const oggIndex = inputBuffer.indexOf(oggSignature);
        
        if (oggIndex > 0) {
            console.log(`🔍 Found OGG signature at offset ${oggIndex}`);
            const oggData = inputBuffer.subarray(oggIndex);
            await fs.writeFile(outputPath, oggData);
            return true;
        }
        
        // Try WhatsApp specific decoding patterns
        const decoded = await decodeWhatsAppSpecific(inputBuffer);
        if (decoded) {
            await fs.writeFile(outputPath, decoded);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error(`❌ Error repairing OGG headers:`, error);
        return false;
    }
}

/**
 * WhatsApp-specific decoding patterns
 */
async function decodeWhatsAppSpecific(buffer: Buffer): Promise<Buffer | null> {
    try {
        // Pattern 1: Simple XOR decoding with common WhatsApp keys
        const commonKeys = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05];
        
        for (const key of commonKeys) {
            const decoded = Buffer.alloc(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
                decoded[i] = buffer[i] ^ key;
            }
            
            // Check if this produces a valid OGG header
            if (decoded.subarray(0, 4).toString() === 'OggS') {
                console.log(`✅ Found valid XOR key: 0x${key.toString(16).padStart(2, '0')}`);
                return decoded;
            }
        }
        
        // Pattern 2: Check for offset-based encoding
        for (let offset = 0; offset < Math.min(buffer.length, 256); offset++) {
            const shifted = buffer.subarray(offset);
            if (shifted.subarray(0, 4).toString() === 'OggS') {
                console.log(`✅ Found OGG data at offset: ${offset}`);
                return shifted;
            }
        }
        
        return null;
        
    } catch (error) {
        console.error(`❌ Error in WhatsApp-specific decoding:`, error);
        return null;
    }
}

/**
 * Get the decoded file path for a given media file
 */
export function getDecodedFilePath(originalPath: string): string {
    const dir = path.dirname(originalPath);
    const name = path.basename(originalPath, path.extname(originalPath));
    return path.join(dir, `${name}_decoded.ogg`);
}

/**
 * Check if a decoded version exists
 */
export async function checkDecodedFileExists(originalPath: string): Promise<string | null> {
    const decodedPath = getDecodedFilePath(originalPath);
    try {
        await fs.access(decodedPath);
        return decodedPath;
    } catch {
        return null;
    }
}

/**
 * Decode WhatsApp media file if needed
 */
export async function ensureDecodedMedia(originalPath: string): Promise<string> {
    // Check if decoded version already exists
    const existingDecoded = await checkDecodedFileExists(originalPath);
    if (existingDecoded) {
        console.log(`✅ Using existing decoded file: ${existingDecoded}`);
        return existingDecoded;
    }
    
    // Create decoded version
    const decodedPath = getDecodedFilePath(originalPath);
    const success = await decodeWhatsAppAudio(originalPath, decodedPath);
    
    if (success) {
        return decodedPath;
    } else {
        // Fallback to original if decoding fails
        console.log(`⚠️ Decoding failed, using original file: ${originalPath}`);
        return originalPath;
    }
}