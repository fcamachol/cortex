/**
 * Recovery script for missing media files
 * Downloads audio files that exist in database but are missing from disk
 */

import { storage } from './server/storage.ts';
import { getEvolutionApi } from './server/evolution-api.ts';
import fs from 'fs/promises';
import path from 'path';

const MISSING_FILES = [
    '3A6C147F558AF55CE6E3',
    '3AA9F90154C2F312F847', 
    '3A9257EE7A3185B877DC',
    '3AF40769FCBB9EDED5A6'
];

async function recoverMissingMedia() {
    console.log('🔄 Starting recovery of missing media files...');
    
    for (const messageId of MISSING_FILES) {
        try {
            console.log(`\n📥 Processing ${messageId}...`);
            
            // Get media info from database
            const mediaRecord = await storage.getWhatsappMessageMediaAnyInstance(messageId);
            
            if (!mediaRecord) {
                console.log(`❌ No database record found for ${messageId}`);
                continue;
            }
            
            console.log(`📋 Found database record:`, {
                instanceName: mediaRecord.instanceName,
                mimetype: mediaRecord.mimetype,
                hasMediaKey: !!mediaRecord.mediaKey,
                localPath: mediaRecord.fileLocalPath
            });
            
            // Check if file already exists
            if (mediaRecord.fileLocalPath) {
                try {
                    await fs.access(mediaRecord.fileLocalPath);
                    console.log(`✅ File already exists at ${mediaRecord.fileLocalPath}`);
                    continue;
                } catch {
                    console.log(`📂 File missing at ${mediaRecord.fileLocalPath}, will download`);
                }
            }
            
            // Download using Evolution API with media key
            if (mediaRecord.mediaKey) {
                console.log(`🔑 Attempting download with media key...`);
                
                const evolutionApi = getEvolutionApi();
                const base64Data = await evolutionApi.downloadMedia(messageId, mediaRecord.mediaKey);
                
                if (base64Data) {
                    // Create directory if needed
                    const mediaDir = path.dirname(mediaRecord.fileLocalPath);
                    await fs.mkdir(mediaDir, { recursive: true });
                    
                    // Save file
                    const buffer = Buffer.from(base64Data, 'base64');
                    await fs.writeFile(mediaRecord.fileLocalPath, buffer);
                    
                    console.log(`✅ Successfully downloaded and saved ${messageId} to ${mediaRecord.fileLocalPath}`);
                    console.log(`📊 File size: ${buffer.length} bytes`);
                } else {
                    console.log(`❌ Failed to download ${messageId} - no data returned`);
                }
            } else {
                console.log(`❌ No media key available for ${messageId}`);
            }
            
        } catch (error) {
            console.error(`❌ Error processing ${messageId}:`, error.message);
        }
    }
    
    console.log('\n🏁 Media recovery completed');
}

// Run the recovery
recoverMissingMedia().catch(console.error);