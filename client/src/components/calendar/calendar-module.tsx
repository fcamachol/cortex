import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Plus, MoreVertical, CalendarIcon, Clock, MapPin, Users, ExternalLink } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addDays, subDays, isSameDay, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface CalendarEvent {
  eventId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  location?: string;
  isAllDay: boolean;
  provider: 'google_calendar' | 'outlook' | 'apple_calendar';
  providerEventId?: string;
  metadata?: any;
}

interface CalendarProvider {
  providerId: string;
  provider: 'google_calendar' | 'outlook' | 'apple_calendar';
  syncStatus: 'active' | 'error' | 'pending' | 'revoked';
}

export default function CalendarModule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    isAllDay: false
  });
  const { toast } = useToast();

  // Get date range based on view mode
  const getDateRange = () => {
    if (viewMode === 'month') {
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { startDate, endDate };
    } else if (viewMode === 'week') {
      const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
      const endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
      return { startDate, endDate };
    } else { // day
      const startDate = startOfDay(currentDate);
      const endDate = endOfDay(currentDate);
      return { startDate, endDate };
    }
  };

  // Fetch calendar events for the current view
  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['/api/calendar/events', viewMode, currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      
      const response = await fetch(`/api/calendar/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    }
  });

  // Fetch calendar providers
  const { data: providers = [] } = useQuery({
    queryKey: ['/api/calendar/providers'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/providers');
      if (!response.ok) throw new Error('Failed to fetch providers');
      return response.json();
    }
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      return apiRequest('/api/calendar/events', 'POST', eventData);
    },
    onSuccess: () => {
      toast({
        title: "Event created",
        description: "Your calendar event has been created successfully."
      });
      setIsCreateEventOpen(false);
      setNewEvent({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        location: '',
        isAllDay: false
      });
      refetchEvents();
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create event",
        description: error.message || "An error occurred while creating the event.",
        variant: "destructive"
      });
    }
  });

  // Update event mutation for drag-and-drop
  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, updates }: { eventId: string; updates: any }) => {
      return apiRequest(`/api/calendar/events/${eventId}`, 'PUT', updates);
    },
    onSuccess: () => {
      toast({
        title: "Event updated",
        description: "Event time has been updated successfully."
      });
      refetchEvents();
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update event",
        description: error.message || "Could not move the event.",
        variant: "destructive"
      });
    }
  });

  // Format current period for display based on view mode
  const formatCurrentPeriod = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else { // day
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    }
  };

  // Navigate to previous/next period based on view mode
  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    if (viewMode === 'month') {
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
    } else if (viewMode === 'week') {
      if (direction === 'prev') {
        setCurrentDate(subWeeks(currentDate, 1));
        return;
      } else {
        setCurrentDate(addWeeks(currentDate, 1));
        return;
      }
    } else { // day
      if (direction === 'prev') {
        setCurrentDate(subDays(currentDate, 1));
        return;
      } else {
        setCurrentDate(addDays(currentDate, 1));
        return;
      }
    }
    
    setCurrentDate(newDate);
  };

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of week for the first day (0 = Sunday)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDateObj = new Date(startDate);
    
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      const day = new Date(currentDateObj);
      const isCurrentMonth = day.getMonth() === month;
      const isToday = day.toDateString() === new Date().toDateString();
      
      days.push({
        date: day,
        dayNumber: day.getDate(),
        isCurrentMonth,
        isToday,
        events: getEventsForDay(day) // Mock events
      });
      
      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }
    
    return days;
  };

  // Get events for a specific day from the fetched events
  const getEventsForDay = (date: Date) => {
    if (!events || events.length === 0) return [];
    
    const dayEvents = events.filter((event: CalendarEvent) => {
      const eventDate = new Date(event.startTime);
      return eventDate.toDateString() === date.toDateString();
    });

    return dayEvents.map((event: CalendarEvent) => {
      const providerColors = {
        'google_calendar': 'bg-blue-100 text-blue-800',
        'outlook': 'bg-orange-100 text-orange-800',
        'apple_calendar': 'bg-gray-100 text-gray-800'
      };

      return {
        title: event.title,
        color: providerColors[event.provider] || 'bg-gray-100 text-gray-800',
        eventId: event.eventId,
        startTime: event.startTime,
        isAllDay: event.isAllDay
      };
    });
  };

  // Generate week view data
  const generateWeekDays = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDays = eachDayOfInterval({
      start: weekStart,
      end: endOfWeek(currentDate, { weekStartsOn: 0 })
    });

    return weekDays.map(day => ({
      date: day,
      dayNumber: day.getDate(),
      isToday: isSameDay(day, new Date()),
      events: getEventsForDay(day)
    }));
  };

  // Generate day view data
  const generateDayEvents = () => {
    const dayEvents = getEventsForDay(currentDate);
    
    // Group events by hour for better display
    const eventsByHour = Array.from({ length: 24 }, (_, hour) => {
      const hourStart = new Date(currentDate);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(currentDate);
      hourEnd.setHours(hour, 59, 59, 999);

      return {
        hour,
        events: dayEvents.filter((event: any) => {
          if (event.isAllDay) return hour === 0; // Show all-day events at the top
          const eventStart = new Date(event.startTime);
          return eventStart.getHours() === hour;
        })
      };
    });

    return eventsByHour;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekViewDays = generateWeekDays();
  const dayViewEvents = generateDayEvents();
  const timeSlots = generateTimeSlots();

  // Get upcoming events from real data
  const upcomingEvents = events ? events
    .filter((event: CalendarEvent) => new Date(event.startTime) >= new Date())
    .sort((a: CalendarEvent, b: CalendarEvent) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5)
    .map((event: CalendarEvent) => {
      const eventDate = new Date(event.startTime);
      const endDate = event.endTime ? new Date(event.endTime) : null;
      
      const providerColors = {
        'google_calendar': 'bg-blue-500',
        'outlook': 'bg-orange-500',
        'apple_calendar': 'bg-gray-500'
      };

      let timeDisplay = '';
      if (event.isAllDay) {
        timeDisplay = format(eventDate, 'EEEE, MMMM d') + ' - All day';
      } else if (endDate) {
        timeDisplay = format(eventDate, 'EEEE, MMMM d, h:mm a') + ' - ' + format(endDate, 'h:mm a');
      } else {
        timeDisplay = format(eventDate, 'EEEE, MMMM d, h:mm a');
      }

      return {
        id: event.eventId,
        title: event.title,
        time: timeDisplay,
        color: providerColors[event.provider] || 'bg-gray-500',
        location: event.location
      };
    }) : [];

  // Handle clicking on calendar grid to create event
  const handleGridClick = (date: Date, hour?: number) => {
    const clickDate = new Date(date);
    
    if (hour !== undefined) {
      clickDate.setHours(hour, 0, 0, 0);
      setNewEvent({
        title: '',
        description: '',
        startTime: format(clickDate, 'HH:mm'),
        endTime: format(new Date(clickDate.getTime() + 60 * 60 * 1000), 'HH:mm'), // Default 1 hour duration
        location: '',
        isAllDay: false
      });
    } else {
      setNewEvent({
        title: '',
        description: '',
        startTime: '09:00',
        endTime: '10:00',
        location: '',
        isAllDay: false
      });
    }
    
    setSelectedDate(clickDate);
    setIsCreateEventOpen(true);
  };

  // Handle drag end for moving events
  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const [eventId, eventType] = draggableId.split('|');
    
    // Parse destination to get new time slot
    const [destType, destDate, destHour, destMinute] = destination.droppableId.split('|');
    
    if (destType !== 'timeslot') return;

    // Find the event being moved
    const event = events.find((e: any) => e.eventId === eventId);
    if (!event) return;

    // Calculate new start and end times
    const newStartTime = new Date(destDate);
    newStartTime.setHours(parseInt(destHour), parseInt(destMinute), 0, 0);
    
    const originalStart = new Date(event.startTime);
    const originalEnd = event.endTime ? new Date(event.endTime) : null;
    const duration = originalEnd ? originalEnd.getTime() - originalStart.getTime() : 60 * 60 * 1000; // Default 1 hour
    
    const newEndTime = new Date(newStartTime.getTime() + duration);

    // Update the event
    updateEventMutation.mutate({
      eventId,
      updates: {
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString()
      }
    });
  };

  // Generate 15-minute time slots for day view
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = new Date(currentDate);
        time.setHours(hour, minute, 0, 0);
        
        const eventsInSlot = events.filter((event: any) => {
          if (event.isAllDay) return hour === 0 && minute === 0;
          const eventStart = new Date(event.startTime);
          const eventHour = eventStart.getHours();
          const eventMinute = Math.floor(eventStart.getMinutes() / 15) * 15;
          return eventHour === hour && eventMinute === minute;
        });

        slots.push({
          hour,
          minute,
          time,
          events: eventsInSlot,
          id: `timeslot|${format(currentDate, 'yyyy-MM-dd')}|${hour}|${minute}`
        });
      }
    }
    return slots;
  };

  // Handle create event form submission
  const handleCreateEvent = () => {
    if (!newEvent.title) {
      toast({
        title: "Title required",
        description: "Please enter a title for the event.",
        variant: "destructive"
      });
      return;
    }

    let startDateTime = new Date();
    let endDateTime = null;

    if (selectedDate) {
      startDateTime = new Date(selectedDate);
    }

    if (newEvent.startTime && !newEvent.isAllDay) {
      const [hours, minutes] = newEvent.startTime.split(':');
      startDateTime.setHours(parseInt(hours), parseInt(minutes));
    }

    if (newEvent.endTime && !newEvent.isAllDay) {
      const [hours, minutes] = newEvent.endTime.split(':');
      endDateTime = new Date(startDateTime);
      endDateTime.setHours(parseInt(hours), parseInt(minutes));
    }

    createEventMutation.mutate({
      title: newEvent.title,
      description: newEvent.description,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime ? endDateTime.toISOString() : null,
      location: newEvent.location,
      isAllDay: newEvent.isAllDay
    });
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
          <Dialog open={isCreateEventOpen} onOpenChange={setIsCreateEventOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Event title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Event description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={newEvent.isAllDay}
                    onChange={(e) => setNewEvent({ ...newEvent, isAllDay: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="allDay">All day event</Label>
                </div>

                {!newEvent.isAllDay && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={newEvent.startTime}
                        onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={newEvent.endTime}
                        onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Event location"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  />
                </div>

                {providers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Calendar Provider</Label>
                    <div className="flex space-x-2">
                      {providers.map((provider: CalendarProvider) => (
                        <Badge 
                          key={provider.providerId} 
                          variant={provider.syncStatus === 'active' ? 'default' : 'secondary'}
                        >
                          {provider.provider === 'google_calendar' ? 'Google' : 
                           provider.provider === 'outlook' ? 'Microsoft' : 'Apple'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateEventOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateEvent}
                  disabled={createEventMutation.isPending}
                >
                  {createEventMutation.isPending ? "Creating..." : "Create Event"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Calendar Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigatePeriod('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrentPeriod()}
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigatePeriod('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              {['Month', 'Week', 'Day'].map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode.toLowerCase() ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode(mode.toLowerCase())}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>

          {/* Calendar Content - Different views */}
          {viewMode === 'month' && (
            <div className="grid grid-cols-7 gap-0">
              {/* Calendar Headers */}
              {weekDays.map((day) => (
                <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`calendar-day ${day.isToday ? 'today' : ''} ${
                    !day.isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : ''
                  } cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}
                  onClick={() => handleGridClick(day.date)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${
                      day.isToday 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {day.dayNumber}
                    </span>
                    {day.isToday && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {day.events.map((event: any, eventIndex: number) => (
                      <div
                        key={eventIndex}
                        className={`text-xs px-2 py-1 rounded truncate ${event.color}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Week View */}
          {viewMode === 'week' && (
            <div className="grid grid-cols-7 gap-0">
              {/* Week Headers */}
              {weekViewDays.map((day, index) => (
                <div key={index} className="p-3 text-center border-b border-gray-200 dark:border-gray-700">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {format(day.date, 'EEE')}
                  </div>
                  <div className={`text-lg font-semibold mt-1 ${
                    day.isToday 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {day.dayNumber}
                  </div>
                </div>
              ))}

              {/* Week Events */}
              {weekViewDays.map((day, index) => (
                <div 
                  key={index} 
                  className="min-h-[300px] p-2 border-r border-gray-200 dark:border-gray-700 last:border-r-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => handleGridClick(day.date, 9)} // Default to 9 AM
                >
                  <div className="space-y-1">
                    {day.events.map((event: any, eventIndex: number) => (
                      <div
                        key={eventIndex}
                        className={`text-xs px-2 py-1 rounded ${event.color} cursor-pointer hover:opacity-80`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        {!event.isAllDay && (
                          <div className="text-xs opacity-75">
                            {format(new Date(event.startTime), 'h:mm a')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Day View */}
          {viewMode === 'day' && (
            <div className="max-h-[500px] overflow-y-auto">
              {dayViewEvents.map((hourSlot, index) => (
                <div key={index} className="flex border-b border-gray-100 dark:border-gray-700">
                  <div className="w-16 p-2 text-sm text-gray-500 dark:text-gray-400 text-right">
                    {hourSlot.hour === 0 ? '12 AM' : 
                     hourSlot.hour < 12 ? `${hourSlot.hour} AM` : 
                     hourSlot.hour === 12 ? '12 PM' : 
                     `${hourSlot.hour - 12} PM`}
                  </div>
                  <div 
                    className="flex-1 p-2 min-h-[60px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleGridClick(currentDate, hourSlot.hour)}
                  >
                    <div className="space-y-1">
                      {hourSlot.events.map((event: any, eventIndex: number) => (
                        <div
                          key={eventIndex}
                          className={`px-3 py-2 rounded ${event.color} cursor-pointer hover:opacity-80`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="font-medium">{event.title}</div>
                          {event.location && (
                            <div className="text-xs opacity-75 flex items-center mt-1">
                              <MapPin className="h-3 w-3 mr-1" />
                              {event.location}
                            </div>
                          )}
                          {!event.isAllDay && (
                            <div className="text-xs opacity-75 flex items-center mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(new Date(event.startTime), 'h:mm a')}
                              {event.endTime && ` - ${format(new Date(event.endTime), 'h:mm a')}`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendar Integration Status */}
        {providers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Calendar Integrations</h3>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-3">
                {providers.map((provider: CalendarProvider) => (
                  <div key={provider.providerId} className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${
                      provider.syncStatus === 'active' ? 'bg-green-500' : 
                      provider.syncStatus === 'error' ? 'bg-red-500' : 
                      provider.syncStatus === 'pending' ? 'bg-yellow-500' : 'bg-gray-500'
                    }`}></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {provider.provider === 'google_calendar' ? 'Google Calendar' : 
                       provider.provider === 'outlook' ? 'Microsoft Outlook' : 'Apple Calendar'}
                    </span>
                    <Badge variant={provider.syncStatus === 'active' ? 'default' : 'secondary'}>
                      {provider.syncStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Upcoming Events</h3>
              {eventsLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              )}
            </div>
          </div>
          <div className="p-4 space-y-3">
            {upcomingEvents.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <CalendarIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h4 className="text-lg font-medium mb-2">No upcoming events</h4>
                <p className="text-sm">Create your first event or connect a calendar provider to get started.</p>
              </div>
            ) : (
              upcomingEvents.map((event: any) => (
                <div key={event.id} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  <div className={`w-3 h-3 ${event.color} rounded-full mt-2 flex-shrink-0`}></div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {event.title}
                    </h4>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 mt-1">
                      <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{event.time}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="flex-shrink-0">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
