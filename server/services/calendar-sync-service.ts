import * as cron from 'node-cron';
import { storage } from '../storage';

export class CalendarSyncService {
    private static instance: CalendarSyncService;
    private syncJobs: Map<string, cron.ScheduledTask> = new Map();

    private constructor() {}

    public static getInstance(): CalendarSyncService {
        if (!CalendarSyncService.instance) {
            CalendarSyncService.instance = new CalendarSyncService();
        }
        return CalendarSyncService.instance;
    }

    /**
     * Start automatic calendar sync for all active integrations
     */
    public async startAutoSync() {
        console.log('📅 Starting automatic calendar sync service...');
        
        // Sync every 15 minutes
        const syncTask = cron.schedule('*/15 * * * *', async () => {
            await this.syncAllActiveIntegrations();
        });

        this.syncJobs.set('main-sync', syncTask);
        
        // Also run an initial sync on startup
        setTimeout(() => {
            this.syncAllActiveIntegrations();
        }, 10000); // Wait 10 seconds after startup

        console.log('✅ Calendar auto-sync enabled (every 15 minutes)');
    }

    /**
     * Sync all active Google Calendar integrations
     */
    private async syncAllActiveIntegrations() {
        try {
            console.log('🔄 Running scheduled calendar sync...');
            
            const integrations = await storage.getGoogleCalendarIntegrations();
            const activeIntegrations = integrations.filter(int => int.is_active);
            
            if (activeIntegrations.length === 0) {
                console.log('📅 No active calendar integrations found');
                return;
            }

            console.log(`📅 Found ${activeIntegrations.length} active calendar integrations`);

            for (const integration of activeIntegrations) {
                try {
                    console.log(`📅 Syncing calendar for user: ${integration.user_id}`);
                    
                    const { googleCalendarService } = await import('../google-calendar-service');
                    
                    // Set credentials
                    googleCalendarService.setCredentials({
                        accessToken: integration.access_token,
                        refreshToken: integration.refresh_token
                    });

                    // Perform sync
                    await googleCalendarService.syncCalendarEvents(integration.user_id, integration.id);
                    
                    console.log(`✅ Calendar sync completed for user: ${integration.user_id}`);
                    
                } catch (error) {
                    console.error(`❌ Failed to sync calendar for user ${integration.user_id}:`, error);
                }
            }
            
        } catch (error) {
            console.error('❌ Error in scheduled calendar sync:', error);
        }
    }

    /**
     * Stop all sync jobs
     */
    public stopAutoSync() {
        console.log('📅 Stopping calendar sync service...');
        
        for (const [jobId, task] of this.syncJobs) {
            task.stop();
            task.destroy();
        }
        
        this.syncJobs.clear();
        console.log('✅ Calendar sync service stopped');
    }

    /**
     * Manually trigger sync for specific user
     */
    public async syncForUser(userId: string): Promise<void> {
        const integrations = await storage.getGoogleCalendarIntegrations();
        const userIntegration = integrations.find(int => int.user_id === userId && int.is_active);
        
        if (!userIntegration) {
            throw new Error('No active Google Calendar integration found for user');
        }

        const { googleCalendarService } = await import('../google-calendar-service');
        
        googleCalendarService.setCredentials({
            accessToken: userIntegration.access_token,
            refreshToken: userIntegration.refresh_token
        });

        await googleCalendarService.syncCalendarEvents(userId, userIntegration.id);
    }
}

export const calendarSyncService = CalendarSyncService.getInstance();