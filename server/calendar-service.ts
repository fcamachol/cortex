import { google } from 'googleapis';
import { storage } from './storage';
import { 
  CalendarAccount, 
  InsertCalendarAccount, 
  CalendarCalendar, 
  InsertCalendarCalendar,
  CalendarEvent,
  InsertCalendarEvent 
} from '../shared/schema';

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface CalendarEventData {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
}

export class CalendarService {
  private config: GoogleCalendarConfig;
  
  constructor(config: GoogleCalendarConfig) {
    this.config = config;
  }

  /**
   * Generate OAuth URL for Google Calendar authorization
   */
  getAuthUrl(userId: string): string {
    const oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId in state for callback handling
    });
  }

  /**
   * Exchange authorization code for tokens and create calendar account
   */
  async createAccountFromAuthCode(
    userId: string, 
    workspaceId: string,
    authCode: string,
    userEmail: string
  ): Promise<CalendarAccount> {
    const oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    const { tokens } = await oauth2Client.getToken(authCode);
    
    if (!tokens.access_token) {
      throw new Error('Failed to get access token from Google');
    }

    const accountData: InsertCalendarAccount = {
      userId,
      workspaceId,
      provider: 'google',
      providerAccountId: userEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: { granted: ['calendar', 'calendar.events'] },
      syncStatus: 'active'
    };

    return await storage.createCalendarAccount(accountData);
  }

  /**
   * Get authenticated Google Calendar client for user
   */
  private async getAuthenticatedClient(userId: string) {
    const account = await storage.getCalendarAccount(userId);
    if (!account) {
      throw new Error('No calendar account found for user');
    }

    const oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.tokenExpiryDate?.getTime()
    });

    // Handle token refresh
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await storage.updateCalendarAccount(userId, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || account.refreshToken,
          tokenExpiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null
        });
      }
    });

    return { oauth2Client, account };
  }

  /**
   * Sync user's calendars from Google Calendar
   */
  async syncCalendars(userId: string): Promise<CalendarCalendar[]> {
    const { oauth2Client, account } = await this.getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      const response = await calendar.calendarList.list();
      const calendars = response.data.items || [];
      
      const syncedCalendars: CalendarCalendar[] = [];

      for (const googleCalendar of calendars) {
        if (!googleCalendar.id) continue;

        const calendarData: InsertCalendarCalendar = {
          accountId: account.accountId,
          providerCalendarId: googleCalendar.id,
          summary: googleCalendar.summary || 'Untitled Calendar',
          description: googleCalendar.description || null,
          timezone: googleCalendar.timeZone || null,
          isPrimary: googleCalendar.primary || false,
          isEnabledForSync: true
        };

        try {
          const existingCalendar = await storage.getCalendarCalendars(userId);
          const existing = existingCalendar.find(c => c.providerCalendarId === googleCalendar.id);
          
          if (existing) {
            const updated = await storage.updateCalendarCalendar(existing.calendarId, {
              summary: calendarData.summary,
              description: calendarData.description,
              timezone: calendarData.timezone,
              isPrimary: calendarData.isPrimary
            });
            syncedCalendars.push(updated);
          } else {
            const created = await storage.createCalendarCalendar(calendarData);
            syncedCalendars.push(created);
          }
        } catch (error) {
          console.error(`Error syncing calendar ${googleCalendar.id}:`, error);
        }
      }

      await storage.updateCalendarAccount(userId, { 
        syncStatus: 'active',
        updatedAt: new Date()
      });

      return syncedCalendars;
    } catch (error) {
      console.error('Error syncing calendars:', error);
      await storage.updateCalendarAccount(userId, { syncStatus: 'error' });
      throw error;
    }
  }

  /**
   * Create event in Google Calendar and sync to local database
   */
  async createEvent(userId: string, eventData: CalendarEventData, calendarId?: string): Promise<CalendarEvent> {
    const { oauth2Client, account } = await this.getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get user's calendars to find target calendar
    const userCalendars = await storage.getCalendarCalendars(userId);
    let targetCalendar = userCalendars.find(c => c.isPrimary);
    
    if (calendarId) {
      const specified = userCalendars.find(c => c.calendarId.toString() === calendarId);
      if (specified) targetCalendar = specified;
    }

    if (!targetCalendar) {
      throw new Error('No suitable calendar found for event creation');
    }

    // Create event in Google Calendar
    const googleEvent = {
      summary: eventData.title,
      description: eventData.description,
      location: eventData.location,
      start: eventData.isAllDay ? 
        { date: eventData.startTime.toISOString().split('T')[0] } :
        { dateTime: eventData.startTime.toISOString(), timeZone: targetCalendar.timezone || 'UTC' },
      end: eventData.isAllDay ?
        { date: (eventData.endTime || new Date(eventData.startTime.getTime() + 24*60*60*1000)).toISOString().split('T')[0] } :
        { dateTime: (eventData.endTime || new Date(eventData.startTime.getTime() + 60*60*1000)).toISOString(), timeZone: targetCalendar.timezone || 'UTC' },
      attendees: eventData.attendees?.map(email => ({ email }))
    };

    try {
      const response = await calendar.events.insert({
        calendarId: targetCalendar.providerCalendarId,
        requestBody: googleEvent
      });

      if (!response.data.id) {
        throw new Error('Failed to create event in Google Calendar');
      }

      // Create local calendar event record
      const localEventData: InsertCalendarEvent = {
        calendarId: targetCalendar.calendarId,
        providerEventId: response.data.id,
        title: eventData.title,
        description: eventData.description || null,
        startTime: eventData.startTime,
        endTime: eventData.endTime || new Date(eventData.startTime.getTime() + 60*60*1000),
        isAllDay: eventData.isAllDay || false,
        location: eventData.location || null,
        meetLink: response.data.hangoutLink || null,
        providerHtmlLink: response.data.htmlLink || null,
        status: response.data.status || 'confirmed'
      };

      const localEvent = await storage.createCalendarEvent(localEventData);

      // Add attendees if any
      if (eventData.attendees?.length) {
        for (const email of eventData.attendees) {
          await storage.createCalendarAttendee({
            eventId: localEvent.eventId,
            email,
            displayName: email,
            responseStatus: 'needsAction',
            isOrganizer: false
          });
        }
      }

      console.log(`✅ Calendar event created: ${eventData.title} at ${eventData.startTime.toISOString()}`);
      return localEvent;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  /**
   * Create intelligent calendar event from WhatsApp message context
   */
  async createEventFromMessage(
    userId: string, 
    messageContent: string, 
    extractedData: {
      suggestedTitle?: string;
      suggestedDueDate?: Date;
      extractedLocation?: string;
      needsMeetLink?: boolean;
    }
  ): Promise<CalendarEvent> {
    const title = extractedData.suggestedTitle || 
                  messageContent.substring(0, 100) || 
                  'Event from WhatsApp';

    const startTime = extractedData.suggestedDueDate || 
                      new Date(Date.now() + 60*60*1000); // Default to 1 hour from now

    const eventData: CalendarEventData = {
      title,
      description: `Event created from WhatsApp message:\n\n"${messageContent}"`,
      startTime,
      endTime: new Date(startTime.getTime() + 60*60*1000), // 1 hour duration
      location: extractedData.extractedLocation,
      isAllDay: false
    };

    return await this.createEvent(userId, eventData);
  }

  /**
   * Get upcoming events for user
   */
  async getUpcomingEvents(userId: string, limit: number = 10): Promise<CalendarEvent[]> {
    const events = await storage.getCalendarEvents(userId);
    const now = new Date();
    
    return events
      .filter(event => event.startTime && event.startTime > now)
      .sort((a, b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0))
      .slice(0, limit);
  }

  /**
   * Create new Google Calendar
   */
  async createCalendar(userId: string, calendarData: { name: string; description?: string; color?: string }): Promise<CalendarCalendar> {
    const { oauth2Client } = await this.getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Create calendar in Google Calendar
    const googleCalendar = await calendar.calendars.insert({
      requestBody: {
        summary: calendarData.name,
        description: calendarData.description,
        timeZone: 'UTC'
      }
    });

    if (!googleCalendar.data.id) {
      throw new Error('Failed to create Google Calendar');
    }

    // Save to local database
    const localCalendarData: InsertCalendarCalendar = {
      userId,
      providerCalendarId: googleCalendar.data.id,
      summary: calendarData.name,
      description: calendarData.description,
      timezone: 'UTC',
      colorId: calendarData.color || 'blue',
      isPrimary: false,
      isEnabledForSync: true
    };

    return await storage.createCalendarCalendar(localCalendarData);
  }

  /**
   * Delete Google Calendar
   */
  async deleteCalendar(userId: string, calendarId: string): Promise<void> {
    const { oauth2Client } = await this.getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get calendar details from local database
    const userCalendars = await storage.getCalendarCalendars(userId);
    const targetCalendar = userCalendars.find(c => c.calendarId.toString() === calendarId);

    if (!targetCalendar) {
      throw new Error('Calendar not found');
    }

    if (targetCalendar.isPrimary) {
      throw new Error('Cannot delete primary calendar');
    }

    // Delete from Google Calendar
    await calendar.calendars.delete({
      calendarId: targetCalendar.providerCalendarId
    });

    // Delete from local database
    await storage.deleteCalendarCalendar(calendarId);
  }

  /**
   * Check if user has calendar integration set up
   */
  async hasCalendarIntegration(userId: string): Promise<boolean> {
    const account = await storage.getCalendarAccount(userId);
    return account?.syncStatus === 'active';
  }
}

// Export singleton instance
export const calendarService = new CalendarService({
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/oauth/callback'
});