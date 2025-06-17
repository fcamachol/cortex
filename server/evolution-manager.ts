import { storage } from './storage';
import type { WhatsappInstance } from '@shared/schema';

export class EvolutionApiManager {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Evolution API Manager...');
    
    try {
      // For HTTP API, we don't need persistent bridges
      // Just verify API connectivity
      const evolutionApi = await import('./evolution-api').then(m => m.getEvolutionApi());
      const healthCheck = await evolutionApi.healthCheck();
      
      this.isInitialized = true;
      console.log(`✅ Evolution API Manager initialized - Health: ${healthCheck.status}`);
    } catch (error) {
      console.error('❌ Failed to initialize Evolution API Manager:', error);
    }
  }

  private async getAllUsersWithInstances() {
    // This would need to be implemented in storage to get users with their instances
    // For now, we'll use a simple approach
    const allInstances = await this.getAllActiveInstances();
    const userInstances = new Map<string, WhatsappInstance[]>();
    
    for (const instance of allInstances) {
      if (!userInstances.has(instance.userId)) {
        userInstances.set(instance.userId, []);
      }
      userInstances.get(instance.userId)!.push(instance);
    }
    
    return Array.from(userInstances.entries()).map(([userId, instances]) => ({
      id: userId,
      instances
    }));
  }

  private async getAllActiveInstances(): Promise<WhatsappInstance[]> {
    // We need to get all instances across all users
    // This is a simplified approach - in production you'd want pagination
    const users = await this.getAllUsers();
    const allInstances: WhatsappInstance[] = [];
    
    for (const user of users) {
      const userInstances = await storage.getWhatsappInstances(user.id);
      allInstances.push(...userInstances.filter(instance => instance.isActive));
    }
    
    return allInstances;
  }

  private async getAllUsers() {
    // This would need a method in storage to get all users
    // For now, return the demo user
    return [{ id: "7804247f-3ae8-4eb2-8c6d-2c44f967ad42" }];
  }

  async createBridge(userId: string, instance: WhatsappInstance): Promise<void> {
    // For HTTP API, no persistent bridge needed
    console.log(`✅ Instance ready for HTTP API calls: ${instance.instanceName}`);
  }

  async removeBridge(userId: string, instanceId: string): Promise<void> {
    const bridgeKey = `${userId}-${instanceId}`;
    const bridge = this.bridges.get(bridgeKey);
    
    if (bridge) {
      await bridge.shutdown();
      this.bridges.delete(bridgeKey);
      console.log(`✅ Removed bridge for instance: ${instanceId}`);
    }
  }

  async sendMessage(userId: string, instanceId: string, to: string, message: string, options?: any): Promise<any> {
    const bridgeKey = `${userId}-${instanceId}`;
    const bridge = this.bridges.get(bridgeKey);
    
    if (!bridge) {
      throw new Error(`No bridge found for instance: ${instanceId}`);
    }

    if (!bridge.isSocketConnected()) {
      throw new Error(`Bridge not connected for instance: ${instanceId}`);
    }

    return bridge.sendMessage(to, message, options);
  }

  getBridgeStatus(userId: string, instanceId: string): { connected: boolean; bridgeExists: boolean } {
    const bridgeKey = `${userId}-${instanceId}`;
    const bridge = this.bridges.get(bridgeKey);
    
    return {
      bridgeExists: !!bridge,
      connected: bridge ? bridge.isSocketConnected() : false
    };
  }

  getAllBridgeStatuses(): Array<{ key: string; connected: boolean }> {
    return Array.from(this.bridges.entries()).map(([key, bridge]) => ({
      key,
      connected: bridge.isSocketConnected()
    }));
  }

  async refreshInstance(userId: string, instanceId: string): Promise<void> {
    await this.removeBridge(userId, instanceId);
    
    const instance = await storage.getWhatsappInstance(instanceId);
    if (instance && instance.isActive) {
      await this.createBridge(userId, instance);
    }
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down all Evolution API bridges...');
    
    const shutdownPromises = Array.from(this.bridges.values()).map(bridge => 
      bridge.shutdown()
    );
    
    await Promise.all(shutdownPromises);
    this.bridges.clear();
    this.isInitialized = false;
    
    console.log('✅ All bridges shut down successfully');
  }
}

// Export singleton instance
export const evolutionManager = new EvolutionBridgeManager();