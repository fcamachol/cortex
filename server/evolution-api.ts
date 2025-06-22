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

            // Handle responses that might not have a JSON body (e.g., 204 No Content)
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json() as T;
            } else {
                // For non-JSON responses, return the text content or an empty object
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
        // Creating an instance uses the global API key
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
        // Try multiple possible endpoints for fetching groups
        const endpoints = [
            `/chat/findAll/${instanceName}`, // Get all chats, filter for groups
            `/instance/connectionState/${instanceName}` // Fallback to check instance status
        ];
        
        for (const endpoint of endpoints) {
            try {
                const result = await this.makeRequest(endpoint, 'GET', null, instanceApiKey);
                
                if (endpoint.includes('chat/findAll')) {
                    // Filter only group chats (JIDs ending with @g.us)
                    return Array.isArray(result) ? result.filter(chat => chat.id?.endsWith('@g.us')) : [];
                }
                
                return Array.isArray(result) ? result : [];
            } catch (error) {
                console.warn(`⚠️ Evolution API endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }
        
        return []; // Return empty array if all endpoints fail
    }

    async fetchGroupMetadata(instanceName: string, instanceApiKey: string, groupJid: string): Promise<any> {
        // Fetch detailed group metadata including authentic subject name
        return this.makeRequest(`/group/findGroupInfos/${instanceName}`, 'POST', { 
            groupJid: groupJid 
        }, instanceApiKey);
    }

    async fetchGroupInfo(instanceName: string, instanceApiKey: string, groupId: string): Promise<any> {
        // CORRECTED: The documented endpoint for fetching a single group's info.
        return this.makeRequest(`/group/info/${instanceName}?groupId=${groupId}`, 'GET', null, instanceApiKey);
    }

    async updateGroupSubject(instanceName: string, instanceApiKey: string, groupJid: string, newSubject: string): Promise<any> {
        const body = { subject: newSubject, groupJid: groupJid };
        return this.makeRequest(`/group/updateSubject/${instanceName}`, 'PUT', body, instanceApiKey);
    }
    
    async updateGroupDescription(instanceName: string, instanceApiKey: string, groupJid: string, newDescription: string): Promise<any> {
        const body = { description: newDescription, groupJid: groupJid };
        return this.makeRequest(`/group/updateDescription/${instanceName}`, 'PUT', body, instanceApiKey);
    }

    async updateGroupSettings(instanceName: string, instanceApiKey: string, groupJid: string, settings: { announce?: 'true' | 'false', locked?: 'true' | 'false' }): Promise<any> {
        // CORRECTED: The documented endpoint for updating group settings.
        const body = { settings: settings, groupJid: groupJid };
        return this.makeRequest(`/group/setting/update/${instanceName}`, 'PUT', body, instanceApiKey);
    }

    async updateGroupProfilePicture(instanceName: string, instanceApiKey: string, groupJid: string, imageUrl: string): Promise<any> {
        const body = { url: imageUrl, groupJid: groupJid };
        return this.makeRequest(`/group/updateProfilePicture/${instanceName}`, 'PUT', body, instanceApiKey);
    }
    
    async addGroupParticipants(instanceName: string, instanceApiKey: string, groupJid: string, participants: string[]): Promise<any> {
        const body = { participants: participants, groupJid: groupJid };
        return this.makeRequest(`/group/addParticipants/${instanceName}`, 'PUT', body, instanceApiKey);
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

    async refreshGroupsSubjects(instanceName: string, instanceApiKey: string): Promise<any[]> {
        // Fetch all groups and update their authentic subjects
        try {
            const groups = await this.fetchAllGroups(instanceName, instanceApiKey);
            const enrichedGroups = [];
            
            for (const group of groups) {
                try {
                    const metadata = await this.fetchGroupMetadata(instanceName, instanceApiKey, group.id);
                    enrichedGroups.push({
                        ...group,
                        subject: metadata.subject || group.subject || 'Unknown Group',
                        metadata: metadata
                    });
                } catch (error) {
                    console.warn(`Failed to fetch metadata for group ${group.id}:`, error.message);
                    enrichedGroups.push({
                        ...group,
                        subject: group.subject || 'Unknown Group'
                    });
                }
            }
            
            return enrichedGroups;
        } catch (error) {
            console.error('Failed to refresh group subjects:', error);
            return [];
        }
    }
    
    async fetchGroupInfo(instanceName: string, instanceApiKey: string, groupId: string): Promise<any> {
        // CORRECTED: The documented endpoint for fetching a single group's info.
        const endpoint = `/group/fetchInfo/${instanceName}?groupId=${groupId}`;
        return this.makeRequest(endpoint, 'GET', null, instanceApiKey);
    }

    async updateGroupSubject(instanceName: string, instanceApiKey: string, groupJid: string, newSubject: string): Promise<any> {
        const body = { subject: newSubject, groupJid: groupJid };
        return this.makeRequest(`/group/updateSubject/${instanceName}`, 'PUT', body, instanceApiKey);
    }
    
    async updateGroupDescription(instanceName: string, instanceApiKey: string, groupJid: string, newDescription: string): Promise<any> {
        const body = { description: newDescription, groupJid: groupJid };
        return this.makeRequest(`/group/updateDescription/${instanceName}`, 'PUT', body, instanceApiKey);
    }
    
    async addGroupParticipants(instanceName: string, instanceApiKey: string, groupJid: string, participants: string[]): Promise<any> {
        const body = { participants: participants, groupJid: groupJid };
        return this.makeRequest(`/group/addParticipants/${instanceName}`, 'PUT', body, instanceApiKey);
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