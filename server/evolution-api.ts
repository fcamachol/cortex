// Using native fetch (Node.js 18+)

// --- INTERFACES ---
// These define the expected shapes for API requests and responses.

interface EvolutionApiConfig {
    baseUrl: string;
    apiKey: string; // This is the global API key
}

interface CreateInstanceRequest {
    instanceName: string;
    qrcode?: boolean;
    webhook?: string; // The full, unique public URL for this instance's webhooks
    events?: string[];
}

interface InstanceResponse {
    instance: {
        instanceName: string;
        owner: string;
        status: string;
    };
    hash: {
        apikey: string; // The instance-specific API key
    };
    qrcode?: {
        base64?: string;
    };
}

interface ConnectionStateResponse {
    state: 'open' | 'close' | 'connecting';
}

interface SendTextRequest {
    number: string;
    textMessage: {
        text: string;
    };
    options?: {
        delay?: number;
        presence?: 'composing';
        quoted?: {
            key: {
                remoteJid: string;
                fromMe: boolean;
                id: string;
            };
        };
    };
}

// --- API CLIENT CLASS ---

export class EvolutionApi {
    private config: EvolutionApiConfig;

    constructor(config: EvolutionApiConfig) {
        this.config = config;
    }

    private async makeRequest<T>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: any,
        instanceApiKey?: string // Optional instance-specific key
    ): Promise<T> {
        const url = `${this.config.baseUrl}${endpoint}`;
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            // Use the instance-specific key if provided, otherwise the global key
            'apikey': instanceApiKey || this.config.apiKey,
        };

        const options: RequestInit = {
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
                console.error(`❌ Evolution API Error Response (${response.status}) for ${url}:`, errorText);
                throw new Error(`Evolution API request failed: ${response.status} ${response.statusText}`);
            }

            // Handle responses that might not have a JSON body (e.g., 204 No Content)
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return await response.json() as T;
            } else {
                return await response.text() as T;
            }

        } catch (error) {
            console.error(`❌ Evolution API Error during request to ${url}:`, error);
            throw error;
        }
    }

    // --- INSTANCE MANAGEMENT ---

    async createInstance(request: CreateInstanceRequest): Promise<InstanceResponse> {
        return this.makeRequest('/instance/create', 'POST', request);
    }

    async getConnectionState(instanceName: string, instanceApiKey: string): Promise<ConnectionStateResponse> {
        return this.makeRequest(`/instance/connectionState/${instanceName}`, 'GET', null, instanceApiKey);
    }
    
    async logoutInstance(instanceName: string, instanceApiKey: string): Promise<any> {
        return this.makeRequest(`/instance/logout/${instanceName}`, 'DELETE', null, instanceApiKey);
    }

    async deleteInstance(instanceName: string): Promise<any> {
        // Deleting usually requires the global API key
        return this.makeRequest(`/instance/delete/${instanceName}`, 'DELETE');
    }
    
    // --- MESSAGE MANAGEMENT ---

    async sendTextMessage(instanceName: string, instanceApiKey: string, request: SendTextRequest): Promise<any> {
        return this.makeRequest(`/message/sendText/${instanceName}`, 'POST', request, instanceApiKey);
    }
    
    // --- DATA FETCHING (Corrected Endpoints) ---

    async fetchAllChats(instanceName: string, instanceApiKey: string): Promise<any[]> {
        // CORRECTED: The documented endpoint for fetching chats.
        return this.makeRequest(`/chat/findAll/${instanceName}`, 'GET', null, instanceApiKey);
    }

    async fetchAllContacts(instanceName: string, instanceApiKey: string): Promise<any[]> {
        // CORRECTED: The documented endpoint for fetching contacts.
        return this.makeRequest(`/contact/findAll/${instanceName}`, 'GET', null, instanceApiKey);
    }
    
    async fetchAllGroups(instanceName: string, instanceApiKey: string): Promise<any[]> {
        // Use the working endpoint discovered through API exploration
        try {
            // First get all instances to find group data
            const instances = await this.makeRequest(`/instance/fetchInstances`, 'GET', null, instanceApiKey);
            
            // Find our specific instance
            const targetInstance = instances.find((inst: any) => inst.name === instanceName);
            if (!targetInstance) {
                throw new Error(`Instance ${instanceName} not found`);
            }
            
            // Extract group data from the instance information
            const groups: any[] = [];
            
            // If the instance has chat information, filter for groups
            if (targetInstance._count && targetInstance._count.Chat > 0) {
                // Use group participants endpoint to discover groups
                return this.discoverGroupsViaParticipants(instanceName, instanceApiKey);
            }
            
            return groups;
        } catch (error) {
            console.error('Error fetching groups:', error);
            return [];
        }
    }
    
    async discoverGroupsViaParticipants(instanceName: string, instanceApiKey: string): Promise<any[]> {
        // This method uses available endpoints to discover group information
        try {
            const response = await this.makeRequest(`/group/participants/${instanceName}`, 'POST', {}, instanceApiKey);
            return Array.isArray(response) ? response : [];
        } catch (error) {
            console.log('Group discovery via participants failed, returning empty array');
            return [];
        }
    }
    
    async fetchGroupInfo(instanceName: string, instanceApiKey: string, groupId: string): Promise<any> {
        // CORRECTED: The documented endpoint for fetching a single group's info.
        const endpoint = `/group/fetchInfo/${instanceName}?groupId=${groupId}`;
        return this.makeRequest(endpoint, 'GET', null, instanceApiKey);
    }
}


// --- SINGLETON MANAGEMENT ---
// This pattern ensures a single, configurable instance of the API client.

export interface EvolutionApiSettings {
    baseUrl: string;
    apiKey: string; // This is the global/master API key
}

let evolutionApi: EvolutionApi | null = null;

export function initializeEvolutionApi(settings: EvolutionApiSettings): EvolutionApi {
    if (!settings.baseUrl || !settings.apiKey) {
        throw new Error('Cannot initialize Evolution API without baseUrl and apiKey');
    }
    evolutionApi = new EvolutionApi(settings);
    console.log('✅ Evolution API client initialized with new settings.');
    return evolutionApi;
}

export function getEvolutionApi(): EvolutionApi {
    if (!evolutionApi) {
        throw new Error('Evolution API not initialized. Call initializeEvolutionApi first.');
    }
    return evolutionApi;
}