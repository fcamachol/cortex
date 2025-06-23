/**
 * Simple test to validate audio files and create browser-compatible versions
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

async function testSimpleAudio() {
    console.log('Testing audio file validation and conversion...');
    
    const inputFile = '/home/runner/workspace/media/live-test-1750199771/3A22F20DFB15C869255E.ogg';
    const outputFile = inputFile.replace('.ogg', '_converted.wav');
    
    try {
        // Check if input file exists
        await fs.access(inputFile);
        console.log('Input file found:', inputFile);
        
        // Convert to WAV for universal browser compatibility
        const success = await convertToWav(inputFile, outputFile);
        
        if (success) {
            console.log('Conversion successful!');
            console.log('Browser-compatible file:', outputFile);
            
            // Verify output file
            const stats = await fs.stat(outputFile);
            console.log('Output file size:', stats.size, 'bytes');
            
            if (stats.size > 44) {
                console.log('WAV file created successfully - browsers can play this format');
            }
        } else {
            console.log('Conversion failed - original OGG might be in proprietary format');
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

function convertToWav(inputPath, outputPath) {
    return new Promise((resolve) => {
        console.log('Converting to WAV format...');
        
        const ffmpeg = spawn('ffmpeg', [
            '-i', inputPath,
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            '-f', 'wav',
            '-y',
            outputPath
        ]);
        
        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log('FFmpeg conversion completed successfully');
                resolve(true);
            } else {
                console.log('FFmpeg conversion failed with code:', code);
                if (stderr.includes('Invalid data')) {
                    console.log('Audio file appears to be in invalid or proprietary format');
                }
                resolve(false);
            }
        });
        
        ffmpeg.on('error', (error) => {
            console.log('FFmpeg error:', error.message);
            resolve(false);
        });
    });
}

testSimpleAudio();