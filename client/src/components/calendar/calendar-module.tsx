import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Plus, MoreVertical, Calendar as CalendarIcon, Clock, MapPin, Menu, Search, Settings } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addDays, subDays, isSameDay, startOfMonth, endOfMonth, isSameMonth, startOfDay, endOfDay } from "date-fns";
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
  calendarId?: string;
}

interface SubCalendar {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  provider: 'google_calendar' | 'outlook' | 'apple_calendar' | 'local';
}

export default function CalendarModule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    isAllDay: false,
    calendarId: 'personal'
  });

  const { toast } = useToast();

  // Sample sub-calendars (in real app, fetch from API)
  const [subCalendars, setSubCalendars] = useState<SubCalendar[]>([
    { id: 'personal', name: 'Personal', color: 'bg-blue-500', visible: true, provider: 'local' },
    { id: 'work', name: 'Work', color: 'bg-red-500', visible: true, provider: 'google_calendar' },
    { id: 'birthdays', name: 'Birthdays', color: 'bg-green-500', visible: true, provider: 'local' },
    { id: 'family', name: 'Family', color: 'bg-purple-500', visible: true, provider: 'local' },
    { id: 'tasks', name: 'Tasks', color: 'bg-orange-500', visible: false, provider: 'local' },
  ]);

  // Import Google Calendar mutation
  const importGoogleCalendarMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/calendar/auth/google', 'POST');
    },
    onSuccess: (data: any) => {
      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start Google Calendar import",
        description: error.message || "Could not initiate Google Calendar connection.",
        variant: "destructive"
      });
    }
  });

  // Sync Google Calendars mutation
  const syncGoogleCalendarsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/calendar/sync/google', 'POST');
    },
    onSuccess: (data: any) => {
      toast({
        title: "Google Calendars synced",
        description: `Imported ${data.calendarsCount} calendars and ${data.eventsCount} events.`
      });
      refetchEvents();
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/providers'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to sync Google Calendars",
        description: error.message || "Could not sync Google Calendar data.",
        variant: "destructive"
      });
    }
  });

  // Fetch calendar events
  const { data: events = [], refetch: refetchEvents } = useQuery({
    queryKey: ['/api/calendar/events'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/events');
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
        isAllDay: false,
        calendarId: 'personal'
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

  // Generate calendar data for month view
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd }).map(day => {
      const dayEvents = getEventsForDay(day);
      return {
        date: day,
        dayNumber: day.getDate(),
        isCurrentMonth: isSameMonth(day, currentDate),
        isToday: isSameDay(day, new Date()),
        events: dayEvents
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

  // Generate time slots for day/week view
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push({
        hour,
        time: `${hour === 0 ? '12' : hour <= 12 ? hour : hour - 12} ${hour < 12 ? 'AM' : 'PM'}`,
        events: []
      });
    }
    return slots;
  };

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    return events.filter((event: any) => {
      const eventStart = new Date(event.startTime);
      return eventStart >= dayStart && eventStart <= dayEnd;
    }).map((event: any) => {
      const calendar = subCalendars.find(cal => cal.id === event.calendarId || cal.provider === event.provider);
      return {
        ...event,
        color: calendar ? calendar.color : 'bg-gray-500'
      };
    });
  };

  // Handle grid click to create event
  const handleGridClick = (date: Date, hour?: number) => {
    const clickDate = new Date(date);
    
    if (hour !== undefined) {
      clickDate.setHours(hour, 0, 0, 0);
      setNewEvent({
        title: '',
        description: '',
        startTime: format(clickDate, 'HH:mm'),
        endTime: format(new Date(clickDate.getTime() + 60 * 60 * 1000), 'HH:mm'),
        location: '',
        isAllDay: false,
        calendarId: 'personal'
      });
    } else {
      setNewEvent({
        title: '',
        description: '',
        startTime: '09:00',
        endTime: '10:00',
        location: '',
        isAllDay: false,
        calendarId: 'personal'
      });
    }
    
    setSelectedDate(clickDate);
    setIsCreateEventOpen(true);
  };

  // Handle drag end for moving events
  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    // Implementation for drag and drop functionality
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
      isAllDay: newEvent.isAllDay,
      calendarId: newEvent.calendarId
    });
  };

  // Toggle calendar visibility
  const toggleCalendarVisibility = (calendarId: string) => {
    setSubCalendars(prev => prev.map(cal => 
      cal.id === calendarId ? { ...cal, visible: !cal.visible } : cal
    ));
  };

  // Filter events by visible calendars
  const visibleEvents = events.filter((event: any) => {
    const calendar = subCalendars.find(cal => 
      cal.id === event.calendarId || cal.provider === event.provider
    );
    return calendar ? calendar.visible : true;
  });

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekViewDays = generateWeekDays();
  const timeSlots = generateTimeSlots();

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-screen bg-white">
        {/* Sidebar */}
        <div className={cn(
          "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <CalendarIcon className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-lg">Calendar</span>
            </div>
            
            <Button 
              onClick={() => setIsCreateEventOpen(true)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
          </div>

          {/* Mini Calendar */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">{format(currentDate, 'MMMM yyyy')}</div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {/* Mini Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-xs">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={`header-${idx}`} className="text-center text-gray-500 py-1">{day}</div>
              ))}
              {generateCalendarDays().map((day, index) => (
                <button
                  key={`day-${day.date.getTime()}`}
                  onClick={() => setCurrentDate(day.date)}
                  className={cn(
                    "text-center py-1 rounded text-xs hover:bg-gray-100 transition-colors",
                    day.isToday && "bg-blue-500 text-white hover:bg-blue-600",
                    !day.isCurrentMonth && "text-gray-300",
                    isSameDay(day.date, currentDate) && !day.isToday && "bg-gray-200"
                  )}
                >
                  {day.dayNumber}
                </button>
              ))}
            </div>
          </div>

          {/* My Calendars */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">My calendars</h3>
              <div className="space-y-2">
                {subCalendars.map((calendar) => (
                  <div key={calendar.id} className="flex items-center gap-3 py-1 px-2 rounded hover:bg-gray-50">
                    <Checkbox
                      checked={calendar.visible}
                      onCheckedChange={() => toggleCalendarVisibility(calendar.id)}
                      className="data-[state=checked]:bg-transparent data-[state=checked]:border-current"
                      style={{ color: calendar.color.replace('bg-', '') }}
                    />
                    <div className={cn("w-3 h-3 rounded", calendar.color)}></div>
                    <span className="text-sm text-gray-700 flex-1">{calendar.name}</span>
                    <MoreVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                  </div>
                ))}
              </div>
            </div>

            {/* Other Calendars */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Other calendars</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => importGoogleCalendarMutation.mutate()}
                  disabled={importGoogleCalendarMutation.isPending}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {providers.length === 0 ? (
                  <div className="text-xs text-gray-500 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => importGoogleCalendarMutation.mutate()}
                      disabled={importGoogleCalendarMutation.isPending}
                      className="text-xs text-blue-600 hover:text-blue-800 p-0 h-auto font-normal"
                    >
                      {importGoogleCalendarMutation.isPending ? "Connecting..." : "Import from Google Calendar"}
                    </Button>
                  </div>
                ) : (
                  providers.map((provider: any) => (
                    <div key={provider.providerId} className="flex items-center gap-3 py-1 px-2 rounded hover:bg-gray-50 group">
                      <div className="w-3 h-3 rounded bg-blue-500"></div>
                      <span className="text-sm text-gray-700 flex-1 capitalize">{provider.provider.replace('_', ' ')}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={provider.syncStatus === 'active' ? 'default' : 'destructive'} className="text-xs">
                          {provider.syncStatus}
                        </Badge>
                        {provider.syncStatus === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => syncGoogleCalendarsMutation.mutate()}
                            disabled={syncGoogleCalendarsMutation.isPending}
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                          >
                            <Clock className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <Menu className="w-5 h-5" />
                </Button>
                
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigatePeriod('prev')}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigatePeriod('next')}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
                    Today
                  </Button>
                  <h1 className="text-xl font-normal text-gray-700 ml-4">
                    {formatCurrentPeriod()}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  {['Month', 'Week', 'Day'].map((mode) => (
                    <Button
                      key={mode}
                      variant={viewMode === mode.toLowerCase() ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode(mode.toLowerCase())}
                      className={cn(
                        "rounded-none border-0",
                        viewMode === mode.toLowerCase() ? "bg-blue-100 text-blue-700" : "hover:bg-gray-50"
                      )}
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
                
                <Button variant="ghost" size="sm">
                  <Search className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Calendar Content */}
          <div className="flex-1 overflow-auto">
            {viewMode === 'month' && (
              <div className="p-6">
                <div className="grid grid-cols-7 gap-0 border border-gray-200 rounded-lg overflow-hidden">
                  {/* Day Headers */}
                  {weekDays.map((day) => (
                    <div key={day} className="bg-gray-50 border-b border-gray-200 p-3 text-center text-sm font-medium text-gray-700">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar Days */}
                  {calendarDays.map((day, index) => (
                    <div
                      key={index}
                      className={cn(
                        "min-h-[120px] border-b border-r border-gray-200 p-2 cursor-pointer hover:bg-gray-50 transition-colors",
                        !day.isCurrentMonth && "bg-gray-50",
                        day.isToday && "bg-blue-50"
                      )}
                      onClick={() => handleGridClick(day.date)}
                    >
                      <div className={cn(
                        "text-sm font-medium mb-2",
                        day.isToday ? "text-blue-600" : day.isCurrentMonth ? "text-gray-900" : "text-gray-400"
                      )}>
                        {day.dayNumber}
                      </div>
                      <div className="space-y-1">
                        {day.events.slice(0, 3).map((event: any, eventIndex: number) => (
                          <div
                            key={eventIndex}
                            className={cn("text-xs px-2 py-1 rounded text-white truncate", event.color)}
                          >
                            {event.title}
                          </div>
                        ))}
                        {day.events.length > 3 && (
                          <div className="text-xs text-gray-500 px-2">
                            +{day.events.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewMode === 'week' && (
              <div className="flex flex-col h-full">
                {/* Week Header */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                  <div className="w-16 border-r border-gray-200"></div>
                  {weekViewDays.map((day, index) => (
                    <div key={index} className="flex-1 p-3 text-center border-r border-gray-200 last:border-r-0">
                      <div className="text-sm text-gray-600">{format(day.date, 'EEE')}</div>
                      <div className={cn(
                        "text-lg font-medium mt-1",
                        day.isToday ? "text-blue-600" : "text-gray-900"
                      )}>
                        {day.dayNumber}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Week Grid */}
                <div className="flex-1 overflow-y-auto">
                  <Droppable droppableId="week-view" type="EVENT">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {timeSlots.map((slot, slotIndex) => (
                          <div key={slotIndex} className="flex border-b border-gray-100">
                            <div className="w-16 p-2 text-xs text-gray-500 text-right border-r border-gray-200">
                              {slot.time}
                            </div>
                            {weekViewDays.map((day, dayIndex) => {
                              const dayEvents = getEventsForDay(day.date).filter((event: any) => {
                                const eventHour = new Date(event.startTime).getHours();
                                return eventHour === slot.hour;
                              });
                              
                              return (
                                <div 
                                  key={dayIndex} 
                                  className="flex-1 min-h-[60px] border-r border-gray-100 last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors relative p-1"
                                  onClick={() => handleGridClick(day.date, slot.hour)}
                                >
                                  {dayEvents.map((event: any, eventIndex: number) => (
                                    <Draggable key={event.eventId} draggableId={event.eventId} index={eventIndex}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={cn(
                                            "text-xs px-2 py-1 rounded-sm text-white cursor-pointer mb-1 truncate",
                                            event.color,
                                            snapshot.isDragging && "opacity-50"
                                          )}
                                          style={provided.draggableProps.style}
                                        >
                                          {event.title}
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            )}

            {viewMode === 'day' && (
              <div className="flex flex-col h-full">
                {/* Day Header */}
                <div className="flex border-b border-gray-200 bg-gray-50 p-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-600">{format(currentDate, 'EEEE')}</div>
                    <div className="text-2xl font-medium text-gray-900 mt-1">
                      {format(currentDate, 'd')}
                    </div>
                  </div>
                </div>
                
                {/* Day Grid */}
                <div className="flex-1 overflow-y-auto">
                  {timeSlots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="flex border-b border-gray-100">
                      <div className="w-16 p-2 text-xs text-gray-500 text-right border-r border-gray-200">
                        {slot.time}
                      </div>
                      <div 
                        className="flex-1 min-h-[60px] cursor-pointer hover:bg-gray-50 transition-colors relative"
                        onClick={() => handleGridClick(currentDate, slot.hour)}
                      >
                        {/* Events for this hour would be positioned here */}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Event Dialog */}
        <Dialog open={isCreateEventOpen} onOpenChange={setIsCreateEventOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Add title"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Add description"
                />
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Add location"
                />
              </div>

              <div>
                <Label htmlFor="calendar">Calendar</Label>
                <select
                  id="calendar"
                  value={newEvent.calendarId}
                  onChange={(e) => setNewEvent({ ...newEvent, calendarId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {subCalendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={newEvent.isAllDay}
                  onChange={(e) => setNewEvent({ ...newEvent, isAllDay: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="allDay" className="text-sm">All day</Label>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateEventOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateEvent}
                  disabled={createEventMutation.isPending}
                >
                  {createEventMutation.isPending ? "Creating..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DragDropContext>
  );
}