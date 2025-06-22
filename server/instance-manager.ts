import { storage } from './storage';

export class InstanceManager {
    /**
     * Create a new WhatsApp instance with automatic webhook configuration
     */
    static async createInstanceWithWebhook(instanceName: string, options: {
        webhookUrl?: string;
        displayName?: string;
        qrcode?: boolean;
        number?: string;
    } = {}): Promise<{ success: boolean; instance?: any; error?: string }> {
        try {
            const evolutionApiUrl = process.env.EVOLUTION_API_URL;
            const apiKey = process.env.EVOLUTION_API_KEY;

            if (!evolutionApiUrl || !apiKey) {
                return { success: false, error: 'Evolution API configuration missing' };
            }

            console.log(`🚀 Creating new instance: ${instanceName}`);

            // Step 1: Create the instance with integration
            const webhookUrl = options.webhookUrl || `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/api/evolution/webhook/${instanceName}`;
            
            const createResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey
                },
                body: JSON.stringify({
                    instanceName: instanceName,
                    integration: "WHATSAPP-BAILEYS",
                    qrcode: options.qrcode ?? true,
                    webhook: {
                        enabled: true,
                        url: webhookUrl,
                        webhookByEvents: true,
                        webhookBase64: true,
                        events: [
                            "APPLICATION_STARTUP",
                            "QRCODE_UPDATED", 
                            "MESSAGES_SET",
                            "MESSAGES_UPSERT",
                            "MESSAGES_UPDATE", 
                            "MESSAGES_DELETE",
                            "SEND_MESSAGE",
                            "CONTACTS_SET",
                            "CONTACTS_UPSERT",
                            "CONTACTS_UPDATE",
                            "PRESENCE_UPDATE",
                            "CHATS_SET", 
                            "CHATS_UPSERT",
                            "CHATS_UPDATE",
                            "CHATS_DELETE",
                            "GROUPS_UPSERT",
                            "GROUP_UPDATE", 
                            "GROUP_PARTICIPANTS_UPDATE",
                            "CONNECTION_UPDATE",
                            "CALL",
                            "NEW_JWT_TOKEN",
                            "TYPEBOT_START",
                            "TYPEBOT_CHANGE_STATUS"
                        ]
                    }
                })
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                return { success: false, error: `Failed to create instance: ${errorText}` };
            }

            const instanceData = await createResponse.json();
            console.log(`✅ Instance created with webhook: ${instanceName}`);

            // Step 2: Store instance in database
            const dbInstance = {
                instanceId: instanceName,
                name: options.displayName || instanceName,
                status: 'created',
                apiKey: apiKey,
                webhookUrl: webhookUrl,
                ownerJid: null, // Will be updated when connected
            };

            await storage.upsertWhatsappInstance(dbInstance);
            console.log(`💾 Instance stored in database: ${instanceName}`);

            return { 
                success: true, 
                instance: {
                    ...instanceData,
                    webhookUrl: webhookUrl
                }
            };

        } catch (error) {
            console.error(`❌ Error creating instance ${instanceName}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Configure webhook for an existing instance with all required events
     */
    static async configureInstanceWebhook(instanceName: string, webhookUrl: string): Promise<boolean> {
        try {
            const evolutionApiUrl = process.env.EVOLUTION_API_URL;
            const apiKey = process.env.EVOLUTION_API_KEY;

            console.log(`🔗 Configuring webhook for instance: ${instanceName}`);
            console.log(`📡 Webhook URL: ${webhookUrl}`);

            const webhookResponse = await fetch(`${evolutionApiUrl}/webhook/set/${instanceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey
                },
                body: JSON.stringify({
                    enabled: true,
                    url: webhookUrl,
                    webhookByEvents: true,
                    webhookBase64: true,
                    events: [
                        "APPLICATION_STARTUP",
                        "QRCODE_UPDATED", 
                        "MESSAGES_SET",
                        "MESSAGES_UPSERT",
                        "MESSAGES_UPDATE", 
                        "MESSAGES_DELETE",
                        "SEND_MESSAGE",
                        "CONTACTS_SET",
                        "CONTACTS_UPSERT",
                        "CONTACTS_UPDATE",
                        "PRESENCE_UPDATE",
                        "CHATS_SET", 
                        "CHATS_UPSERT",
                        "CHATS_UPDATE",
                        "CHATS_DELETE",
                        "GROUPS_UPSERT",
                        "GROUP_UPDATE", 
                        "GROUP_PARTICIPANTS_UPDATE",
                        "CONNECTION_UPDATE",
                        "CALL",
                        "NEW_JWT_TOKEN",
                        "TYPEBOT_START",
                        "TYPEBOT_CHANGE_STATUS"
                    ]
                })
            });

            if (!webhookResponse.ok) {
                const errorText = await webhookResponse.text();
                console.error(`❌ Failed to configure webhook: ${errorText}`);
                return false;
            }

            const webhookResult = await webhookResponse.json();
            console.log(`✅ Webhook configured successfully for ${instanceName}`);
            console.log(`📋 Webhook events enabled:`, webhookResult);

            return true;

        } catch (error) {
            console.error(`❌ Error configuring webhook for ${instanceName}:`, error.message);
            return false;
        }
    }

    /**
     * Get instance connection status and QR code
     */
    static async getInstanceStatus(instanceName: string): Promise<{ success: boolean; status?: any; qrcode?: string; error?: string }> {
        try {
            const evolutionApiUrl = process.env.EVOLUTION_API_URL;
            const apiKey = process.env.EVOLUTION_API_KEY;

            const statusResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
                method: 'GET',
                headers: {
                    'apikey': apiKey
                }
            });

            if (!statusResponse.ok) {
                return { success: false, error: 'Failed to get instance status' };
            }

            const statusData = await statusResponse.json();
            
            return { 
                success: true, 
                status: statusData.instance?.state,
                qrcode: statusData.base64
            };

        } catch (error) {
            console.error(`❌ Error getting instance status:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete an instance and clean up database records
     */
    static async deleteInstance(instanceName: string): Promise<{ success: boolean; error?: string }> {
        try {
            const evolutionApiUrl = process.env.EVOLUTION_API_URL;
            const apiKey = process.env.EVOLUTION_API_KEY;

            console.log(`🗑️ Deleting instance: ${instanceName}`);

            const deleteResponse = await fetch(`${evolutionApiUrl}/instance/delete/${instanceName}`, {
                method: 'DELETE',
                headers: {
                    'apikey': apiKey
                }
            });

            if (!deleteResponse.ok) {
                const errorText = await deleteResponse.text();
                return { success: false, error: `Failed to delete instance: ${errorText}` };
            }

            // Clean up database records
            await storage.deleteWhatsappInstance(instanceName);
            console.log(`✅ Instance deleted: ${instanceName}`);

            return { success: true };

        } catch (error) {
            console.error(`❌ Error deleting instance ${instanceName}:`, error.message);
            return { success: false, error: error.message };
        }
    }
}