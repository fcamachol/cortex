import { getEvolutionApi } from './evolution-api';
import { storage } from './storage';
import fs from 'fs/promises';
import path from 'path';
import { lookup } from 'mime-types';

// Configuration
const MEDIA_STORAGE_PATH = path.resolve(process.cwd(), 'media');

/**
 * Handles the entire media download process for a given message.
 * @param instanceId - The Evolution API instance ID.
 * @param instanceApiKey - The instance-specific API key.
 * @param messageData - The full message object from the webhook.
 */
export async function handleMediaDownload(instanceId: string, instanceApiKey: string, messageData: any) {
    const messageId = messageData.key?.id;
    if (!messageId) {
        console.error('No message ID found in message data');
        return;
    }

    console.log(`📥 [${instanceId}] Starting media download for message ID: ${messageId}`);

    try {
        // Step 1 & 2: Make the API call using Evolution API client
        const evolutionApi = getEvolutionApi();
        const mediaData = await evolutionApi.downloadMedia(instanceId, instanceApiKey, messageData);

        if (!mediaData) {
            throw new Error("No media data returned from Evolution API");
        }

        // Step 3: Decode and store the media file
        if (mediaData.base64) {
            const fileBuffer = Buffer.from(mediaData.base64, 'base64');
            const fileExtension = getFileExtension(mediaData.mimetype);
            const fileName = `${messageId}.${fileExtension}`;
            const instanceDir = path.join(MEDIA_STORAGE_PATH, instanceId);
            const filePath = path.join(instanceDir, fileName);
            
            // Ensure the storage directory exists
            await fs.mkdir(instanceDir, { recursive: true });
            
            // Save the file
            await fs.writeFile(filePath, fileBuffer);

            console.log(`✅ [${instanceId}] Media saved successfully: ${filePath}`);
            
            // Update database with local file path
            await storage.updateWhatsappMessageMediaPath(messageId, instanceId, filePath);

            return filePath;
        } else {
            throw new Error("No Base64 data found in the API response");
        }

    } catch (error) {
        // Step 4: Robust error handling
        if (error instanceof Error && error.message.includes('404')) {
            console.warn(`❌ [${instanceId}] Media for message ${messageId} has expired or is unavailable (404)`);
            // Mark as unavailable in database
            await markMediaAsUnavailable(messageId, instanceId);
        } else {
            console.error(`❌ [${instanceId}] Error during media download for message ${messageId}:`, error);
        }
        return null;
    }
}

/**
 * Attempts to download media for a message that wasn't cached initially
 */
export async function downloadMediaForMessage(instanceId: string, messageId: string) {
    try {
        // Get the instance details
        const instance = await storage.getInstanceById(instanceId);
        if (!instance || !instance.apiKey) {
            console.error(`Instance ${instanceId} not found or missing API key`);
            return null;
        }

        // Get the original message data
        const message = await storage.getWhatsappMessageById(messageId, instanceId);
        if (!message?.rawApiPayload) {
            console.error(`Message ${messageId} not found or missing raw API payload`);
            return null;
        }

        // Attempt download
        return await handleMediaDownload(instanceId, instance.apiKey, message.rawApiPayload);
    } catch (error) {
        console.error(`Failed to download media for message ${messageId}:`, error);
        return null;
    }
}

/**
 * Get file extension from mimetype
 */
function getFileExtension(mimetype: string): string {
    if (!mimetype) return 'bin';
    
    // Handle specific WhatsApp media types
    if (mimetype.includes('ogg')) return 'ogg';
    if (mimetype.includes('mp4')) return 'mp4';
    if (mimetype.includes('webp')) return 'webp';
    if (mimetype.includes('jpeg')) return 'jpg';
    if (mimetype.includes('png')) return 'png';
    if (mimetype.includes('pdf')) return 'pdf';
    
    // Use mime-types library as fallback
    const extension = lookup(mimetype);
    return extension ? extension.split('/')[1] : 'bin';
}

/**
 * Cache base64 media data directly from webhook payload
 */
export async function cacheBase64Media(instanceId: string, messageId: string, base64Data: string, mimetype: string): Promise<string | null> {
    try {
        if (!base64Data) {
            console.error('No base64 data provided');
            return null;
        }

        // Create storage directory
        const instanceDir = path.join(MEDIA_STORAGE_PATH, instanceId);
        await fs.mkdir(instanceDir, { recursive: true });

        // Determine file extension
        const fileExtension = getFileExtension(mimetype);
        const fileName = `${messageId}.${fileExtension}`;
        const filePath = path.join(instanceDir, fileName);

        // Clean base64 data (remove data URL prefix if present)
        const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
        
        // Convert base64 to buffer and save
        const fileBuffer = Buffer.from(cleanBase64, 'base64');
        await fs.writeFile(filePath, fileBuffer);

        console.log(`✅ [${instanceId}] Base64 media cached: ${filePath} (${fileBuffer.length} bytes)`);
        return filePath;

    } catch (error) {
        console.error(`❌ [${instanceId}] Error caching base64 media for ${messageId}:`, error);
        return null;
    }
}

/**
 * Mark media as unavailable in the database
 */
async function markMediaAsUnavailable(messageId: string, instanceId: string) {
    try {
        // For now, we don't have a specific unavailable status in the schema
        // but we can log this for future reference
        console.log(`📝 Marking media as unavailable for message ${messageId} in instance ${instanceId}`);
    } catch (error) {
        console.error('Error marking media as unavailable:', error);
    }
}

/**
 * Check if media file exists locally
 */
export async function checkMediaExists(instanceId: string, messageId: string): Promise<string | null> {
    try {
        const extensions = ['ogg', 'mp4', 'jpg', 'png', 'webp', 'pdf', 'bin'];
        const instanceDir = path.join(MEDIA_STORAGE_PATH, instanceId);
        
        for (const ext of extensions) {
            const filePath = path.join(instanceDir, `${messageId}.${ext}`);
            try {
                await fs.access(filePath);
                return filePath; // File exists
            } catch {
                // File doesn't exist, try next extension
                continue;
            }
        }
        
        return null; // No file found
    } catch (error) {
        console.error('Error checking media existence:', error);
        return null;
    }
}