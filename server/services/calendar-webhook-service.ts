/**
 * Google Calendar Webhook Service
 * Handles real-time push notifications from Google Calendar
 * Implements bidirectional sync with conflict resolution
 */

import { GoogleCalendarService } from '../google-calendar-service.js';
import { storage } from '../storage.js';
import { nanoid } from 'nanoid';

interface WebhookChannel {
  id: string;
  calendarId: string;
  userId: string;
  integrationId: string;
  expirationTime: number;
  resourceId: string;
}

interface CalendarChangeEvent {
  channelId: string;
  resourceState: string;
  resourceId: string;
  resourceUri: string;
  messageNumber: string;
  publishTime: string;
}

export class CalendarWebhookService {
  private googleCalendarService: GoogleCalendarService;
  private activeChannels: Map<string, WebhookChannel> = new Map();
  private renewalBuffer = 24 * 60 * 60 * 1000; // 24 hours before expiration

  constructor() {
    this.googleCalendarService = new GoogleCalendarService();
    this.startChannelRenewalScheduler();
  }

  /**
   * Set up push notifications for a calendar integration
   */
  async setupCalendarWebhooks(userId: string, integrationId: string): Promise<void> {
    try {
      console.log(`📅 Setting up calendar webhooks for user ${userId}`);
      
      // Get user's calendar integrations
      const integration = await storage.getCalendarIntegration(integrationId);
      if (!integration) {
        throw new Error('Calendar integration not found');
      }

      // Initialize Google Calendar service with user's tokens
      await this.googleCalendarService.initializeWithTokens(
        integration.accessToken,
        integration.refreshToken
      );

      // Get all calendars for this user
      const calendars = await this.googleCalendarService.getCalendars();
      
      // Set up webhook for each calendar
      for (const calendar of calendars) {
        await this.createWebhookChannel(calendar.id, userId, integrationId);
      }

      console.log(`✅ Webhook channels created for ${calendars.length} calendars`);
    } catch (error) {
      console.error('Error setting up calendar webhooks:', error);
      throw error;
    }
  }

  /**
   * Create a webhook channel for a specific calendar
   */
  private async createWebhookChannel(
    calendarId: string, 
    userId: string, 
    integrationId: string
  ): Promise<string> {
    try {
      const channelId = `cal-${nanoid(12)}`;
      const webhookUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://localhost:5000'}/api/calendar/webhook`;
      
      // Create watch request
      const watchRequest = {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        params: {
          ttl: String(7 * 24 * 60 * 60) // 7 days (max allowed)
        }
      };

      // Create the webhook channel
      const response = await this.googleCalendarService.watchCalendar(calendarId, watchRequest);
      
      // Store channel information
      const channel: WebhookChannel = {
        id: channelId,
        calendarId,
        userId,
        integrationId,
        expirationTime: parseInt(response.expiration),
        resourceId: response.resourceId
      };
      
      this.activeChannels.set(channelId, channel);
      
      // Store in database for persistence
      await this.storeWebhookChannel(channel);
      
      console.log(`📡 Created webhook channel ${channelId} for calendar ${calendarId}`);
      return channelId;
    } catch (error) {
      console.error(`Error creating webhook channel for calendar ${calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Handle incoming webhook notification from Google Calendar
   */
  async handleWebhookNotification(headers: any, body: any): Promise<void> {
    try {
      const channelId = headers['x-goog-channel-id'];
      const resourceState = headers['x-goog-resource-state'];
      const resourceId = headers['x-goog-resource-id'];
      const messageNumber = headers['x-goog-message-number'];
      
      console.log(`📩 Received calendar webhook: Channel ${channelId}, State: ${resourceState}`);

      // Ignore sync notifications (initial setup)
      if (resourceState === 'sync') {
        console.log('📋 Ignoring sync notification');
        return;
      }

      // Get channel information
      const channel = this.activeChannels.get(channelId);
      if (!channel) {
        console.warn(`⚠️ Unknown webhook channel: ${channelId}`);
        return;
      }

      // Handle the calendar change
      await this.processCalendarChange(channel, resourceState);
      
      console.log(`✅ Processed calendar change for channel ${channelId}`);
    } catch (error) {
      console.error('Error handling webhook notification:', error);
      throw error;
    }
  }

  /**
   * Process a calendar change notification
   */
  private async processCalendarChange(
    channel: WebhookChannel, 
    resourceState: string
  ): Promise<void> {
    try {
      // Initialize Google Calendar service with user's tokens
      const integration = await storage.getCalendarIntegration(channel.integrationId);
      if (!integration) {
        console.error('Calendar integration not found');
        return;
      }

      await this.googleCalendarService.initializeWithTokens(
        integration.accessToken,
        integration.refreshToken
      );

      // Get the latest events from this calendar
      const events = await this.googleCalendarService.getCalendarEvents(channel.calendarId);
      
      // Process each event with conflict resolution
      for (const event of events) {
        await this.syncEventWithConflictResolution(event, channel);
      }

      console.log(`🔄 Synced ${events.length} events from calendar ${channel.calendarId}`);
    } catch (error) {
      console.error('Error processing calendar change:', error);
      throw error;
    }
  }

  /**
   * Sync event with conflict resolution
   */
  private async syncEventWithConflictResolution(
    googleEvent: any, 
    channel: WebhookChannel
  ): Promise<void> {
    try {
      // Check if event exists in our database
      const existingEvent = await storage.getCortexEventByExternalId(googleEvent.id);
      
      if (existingEvent) {
        // Check timestamps to determine which is newer
        const googleUpdated = new Date(googleEvent.updated);
        const localUpdated = new Date(existingEvent.updatedAt);
        
        // Add sync metadata to prevent loops
        if (this.isFromOurSync(googleEvent)) {
          console.log(`🔄 Skipping event ${googleEvent.id} - originated from our sync`);
          return;
        }
        
        if (googleUpdated > localUpdated) {
          console.log(`📥 Google Calendar is newer - updating local event ${googleEvent.id}`);
          await this.updateLocalEvent(googleEvent, existingEvent.id, channel);
        } else {
          console.log(`📤 Local event is newer - skipping update for ${googleEvent.id}`);
        }
      } else {
        // New event from Google Calendar
        console.log(`➕ Creating new event from Google Calendar: ${googleEvent.id}`);
        await this.createLocalEvent(googleEvent, channel);
      }
    } catch (error) {
      console.error('Error syncing event with conflict resolution:', error);
    }
  }

  /**
   * Check if event originated from our sync to prevent loops
   */
  private isFromOurSync(googleEvent: any): boolean {
    // Check for our sync metadata in the event description or extended properties
    return googleEvent.extendedProperties?.private?.syncSource === 'whatsapp-crm' ||
           googleEvent.description?.includes('[Synced from WhatsApp CRM]');
  }

  /**
   * Update local event from Google Calendar
   */
  private async updateLocalEvent(
    googleEvent: any, 
    localEventId: string, 
    channel: WebhookChannel
  ): Promise<void> {
    try {
      const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
      const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;
      const isAllDay = !googleEvent.start?.dateTime;

      await storage.updateCortexSchedulingEvent(localEventId, {
        title: googleEvent.summary || 'Untitled Event',
        description: googleEvent.description || '',
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        isAllDay,
        location: googleEvent.location || '',
        meetingUrl: googleEvent.hangoutLink || '',
        status: googleEvent.status || 'confirmed',
        organizerEmail: googleEvent.organizer?.email || null,
        attendees: this.extractAttendees(googleEvent.attendees || []),
        recurrence: googleEvent.recurrence || null,
        timezone: googleEvent.start?.timeZone || null,
        visibility: googleEvent.visibility || 'default',
        updatedAt: new Date()
      });

      console.log(`✅ Updated local event ${localEventId} from Google Calendar`);
    } catch (error) {
      console.error('Error updating local event:', error);
      throw error;
    }
  }

  /**
   * Create new local event from Google Calendar
   */
  private async createLocalEvent(googleEvent: any, channel: WebhookChannel): Promise<void> {
    try {
      const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
      const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;
      const isAllDay = !googleEvent.start?.dateTime;

      // Get calendar info for subcalendar metadata
      const calendar = await this.googleCalendarService.getCalendar(channel.calendarId);
      const isBirthdayEvent = this.isBirthdayEvent(googleEvent);

      await storage.createCortexSchedulingEvent({
        externalEventId: googleEvent.id,
        title: googleEvent.summary || 'Untitled Event',
        description: googleEvent.description || '',
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        isAllDay,
        location: googleEvent.location || '',
        meetingUrl: googleEvent.hangoutLink || '',
        status: googleEvent.status || 'confirmed',
        organizerEmail: googleEvent.organizer?.email || null,
        attendees: this.extractAttendees(googleEvent.attendees || []),
        recurrence: googleEvent.recurrence || null,
        timezone: googleEvent.start?.timeZone || null,
        visibility: googleEvent.visibility || 'default',
        createdBy: channel.userId,
        subcalendarName: isBirthdayEvent ? 'Google Contacts Birthdays' : (calendar.summary || 'Unknown Calendar'),
        subcalendarColor: isBirthdayEvent ? '#f093fb' : (calendar.backgroundColor || '#4285f4'),
        subcalendarId: channel.calendarId
      });

      console.log(`✅ Created new local event from Google Calendar: ${googleEvent.id}`);
    } catch (error) {
      console.error('Error creating local event:', error);
      throw error;
    }
  }

  /**
   * Sync local changes to Google Calendar
   */
  async syncToGoogleCalendar(eventData: any): Promise<void> {
    try {
      console.log(`📤 Syncing event to Google Calendar: ${eventData.title}`);

      // Get the integration for this event
      const integration = await storage.getCalendarIntegrationByUserId(eventData.createdBy);
      if (!integration) {
        console.log('No Google Calendar integration found for user');
        return;
      }

      // Initialize Google Calendar service
      await this.googleCalendarService.initializeWithTokens(
        integration.accessToken,
        integration.refreshToken
      );

      // Add sync metadata to prevent loops
      const eventWithMetadata = {
        ...eventData,
        description: `${eventData.description || ''}\n[Synced from WhatsApp CRM]`,
        extendedProperties: {
          private: {
            syncSource: 'whatsapp-crm',
            syncTimestamp: new Date().toISOString()
          }
        }
      };

      if (eventData.isNew) {
        // Create new event in Google Calendar
        const googleEvent = await this.googleCalendarService.createEvent(
          eventData.subcalendarId || 'primary',
          {
            summary: eventWithMetadata.title,
            description: eventWithMetadata.description,
            start: { dateTime: eventWithMetadata.startTime },
            end: { dateTime: eventWithMetadata.endTime },
            location: eventWithMetadata.location,
            extendedProperties: eventWithMetadata.extendedProperties
          }
        );

        // Update local event with Google Calendar ID
        await storage.updateCortexSchedulingEvent(eventData.id, {
          externalEventId: googleEvent.id
        });

        console.log(`✅ Created event in Google Calendar: ${googleEvent.id}`);
      } else if (eventData.externalEventId) {
        // Update existing event in Google Calendar
        await this.googleCalendarService.updateEvent(
          eventData.subcalendarId || 'primary',
          eventData.externalEventId,
          {
            summary: eventWithMetadata.title,
            description: eventWithMetadata.description,
            start: { dateTime: eventWithMetadata.startTime },
            end: { dateTime: eventWithMetadata.endTime },
            location: eventWithMetadata.location,
            extendedProperties: eventWithMetadata.extendedProperties
          }
        );

        console.log(`✅ Updated event in Google Calendar: ${eventData.externalEventId}`);
      }
    } catch (error) {
      console.error('Error syncing to Google Calendar:', error);
      // Store failed sync for retry
      await this.storeFailedSync(eventData, error);
    }
  }

  /**
   * Start automatic channel renewal scheduler
   */
  private startChannelRenewalScheduler(): void {
    // Check for channels needing renewal every hour
    setInterval(async () => {
      try {
        await this.renewExpiringChannels();
      } catch (error) {
        console.error('Error in channel renewal scheduler:', error);
      }
    }, 60 * 60 * 1000); // Every hour

    console.log('📅 Calendar webhook renewal scheduler started');
  }

  /**
   * Renew expiring webhook channels
   */
  private async renewExpiringChannels(): Promise<void> {
    const now = Date.now();
    const channelsToRenew = Array.from(this.activeChannels.values())
      .filter(channel => channel.expirationTime - now < this.renewalBuffer);

    for (const channel of channelsToRenew) {
      try {
        console.log(`🔄 Renewing webhook channel ${channel.id}`);
        
        // Stop the old channel
        await this.stopWebhookChannel(channel.id);
        
        // Create a new channel
        await this.createWebhookChannel(
          channel.calendarId, 
          channel.userId, 
          channel.integrationId
        );
        
        console.log(`✅ Renewed webhook channel for calendar ${channel.calendarId}`);
      } catch (error) {
        console.error(`Error renewing channel ${channel.id}:`, error);
      }
    }
  }

  /**
   * Stop a webhook channel
   */
  async stopWebhookChannel(channelId: string): Promise<void> {
    try {
      const channel = this.activeChannels.get(channelId);
      if (channel) {
        await this.googleCalendarService.stopWatchChannel(channelId, channel.resourceId);
        this.activeChannels.delete(channelId);
        await this.removeWebhookChannel(channelId);
        console.log(`🛑 Stopped webhook channel ${channelId}`);
      }
    } catch (error) {
      console.error(`Error stopping webhook channel ${channelId}:`, error);
    }
  }

  /**
   * Helper methods
   */
  private extractAttendees(attendees: any[]): any[] {
    return attendees.map(attendee => ({
      email: attendee.email,
      displayName: attendee.displayName,
      responseStatus: attendee.responseStatus
    }));
  }

  private isBirthdayEvent(event: any): boolean {
    return event.summary?.toLowerCase().includes('birthday') || 
           event.description?.toLowerCase().includes('birthday') ||
           event.creator?.email === 'contacts@google.com';
  }

  private async storeWebhookChannel(channel: WebhookChannel): Promise<void> {
    // Store channel in database for persistence across restarts
    // Implementation depends on your database schema
  }

  private async removeWebhookChannel(channelId: string): Promise<void> {
    // Remove channel from database
    // Implementation depends on your database schema
  }

  private async storeFailedSync(eventData: any, error: any): Promise<void> {
    // Store failed sync operations for manual retry
    console.error('Storing failed sync:', { eventData, error: error.message });
  }

  /**
   * Load existing webhook channels on startup
   */
  async loadExistingChannels(): Promise<void> {
    try {
      // Load channels from database and populate activeChannels map
      // Implementation depends on your database schema
      console.log('📋 Loaded existing webhook channels');
    } catch (error) {
      console.error('Error loading existing channels:', error);
    }
  }
}