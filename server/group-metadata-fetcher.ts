import { getEvolutionApi } from './evolution-api';

interface GroupMetadataFetcher {
  instanceId: string;
  instanceApiKey: string;
  instanceNumber?: string;
}

export class GroupMetadataFetcher {
  private instanceId: string;
  private instanceApiKey: string;
  private instanceNumber?: string;

  constructor(config: GroupMetadataFetcher) {
    this.instanceId = config.instanceId;
    this.instanceApiKey = config.instanceApiKey;
    this.instanceNumber = config.instanceNumber;
  }

  /**
   * Method A: Direct Fetch (try first)
   * Attempts to get group metadata directly from available endpoints
   */
  async directFetch(groupJid: string): Promise<any> {
    console.log(`🔍 [${this.instanceId}] Attempting direct fetch for group: ${groupJid}`);
    
    try {
      const evolutionApi = getEvolutionApi();
      
      // Try participants endpoint (we know this works)
      const participantsResponse = await evolutionApi.fetchGroupInfo(this.instanceId, this.instanceApiKey, groupJid);
      
      if (participantsResponse) {
        console.log(`✅ [${this.instanceId}] Direct fetch successful for ${groupJid}`);
        return participantsResponse;
      }
    } catch (error) {
      console.log(`❌ [${this.instanceId}] Direct fetch failed for ${groupJid}: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Method B: Forced Update Trigger
   * Forces a groups.update webhook by adding an existing member back to the group
   */
  async forcedUpdateTrigger(groupJid: string): Promise<boolean> {
    console.log(`🔄 [${this.instanceId}] Attempting forced update trigger for group: ${groupJid}`);
    
    try {
      const evolutionApi = getEvolutionApi();
      
      // First, get the instance's own number if we don't have it
      if (!this.instanceNumber) {
        await this.fetchInstanceNumber();
      }
      
      if (!this.instanceNumber) {
        console.log(`❌ [${this.instanceId}] Cannot perform forced update - no instance number available`);
        return false;
      }

      // Try to get current participants first
      let participantsToAdd = [this.instanceNumber];
      
      try {
        const baseUrl = process.env.EVOLUTION_API_URL;
        const participantsResponse = await fetch(`${baseUrl}/group/participants/${this.instanceId}?groupJid=${groupJid}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.instanceApiKey
          },
          timeout: 5000
        });
        
        if (participantsResponse.ok) {
          const participantsData = await participantsResponse.json();
          const participants = participantsData.participants || [];
          
          if (participants.length > 0) {
            // Use an existing participant instead of instance number
            participantsToAdd = [participants[0].id];
            console.log(`📋 [${this.instanceId}] Using existing participant for forced update: ${participants[0].id}`);
          }
        }
      } catch (participantError) {
        console.log(`⚠️ [${this.instanceId}] Could not fetch participants, using instance number`);
      }

      // Perform the forced update trigger
      console.log(`🎯 [${this.instanceId}] Triggering forced update by adding participant: ${participantsToAdd[0]}`);
      
      await evolutionApi.addGroupParticipants(this.instanceId, this.instanceApiKey, groupJid, participantsToAdd);
      
      console.log(`✅ [${this.instanceId}] Forced update trigger sent for ${groupJid}`);
      console.log(`📡 [${this.instanceId}] Waiting for groups.update webhook to populate metadata...`);
      
      return true;
      
    } catch (error) {
      console.log(`❌ [${this.instanceId}] Forced update trigger failed for ${groupJid}: ${error.message}`);
      return false;
    }
  }

  /**
   * Fetch the instance's own WhatsApp number
   */
  private async fetchInstanceNumber(): Promise<void> {
    try {
      const baseUrl = process.env.EVOLUTION_API_URL;
      const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.EVOLUTION_API_KEY
        }
      });

      if (response.ok) {
        const instances = await response.json();
        const targetInstance = instances.find((inst: any) => inst.name === this.instanceId);
        
        if (targetInstance && targetInstance.number) {
          this.instanceNumber = `${targetInstance.number}@s.whatsapp.net`;
          console.log(`📱 [${this.instanceId}] Instance number found: ${this.instanceNumber}`);
        } else if (targetInstance && targetInstance.ownerJid) {
          this.instanceNumber = targetInstance.ownerJid;
          console.log(`📱 [${this.instanceId}] Instance owner JID found: ${this.instanceNumber}`);
        }
      }
    } catch (error) {
      console.log(`⚠️ [${this.instanceId}] Could not fetch instance number: ${error.message}`);
    }
  }

  /**
   * Main method: Try direct fetch first, then forced update if needed
   */
  async populateGroupInfo(groupJid: string): Promise<{ success: boolean; method: string; data?: any }> {
    console.log(`🚀 [${this.instanceId}] Starting group metadata population for: ${groupJid}`);
    
    // Method A: Try direct fetch first
    const directResult = await this.directFetch(groupJid);
    if (directResult) {
      return {
        success: true,
        method: 'direct_fetch',
        data: directResult
      };
    }

    // Method B: Use forced update trigger
    const forcedResult = await this.forcedUpdateTrigger(groupJid);
    if (forcedResult) {
      return {
        success: true,
        method: 'forced_update_trigger',
        data: null // Data will come via webhook
      };
    }

    return {
      success: false,
      method: 'none',
      data: null
    };
  }
}

export function createGroupMetadataFetcher(instanceId: string, instanceApiKey: string): GroupMetadataFetcher {
  return new GroupMetadataFetcher({
    instanceId,
    instanceApiKey
  });
}