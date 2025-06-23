/**
 * WhatsApp Audio Processor
 * Handles decoding of WhatsApp's proprietary audio format to browser-compatible audio
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Process WhatsApp audio file and convert to browser-compatible format
 */
export async function processWhatsAppAudio(inputPath: string): Promise<string | null> {
    try {
        console.log(`🔄 Processing WhatsApp audio: ${inputPath}`);
        
        // Check if file exists
        await fs.access(inputPath);
        
        // Create output path for processed audio
        const dir = path.dirname(inputPath);
        const name = path.basename(inputPath, path.extname(inputPath));
        const outputPath = path.join(dir, `${name}_processed.wav`);
        
        // Check if processed version already exists
        try {
            await fs.access(outputPath);
            console.log(`✅ Using existing processed audio: ${outputPath}`);
            return outputPath;
        } catch {
            // File doesn't exist, need to process
        }
        
        // Read the original file
        const inputBuffer = await fs.readFile(inputPath);
        console.log(`📁 Input file size: ${inputBuffer.length} bytes`);
        
        // Try multiple decoding strategies
        const decodedBuffer = await decodeWhatsAppAudio(inputBuffer);
        
        if (decodedBuffer) {
            // Convert decoded audio to WAV using FFmpeg
            const wavBuffer = await convertToWav(decodedBuffer);
            
            if (wavBuffer) {
                await fs.writeFile(outputPath, wavBuffer);
                console.log(`✅ Created processed audio: ${outputPath} (${wavBuffer.length} bytes)`);
                return outputPath;
            }
        }
        
        // If decoding fails, try direct FFmpeg processing with raw audio assumptions
        const directProcessed = await directFFmpegProcess(inputPath, outputPath);
        if (directProcessed) {
            return outputPath;
        }
        
        console.log(`❌ Failed to process WhatsApp audio: ${inputPath}`);
        return null;
        
    } catch (error) {
        console.error(`❌ Error processing WhatsApp audio:`, error);
        return null;
    }
}

/**
 * Attempt to decode WhatsApp's proprietary audio format
 */
async function decodeWhatsAppAudio(buffer: Buffer): Promise<Buffer | null> {
    try {
        // Strategy 1: Check for embedded OGG data
        const oggSignature = Buffer.from('OggS');
        let oggIndex = buffer.indexOf(oggSignature);
        
        if (oggIndex > 0) {
            console.log(`🔍 Found embedded OGG at offset: ${oggIndex}`);
            return buffer.subarray(oggIndex);
        }
        
        // Strategy 2: Try XOR decoding with common WhatsApp keys
        const commonKeys = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x10, 0x20, 0x40, 0x80, 0xFF];
        
        for (const key of commonKeys) {
            const decoded = Buffer.alloc(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
                decoded[i] = buffer[i] ^ key;
            }
            
            // Check if XOR produces valid OGG
            if (decoded.subarray(0, 4).toString('ascii') === 'OggS') {
                console.log(`🔓 Successfully decoded with XOR key: 0x${key.toString(16)}`);
                return decoded;
            }
        }
        
        // Strategy 3: Check for RIFF/WAV header
        if (buffer.subarray(0, 4).toString('ascii') === 'RIFF') {
            console.log(`🔍 Found embedded WAV data`);
            return buffer;
        }
        
        // Strategy 4: Look for Opus header
        const opusIndex = buffer.indexOf(Buffer.from('OpusHead'));
        if (opusIndex >= 0) {
            console.log(`🔍 Found Opus header at offset: ${opusIndex}`);
            return buffer.subarray(opusIndex);
        }
        
        return null;
        
    } catch (error) {
        console.error(`❌ Error decoding WhatsApp audio:`, error);
        return null;
    }
}

/**
 * Convert audio buffer to WAV format using FFmpeg
 */
async function convertToWav(audioBuffer: Buffer): Promise<Buffer | null> {
    const tempDir = '/tmp';
    const inputFile = path.join(tempDir, `audio_${Date.now()}_input`);
    const outputFile = path.join(tempDir, `audio_${Date.now()}_output.wav`);
    
    try {
        // Write buffer to temp file
        await fs.writeFile(inputFile, audioBuffer);
        
        // Convert with FFmpeg
        const success = await runFFmpeg([
            '-i', inputFile,
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            '-f', 'wav',
            '-y', outputFile
        ]);
        
        if (success) {
            const wavBuffer = await fs.readFile(outputFile);
            
            // Cleanup
            await fs.unlink(inputFile).catch(() => {});
            await fs.unlink(outputFile).catch(() => {});
            
            return wavBuffer;
        }
        
        // Cleanup on failure
        await fs.unlink(inputFile).catch(() => {});
        await fs.unlink(outputFile).catch(() => {});
        
        return null;
        
    } catch (error) {
        console.error(`❌ Error converting to WAV:`, error);
        return null;
    }
}

/**
 * Direct FFmpeg processing assuming raw audio data
 */
async function directFFmpegProcess(inputPath: string, outputPath: string): Promise<boolean> {
    try {
        // Try multiple raw audio format assumptions
        const strategies = [
            // Assume 16kHz mono signed 16-bit
            ['-f', 's16le', '-ar', '16000', '-ac', '1', '-i', inputPath, '-f', 'wav', '-y', outputPath],
            // Assume 8kHz mono unsigned 8-bit
            ['-f', 'u8', '-ar', '8000', '-ac', '1', '-i', inputPath, '-f', 'wav', '-y', outputPath],
            // Assume 44.1kHz stereo signed 16-bit
            ['-f', 's16le', '-ar', '44100', '-ac', '2', '-i', inputPath, '-f', 'wav', '-y', outputPath],
            // Force read with error tolerance
            ['-err_detect', 'ignore_err', '-i', inputPath, '-acodec', 'pcm_s16le', '-ar', '16000', '-f', 'wav', '-y', outputPath]
        ];
        
        for (const args of strategies) {
            console.log(`🔄 Trying FFmpeg strategy: ${args.join(' ')}`);
            const success = await runFFmpeg(args);
            
            if (success) {
                // Verify output file has reasonable size
                try {
                    const stats = await fs.stat(outputPath);
                    if (stats.size > 44) { // Minimum WAV header size
                        console.log(`✅ Direct FFmpeg processing successful: ${stats.size} bytes`);
                        return true;
                    }
                } catch {
                    // Continue to next strategy
                }
            }
        }
        
        return false;
        
    } catch (error) {
        console.error(`❌ Error in direct FFmpeg processing:`, error);
        return false;
    }
}

/**
 * Run FFmpeg with given arguments
 */
function runFFmpeg(args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', args);
        
        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                console.log(`❌ FFmpeg failed with code ${code}`);
                if (stderr.includes('Invalid data')) {
                    console.log(`📝 Invalid data format detected`);
                }
                resolve(false);
            }
        });
        
        ffmpeg.on('error', (error) => {
            console.log(`❌ FFmpeg error: ${error.message}`);
            resolve(false);
        });
    });
}