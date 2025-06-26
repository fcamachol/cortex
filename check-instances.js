/**
 * Check WhatsApp instances and their API keys
 */

import { storage } from './server/storage.js';

async function checkInstances() {
  console.log('🔍 Checking WhatsApp instances and their API keys...');
  
  try {
    const instances = await storage.getAllWhatsappInstances();
    
    console.log(`Found ${instances.length} instances:`);
    instances.forEach(instance => {
      console.log(`- ${instance.instanceName}: API Key ${instance.apiKey ? 'configured ✓' : 'MISSING ❌'}`);
      if (instance.apiKey) {
        console.log(`  API Key: ${instance.apiKey.substring(0, 10)}...${instance.apiKey.substring(instance.apiKey.length - 10)}`);
      }
    });
    
    // Check if live-test-1750199771 exists and has API key
    const testInstance = await storage.getWhatsappInstance('live-test-1750199771');
    if (testInstance) {
      console.log(`\n🧪 Test instance live-test-1750199771:`);
      console.log(`  - API Key: ${testInstance.apiKey ? 'configured ✓' : 'MISSING ❌'}`);
      console.log(`  - Status: ${testInstance.status || 'unknown'}`);
    } else {
      console.log(`\n❌ Test instance live-test-1750199771 not found`);
    }
    
  } catch (error) {
    console.error('Error checking instances:', error);
  }
}

checkInstances();