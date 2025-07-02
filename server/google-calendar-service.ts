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
            ? `https://${process.env.REPL_SLUG}.replit.app/oauth/callback`
            : `https://${process.env.REPLIT_DOMAINS}/oauth/callback`;
            
        console.log('🔐 Google OAuth Configuration:');
        console.log('  - Environment:', process.env.NODE_ENV || 'development');
        console.log('  - Redirect URI:', redirectUri);
        console.log('  - Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Missing');
        console.log('  - Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');
            
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
     * Get Google Calendar list with metadata (colors, names, etc.)
     */
    async getCalendarList(userId: string): Promise<any[]> {
        try {
            const integration = await storage.getActiveGoogleCalendarIntegration(userId);
            if (!integration) {
                throw new Error('No active Google Calendar integration found');
            }

            this.setCredentials({
                accessToken: integration.access_token,
                refreshToken: integration.refresh_token
            });

            const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
            const response = await calendar.calendarList.list();
            
            const calendars = response.data.items || [];
            console.log(`📅 Found ${calendars.length} Google Calendar subcalendars`);

            return calendars.map(cal => ({
                id: cal.id,
                name: cal.summary,
                description: cal.description,
                color: this.convertGoogleColorToTailwind(cal.backgroundColor || '#4285f4'),
                hexColor: cal.backgroundColor || '#4285f4',
                foregroundColor: cal.foregroundColor || '#ffffff',
                isPrimary: cal.primary || false,
                accessRole: cal.accessRole,
                timezone: cal.timeZone,
                isVisible: !cal.hidden,
                provider: 'google_calendar'
            }));
            
        } catch (error) {
            console.error('Error fetching calendar list:', error);
            throw error;
        }
    }

    /**
     * Convert Google Calendar hex colors to Tailwind CSS classes
     */
    private convertGoogleColorToTailwind(hexColor: string): string {
        const colorMap: { [key: string]: string } = {
            // Google Calendar Standard Colors - Authentic Palette
            '#a4bdfc': 'bg-indigo-300',    // Periwinkle (Light blue)
            '#7ae7bf': 'bg-emerald-300',   // Mint green
            '#dbadff': 'bg-purple-300',    // Lavender
            '#ff887c': 'bg-red-300',       // Flamingo pink
            '#ffc8af': 'bg-orange-300',    // Peach
            '#ffd6cc': 'bg-pink-300',      // Blush pink
            '#c2c2c2': 'bg-gray-400',      // Gray
            
            // Bold Google Calendar Colors
            '#4285f4': 'bg-blue-500',      // Google Blue (Default)
            '#34a853': 'bg-green-500',     // Google Green
            '#fbbc04': 'bg-yellow-500',    // Google Yellow  
            '#ea4335': 'bg-red-500',       // Google Red
            '#ff6d01': 'bg-orange-500',    // Google Orange
            '#46d6db': 'bg-cyan-400',      // Turquoise
            '#e1bee7': 'bg-purple-200',    // Wisteria
            '#f3f3f3': 'bg-gray-200',      // Birch
            
            // Extended Google Calendar Colors
            '#ac725e': 'bg-amber-700',     // Chocolate
            '#d06b64': 'bg-red-400',       // Cherry blossom
            '#f83a22': 'bg-red-600',       // Tomato
            '#fa573c': 'bg-orange-600',    // Tangerine
            '#ff7537': 'bg-orange-500',    // Pumpkin
            '#ffad46': 'bg-yellow-400',    // Mango
            '#42d692': 'bg-green-400',     // Eucalyptus
            '#16a765': 'bg-green-600',     // Basil
            '#7bd148': 'bg-lime-400',      // Pistachio
            '#51b749': 'bg-green-500',     // Avocado
            '#9fe1e7': 'bg-cyan-200',      // Peacock
            '#9fc6e7': 'bg-blue-300',      // Sky
            '#4986e7': 'bg-blue-600',      // Cobalt
            '#9a9cff': 'bg-indigo-400',    // Blueberry
            '#b99aff': 'bg-purple-400',    // Grape
            '#cabdbf': 'bg-gray-300',      // Birch light
            '#cca6ac': 'bg-pink-300',      // Rose
            
            // Legacy support
            '#33b679': 'bg-green-500',     // Material Green
            '#8e24aa': 'bg-purple-500',    // Material Purple
            '#e67c73': 'bg-red-500',       // Material Red
            '#f09300': 'bg-orange-500',    // Material Orange
            '#795548': 'bg-amber-800',     // Material Brown
            '#616161': 'bg-gray-500',      // Material Gray
            '#ff7043': 'bg-orange-600',    // Deep Orange
            '#9c27b0': 'bg-purple-600',    // Deep Purple
            '#3f51b5': 'bg-indigo-500',    // Indigo
            '#2196f3': 'bg-blue-400',      // Light Blue
            '#00bcd4': 'bg-cyan-500',      // Cyan
            '#009688': 'bg-teal-500',      // Teal
            '#4caf50': 'bg-green-400',     // Light Green
            '#8bc34a': 'bg-lime-500',      // Lime
            '#cddc39': 'bg-lime-400',      // Lime Yellow
            '#ffeb3b': 'bg-yellow-400',    // Yellow
            '#ffc107': 'bg-amber-500',     // Amber
            '#ff9800': 'bg-orange-500',    // Orange
            '#ff5722': 'bg-red-600',       // Deep Orange
        };
        
        return colorMap[hexColor.toLowerCase()] || 'bg-blue-500';
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
                console.log(`📅 Syncing calendar: ${cal.summary} (${cal.id})`);
                
                // Get events from last 30 days and next 90 days to show comprehensive data
                const timeMin = new Date();
                timeMin.setDate(timeMin.getDate() - 30);
                const timeMax = new Date();
                timeMax.setDate(timeMax.getDate() + 90);

                const eventsResponse = await calendar.events.list({
                    calendarId: cal.id!,
                    timeMin: timeMin.toISOString(),
                    timeMax: timeMax.toISOString(),
                    maxResults: 250,
                    singleEvents: true,
                    orderBy: 'startTime'
                });

                const events = eventsResponse.data.items || [];
                console.log(`📅 Found ${events.length} events in calendar: ${cal.summary}`);

                // Store calendar info first
                await this.storeCalendarInfo(cal, userId, integrationId);

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
     * Store calendar information for display
     */
    private async storeCalendarInfo(cal: any, userId: string, integrationId: string): Promise<void> {
        try {
            // Store calendar metadata for better organization
            const calendarData = {
                externalId: cal.id,
                name: cal.summary || 'Untitled Calendar',
                description: cal.description || null,
                color: cal.backgroundColor || '#4285f4',
                isPrimary: cal.primary || false,
                accessRole: cal.accessRole || 'reader',
                timezone: cal.timeZone || 'UTC',
                isVisible: !cal.hidden,
                integrationId: integrationId,
                userId: userId
            };
            
            console.log(`📅 Storing calendar: ${calendarData.name}`);
            // This would store calendar metadata if we had the table structure
            
        } catch (error) {
            console.error('Error storing calendar info:', error);
        }
    }

    /**
     * Detect if this is a birthday event from Google Contacts
     */
    private isBirthdayEvent(event: any): boolean {
        const title = event.summary || '';
        const description = event.description || '';
        
        // Check for birthday patterns in multiple languages
        const birthdayPatterns = [
            /birthday/i,
            /cumpleaños/i,
            /aniversario/i,
            /natalicio/i,
            /\s+-\s+Birthday/i,
            /\s+-\s+Cumpleaños/i
        ];
        
        // Check if event comes from contacts calendar or has birthday patterns
        const isBirthdayPattern = birthdayPatterns.some(pattern => 
            pattern.test(title) || pattern.test(description)
        );
        
        // Check if event is all-day (birthdays are typically all-day events)
        const isAllDay = !event.start?.dateTime;
        
        return isBirthdayPattern && isAllDay;
    }

    /**
     * Store a Google Calendar event in cortex_scheduling.events
     */
    private async storeEventInCortex(event: any, calendar: any, userId: string, integrationId: string): Promise<void> {
        try {
            // Check if event already exists to prevent duplicates
            const existingEvents = await storage.getCortexSchedulingEventsByExternalId(event.id);
            if (existingEvents && existingEvents.length > 0) {
                console.log(`📅 Event already exists, skipping: ${event.summary} (${event.id})`);
                return;
            }

            const startTime = event.start?.dateTime || event.start?.date;
            const endTime = event.end?.dateTime || event.end?.date;
            const isAllDay = !event.start?.dateTime; // If no time, it's all day

            // Detect if this is a birthday event from Google Contacts
            const isBirthdayEvent = this.isBirthdayEvent(event);
            
            // Handle timezone conversion properly - convert to Mexico City time
            let processedStartTime = null;
            let processedEndTime = null;
            let eventTimezone = event.start?.timeZone || 'America/Mexico_City';
            
            if (startTime) {
                if (isAllDay) {
                    // For all-day events, use the date as-is
                    processedStartTime = startTime;
                } else {
                    // For timed events, convert to Mexico City timezone
                    const startDate = new Date(startTime);
                    const mexicoCityTime = toZonedTime(startDate, 'America/Mexico_City');
                    processedStartTime = format(mexicoCityTime, 'yyyy-MM-dd HH:mm:ss', { timeZone: 'America/Mexico_City' });
                }
            }
            
            if (endTime) {
                if (isAllDay) {
                    processedEndTime = endTime;
                } else {
                    const endDate = new Date(endTime);
                    const mexicoCityTime = toZonedTime(endDate, 'America/Mexico_City');
                    processedEndTime = format(mexicoCityTime, 'yyyy-MM-dd HH:mm:ss', { timeZone: 'America/Mexico_City' });
                }
            }

            console.log(`📅 Event timezone data: ${event.summary} - Start: ${startTime}, Timezone: ${eventTimezone}`);
            
            // Store in cortex_scheduling.events table with subcalendar information
            await storage.createCortexSchedulingEvent({
                externalEventId: event.id,
                title: event.summary || 'Untitled Event',
                description: event.description || '',
                startTime: processedStartTime,
                endTime: processedEndTime,
                isAllDay,
                location: event.location || '',
                meetingUrl: event.hangoutLink || '',
                status: event.status || 'confirmed',
                organizerEmail: event.organizer?.email || null,
                attendees: this.extractAttendees(event.attendees || []),
                recurrence: event.recurrence || null,
                timezone: eventTimezone,
                visibility: event.visibility || 'default',
                createdBy: userId,
                // Enhanced subcalendar information with birthday detection
                subcalendarName: isBirthdayEvent ? 'Google Contacts Birthdays' : (calendar.summary || 'Unknown Calendar'),
                subcalendarColor: isBirthdayEvent ? '#f093fb' : (calendar.backgroundColor || '#4285f4'),
                subcalendarId: calendar.id
            });

            console.log(`📅 Stored new event: ${event.summary} from ${calendar.summary}`);

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

    /**
     * Create a webhook channel to watch calendar changes
     */
    async watchCalendar(calendarId: string, watchRequest: any): Promise<any> {
        try {
            const response = await this.calendar.events.watch({
                calendarId: calendarId,
                requestBody: watchRequest
            });
            return response.data;
        } catch (error) {
            console.error('Error creating calendar watch:', error);
            throw error;
        }
    }

    /**
     * Stop watching a calendar channel
     */
    async stopWatchChannel(channelId: string, resourceId: string): Promise<void> {
        try {
            await this.calendar.channels.stop({
                requestBody: {
                    id: channelId,
                    resourceId: resourceId
                }
            });
        } catch (error) {
            console.error('Error stopping watch channel:', error);
            throw error;
        }
    }

    /**
     * Create a new event in Google Calendar
     */
    async createEvent(calendarId: string, eventData: any): Promise<any> {
        try {
            const response = await this.calendar.events.insert({
                calendarId: calendarId,
                requestBody: eventData
            });
            return response.data;
        } catch (error) {
            console.error('Error creating calendar event:', error);
            throw error;
        }
    }

    /**
     * Update an existing event in Google Calendar
     */
    async updateEvent(calendarId: string, eventId: string, eventData: any): Promise<any> {
        try {
            const response = await this.calendar.events.update({
                calendarId: calendarId,
                eventId: eventId,
                requestBody: eventData
            });
            return response.data;
        } catch (error) {
            console.error('Error updating calendar event:', error);
            throw error;
        }
    }

    /**
     * Delete an event from Google Calendar
     */
    async deleteEvent(calendarId: string, eventId: string): Promise<void> {
        try {
            await this.calendar.events.delete({
                calendarId: calendarId,
                eventId: eventId
            });
        } catch (error) {
            console.error('Error deleting calendar event:', error);
            throw error;
        }
    }

    /**
     * Get events from a specific calendar with optional time range
     */
    async getCalendarEvents(calendarId: string, timeMin?: string, timeMax?: string): Promise<any[]> {
        try {
            const response = await this.calendar.events.list({
                calendarId: calendarId,
                timeMin: timeMin,
                timeMax: timeMax,
                singleEvents: true,
                orderBy: 'startTime'
            });
            return response.data.items || [];
        } catch (error) {
            console.error('Error getting calendar events:', error);
            throw error;
        }
    }

    /**
     * Initialize with existing tokens for webhook service
     */
    async initializeWithTokens(accessToken: string, refreshToken?: string): Promise<void> {
        this.oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    }
}

export const googleCalendarService = new GoogleCalendarService();