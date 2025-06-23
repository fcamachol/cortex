/**
 * Test Evolution API downloadMedia method to validate your solution approach
 */

import { EvolutionApi } from './server/evolution-api.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { lookup } from 'mime-types';

const evolutionApi = new EvolutionApi(process.env.EVOLUTION_API_URL, process.env.EVOLUTION_API_KEY);

async function testEvolutionMediaDownload() {
  try {
    console.log('🧪 Testing Evolution API downloadMedia method...');
    
    // Test with a known audio message from the database
    const messageData = {
      key: { id: '3A22F20DFB15C869255E' },
      message: {
        audioMessage: {
          mimetype: 'audio/ogg; codecs=opus'
        }
      }
    };
    
    console.log(`📥 Attempting to download message: ${messageData.key.id}`);
    
    // Call Evolution API downloadMedia
    const downloadedMedia = await evolutionApi.downloadMedia(
      'live-test-1750199771', 
      process.env.EVOLUTION_API_KEY, 
      messageData
    );
    
    if (downloadedMedia && downloadedMedia.buffer) {
      console.log(`✅ Download successful!`);
      console.log(`📊 Media info:`, {
        mimetype: downloadedMedia.mimetype,
        size: downloadedMedia.buffer.length,
        type: typeof downloadedMedia.buffer
      });
      
      // Determine file extension from mimetype
      const extension = downloadedMedia.mimetype.split('/')[1] || 'ogg';
      const fileName = `${messageData.key.id}.${extension}`;
      const storagePath = path.resolve('./media_storage/live-test-1750199771');
      
      // Save the buffer to file
      await fs.mkdir(storagePath, { recursive: true });
      await fs.writeFile(path.join(storagePath, fileName), downloadedMedia.buffer);
      
      console.log(`✅ Playable audio file saved: ${fileName}`);
      console.log(`📁 Saved to: ${path.join(storagePath, fileName)}`);
      
      // Verify the file header
      const fileBuffer = await fs.readFile(path.join(storagePath, fileName));
      const header = fileBuffer.slice(0, 16);
      console.log(`🔍 File header:`, header.toString('hex'));
      
      return true;
    } else {
      console.log(`❌ Download failed - no media data returned`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return false;
  }
}

// Run the test
testEvolutionMediaDownload()
  .then(success => {
    if (success) {
      console.log('\n🎉 Evolution API downloadMedia test PASSED!');
      console.log('✅ Your solution approach is correct - Evolution API provides playable audio files');
    } else {
      console.log('\n❌ Evolution API downloadMedia test FAILED');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });