/**
 * Google Cloud Storage service for WhatsApp media files
 * Provides reliable cloud storage for audio, images, and documents
 */

import { Storage } from '@google-cloud/storage';
import { lookup } from 'mime-types';
import path from 'path';
import fs from 'fs/promises';

export class GCSMediaStorage {
  private storage: Storage;
  private bucketName: string;
  private bucket: any;

  constructor() {
    // Initialize GCS client - will use service account key from environment
    this.storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_SERVICE_ACCOUNT_KEY_PATH, // Path to service account JSON
      // Or use credentials directly:
      // credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY || '{}')
    });
    
    this.bucketName = process.env.GCS_BUCKET_NAME || 'whatsapp-media-storage';
    this.bucket = this.storage.bucket(this.bucketName);
  }

  /**
   * Upload media file to Google Cloud Storage
   * @param filePath - Local file path
   * @param messageId - WhatsApp message ID
   * @param instanceName - WhatsApp instance name
   * @returns Public URL of uploaded file
   */
  async uploadMediaFile(filePath: string, messageId: string, instanceName: string): Promise<string> {
    try {
      // Generate cloud storage path
      const fileExtension = path.extname(filePath);
      const cloudPath = `media/${instanceName}/${messageId}${fileExtension}`;
      
      // Get mime type
      const mimeType = lookup(filePath) || 'application/octet-stream';
      
      console.log(`☁️ Uploading ${filePath} to GCS: ${cloudPath}`);
      
      // Upload file to GCS
      const file = this.bucket.file(cloudPath);
      await file.save(await fs.readFile(filePath), {
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=86400', // 24 hours
          metadata: {
            messageId,
            instanceName,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      // Make file publicly accessible
      await file.makePublic();
      
      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${cloudPath}`;
      
      console.log(`✅ File uploaded to GCS: ${publicUrl}`);
      return publicUrl;
      
    } catch (error) {
      console.error(`❌ Error uploading to GCS:`, error);
      throw error;
    }
  }

  /**
   * Upload base64 data directly to GCS
   * @param base64Data - Base64 encoded file data
   * @param messageId - WhatsApp message ID
   * @param instanceName - WhatsApp instance name
   * @param fileExtension - File extension (.ogg, .jpg, .pdf)
   * @param mimeType - MIME type
   * @returns Public URL of uploaded file
   */
  async uploadBase64ToGCS(
    base64Data: string, 
    messageId: string, 
    instanceName: string, 
    fileExtension: string,
    mimeType: string
  ): Promise<string> {
    try {
      const cloudPath = `media/${instanceName}/${messageId}${fileExtension}`;
      
      console.log(`☁️ Uploading base64 data to GCS: ${cloudPath}`);
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Upload to GCS
      const file = this.bucket.file(cloudPath);
      await file.save(buffer, {
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=86400',
          metadata: {
            messageId,
            instanceName,
            uploadedAt: new Date().toISOString(),
            source: 'evolution_api_base64'
          }
        }
      });

      // Make file publicly accessible
      await file.makePublic();
      
      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${cloudPath}`;
      
      console.log(`✅ Base64 data uploaded to GCS: ${publicUrl}`);
      return publicUrl;
      
    } catch (error) {
      console.error(`❌ Error uploading base64 to GCS:`, error);
      throw error;
    }
  }

  /**
   * Check if file exists in GCS
   * @param messageId - WhatsApp message ID
   * @param instanceName - WhatsApp instance name
   * @param fileExtension - File extension
   * @returns Boolean indicating if file exists
   */
  async fileExists(messageId: string, instanceName: string, fileExtension: string): Promise<boolean> {
    try {
      const cloudPath = `media/${instanceName}/${messageId}${fileExtension}`;
      const file = this.bucket.file(cloudPath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error(`❌ Error checking file existence in GCS:`, error);
      return false;
    }
  }

  /**
   * Get public URL for media file
   * @param messageId - WhatsApp message ID
   * @param instanceName - WhatsApp instance name
   * @param fileExtension - File extension
   * @returns Public URL or null if file doesn't exist
   */
  async getPublicUrl(messageId: string, instanceName: string, fileExtension: string): Promise<string | null> {
    try {
      const cloudPath = `media/${instanceName}/${messageId}${fileExtension}`;
      const exists = await this.fileExists(messageId, instanceName, fileExtension);
      
      if (exists) {
        return `https://storage.googleapis.com/${this.bucketName}/${cloudPath}`;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting public URL from GCS:`, error);
      return null;
    }
  }

  /**
   * Migrate existing local files to GCS
   * @param localMediaDir - Local media directory path
   * @returns Array of migration results
   */
  async migrateLocalFilesToGCS(localMediaDir: string): Promise<Array<{messageId: string, success: boolean, url?: string, error?: string}>> {
    const results: Array<{messageId: string, success: boolean, url?: string, error?: string}> = [];
    
    try {
      console.log(`🔄 Starting migration from ${localMediaDir} to GCS...`);
      
      // Get all instance directories
      const instanceDirs = await fs.readdir(localMediaDir);
      
      for (const instanceName of instanceDirs) {
        const instancePath = path.join(localMediaDir, instanceName);
        const stat = await fs.stat(instancePath);
        
        if (stat.isDirectory()) {
          console.log(`📁 Processing instance: ${instanceName}`);
          
          // Get all files in instance directory
          const files = await fs.readdir(instancePath);
          
          for (const fileName of files) {
            const filePath = path.join(instancePath, fileName);
            const fileExtension = path.extname(fileName);
            const messageId = path.basename(fileName, fileExtension);
            
            try {
              // Check if already exists in GCS
              const exists = await this.fileExists(messageId, instanceName, fileExtension);
              if (exists) {
                console.log(`⏭️ File already exists in GCS: ${messageId}`);
                results.push({ messageId, success: true, url: await this.getPublicUrl(messageId, instanceName, fileExtension) || undefined });
                continue;
              }
              
              // Upload to GCS
              const publicUrl = await this.uploadMediaFile(filePath, messageId, instanceName);
              results.push({ messageId, success: true, url: publicUrl });
              
            } catch (error) {
              console.error(`❌ Error migrating ${fileName}:`, error);
              results.push({ messageId, success: false, error: error.message });
            }
          }
        }
      }
      
      console.log(`✅ Migration completed. ${results.filter(r => r.success).length}/${results.length} files successful`);
      return results;
      
    } catch (error) {
      console.error(`❌ Error during migration:`, error);
      throw error;
    }
  }

  /**
   * Create bucket if it doesn't exist
   */
  async initializeBucket(): Promise<void> {
    try {
      const [exists] = await this.bucket.exists();
      
      if (!exists) {
        console.log(`📦 Creating GCS bucket: ${this.bucketName}`);
        await this.storage.createBucket(this.bucketName, {
          location: 'US',
          storageClass: 'STANDARD',
          iamConfiguration: {
            uniformBucketLevelAccess: {
              enabled: true
            }
          }
        });
        console.log(`✅ Bucket created: ${this.bucketName}`);
      } else {
        console.log(`✅ Bucket already exists: ${this.bucketName}`);
      }
      
      // Set CORS policy for web access
      await this.bucket.setCorsConfiguration([
        {
          origin: ['*'],
          method: ['GET', 'HEAD'],
          responseHeader: ['Content-Type', 'Range'],
          maxAgeSeconds: 3600
        }
      ]);
      
    } catch (error) {
      console.error(`❌ Error initializing bucket:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const gcsMediaStorage = new GCSMediaStorage();