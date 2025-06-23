/**
 * Test FFmpeg-based WhatsApp audio decoding
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

async function testFFmpegDecoder() {
    console.log('🔄 TESTING FFMPEG WHATSAPP AUDIO DECODER');
    console.log('='.repeat(60));
    
    const inputFile = '/home/runner/workspace/media/live-test-1750199771/3A22F20DFB15C869255E.ogg';
    const outputFile = '/home/runner/workspace/media/live-test-1750199771/3A22F20DFB15C869255E_converted.wav';
    
    // Strategy 1: Try to probe the file first
    console.log('📋 Probing file with FFprobe...');
    await probeFile(inputFile);
    
    // Strategy 2: Multiple conversion attempts
    const strategies = [
        // Force read as raw PCM data
        ['-f', 'data', '-i', inputFile, '-ar', '16000', '-ac', '1', '-f', 'wav', '-y', outputFile],
        // Try with error tolerance
        ['-err_detect', 'ignore_err', '-i', inputFile, '-c:a', 'pcm_s16le', '-ar', '16000', '-f', 'wav', '-y', outputFile],
        // Assume raw signed 16-bit little-endian
        ['-f', 's16le', '-ar', '16000', '-ac', '1', '-i', inputFile, '-f', 'wav', '-y', outputFile],
        // Try original format detection
        ['-i', inputFile, '-f', 'wav', '-y', outputFile],
        // Force as unsigned 8-bit raw
        ['-f', 'u8', '-ar', '8000', '-ac', '1', '-i', inputFile, '-f', 'wav', '-y', outputFile]
    ];
    
    for (let i = 0; i < strategies.length; i++) {
        const args = strategies[i];
        console.log(`\n🔄 Strategy ${i + 1}: ffmpeg ${args.join(' ')}`);
        
        const success = await runFFmpeg(args);
        if (success) {
            console.log(`✅ Conversion successful with strategy ${i + 1}`);
            
            // Check output file
            try {
                const stats = await fs.stat(outputFile);
                console.log(`📁 Output file size: ${stats.size} bytes`);
                
                if (stats.size > 44) { // Minimum WAV header size
                    console.log(`🎵 Audio file created successfully!`);
                    console.log(`📂 Converted file: ${outputFile}`);
                    return;
                }
            } catch (error) {
                console.log(`❌ Output file check failed: ${error.message}`);
            }
        }
    }
    
    console.log(`❌ All conversion strategies failed`);
}

function probeFile(filePath) {
    return new Promise((resolve) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            filePath
        ]);
        
        let stdout = '';
        let stderr = '';
        
        ffprobe.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        ffprobe.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        ffprobe.on('close', (code) => {
            if (code === 0 && stdout) {
                try {
                    const info = JSON.parse(stdout);
                    console.log(`✅ File format detected:`, JSON.stringify(info.format, null, 2));
                    if (info.streams) {
                        console.log(`🎵 Audio streams:`, JSON.stringify(info.streams, null, 2));
                    }
                } catch (error) {
                    console.log(`❌ Failed to parse probe output`);
                }
            } else {
                console.log(`❌ FFprobe failed (code ${code})`);
                if (stderr) console.log(`Error: ${stderr}`);
            }
            resolve();
        });
        
        ffprobe.on('error', (error) => {
            console.log(`❌ FFprobe error: ${error.message}`);
            resolve();
        });
    });
}

function runFFmpeg(args) {
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', args);
        
        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log(`   ✅ Success`);
                resolve(true);
            } else {
                console.log(`   ❌ Failed (code ${code})`);
                if (stderr.includes('Invalid data found')) {
                    console.log(`   📝 Invalid data format detected`);
                }
                resolve(false);
            }
        });
        
        ffmpeg.on('error', (error) => {
            console.log(`   ❌ Error: ${error.message}`);
            resolve(false);
        });
    });
}

testFFmpegDecoder();