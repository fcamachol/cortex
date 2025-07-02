import { google } from 'googleapis';
import { storage } from './storage';

interface GoogleCalendarCredentials {
    accessToken: string;
    refreshToken: string;
    clientId?: string;
    clientSecret?: string;
}

export class GoogleCalendarService {
    private oauth2Client: any;

    constructor() {
        const redirectUri = process.env.NODE_ENV === 'production' 
            ? `https://${process.env.REPL_SLUG}.replit.app/api/auth/google/calendar/callback`
            : `https://${process.env.REPLIT_DOMAINS}/api/auth/google/calendar/callback`;
            
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            redirectUri
        );
    }

    /**
     * Set credentials for the OAuth2 client
     */
    setCredentials(credentials: GoogleCalendarCredentials) {
        this.oauth2Client.setCredentials({
            access_token: credentials.accessToken,
            refresh_token: credentials.refreshToken
        });
    }

    /**
     * Get authorization URL for Google Calendar integration
     */
    getAuthUrl(): string {
        const scopes = [
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/userinfo.email'
        ];

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async getTokens(code: string): Promise<any> {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            return tokens;
        } catch (error) {
            console.error('Error getting tokens:', error);
            throw error;
        }
    }

    /**
     * Sync Google Calendar events to cortex_scheduling schema
     */
    async syncCalendarEvents(userId: string, integrationId: string): Promise<void> {
        try {
            const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
            
            // Get user's calendars
            const calendarsResponse = await calendar.calendarList.list();
            const calendars = calendarsResponse.data.items || [];

            console.log(`📅 Found ${calendars.length} calendars for sync`);

            for (const cal of calendars) {
                // Get events from each calendar
                const eventsResponse = await calendar.events.list({
                    calendarId: cal.id,
                    timeMin: new Date().toISOString(),
                    maxResults: 100,
                    singleEvents: true,
                    orderBy: 'startTime'
                });

                const events = eventsResponse.data.items || [];
                console.log(`📅 Found ${events.length} events in calendar: ${cal.summary}`);

                // Store events in cortex_scheduling.events
                for (const event of events) {
                    await this.storeEventInCortex(event, cal, userId, integrationId);
                }
            }

            // Update last sync time
            await this.updateLastSyncTime(integrationId);
            
        } catch (error) {
            console.error('Error syncing calendar events:', error);
            throw error;
        }
    }

    /**
     * Store a Google Calendar event in cortex_scheduling.events
     */
    private async storeEventInCortex(event: any, calendar: any, userId: string, integrationId: string): Promise<void> {
        try {
            const startTime = event.start?.dateTime || event.start?.date;
            const endTime = event.end?.dateTime || event.end?.date;
            const isAllDay = !event.start?.dateTime; // If no time, it's all day

            // Store in cortex_scheduling.events table
            await storage.createCortexSchedulingEvent({
                externalEventId: event.id,
                calendarIntegrationId: integrationId,
                title: event.summary || 'Untitled Event',
                description: event.description || null,
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                isAllDay,
                location: event.location || null,
                meetingUrl: event.hangoutLink || null,
                status: event.status || 'confirmed',
                organizerEmail: event.organizer?.email || null,
                attendees: this.extractAttendees(event.attendees || []),
                recurrence: event.recurrence || null,
                timezone: event.start?.timeZone || null,
                visibility: event.visibility || 'default',
                createdBy: userId
            });

        } catch (error) {
            console.error('Error storing event in cortex:', error);
        }
    }

    /**
     * Extract attendees from Google Calendar event
     */
    private extractAttendees(attendees: any[]): any[] {
        return attendees.map(attendee => ({
            email: attendee.email,
            displayName: attendee.displayName || attendee.email,
            responseStatus: attendee.responseStatus || 'needsAction',
            isOrganizer: attendee.organizer || false
        }));
    }

    /**
     * Update last sync time for integration
     */
    private async updateLastSyncTime(integrationId: string): Promise<void> {
        try {
            await storage.updateCalendarIntegrationSyncTime(integrationId, new Date());
        } catch (error) {
            console.error('Error updating sync time:', error);
        }
    }

    /**
     * Create a new event in Google Calendar
     */
    async createCalendarEvent(calendarId: string, eventData: any): Promise<any> {
        try {
            const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
            
            const event = {
                summary: eventData.title,
                description: eventData.description,
                start: {
                    dateTime: eventData.startTime,
                    timeZone: eventData.timezone || 'America/Mexico_City'
                },
                end: {
                    dateTime: eventData.endTime,
                    timeZone: eventData.timezone || 'America/Mexico_City'
                },
                location: eventData.location,
                attendees: eventData.attendees?.map((email: string) => ({ email })) || []
            };

            const response = await calendar.events.insert({
                calendarId: calendarId || 'primary',
                requestBody: event
            });

            return response.data;
        } catch (error) {
            console.error('Error creating Google Calendar event:', error);
            throw error;
        }
    }

    /**
     * Get user profile information
     */
    async getUserProfile(): Promise<any> {
        try {
            const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
            const response = await oauth2.userinfo.get();
            return response.data;
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }

    /**
     * Refresh access token if needed
     */
    async refreshTokenIfNeeded(): Promise<boolean> {
        try {
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            this.oauth2Client.setCredentials(credentials);
            return true;
        } catch (error) {
            console.error('Error refreshing token:', error);
            return false;
        }
    }
}

export const googleCalendarService = new GoogleCalendarService();