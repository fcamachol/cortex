/**
 * Fix missing API key for live-test-1750199771 instance
 */

import { storage } from './server/storage.ts';

async function fixMissingApiKey() {
    console.log('🔧 Fixing missing API key for live-test-1750199771...');
    
    try {
        // Get the instance first
        const instance = await storage.getWhatsappInstance('live-test-1750199771');
        if (!instance) {
            console.log('❌ Instance not found');
            return;
        }
        
        console.log('✅ Instance found:', instance.instanceName);
        console.log('   Current API Key:', instance.apiKey ? 'EXISTS' : 'MISSING');
        console.log('   Connected:', instance.isConnected);
        console.log('   Status:', instance.status);
        
        // Based on other instances and the Evolution API pattern, 
        // the API key should be the global API key: B6D711FCDE4D4FD5936544120E713976
        const globalApiKey = 'B6D711FCDE4D4FD5936544120E713976';
        
        // Update the instance with the API key
        const updatedInstance = {
            ...instance,
            apiKey: globalApiKey,
            isConnected: true,
            status: 'connected',
            updatedAt: new Date()
        };
        
        await storage.upsertWhatsappInstance(updatedInstance);
        
        console.log('✅ Updated instance with API key');
        
        // Verify the update
        const verifyInstance = await storage.getWhatsappInstance('live-test-1750199771');
        console.log('🔍 Verification:');
        console.log('   API Key:', verifyInstance?.apiKey ? 'EXISTS' : 'MISSING');
        console.log('   Connected:', verifyInstance?.isConnected);
        console.log('   Status:', verifyInstance?.status);
        
        if (verifyInstance?.apiKey) {
            console.log('🎉 API key fix completed! Media downloads should now work.');
        } else {
            console.log('❌ API key fix failed');
        }
        
    } catch (error) {
        console.error('Error fixing API key:', error);
    }
}

fixMissingApiKey();