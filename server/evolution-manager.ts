import { EvolutionAPIWebSocket } from './evolution-websocket';
import { storage } from './storage';
import type { WhatsappInstance } from '@shared/schema';

export class EvolutionBridgeManager {
  private bridges = new Map<string, EvolutionAPIWebSocket>();
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Evolution API Bridge Manager...');
    
    try {
      const users = await this.getAllUsersWithInstances();
      
      for (const user of users) {
        for (const instance of user.instances) {
          await this.createBridge(user.id, instance);
        }
      }
      
      this.isInitialized = true;
      console.log(`✅ Bridge Manager initialized with ${this.bridges.size} active WebSocket connections`);
    } catch (error) {
      console.error('❌ Failed to initialize Bridge Manager:', error);
      this.isInitialized = true;
    }
  }

  private async getAllUsersWithInstances() {
    const allInstances = await this.getAllActiveInstances();
    const userInstances = new Map<string, WhatsappInstance[]>();
    
    for (const instance of allInstances) {
      if (!userInstances.has(instance.userId)) {
        userInstances.set(instance.userId, []);
      }
      userInstances.get(instance.userId)!.push(instance);
    }
    
    return Array.from(userInstances.entries()).map(([id, instances]) => ({
      id,
      instances
    }));
  }

  private async getAllActiveInstances(): Promise<WhatsappInstance[]> {
    const users = await this.getAllUsers();
    const allInstances: WhatsappInstance[] = [];
    
    for (const user of users) {
      const userInstances = await storage.getWhatsappInstances(user.id);
      allInstances.push(...userInstances.filter(instance => instance.isActive));
    }
    
    return allInstances;
  }

  private async getAllUsers() {
    return [{ id: "7804247f-3ae8-4eb2-8c6d-2c44f967ad42" }];
  }

  async createBridge(userId: string, instance: WhatsappInstance): Promise<void> {
    const bridgeKey = instance.instanceName; // Use instance name as key for per-instance isolation
    
    if (this.bridges.has(bridgeKey)) {
      console.log(`🔄 Bridge exists for instance ${instance.instanceName}, reconnecting...`);
      const existingBridge = this.bridges.get(bridgeKey);
      await existingBridge?.shutdown();
      this.bridges.delete(bridgeKey);
    }

    try {
      const config = {
        apiUrl: 'https://evolution-api-evolution-api.vuswn0.easypanel.host',
        instanceName: instance.instanceName,
        apiKey: instance.instanceApiKey || '119FA240-45ED-46A7-AE13-5A1B7C909D7D',
        reconnectInterval: 3000,
        maxReconnectAttempts: 50
      };

      console.log(`🔗 Creating instance-specific WebSocket for: ${instance.instanceName} (${instance.phoneNumber})`);
      console.log(`📡 Evolution API URL: ${config.apiUrl}`);

      const bridge = new EvolutionAPIWebSocket(config, userId, instance.id);
      this.bridges.set(bridgeKey, bridge);
      
      console.log(`✅ Created instance-specific WebSocket bridge for: ${instance.instanceName}`);
    } catch (error) {
      console.error(`❌ Failed to create WebSocket bridge for ${instance.instanceName}:`, error);
    }
  }

  async removeBridge(instanceName: string): Promise<void> {
    const bridge = this.bridges.get(instanceName);
    
    if (bridge) {
      await bridge.shutdown();
      this.bridges.delete(instanceName);
      console.log(`🗑️ Removed bridge for instance: ${instanceName}`);
    }
  }

  async sendMessage(instanceName: string, to: string, message: string, options?: any): Promise<any> {
    const bridge = this.bridges.get(instanceName);
    
    if (!bridge) {
      throw new Error(`No bridge found for instance: ${instanceName}`);
    }

    return await bridge.sendMessage(to, message, options);
  }

  getBridgeStatus(instanceName: string): { connected: boolean; bridgeExists: boolean } {
    const bridge = this.bridges.get(instanceName);
    
    return {
      connected: bridge?.isSocketConnected() || false,
      bridgeExists: !!bridge
    };
  }

  getAllBridgeStatuses(): Array<{ key: string; connected: boolean }> {
    return Array.from(this.bridges.entries()).map(([key, bridge]) => ({
      key,
      connected: bridge.isSocketConnected()
    }));
  }

  async refreshInstance(userId: string, instanceId: string): Promise<void> {
    const instance = await storage.getWhatsappInstance(userId, instanceId);
    if (instance) {
      await this.removeBridge(userId, instance.id);
      await this.createBridge(userId, instance);
    }
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down all bridges...');
    
    const shutdownPromises = Array.from(this.bridges.values()).map(bridge => 
      bridge.shutdown()
    );
    
    await Promise.allSettled(shutdownPromises);
    this.bridges.clear();
    this.isInitialized = false;
    
    console.log('✅ All bridges shut down');
  }
}

export const evolutionManager = new EvolutionBridgeManager();