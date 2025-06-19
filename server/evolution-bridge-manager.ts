import { EvolutionWebSocketBridge } from './evolution-bridge';
import { storage } from './storage';
import { getInstanceEvolutionApi } from './evolution-api';

interface BridgeInstance {
  bridge: EvolutionWebSocketBridge;
  instanceId: string;
  userId: string;
  apiKey: string;
  isActive: boolean;
}

export class EvolutionBridgeManager {
  private static instance: EvolutionBridgeManager;
  private bridges: Map<string, BridgeInstance> = new Map();
  private readonly EVOLUTION_API_URL = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';

  static getInstance(): EvolutionBridgeManager {
    if (!EvolutionBridgeManager.instance) {
      EvolutionBridgeManager.instance = new EvolutionBridgeManager();
    }
    return EvolutionBridgeManager.instance;
  }

  private constructor() {
    console.log('🚀 Initializing Evolution API Bridge Manager...');
  }

  async initializeAllUserInstances(userId: string): Promise<void> {
    try {
      const userInstances = await storage.getWhatsappInstances(userId);
      console.log(`🔄 Found ${userInstances.length} instances for user ${userId}`);

      for (const instance of userInstances) {
        if (instance.isConnected && instance.apiKey) {
          await this.createInstanceBridge(userId, instance.instanceId, instance.apiKey);
        }
      }

      console.log(`✅ Bridge Manager initialized with ${this.bridges.size} active WebSocket connections`);
    } catch (error) {
      console.error('❌ Failed to initialize user instances:', error);
    }
  }

  async createInstanceBridge(userId: string, instanceId: string, apiKey: string): Promise<void> {
    const bridgeKey = `${userId}-${instanceId}`;
    
    // Close existing bridge if it exists
    if (this.bridges.has(bridgeKey)) {
      await this.closeBridge(bridgeKey);
    }

    try {
      console.log(`🔗 Creating WebSocket bridge for instance: ${instanceId}`);
      
      const bridge = new EvolutionWebSocketBridge(
        {
          evolutionApiUrl: this.EVOLUTION_API_URL,
          instanceName: instanceId,
          apiKey: apiKey,
          maxReconnectAttempts: 10,
          reconnectDelay: 5000,
          queueOfflineMessages: true,
          retryFailedSaves: true,
        },
        userId,
        instanceId
      );

      this.bridges.set(bridgeKey, {
        bridge,
        instanceId,
        userId,
        apiKey,
        isActive: true,
      });

      console.log(`✅ WebSocket bridge created for instance: ${instanceId}`);
    } catch (error) {
      console.error(`❌ Failed to create bridge for instance ${instanceId}:`, error);
    }
  }

  async closeBridge(bridgeKey: string): Promise<void> {
    const bridgeInstance = this.bridges.get(bridgeKey);
    if (bridgeInstance) {
      console.log(`🔌 Closing WebSocket bridge: ${bridgeInstance.instanceId}`);
      await bridgeInstance.bridge.shutdown();
      this.bridges.delete(bridgeKey);
    }
  }

  async closeAllBridges(): Promise<void> {
    console.log('🔌 Closing all WebSocket bridges...');
    for (const [key, bridgeInstance] of this.bridges) {
      await bridgeInstance.bridge.shutdown();
    }
    this.bridges.clear();
    console.log('✅ All WebSocket bridges closed');
  }

  getBridge(userId: string, instanceId: string): EvolutionWebSocketBridge | null {
    const bridgeKey = `${userId}-${instanceId}`;
    const bridgeInstance = this.bridges.get(bridgeKey);
    return bridgeInstance?.bridge || null;
  }

  async sendMessageViaInstance(userId: string, instanceId: string, to: string, message: string, options?: any): Promise<any> {
    try {
      const userInstance = await storage.getWhatsappInstance(userId, instanceId);
      if (!userInstance || !userInstance.apiKey) {
        throw new Error(`Instance ${instanceId} not found or missing API key`);
      }

      // Use instance-specific Evolution API client
      const evolutionApi = getInstanceEvolutionApi(userInstance.apiKey);
      
      console.log(`📤 Sending message via instance ${instanceId} to ${to}`);
      const result = await evolutionApi.sendTextMessage(instanceId, {
        number: to,
        text: message,
        options: options || {}
      });

      console.log(`✅ Message sent successfully via instance ${instanceId}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send message via instance ${instanceId}:`, error);
      throw error;
    }
  }

  async getInstanceStatus(userId: string, instanceId: string): Promise<any> {
    try {
      const userInstance = await storage.getWhatsappInstance(userId, instanceId);
      if (!userInstance || !userInstance.apiKey) {
        throw new Error(`Instance ${instanceId} not found or missing API key`);
      }

      // Use instance-specific Evolution API client
      const evolutionApi = getInstanceEvolutionApi(userInstance.apiKey);
      
      const connectionState = await evolutionApi.getConnectionState(instanceId);
      const bridgeKey = `${userId}-${instanceId}`;
      const bridgeInstance = this.bridges.get(bridgeKey);

      return {
        instanceId,
        connectionState: connectionState.instance.state,
        bridgeConnected: bridgeInstance?.isActive || false,
        apiKeyStatus: 'valid'
      };
    } catch (error) {
      console.error(`❌ Failed to get instance status for ${instanceId}:`, error);
      return {
        instanceId,
        connectionState: 'error',
        bridgeConnected: false,
        apiKeyStatus: 'invalid',
        error: error.message
      };
    }
  }

  getActiveBridges(): string[] {
    return Array.from(this.bridges.keys());
  }

  getBridgeCount(): number {
    return this.bridges.size;
  }

  async refreshInstanceBridge(userId: string, instanceId: string): Promise<void> {
    const bridgeKey = `${userId}-${instanceId}`;
    const userInstance = await storage.getWhatsappInstance(userId, instanceId);
    
    if (userInstance && userInstance.isConnected && userInstance.apiKey) {
      await this.createInstanceBridge(userId, instanceId, userInstance.apiKey);
    } else {
      await this.closeBridge(bridgeKey);
    }
  }
}

// Global bridge manager instance
export const bridgeManager = EvolutionBridgeManager.getInstance();