// Using native fetch (Node.js 18+)

// --- INTERFACES ---
// These define the expected shapes for API requests and responses.

interface EvolutionApiConfig {
    baseUrl: string;
    apiKey: string; // This is the global/master API key for creating/deleting instances
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
            console.log(`🚀 Evolution API ${method} ${url}`);
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Evolution API Error Response (${response.status}) for ${url}:`, errorText);
                throw new Error(`Evolution API request failed: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json() as T;
            } else {
                const text = await response.text();
                return (text || {}) as T;
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
        return this.makeRequest(`/instance/delete/${instanceName}`, 'DELETE');
    }
    
    // --- MESSAGE MANAGEMENT ---

    async sendTextMessage(instanceName: string, instanceApiKey: string, request: SendTextRequest): Promise<any> {
        return this.makeRequest(`/message/sendText/${instanceName}`, 'POST', request, instanceApiKey);
    }
    
    // --- GROUP MANAGEMENT (NEW ROBUST IMPLEMENTATION) ---

    /**
     * Attempts to fetch all groups by first fetching all instances and their chat metadata.
     * This is a robust fallback for when /chat/findAll is unavailable.
     */
    // REMOVED: fetchAllGroups function - use individual group fetch only
    
    /**
     * Attempts to fetch a single group's metadata using multiple endpoint strategies.
     */
    async fetchGroupInfo(instanceName: string, instanceApiKey: string, groupId: string): Promise<any> {
        const endpointsToTry = [
            `/group/groupMetadata/${instanceName}?groupJid=${groupId}`,
            `/group/info/${instanceName}?groupId=${groupId}`
        ];

        for (const endpoint of endpointsToTry) {
            try {
                const result = await this.makeRequest(endpoint, 'GET', null, instanceApiKey);
                if (result && (result as any).id) {
                    console.log(`✅ Found group info via endpoint: ${endpoint}`);
                    return result;
                }
            } catch (error) {
                console.warn(`- Endpoint ${endpoint} failed. Trying next...`);
            }
        }
        
        throw new Error(`Could not fetch group info for ${groupId} using any available endpoint.`);
    }

    async updateGroupSubject(instanceName: string, instanceApiKey: string, groupJid: string, newSubject: string): Promise<any> {
        const body = { subject: newSubject, groupJid: groupJid };
        return this.makeRequest(`/group/updateSubject/${instanceName}`, 'PUT', body, instanceApiKey);
    }
    
    async updateGroupDescription(instanceName: string, instanceApiKey: string, groupJid: string, newDescription: string): Promise<any> {
        const body = { description: newDescription, groupJid: groupJid };
        return this.makeRequest(`/group/updateDescription/${instanceName}`, 'PUT', body, instanceApiKey);
    }

    async updateGroupSettings(instanceName: string, instanceApiKey: string, groupJid: string, settings: { announce?: 'true' | 'false' }): Promise<any> {
        const body = { settings: settings, groupJid: groupJid };
        return this.makeRequest(`/group/updateSetting/${instanceName}`, 'PUT', body, instanceApiKey);
    }

    async updateGroupProfilePicture(instanceName: string, instanceApiKey: string, groupJid: string, imageUrl: string): Promise<any> {
        const body = { url: imageUrl, groupJid: groupJid };
        return this.makeRequest(`/group/updateProfilePicture/${instanceName}`, 'PUT', body, instanceApiKey);
    }
    
    async addGroupParticipants(instanceName: string, instanceApiKey: string, groupJid: string, participants: string[]): Promise<any> {
        const body = { participants: participants };
        return this.makeRequest(`/group/addParticipants/${instanceName}?groupId=${groupJid}`, 'POST', body, instanceApiKey);
    }

    async removeGroupParticipants(instanceName: string, instanceApiKey: string, groupJid: string, participants: string[]): Promise<any> {
        const body = { participants: participants, groupJid: groupJid };
        return this.makeRequest(`/group/removeParticipants/${instanceName}`, 'PUT', body, instanceApiKey);
    }

    async promoteGroupParticipants(instanceName: string, instanceApiKey: string, groupJid: string, participants: string[]): Promise<any> {
        const body = { participants: participants, groupJid: groupJid };
        return this.makeRequest(`/group/promoteParticipants/${instanceName}`, 'PUT', body, instanceApiKey);
    }

    async demoteGroupParticipants(instanceName: string, instanceApiKey: string, groupJid: string, participants: string[]): Promise<any> {
        const body = { participants: participants, groupJid: groupJid };
        return this.makeRequest(`/group/demoteParticipants/${instanceName}`, 'PUT', body, instanceApiKey);
    }

    // Deprecated but kept for fallback
    async fetchAllChats(instanceName: string, instanceApiKey: string): Promise<any[]> {
        try {
            return await this.makeRequest(`/chat/findAll/${instanceName}`, 'GET', null, instanceApiKey);
        } catch (e) {
            console.warn("`/chat/findAll` endpoint failed, returning empty array.");
            return [];
        }
    }

    async fetchAllContacts(instanceName: string, instanceApiKey: string): Promise<any[]> {
        try {
            return await this.makeRequest(`/chat/whatsappNumbers/${instanceName}`, 'GET', null, instanceApiKey);
        } catch (e) {
            console.warn("`/chat/whatsappNumbers` endpoint failed, returning empty array.");
            return [];
        }
    }

    async fetchGroupMetadata(instanceName: string, instanceApiKey: string, groupJid: string): Promise<any> {
        return this.makeRequest(`/group/groupMetadata/${instanceName}?groupJid=${groupJid}`, 'GET', null, instanceApiKey);
    }

    // Download and decrypt media from WhatsApp using the correct endpoint
    async downloadMedia(instanceName: string, instanceApiKey: string, messageData: any): Promise<any> {
        try {
            const response = await this.makeRequest<any>(
                `/message/downloadMedia/${instanceName}`,
                'POST',
                {
                    key: messageData.key,
                    message: messageData.message,
                    remoteJid: messageData.key?.remoteJid
                },
                instanceApiKey
            );

            return response;
        } catch (error) {
            console.error('Evolution API media download error:', error);
            throw error;
        }
    }

    // REMOVED: refreshGroupsSubjects function - use individual group fetch only
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