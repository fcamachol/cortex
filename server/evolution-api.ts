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
        const url = new URL(endpoint, this.config.baseUrl).href;
        
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

    // Download and decrypt media from WhatsApp using base64 methods
    async downloadMedia(instanceName: string, instanceApiKey: string, messageData: any): Promise<any> {
        const messageId = messageData.key.id;
        console.log(`📥 Attempting media download for message: ${messageId}`);

        // Method 1: Check if base64 data is already in the webhook payload
        if (messageData.message) {
            const audioMessage = messageData.message.audioMessage;
            const imageMessage = messageData.message.imageMessage;
            const videoMessage = messageData.message.videoMessage;
            const documentMessage = messageData.message.documentMessage;
            
            const mediaMessage = audioMessage || imageMessage || videoMessage || documentMessage;
            
            if (mediaMessage) {
                // Check for direct base64 data in the webhook
                if (mediaMessage.base64) {
                    console.log(`✅ Method 1: Using base64 from webhook payload`);
                    const buffer = Buffer.from(mediaMessage.base64, 'base64');
                    return {
                        buffer: buffer,
                        base64: mediaMessage.base64,
                        mimetype: mediaMessage.mimetype || 'audio/ogg',
                        filename: `${messageId}.${this.getFileExtension(mediaMessage.mimetype)}`
                    };
                }
                
                // Check for media URL in webhook
                if (mediaMessage.url) {
                    console.log(`🚀 Method 2: Downloading from webhook URL`);
                    try {
                        const response = await fetch(mediaMessage.url);
                        if (response.ok) {
                            const arrayBuffer = await response.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);
                            const base64Data = buffer.toString('base64');
                            
                            return {
                                buffer: buffer,
                                base64: base64Data,
                                mimetype: mediaMessage.mimetype || 'audio/ogg',
                                filename: `${messageId}.${this.getFileExtension(mediaMessage.mimetype)}`
                            };
                        }
                    } catch (error) {
                        console.log(`⚠️ Method 2 failed: ${error.message}`);
                    }
                }
            }
        }

        // Method 3: Try Evolution API /chat/getBase64 endpoint
        try {
            const downloadEndpoint = `/chat/getBase64/${instanceName}`;
            const downloadBody = {
                message: messageData
            };
            
            console.log(`🚀 Method 3: Using Evolution API getBase64 endpoint`);
            
            const downloadResponse = await this.makeRequest<any>(
                downloadEndpoint,
                'POST',
                downloadBody,
                instanceApiKey
            );

            if (downloadResponse && downloadResponse.base64) {
                console.log(`✅ Method 3: Media download successful via Evolution API`);
                
                const buffer = Buffer.from(downloadResponse.base64, 'base64');
                let mimetype = 'audio/ogg';
                if (messageData.message?.audioMessage?.mimetype) {
                    mimetype = messageData.message.audioMessage.mimetype;
                } else if (downloadResponse.mimetype) {
                    mimetype = downloadResponse.mimetype;
                }
                
                return {
                    buffer: buffer,
                    base64: downloadResponse.base64,
                    mimetype: mimetype,
                    filename: `${messageId}.${this.getFileExtension(mimetype)}`
                };
            }
        } catch (error) {
            console.log(`⚠️ Method 3 failed: ${error.message}`);
        }

        // Method 4: Try alternative Evolution API endpoint structure
        try {
            const downloadEndpoint = `/chat/getBase64/${instanceName}`;
            const downloadBody = {
                message: {
                    key: messageData.key
                }
            };
            
            console.log(`🚀 Method 4: Using Evolution API with key-only structure`);
            
            const downloadResponse = await this.makeRequest<any>(
                downloadEndpoint,
                'POST',
                downloadBody,
                instanceApiKey
            );

            if (downloadResponse && downloadResponse.base64) {
                console.log(`✅ Method 4: Media download successful`);
                const buffer = Buffer.from(downloadResponse.base64, 'base64');
                return {
                    buffer: buffer,
                    base64: downloadResponse.base64,
                    mimetype: messageData.message?.audioMessage?.mimetype || 'audio/ogg',
                    filename: `${messageId}.ogg`
                };
            }
        } catch (error) {
            console.log(`⚠️ Method 4 failed: ${error.message}`);
        }

        // Method 4: Check if media URL is directly available in webhook data
        if (messageData.message) {
            const audioMessage = messageData.message.audioMessage;
            const imageMessage = messageData.message.imageMessage;
            const videoMessage = messageData.message.videoMessage;
            const documentMessage = messageData.message.documentMessage;
            
            const mediaMessage = audioMessage || imageMessage || videoMessage || documentMessage;
            
            if (mediaMessage && mediaMessage.url) {
                try {
                    console.log(`🚀 Method 4: Downloading from webhook URL`);
                    const response = await fetch(mediaMessage.url);
                    const arrayBuffer = await response.arrayBuffer();
                    const base64Data = Buffer.from(arrayBuffer).toString('base64');
                    
                    return {
                        base64: base64Data,
                        mimetype: mediaMessage.mimetype || 'audio/ogg',
                        filename: `media_${Date.now()}.${this.getFileExtension(mediaMessage.mimetype)}`
                    };
                } catch (error) {
                    console.log(`⚠️ Method 4 failed: ${error.message}`);
                }
            }
        }

        throw new Error('All media download methods failed');
    }

    private getFileExtension(mimetype: string): string {
        if (!mimetype) return 'bin';
        if (mimetype.includes('audio/ogg')) return 'ogg';
        if (mimetype.includes('audio/mp4')) return 'mp4';
        if (mimetype.includes('audio/mpeg')) return 'mp3';
        if (mimetype.includes('image/jpeg')) return 'jpg';
        if (mimetype.includes('image/png')) return 'png';
        if (mimetype.includes('video/mp4')) return 'mp4';
        if (mimetype.includes('application/pdf')) return 'pdf';
        return 'bin';
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