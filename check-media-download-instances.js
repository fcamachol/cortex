/**
 * Check instances for media download debugging
 */

import { storage } from './server/storage.ts';

async function checkInstances() {
    console.log('🔍 Checking instances for media download...');
    
    try {
        // Get all instances - using the correct method name
        const instances = await storage.getWhatsappInstances();
        console.log(`Found ${instances.length} total instances:`);
        
        for (const instance of instances) {
            console.log(`  📱 ${instance.instanceName}`);
            console.log(`     API Key: ${instance.apiKey ? instance.apiKey.substring(0, 15) + '...' : 'MISSING'}`);
            console.log(`     Connected: ${instance.isConnected}`);
            console.log(`     Status: ${instance.status}`);
            console.log('');
        }
        
        // Check if "live-test-1750199771" instance exists
        const testInstance = await storage.getWhatsappInstance('live-test-1750199771');
        console.log('🧪 Testing specific instance "live-test-1750199771":');
        if (testInstance) {
            console.log('  ✅ Instance found in database');
            console.log(`  📱 Name: ${testInstance.instanceName}`);
            console.log(`  🔑 API Key: ${testInstance.apiKey ? testInstance.apiKey.substring(0, 15) + '...' : 'MISSING'}`);
            console.log(`  🔗 Connected: ${testInstance.isConnected}`);
            console.log(`  📊 Status: ${testInstance.status}`);
        } else {
            console.log('  ❌ Instance NOT found in database');
            console.log('  This explains why media downloads are failing!');
        }
        
        // Show recent media messages that are failing
        const mediaMessages = await storage.getWhatsappMessageMedia();
        const recentMedia = mediaMessages.filter(m => m.instanceName === 'live-test-1750199771').slice(0, 3);
        
        console.log(`📁 Recent media messages for live-test-1750199771: ${recentMedia.length}`);
        for (const media of recentMedia) {
            console.log(`  📄 ${media.messageId} - ${media.mimetype} (${media.fileSizeBytes} bytes)`);
        }
        
    } catch (error) {
        console.error('Error checking instances:', error);
    }
}

checkInstances();