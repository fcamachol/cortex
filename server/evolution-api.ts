// Using native fetch (Node.js 18+)

interface EvolutionApiConfig {
  baseUrl: string;
  apiKey: string;
}

interface CreateInstanceRequest {
  instanceName: string;
  integration: string;
  token?: string;
  qrcode?: boolean;
  number?: string;
  webhook_wa_business?: string;
  webhook_wa_groups?: string;
  webhook_url?: string;
  events?: string[];
}

interface InstanceResponse {
  instance: {
    instanceName: string;
    owner: string;
    profileName?: string;
    profilePictureUrl?: string;
    status: string;
  };
  hash: {
    apikey: string;
  };
  webhook?: string;
  events?: string[];
  qrcode?: {
    pairingCode?: string;
    code?: string;
    base64?: string;
  };
}

interface QRCodeResponse {
  base64: string;
  code: string;
  pairingCode?: string;
}

interface ConnectionStateResponse {
  instance: {
    instanceName: string;
    state: string;
  };
  qrcode?: {
    base64: string;
    code: string;
    pairingCode?: string;
  };
}

interface SendMessageRequest {
  number: string;
  text?: string;
  media?: {
    mediatype: 'image' | 'video' | 'audio' | 'document';
    media: string; // base64 or url
    fileName?: string;
    caption?: string;
  };
  options?: {
    delay?: number;
    presence?: 'unavailable' | 'available' | 'composing' | 'recording' | 'paused';
    linkPreview?: boolean;
  };
  quoted?: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message?: any;
  };
}

export class EvolutionApi {
  private config: EvolutionApiConfig;

  constructor(config: EvolutionApiConfig) {
    this.config = config;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    instanceName?: string
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': this.config.apiKey,
    };

    // Add instance-specific API key if available and different from global
    if (instanceName) {
      // In production, you might want to store instance-specific API keys
      // For now, we'll use the global API key
    }

    const options: any = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    try {
      console.log(`🔗 Evolution API ${method} ${url}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evolution API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as T;
      console.log(`✅ Evolution API response:`, data);
      return data;
    } catch (error) {
      console.error(`❌ Evolution API Error:`, error);
      throw error;
    }
  }

  // Instance Management
  async createInstance(request: CreateInstanceRequest): Promise<InstanceResponse> {
    return this.makeRequest('/instance/create', 'POST', request);
  }

  async deleteInstance(instanceName: string): Promise<{ message: string }> {
    return this.makeRequest(`/instance/delete/${instanceName}`, 'DELETE');
  }

  async getInstanceInfo(instanceName: string): Promise<InstanceResponse> {
    return this.makeRequest(`/instance/fetchInstances?instanceName=${instanceName}`);
  }

  async getAllInstances(): Promise<InstanceResponse[]> {
    return this.makeRequest('/instance/fetchInstances');
  }

  // Connection Management
  async connectInstance(instanceName: string): Promise<{ message: string }> {
    return this.makeRequest(`/instance/connect/${instanceName}`, 'GET');
  }

  async restartInstance(instanceName: string): Promise<{ message: string }> {
    return this.makeRequest(`/instance/restart/${instanceName}`, 'PUT');
  }

  async logoutInstance(instanceName: string): Promise<{ message: string }> {
    return this.makeRequest(`/instance/logout/${instanceName}`, 'DELETE');
  }

  // QR Code Management
  async getQRCode(instanceName: string): Promise<QRCodeResponse> {
    return this.makeRequest(`/instance/connect/${instanceName}`);
  }

  async getConnectionState(instanceName: string): Promise<ConnectionStateResponse> {
    return this.makeRequest(`/instance/connectionState/${instanceName}`);
  }

  // Message Management
  async sendTextMessage(instanceName: string, request: SendMessageRequest): Promise<any> {
    return this.makeRequest(`/message/sendText/${instanceName}`, 'POST', request);
  }

  async sendMediaMessage(instanceName: string, request: SendMessageRequest): Promise<any> {
    return this.makeRequest(`/message/sendMedia/${instanceName}`, 'POST', request);
  }

  // Chat Management - Using WebSocket events for real-time data
  async fetchChats(instanceName: string): Promise<any> {
    try {
      // Evolution API uses WebSocket events for chat data
      // Check if we have cached chat data from WebSocket events
      const cachedChats = await this.getCachedChats(instanceName);
      if (cachedChats.length > 0) {
        return cachedChats;
      }
      
      // Try different endpoint structures for Evolution API v2.2.3
      const endpoints = [
        `/chat/findAll/${instanceName}`,
        `/chat/find/${instanceName}`,
        `/${instanceName}/chat/findAll`,
        `/instance/${instanceName}/chat/findAll`
      ];
      
      for (const endpoint of endpoints) {
        try {
          const result = await this.makeRequest(endpoint);
          if (result && Array.isArray(result)) {
            return result;
          }
        } catch (endpointError) {
          // Continue to next endpoint
        }
      }
      
      throw new Error('No valid chat endpoint found');
    } catch (error) {
      console.log('Chat data will be populated via webhook events');
      return [];
    }
  }

  private async getCachedChats(instanceName: string): Promise<any[]> {
    // This would typically query the database for cached chat data
    // For now, return empty array - data comes via WebSocket
    return [];
  }

  async fetchMessages(instanceName: string, remoteJid: string, limit: number = 20): Promise<any> {
    return this.makeRequest(`/chat/fetchMessages/${instanceName}?remoteJid=${remoteJid}&limit=${limit}`);
  }

  // Contacts Management
  async fetchContacts(instanceName: string): Promise<any> {
    return this.makeRequest(`/chat/fetchContacts/${instanceName}`);
  }

  // Webhook Management
  async setWebhook(instanceName: string, webhookUrl: string, events?: string[]): Promise<any> {
    const body = {
      webhook: webhookUrl,
      events: events || [
        'APPLICATION_STARTUP',
        'QRCODE_UPDATED',
        'CONNECTION_UPDATE',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'SEND_MESSAGE',
        'CONTACTS_UPSERT',
        'CONTACTS_UPDATE',
        'PRESENCE_UPDATE',
        'CHATS_UPSERT',
        'CHATS_UPDATE'
      ]
    };
    return this.makeRequest(`/webhook/set/${instanceName}`, 'POST', body);
  }

  async getWebhook(instanceName: string): Promise<any> {
    return this.makeRequest(`/webhook/find/${instanceName}`);
  }

  // Profile Management
  async getProfile(instanceName: string): Promise<any> {
    try {
      // Try the standard profile endpoint first
      return await this.makeRequest(`/chat/fetchProfile/${instanceName}`);
    } catch (error) {
      try {
        // Fallback: try getting instance info which might contain owner info
        const instanceInfo = await this.getInstanceInfo(instanceName);
        return instanceInfo;
      } catch (fallbackError) {
        try {
          // Another fallback: try getting own contact info
          return await this.makeRequest(`/chat/whatsappNumbers/${instanceName}`);
        } catch (finalError) {
          throw error; // Throw original error
        }
      }
    }
  }

  async updateProfileName(instanceName: string, name: string): Promise<any> {
    return this.makeRequest(`/chat/updateProfileName/${instanceName}`, 'PUT', { name });
  }

  async updateProfileStatus(instanceName: string, status: string): Promise<any> {
    return this.makeRequest(`/chat/updateProfileStatus/${instanceName}`, 'PUT', { status });
  }

  // Group Management
  async createGroup(instanceName: string, subject: string, participants: string[]): Promise<any> {
    return this.makeRequest(`/group/create/${instanceName}`, 'POST', {
      subject,
      participants
    });
  }

  async getGroupInfo(instanceName: string, groupJid: string): Promise<any> {
    return this.makeRequest(`/group/findGroup/${instanceName}?groupJid=${groupJid}`);
  }

  async getGroupParticipants(instanceName: string, groupJid: string): Promise<any> {
    return this.makeRequest(`/group/participants/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`);
  }

  // Instance Status Check
  async checkInstanceStatus(instanceName: string): Promise<{
    instanceName: string;
    status: 'open' | 'close' | 'connecting';
    serverStatus: boolean;
    qrcode?: string;
  }> {
    try {
      const connectionState = await this.getConnectionState(instanceName);
      
      return {
        instanceName,
        status: connectionState.instance.state as 'open' | 'close' | 'connecting',
        serverStatus: true,
        qrcode: connectionState.qrcode?.base64
      };
    } catch (error) {
      return {
        instanceName,
        status: 'close',
        serverStatus: false
      };
    }
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      await this.makeRequest('/');
      return { status: 'healthy', message: 'Evolution API is responding' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Global instance to be initialized with config
let evolutionApi: EvolutionApi | null = null;

export function initializeEvolutionApi(config: EvolutionApiConfig): EvolutionApi {
  evolutionApi = new EvolutionApi(config);
  return evolutionApi;
}

export function getEvolutionApi(): EvolutionApi {
  if (!evolutionApi) {
    throw new Error('Evolution API not initialized. Call initializeEvolutionApi first.');
  }
  return evolutionApi;
}

// Configuration management
export interface EvolutionApiSettings {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

let currentSettings: EvolutionApiSettings = {
  baseUrl: process.env.EVOLUTION_API_URL || '',
  apiKey: process.env.EVOLUTION_API_KEY || '',
  enabled: false
};

export function updateEvolutionApiSettings(settings: Partial<EvolutionApiSettings>): void {
  currentSettings = { ...currentSettings, ...settings };
  
  if (currentSettings.baseUrl && currentSettings.apiKey && currentSettings.enabled) {
    initializeEvolutionApi({
      baseUrl: currentSettings.baseUrl,
      apiKey: currentSettings.apiKey
    });
    console.log('✅ Evolution API initialized with new settings');
  }
}

export function getEvolutionApiSettings(): EvolutionApiSettings {
  return { ...currentSettings };
}

export function getInstanceEvolutionApi(instanceApiKey: string): EvolutionApi {
  const settings = getEvolutionApiSettings();
  return new EvolutionApi({
    baseUrl: settings.baseUrl,
    apiKey: instanceApiKey
  });
}