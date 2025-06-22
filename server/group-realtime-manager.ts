import { getSseManager } from './sse-manager';

export interface GroupUpdate {
  type: 'subject_changed' | 'description_changed' | 'participants_changed' | 'settings_changed';
  groupJid: string;
  instanceId: string;
  data: any;
  timestamp: string;
}

export class GroupRealtimeManager {
  /**
   * Broadcast group updates to connected clients in real-time
   */
  static async broadcastGroupUpdate(update: GroupUpdate): Promise<void> {
    try {
      const sseManager = getSseManager();
      const message = {
        type: 'group_update',
        data: update
      };

      // Broadcast to all connected SSE clients
      sseManager.broadcast(message);
      
      console.log(`📡 [${update.instanceId}] Broadcasting group update: ${update.type} for ${update.groupJid}`);
    } catch (error) {
      console.error('Error broadcasting group update:', error);
    }
  }

  /**
   * Handle group subject changes from webhooks
   */
  static async handleSubjectChange(groupJid: string, instanceId: string, oldSubject: string, newSubject: string): Promise<void> {
    if (oldSubject === newSubject) return;

    const update: GroupUpdate = {
      type: 'subject_changed',
      groupJid,
      instanceId,
      data: {
        oldSubject,
        newSubject
      },
      timestamp: new Date().toISOString()
    };

    await this.broadcastGroupUpdate(update);
  }

  /**
   * Handle group description changes from webhooks
   */
  static async handleDescriptionChange(groupJid: string, instanceId: string, oldDescription: string, newDescription: string): Promise<void> {
    if (oldDescription === newDescription) return;

    const update: GroupUpdate = {
      type: 'description_changed',
      groupJid,
      instanceId,
      data: {
        oldDescription,
        newDescription
      },
      timestamp: new Date().toISOString()
    };

    await this.broadcastGroupUpdate(update);
  }

  /**
   * Handle group participant changes from webhooks
   */
  static async handleParticipantsChange(groupJid: string, instanceId: string, action: string, participants: string[]): Promise<void> {
    const update: GroupUpdate = {
      type: 'participants_changed',
      groupJid,
      instanceId,
      data: {
        action, // 'add', 'remove', 'promote', 'demote'
        participants
      },
      timestamp: new Date().toISOString()
    };

    await this.broadcastGroupUpdate(update);
  }

  /**
   * Handle group settings changes from webhooks
   */
  static async handleSettingsChange(groupJid: string, instanceId: string, settings: any): Promise<void> {
    const update: GroupUpdate = {
      type: 'settings_changed',
      groupJid,
      instanceId,
      data: settings,
      timestamp: new Date().toISOString()
    };

    await this.broadcastGroupUpdate(update);
  }
}