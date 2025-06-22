import { storage } from './storage';
import { getEvolutionApi } from './evolution-api';

export class EvolutionGroupUpdater {
    /**
     * Update specific group using the working Evolution API endpoints
     */
    static async updateSingleGroupFromEvolution(groupJid: string, instanceId: string): Promise<boolean> {
        try {
            const instance = await storage.getWhatsappInstance(instanceId);
            if (!instance?.apiKey) {
                console.warn(`No API key found for instance ${instanceId}`);
                return false;
            }

            const evolutionApi = getEvolutionApi();
            
            // Fetch all groups and find the target group
            const allGroups = await evolutionApi.fetchAllGroups(instanceId, instance.apiKey);
            
            // Handle different response formats
            let groups: any[] = [];
            if (Array.isArray(allGroups)) {
                groups = allGroups;
            } else if (allGroups?.groups && Array.isArray(allGroups.groups)) {
                groups = allGroups.groups;
            }

            const targetGroup = groups.find((g: any) => g.id === groupJid);
            
            if (targetGroup?.subject && targetGroup.subject !== 'Group Chat') {
                const existingGroup = await storage.getWhatsappGroup(groupJid, instanceId);
                
                // Ensure owner contact exists before group creation to prevent foreign key constraint violations
                const ownerJid = targetGroup.owner || (existingGroup?.ownerJid);
                if (ownerJid) {
                    const { WebhookApiAdapter } = await import('./whatsapp-api-adapter');
                    await WebhookApiAdapter.ensureOwnerContactExists(ownerJid, instanceId);
                }

                const updatedGroupData = {
                    groupJid: groupJid,
                    instanceId: instanceId,
                    subject: targetGroup.subject,
                    ownerJid: ownerJid || null,
                    description: targetGroup.desc || (existingGroup?.description) || null,
                    creationTimestamp: targetGroup.creation ? new Date(targetGroup.creation * 1000) : (existingGroup?.creationTimestamp) || null,
                    isLocked: targetGroup.restrict || (existingGroup?.isLocked) || false,
                };
                
                await storage.upsertWhatsappGroup(updatedGroupData);
                
                // Update chat record to match
                const existingChat = await storage.getWhatsappChat(groupJid, instanceId);
                if (existingChat) {
                    const updatedChat = { ...existingChat, name: targetGroup.subject };
                    await storage.upsertWhatsappChat(updatedChat);
                }
                
                console.log(`🔄 [${instanceId}] Group updated from Evolution API: ${groupJid} -> "${targetGroup.subject}"`);
                
                // Broadcast real-time update if subject changed
                if (existingGroup && existingGroup.subject !== targetGroup.subject) {
                    const { GroupRealtimeManager } = await import('./group-realtime-manager');
                    await GroupRealtimeManager.handleSubjectChange(groupJid, instanceId, existingGroup.subject || '', targetGroup.subject);
                }
                
                return true;
            }
            
            console.log(`No group found with JID ${groupJid} in Evolution API response`);
            return false;
            
        } catch (error) {
            console.warn(`Failed to update group ${groupJid} from Evolution API:`, error.message);
            return false;
        }
    }

    /**
     * Handle group activity by triggering an Evolution API update
     */
    static async handleGroupActivity(groupJid: string, instanceId: string): Promise<void> {
        // Delay slightly to let webhook processing complete
        setTimeout(async () => {
            await this.updateSingleGroupFromEvolution(groupJid, instanceId);
        }, 500);
    }

    /**
     * Batch update multiple groups from Evolution API
     */
    static async batchUpdateGroupsFromEvolution(instanceId: string, groupJids: string[]): Promise<number> {
        let successCount = 0;
        
        for (const groupJid of groupJids) {
            try {
                const success = await this.updateSingleGroupFromEvolution(groupJid, instanceId);
                if (success) {
                    successCount++;
                }
                
                // Small delay to prevent overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error updating group ${groupJid}:`, error.message);
            }
        }
        
        console.log(`✅ Successfully updated ${successCount}/${groupJids.length} groups from Evolution API`);
        return successCount;
    }
}