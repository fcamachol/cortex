import { getEvolutionApi } from './evolution-api';
import { storage } from './storage';

export class GroupMetadataFetcher {
    /**
     * Proactively fetch and update group metadata from Evolution API
     */
    static async updateGroupFromEvolutionApi(groupJid: string, instanceId: string): Promise<boolean> {
        try {
            const evolutionApi = getEvolutionApi();
            const instance = await storage.getWhatsappInstance(instanceId);
            
            if (!instance?.apiKey) {
                console.warn(`No API key found for instance ${instanceId}`);
                return false;
            }

            // Try multiple Evolution API endpoints to get group information
            const groupData = await this.fetchGroupFromMultipleEndpoints(instanceId, instance.apiKey, groupJid);
            
            if (groupData?.subject && groupData.subject !== 'Group Chat') {
                const existingGroup = await storage.getWhatsappGroup(groupJid, instanceId);
                
                const updatedGroupData = {
                    groupJid: groupJid,
                    instanceId: instanceId,
                    subject: groupData.subject,
                    ownerJid: groupData.owner || (existingGroup?.ownerJid) || null,
                    description: groupData.desc || (existingGroup?.description) || null,
                    creationTimestamp: groupData.creation ? new Date(groupData.creation * 1000) : (existingGroup?.creationTimestamp) || null,
                    isLocked: groupData.restrict || (existingGroup?.isLocked) || false,
                };
                
                await storage.upsertWhatsappGroup(updatedGroupData);
                
                // Update chat record to match
                const existingChat = await storage.getWhatsappChat(groupJid, instanceId);
                if (existingChat) {
                    const updatedChat = { ...existingChat, name: groupData.subject };
                    await storage.upsertWhatsappChat(updatedChat);
                }
                
                console.log(`🔄 [${instanceId}] Group updated from Evolution API: ${groupJid} -> "${groupData.subject}"`);
                
                // Broadcast real-time update if subject changed
                if (existingGroup && existingGroup.subject !== groupData.subject) {
                    const { GroupRealtimeManager } = await import('./group-realtime-manager');
                    await GroupRealtimeManager.handleSubjectChange(groupJid, instanceId, existingGroup.subject || '', groupData.subject);
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.warn(`Failed to update group ${groupJid} from Evolution API:`, error.message);
            return false;
        }
    }

    /**
     * Try multiple Evolution API endpoints to fetch group information
     */
    private static async fetchGroupFromMultipleEndpoints(instanceId: string, apiKey: string, groupJid: string): Promise<any> {
        const evolutionApi = getEvolutionApi();
        
        // Endpoint 1: Try group participants (known to work)
        try {
            const participantsData = await evolutionApi.fetchGroupParticipants(instanceId, apiKey, groupJid);
            if (participantsData?.subject) {
                return participantsData;
            }
        } catch (error) {
            console.debug(`Group participants endpoint failed for ${groupJid}:`, error.message);
        }

        // Endpoint 2: Try chat metadata
        try {
            const chatData = await evolutionApi.fetchChatMetadata(instanceId, apiKey, groupJid);
            if (chatData?.name) {
                return { subject: chatData.name, ...chatData };
            }
        } catch (error) {
            console.debug(`Chat metadata endpoint failed for ${groupJid}:`, error.message);
        }

        // Endpoint 3: Try direct group metadata
        try {
            const groupData = await evolutionApi.fetchGroupMetadata(instanceId, apiKey, groupJid);
            if (groupData?.subject) {
                return groupData;
            }
        } catch (error) {
            console.debug(`Group metadata endpoint failed for ${groupJid}:`, error.message);
        }

        return null;
    }

    /**
     * Batch update multiple groups from Evolution API
     */
    static async batchUpdateGroups(instanceId: string, groupJids: string[]): Promise<number> {
        let successCount = 0;
        
        for (const groupJid of groupJids) {
            try {
                const success = await this.updateGroupFromEvolutionApi(groupJid, instanceId);
                if (success) {
                    successCount++;
                }
                
                // Small delay to prevent API rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error updating group ${groupJid}:`, error.message);
            }
        }
        
        console.log(`✅ Successfully updated ${successCount}/${groupJids.length} groups from Evolution API`);
        return successCount;
    }

    /**
     * Monitor webhook activity and trigger group updates
     */
    static async handleGroupActivity(groupJid: string, instanceId: string): Promise<void> {
        // When we detect group activity (messages, participant changes, etc),
        // proactively fetch the latest group information from Evolution API
        setTimeout(async () => {
            await this.updateGroupFromEvolutionApi(groupJid, instanceId);
        }, 1000); // Small delay to let webhook processing complete
    }
}