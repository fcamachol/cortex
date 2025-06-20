import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Plus, MoreVertical, Calendar as CalendarIcon, Clock, MapPin, Menu, Search, Settings, Trash2, Edit3, Palette, Users, Video, Paperclip, X, Bell } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addDays, subDays, isSameDay, startOfMonth, endOfMonth, isSameMonth, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

// Time dropdown component with 15-minute intervals
function TimeDropdown({ value, onChange, className }: { value: string; onChange: (time: string) => void; className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = hour === 0 && minute === 0 ? '12:00am' :
                           hour < 12 ? `${hour === 0 ? 12 : hour}:${minute.toString().padStart(2, '0')}am` :
                           hour === 12 ? `12:${minute.toString().padStart(2, '0')}pm` :
                           `${hour - 12}:${minute.toString().padStart(2, '0')}pm`;
        times.push({ value: timeStr, display: displayTime });
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();
  const selectedTime = timeOptions.find(t => t.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "px-3 py-2 rounded-lg border text-sm font-medium min-w-[100px] text-left flex items-center justify-between",
          className
        )}
      >
        <span>{selectedTime?.display || value}</span>
        <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto min-w-[120px]">
          {timeOptions.map((time) => (
            <button
              key={time.value}
              onClick={() => {
                onChange(time.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors",
                time.value === value && "bg-blue-50 text-blue-700"
              )}
            >
              {time.display}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState<'event' | 'task' | 'appointment'>('event');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCreateCalendarOpen, setIsCreateCalendarOpen] = useState(false);
  const [selectedCalendarForMenu, setSelectedCalendarForMenu] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    isAllDay: false,
    calendarId: 'personal',
    guests: [] as string[],
    hasGoogleMeet: false,
    meetLink: '',
    attachments: [] as string[],
    availability: 'busy' as 'busy' | 'free',
    visibility: 'default' as 'default' | 'public' | 'private',
    notifications: [10] as number[]
  });
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    estimatedTime: 30, // in minutes
    priority: 'medium' as 'low' | 'medium' | 'high',
    taskList: 'My Tasks',
    completed: false
  });
  const [eventTab, setEventTab] = useState<'event' | 'task' | 'appointment'>('event');
  const [guestEmail, setGuestEmail] = useState('');
  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);
  const [repeatOption, setRepeatOption] = useState('no-repeat');
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);
  const [showAvailabilityDropdown, setShowAvailabilityDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showCustomNotification, setShowCustomNotification] = useState(false);
  const [customNotification, setCustomNotification] = useState({
    type: 'notification',
    value: 30,
    unit: 'minutos'
  });
  const [customRecurrence, setCustomRecurrence] = useState({
    frequency: 'weekly',
    interval: 1,
    daysOfWeek: ['J'], // Thursday selected by default
    endType: 'never',
    endDate: '',
    repetitions: 13
  });
  const repeatDropdownRef = useRef<HTMLDivElement>(null);
  const availabilityDropdownRef = useRef<HTMLDivElement>(null);
  const [newCalendar, setNewCalendar] = useState({
    name: '',
    color: 'bg-blue-500',
    description: ''
  });

  const repeatOptions = [
    { value: 'no-repeat', label: 'No se repite', icon: '👤' },
    { value: 'daily', label: 'Cada día', icon: '📅' },
    { value: 'weekly-thursday', label: 'Cada semana el jueves', icon: '📍' },
    { value: 'monthly-third-thursday', label: 'Cada mes el tercer jueves', icon: '📊' },
    { value: 'yearly-june-19', label: 'Anualmente el 19 de junio', icon: '📆' },
    { value: 'weekdays', label: 'Todos los días laborables (de lunes a viernes)', icon: null },
    { value: 'custom', label: 'Personalizar...', icon: null }
  ];

  const getRepeatLabel = (value: string) => {
    const option = repeatOptions.find(opt => opt.value === value);
    return option ? option.label : 'No se repite';
  };

  // Close repeat dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (repeatDropdownRef.current && !repeatDropdownRef.current.contains(event.target as Node)) {
        setShowRepeatDropdown(false);
      }
      if (availabilityDropdownRef.current && !availabilityDropdownRef.current.contains(event.target as Node)) {
        setShowAvailabilityDropdown(false);
      }
    };

    if (showRepeatDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRepeatDropdown]);

  const { toast } = useToast();

  // Fetch Google Calendar sub-calendars
  const { data: subCalendars = [], refetch: refetchCalendars } = useQuery({
    queryKey: ['/api/calendar/calendars'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/calendar/calendars');
        if (!response.ok) throw new Error('Failed to fetch calendars');
        const data = await response.json();
        
        // If no calendars exist, return default local calendars
        if (data.length === 0) {
          return [
            { id: 'personal', name: 'Personal', color: 'bg-blue-500', visible: true, provider: 'local' },
            { id: 'work', name: 'Work', color: 'bg-red-500', visible: true, provider: 'local' },
            { id: 'family', name: 'Family', color: 'bg-purple-500', visible: true, provider: 'local' },
          ];
        }
        
        return data.map((cal: any) => ({
          id: cal.calendarId || cal.id,
          name: cal.name || cal.summary,
          color: cal.color || 'bg-blue-500',
          visible: cal.visible !== false,
          provider: cal.provider || 'google_calendar'
        }));
      } catch (error) {
        // Return default calendars if API fails
        return [
          { id: 'personal', name: 'Personal', color: 'bg-blue-500', visible: true, provider: 'local' },
          { id: 'work', name: 'Work', color: 'bg-red-500', visible: true, provider: 'local' },
          { id: 'family', name: 'Family', color: 'bg-purple-500', visible: true, provider: 'local' },
        ];
      }
    }
  });

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
      const data = await response.json();
      
      // Add some sample events for demonstration if no events exist
      if (data.length === 0) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        return [
          {
            eventId: 'sample-1',
            title: 'Team Meeting',
            description: 'Weekly team sync',
            startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0).toISOString(),
            endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0).toISOString(),
            location: 'Conference Room A',
            isAllDay: false,
            provider: 'local',
            calendarId: 'work'
          },
          {
            eventId: 'sample-2',
            title: 'Lunch with Sarah',
            description: 'Birthday lunch',
            startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 30).toISOString(),
            endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
            location: 'Downtown Restaurant',
            isAllDay: false,
            provider: 'local',
            calendarId: 'personal'
          },
          {
            eventId: 'sample-3',
            title: 'Project Review',
            description: 'Q4 project milestone review',
            startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 0).toISOString(),
            endTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 15, 30).toISOString(),
            location: 'Virtual Meeting',
            isAllDay: false,
            provider: 'local',
            calendarId: 'work'
          },
          {
            eventId: 'sample-4',
            title: 'Family Dinner',
            description: 'Monthly family gathering',
            startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 18, 0).toISOString(),
            endTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 20, 0).toISOString(),
            location: 'Mom\'s House',
            isAllDay: false,
            provider: 'local',
            calendarId: 'family'
          },
          {
            eventId: 'task-1',
            title: 'Review budget proposal',
            description: 'Complete review of Q1 budget proposal',
            startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString(),
            endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30).toISOString(),
            location: '',
            isAllDay: false,
            isTask: true,
            provider: 'local',
            calendarId: 'work',
            priority: 'high',
            estimatedTime: 90
          },
          {
            eventId: 'task-2',
            title: 'Call dentist',
            description: 'Schedule annual checkup appointment',
            startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 30).toISOString(),
            endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0).toISOString(),
            location: '',
            isAllDay: false,
            isTask: true,
            provider: 'local',
            calendarId: 'personal',
            priority: 'medium',
            estimatedTime: 30
          },
          {
            eventId: 'task-3',
            title: 'Prepare presentation slides',
            description: 'Create slides for client presentation',
            startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 0).toISOString(),
            endTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 12, 0).toISOString(),
            location: '',
            isAllDay: false,
            isTask: true,
            provider: 'local',
            calendarId: 'work',
            priority: 'high',
            estimatedTime: 120
          }
        ];
      }
      
      return data;
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

  // Calendar management mutations
  const createCalendarMutation = useMutation({
    mutationFn: async (calendarData: { name: string; color: string; description?: string }) => {
      return apiRequest('/api/calendar/calendars', 'POST', calendarData);
    },
    onSuccess: () => {
      refetchCalendars();
      setIsCreateCalendarOpen(false);
      setNewCalendar({ name: '', color: 'bg-blue-500', description: '' });
      toast({
        title: "Calendar created",
        description: "New Google Calendar has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create calendar. Please check your Google Calendar connection.",
        variant: "destructive"
      });
    }
  });

  const deleteCalendarMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      return apiRequest(`/api/calendar/calendars/${calendarId}`, 'DELETE');
    },
    onSuccess: () => {
      refetchCalendars();
      setSelectedCalendarForMenu(null);
      toast({
        title: "Calendar deleted",
        description: "Google Calendar has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete calendar. Please try again.",
        variant: "destructive"
      });
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
        calendarId: 'personal',
        guests: [] as string[],
        hasGoogleMeet: false,
        meetLink: '',
        attachments: [] as string[],
        availability: 'busy' as 'busy' | 'free',
        visibility: 'default' as 'default' | 'public' | 'private',
        notifications: [10] as number[]
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

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      return apiRequest('/api/crm/tasks', 'POST', taskData);
    },
    onSuccess: () => {
      toast({
        title: "Task created",
        description: "Your task has been created successfully."
      });
      setIsCreateEventOpen(false);
      setNewTask({
        title: '',
        description: '',
        dueDate: '',
        dueTime: '',
        estimatedTime: 30,
        priority: 'medium',
        taskList: 'My Tasks',
        completed: false
      });
      refetchEvents();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create task",
        description: error.message || "An error occurred while creating the task.",
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

  // Get events for a specific day (filtered by visible calendars)
  const getEventsForDay = (date: Date) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    return events.filter((event: any) => {
      const eventStart = new Date(event.startTime);
      const isInDateRange = eventStart >= dayStart && eventStart <= dayEnd;
      
      // Check if event's calendar is visible
      const calendar = subCalendars?.find((cal: any) => 
        cal.id === event.calendarId || cal.provider === event.provider
      );
      const isCalendarVisible = calendar ? calendar.visible : true;
      
      return isInDateRange && isCalendarVisible;
    }).map((event: any) => {
      const calendar = subCalendars?.find((cal: any) => cal.id === event.calendarId || cal.provider === event.provider);
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
      const startHour = hour < 10 ? `0${hour}` : hour.toString();
      const endHour = hour + 1 < 10 ? `0${hour + 1}` : (hour + 1).toString();
      
      setNewEvent({
        title: '',
        description: '',
        startTime: `${startHour}:00`,
        endTime: `${endHour}:00`,
        location: '',
        isAllDay: false,
        calendarId: 'personal',
        guests: [],
        hasGoogleMeet: false,
        meetLink: '',
        attachments: [],
        availability: 'busy' as 'busy' | 'free',
        visibility: 'default' as 'default' | 'public' | 'private',
        notifications: [10] as number[]
      });
      
      setSelectedDate(clickDate);
    } else {
      setNewEvent({
        title: '',
        description: '',
        startTime: '09:00',
        endTime: '10:00',
        location: '',
        isAllDay: false,
        calendarId: 'personal',
        guests: [] as string[],
        hasGoogleMeet: false,
        meetLink: '',
        attachments: [] as string[],
        availability: 'busy' as 'busy' | 'free',
        visibility: 'default' as 'default' | 'public' | 'private',
        notifications: [10] as number[]
      });
      
      setSelectedDate(clickDate);
    }
    
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

  // Handle create task form submission
  const handleCreateTask = () => {
    if (!newTask.title) {
      toast({
        title: "Title required",
        description: "Please enter a title for the task.",
        variant: "destructive"
      });
      return;
    }

    let dueDateTime = null;
    if (newTask.dueDate) {
      dueDateTime = new Date(newTask.dueDate);
      if (newTask.dueTime) {
        const [hours, minutes] = newTask.dueTime.split(':');
        dueDateTime.setHours(parseInt(hours), parseInt(minutes));
      }
    }

    // Create both task and calendar event
    const taskData = {
      title: newTask.title,
      description: newTask.description,
      dueDate: dueDateTime ? dueDateTime.toISOString() : null,
      estimatedTimeMinutes: newTask.estimatedTime,
      priority: newTask.priority,
      taskList: newTask.taskList,
      completed: newTask.completed,
      instanceId: 'calendar',
      spaceId: 1
    };

    // Create task
    createTaskMutation.mutate(taskData);

    // Also create calendar event representation
    if (dueDateTime) {
      const endTime = new Date(dueDateTime.getTime() + (newTask.estimatedTime * 60 * 1000));
      
      createEventMutation.mutate({
        title: newTask.title,
        description: newTask.description,
        startTime: dueDateTime.toISOString(),
        endTime: endTime.toISOString(),
        location: '',
        isAllDay: false,
        calendarId: 'personal',
        metadata: {
          isTask: true,
          isTaskEvent: true,
          estimatedTime: newTask.estimatedTime,
          priority: newTask.priority,
          taskList: newTask.taskList
        }
      });
    }
  };

  // Create calendar event from task
  const createEventFromTask = (task: any) => {
    if (!task.dueDate) {
      toast({
        title: "Due date required",
        description: "Task must have a due date to create calendar event.",
        variant: "destructive"
      });
      return;
    }

    const taskDueDate = new Date(task.dueDate);
    const endTime = new Date(taskDueDate.getTime() + (task.estimatedTimeMinutes * 60 * 1000));

    createEventMutation.mutate({
      title: `Task: ${task.title}`,
      description: task.description || `Complete task: ${task.title}`,
      startTime: taskDueDate.toISOString(),
      endTime: endTime.toISOString(),
      location: '',
      isAllDay: false,
      calendarId: 'personal',
      metadata: {
        linkedTaskId: task.taskId,
        isTaskEvent: true
      }
    });
  };

  // Toggle calendar visibility
  const toggleCalendarVisibility = (calendarId: string) => {
    // Since subCalendars is now from a query, we'll implement backend visibility toggle
    // For now, this will trigger a refetch to simulate the toggle
    refetchCalendars();
  };

  // Filter events by visible calendars
  const visibleEvents = events.filter((event: any) => {
    const calendar = subCalendars?.find((cal: any) => 
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">My calendars</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateCalendarOpen(true)}
                  className="h-6 w-6 p-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {subCalendars?.map((calendar) => {
                  const calendarEventCount = events.filter((event: any) => 
                    event.calendarId === calendar.id || event.provider === calendar.provider
                  ).length;
                  
                  return (
                    <div key={calendar.id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-gray-50 cursor-pointer group transition-colors" onClick={() => toggleCalendarVisibility(calendar.id)}>
                      <div className="relative">
                        {calendar.visible ? (
                          <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center", calendar.color)}>
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded border-2 border-gray-300 bg-white"></div>
                        )}
                      </div>
                      <div className={cn("w-3 h-3 rounded", calendar.color)}></div>
                      <span className={cn("text-sm flex-1 select-none transition-colors", 
                        calendar.visible ? "text-gray-900" : "text-gray-400"
                      )}>
                        {calendar.name}
                      </span>
                      {calendarEventCount > 0 && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                          {calendarEventCount}
                        </span>
                      )}
                      <div className="relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCalendarForMenu(selectedCalendarForMenu === calendar.id ? null : calendar.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                        </button>
                        {selectedCalendarForMenu === calendar.id && (
                          <div className="absolute right-0 top-6 bg-white border rounded-md shadow-lg z-50 min-w-[120px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCalendarForMenu(null);
                                // Edit calendar functionality would go here
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </button>
                            {calendar.provider === 'google_calendar' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCalendarForMenu(null);
                                  deleteCalendarMutation.mutate(calendar.id);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                            className={cn(
                              "text-xs px-2 py-1 rounded truncate flex items-center gap-1",
                              event.isTask 
                                ? "bg-blue-100 text-blue-800 border border-blue-200" 
                                : `text-white ${event.color}`
                            )}
                          >
                            {event.isTask && (
                              <div className="w-3 h-3 rounded-full border-2 border-blue-600 bg-white flex-shrink-0"></div>
                            )}
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
                                            "text-xs px-2 py-1 rounded-sm cursor-pointer mb-1 truncate flex items-center gap-1",
                                            event.isTask 
                                              ? "bg-blue-100 text-blue-800 border border-blue-200" 
                                              : `text-white ${event.color}`,
                                            snapshot.isDragging && "opacity-50"
                                          )}
                                          style={provided.draggableProps.style}
                                        >
                                          {event.isTask && (
                                            <div className="w-3 h-3 rounded-full border-2 border-blue-600 bg-white flex-shrink-0"></div>
                                          )}
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

        {/* Create Event Dialog - Google Calendar Style */}
        <Dialog open={isCreateEventOpen} onOpenChange={setIsCreateEventOpen}>
          <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto p-0" aria-describedby="event-dialog-description">
            <DialogTitle className="sr-only">Crear nuevo evento</DialogTitle>
            <div id="event-dialog-description" className="sr-only">
              Formulario para crear un nuevo evento en el calendario con opciones de repetición, invitados y configuración avanzada
            </div>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex-1">
                <Input
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Añade un título"
                  className="text-2xl font-normal border-0 border-b-2 border-blue-500 rounded-none px-0 focus:ring-0 focus:border-blue-600"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsCreateEventOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Tab Navigation */}
            <div className="flex px-6 pt-4">
              <button
                onClick={() => setActiveTab('event')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-lg",
                  activeTab === 'event' ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900"
                )}
              >
                Evento
              </button>
              <button
                onClick={() => setActiveTab('task')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-lg ml-2",
                  activeTab === 'task' ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900"
                )}
              >
                Tarea
              </button>
              <button
                onClick={() => setActiveTab('appointment')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-lg ml-2",
                  activeTab === 'appointment' ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:text-gray-900"
                )}
              >
                Agenda de citas
              </button>
            </div>

            {/* Form Content */}
            <div className="px-6 pb-6 space-y-4">
              {activeTab === 'event' && (
                <>
                  {/* Date and Time */}
                  <div className="flex items-start space-x-4">
                    <Clock className="h-5 w-5 text-gray-500 mt-2" />
                    <div className="flex-1 space-y-3">
                      {/* Date Selection */}
                      <div className="flex items-center space-x-4">
                    <Input
                      type="date"
                      value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value + 'T00:00:00');
                        setSelectedDate(newDate);
                      }}
                      className="bg-gray-100 border-0 rounded-lg px-4 py-2 text-gray-700"
                    />
                  </div>
                  
                  {/* Time Selection */}
                  {!newEvent.isAllDay && (
                    <div className="flex items-center space-x-2">
                      <TimeDropdown
                        value={newEvent.startTime}
                        onChange={(time: string) => setNewEvent({ ...newEvent, startTime: time })}
                        className="bg-blue-50 border border-blue-200 text-blue-700"
                      />
                      <span className="text-gray-500">–</span>
                      <TimeDropdown
                        value={newEvent.endTime}
                        onChange={(time: string) => setNewEvent({ ...newEvent, endTime: time })}
                        className="bg-gray-100 border border-gray-300 text-gray-700"
                      />
                    </div>
                  )}
                  
                  {/* All Day Checkbox */}
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="allDay"
                      checked={newEvent.isAllDay}
                      onChange={(e) => setNewEvent({ ...newEvent, isAllDay: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="allDay" className="text-gray-700">Todo el día</label>
                    <span className="text-blue-600 text-sm cursor-pointer hover:underline">Zo</span>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span>Zona horaria</span>
                    <span>•</span>
                    <div className="relative" ref={repeatDropdownRef}>
                      <button
                        onClick={() => setShowRepeatDropdown(!showRepeatDropdown)}
                        className="flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        <span>{getRepeatLabel(repeatOption)}</span>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {showRepeatDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[250px]">
                          <div className="py-2">
                            {repeatOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  if (option.value === 'custom') {
                                    setShowCustomRecurrence(true);
                                    setShowRepeatDropdown(false);
                                  } else {
                                    setRepeatOption(option.value);
                                    setShowRepeatDropdown(false);
                                  }
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                              >
                                {option.icon && <span className="text-gray-400">{option.icon}</span>}
                                <span className="text-gray-700">{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Guests */}
              <div className="flex items-start space-x-4 py-3 hover:bg-gray-50 rounded cursor-pointer">
                <Users className="h-5 w-5 text-gray-500 mt-1" />
                <div className="flex-1">
                  <div className="text-gray-700">Añadir invitados</div>
                  {newEvent.guests.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newEvent.guests.map((guest, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {guest}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => setNewEvent({
                              ...newEvent,
                              guests: newEvent.guests.filter((_, i) => i !== index)
                            })}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex mt-2">
                    <Input
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="Añadir correos electrónicos"
                      className="border-0 border-b border-gray-300 rounded-none focus:ring-0 focus:border-blue-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && guestEmail.trim()) {
                          setNewEvent({
                            ...newEvent,
                            guests: [...newEvent.guests, guestEmail.trim()]
                          });
                          setGuestEmail('');
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Add Google Meet */}
              <div className="flex items-center space-x-4 py-3 hover:bg-gray-50 rounded cursor-pointer">
                <Video className="h-5 w-5 text-gray-500" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Añadir videollamada de Google Meet</span>
                    <Checkbox
                      checked={newEvent.hasGoogleMeet}
                      onCheckedChange={(checked) => setNewEvent({
                        ...newEvent,
                        hasGoogleMeet: checked as boolean,
                        meetLink: checked ? 'https://meet.google.com/new' : ''
                      })}
                    />
                  </div>
                  {newEvent.hasGoogleMeet && (
                    <div className="text-sm text-blue-600 mt-1">
                      {newEvent.meetLink}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Location */}
              <div className="flex items-center space-x-4 py-3 hover:bg-gray-50 rounded">
                <MapPin className="h-5 w-5 text-gray-500" />
                <div className="flex-1">
                  <Input
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    placeholder="Añadir ubicación"
                    className="border-0 border-b border-gray-300 rounded-none focus:ring-0 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Add Description */}
              <div className="flex items-start space-x-4 py-3 hover:bg-gray-50 rounded">
                <div className="h-5 w-5 border-2 border-gray-400 mt-1"></div>
                <div className="flex-1">
                  <Textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Añadir descripción o un archivo adjunto de Google Drive"
                    className="border-0 border-b border-gray-300 rounded-none focus:ring-0 focus:border-blue-500 min-h-[60px]"
                  />
                </div>
              </div>

              {/* Calendar Selection */}
              <div className="flex items-center space-x-4 py-3">
                <CalendarIcon className="h-5 w-5 text-gray-500" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <select
                      value={newEvent.calendarId}
                      onChange={(e) => setNewEvent({ ...newEvent, calendarId: e.target.value })}
                      className="bg-transparent border-0 focus:ring-0 text-gray-700"
                    >
                      {subCalendars.map((calendar) => (
                        <option key={calendar.id} value={calendar.id}>
                          {calendar.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <div className="relative" ref={availabilityDropdownRef}>
                      <button
                        onClick={() => setShowAvailabilityDropdown(!showAvailabilityDropdown)}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                      >
                        <span>{newEvent.availability === 'busy' ? 'No disponible' : 'Disponible'}</span>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {showAvailabilityDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px]">
                          <div className="py-2">
                            <button
                              onClick={() => {
                                setNewEvent({ ...newEvent, availability: 'busy' });
                                setShowAvailabilityDropdown(false);
                              }}
                              className={cn(
                                "w-full px-4 py-2 text-left hover:bg-gray-50 text-sm",
                                newEvent.availability === 'busy' && "bg-blue-50 text-blue-700"
                              )}
                            >
                              No disponible
                            </button>
                            <button
                              onClick={() => {
                                setNewEvent({ ...newEvent, availability: 'free' });
                                setShowAvailabilityDropdown(false);
                              }}
                              className={cn(
                                "w-full px-4 py-2 text-left hover:bg-gray-50 text-sm",
                                newEvent.availability === 'free' && "bg-blue-50 text-blue-700"
                              )}
                            >
                              Disponible
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <span>•</span>
                    <span>Visibilidad predeterminada</span>
                    <span>•</span>
                    <span>Notificar 10 minutos antes</span>
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div className="flex items-start space-x-4 py-3">
                <Bell className="h-5 w-5 text-gray-500 mt-1" />
                <div className="flex-1">
                  <div className="text-gray-700">Notificaciones</div>
                  <div className="space-y-2 mt-2">
                    {newEvent.notifications.map((notification, index) => {
                      const formatNotification = (minutes: number) => {
                        if (minutes < 60) return `${minutes} minutos antes`;
                        if (minutes < 1440) return `${minutes / 60} hora${minutes / 60 > 1 ? 's' : ''} antes`;
                        if (minutes < 10080) return `${minutes / 1440} día${minutes / 1440 > 1 ? 's' : ''} antes`;
                        return `${minutes / 10080} semana${minutes / 10080 > 1 ? 's' : ''} antes`;
                      };
                      
                      return (
                        <div key={index} className="flex items-center gap-2">
                          <div className="bg-gray-100 rounded-lg px-3 py-2 flex items-center gap-2 min-w-[160px]">
                            <span className="text-sm text-gray-700">{formatNotification(notification)}</span>
                            <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                          {newEvent.notifications.length > 1 && (
                            <button
                              onClick={() => {
                                const updatedNotifications = newEvent.notifications.filter((_, i) => i !== index);
                                setNewEvent({ ...newEvent, notifications: updatedNotifications });
                              }}
                              className="text-gray-400 hover:text-red-500 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button
                      onClick={() => setShowNotificationsModal(true)}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Añadir una notificación
                    </button>
                  </div>
                </div>
              </div>
                </>
              )}

              {activeTab === 'task' && (
                <>
                  {/* Task Date and Time */}
                  <div className="flex items-start space-x-4">
                    <Clock className="h-5 w-5 text-gray-500 mt-2" />
                    <div className="flex-1 space-y-3">
                      {/* Due Date Selection */}
                      <div className="flex items-center space-x-4">
                        <Input
                          type="date"
                          value={newTask.dueDate}
                          onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                          className="bg-gray-100 border-0 rounded-lg px-4 py-2 text-gray-700"
                        />
                        <span className="text-gray-500">No se repite</span>
                      </div>
                      
                      {/* Due Time Selection */}
                      <div className="flex items-center space-x-2">
                        <TimeDropdown
                          value={newTask.dueTime}
                          onChange={(time: string) => setNewTask({ ...newTask, dueTime: time })}
                          className="bg-blue-50 border border-blue-200 text-blue-700"
                        />
                        <span className="text-gray-500">Fecha límite</span>
                      </div>
                    </div>
                  </div>

                  {/* Estimated Time */}
                  <div className="flex items-center space-x-4 py-3">
                    <div className="h-5 w-5 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-700">Tiempo estimado:</span>
                        <select
                          value={newTask.estimatedTime}
                          onChange={(e) => setNewTask({ ...newTask, estimatedTime: parseInt(e.target.value) })}
                          className="bg-gray-100 border-0 rounded-lg px-3 py-1 text-gray-700"
                        >
                          {Array.from({ length: 24 }, (_, i) => (i + 1) * 15).map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60 > 0 ? `${minutes % 60}m` : ''}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center space-x-4 py-3">
                    <div className="h-5 w-5 flex items-center justify-center">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        newTask.priority === 'high' && "bg-red-500",
                        newTask.priority === 'medium' && "bg-yellow-500", 
                        newTask.priority === 'low' && "bg-green-500"
                      )}></div>
                    </div>
                    <div className="flex-1">
                      <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                        className="bg-transparent border-0 focus:ring-0 text-gray-700"
                      >
                        <option value="low">Prioridad baja</option>
                        <option value="medium">Prioridad media</option>
                        <option value="high">Prioridad alta</option>
                      </select>
                    </div>
                  </div>

                  {/* Task Description */}
                  <div className="flex items-start space-x-4 py-3">
                    <div className="h-5 w-5 border-2 border-gray-400 mt-1"></div>
                    <div className="flex-1">
                      <Textarea
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        placeholder="Añadir una descripción"
                        className="border-0 border-b border-gray-300 rounded-none focus:ring-0 focus:border-blue-500 min-h-[60px]"
                      />
                    </div>
                  </div>

                  {/* Task List Selection */}
                  <div className="flex items-center space-x-4 py-3">
                    <div className="h-5 w-5 flex items-center justify-center">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    </div>
                    <div className="flex-1">
                      <select
                        value={newTask.taskList}
                        onChange={(e) => setNewTask({ ...newTask, taskList: e.target.value })}
                        className="bg-transparent border-0 focus:ring-0 text-gray-700"
                      >
                        <option value="My Tasks">My Tasks</option>
                        <option value="Personal">Personal</option>
                        <option value="Work">Work</option>
                      </select>
                    </div>
                  </div>

                  {/* Create Calendar Event Option */}
                  {newTask.dueDate && (
                    <div className="flex items-center space-x-4 py-3 border-t border-gray-200">
                      <CalendarIcon className="h-5 w-5 text-gray-500" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">Crear evento en calendario</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (newTask.dueDate && newTask.title) {
                                const taskDueDate = new Date(newTask.dueDate);
                                if (newTask.dueTime) {
                                  const [hours, minutes] = newTask.dueTime.split(':');
                                  taskDueDate.setHours(parseInt(hours), parseInt(minutes));
                                }
                                const endTime = new Date(taskDueDate.getTime() + (newTask.estimatedTime * 60 * 1000));

                                createEventMutation.mutate({
                                  title: `Tarea: ${newTask.title}`,
                                  description: newTask.description || `Completar tarea: ${newTask.title}`,
                                  startTime: taskDueDate.toISOString(),
                                  endTime: endTime.toISOString(),
                                  location: '',
                                  isAllDay: false,
                                  calendarId: 'personal',
                                  metadata: {
                                    isTaskEvent: true,
                                    estimatedTime: newTask.estimatedTime,
                                    priority: newTask.priority
                                  }
                                });
                              }
                            }}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <CalendarIcon className="h-4 w-4 mr-1" />
                            Programar
                          </Button>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          Se creará un evento de {newTask.estimatedTime < 60 ? `${newTask.estimatedTime} min` : `${Math.floor(newTask.estimatedTime / 60)}h ${newTask.estimatedTime % 60 > 0 ? `${newTask.estimatedTime % 60}m` : ''}`} en tu calendario
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
              <Button variant="outline" className="text-blue-600">
                Más opciones
              </Button>
              <Button 
                onClick={activeTab === 'event' ? handleCreateEvent : handleCreateTask}
                disabled={activeTab === 'event' ? createEventMutation.isPending : createTaskMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {(activeTab === 'event' ? createEventMutation.isPending : createTaskMutation.isPending) ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Custom Recurrence Modal */}
        <Dialog open={showCustomRecurrence} onOpenChange={setShowCustomRecurrence}>
          <DialogContent className="sm:max-w-[500px]" aria-describedby="custom-recurrence-description">
            <DialogTitle className="text-xl font-medium text-gray-900 mb-6">
              Periodicidad personalizada
            </DialogTitle>
            <div id="custom-recurrence-description" className="sr-only">
              Configure la repetición personalizada del evento
            </div>
            
            <div className="space-y-6">
              {/* Frequency Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-gray-700">Repetir cada</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCustomRecurrence(prev => ({ ...prev, interval: Math.max(1, prev.interval - 1) }))}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
                    >
                      ▼
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={customRecurrence.interval}
                      onChange={(e) => setCustomRecurrence(prev => ({ ...prev, interval: parseInt(e.target.value) || 1 }))}
                      className="w-16 px-2 py-1 text-center border border-gray-300 rounded bg-gray-100"
                    />
                    <button
                      onClick={() => setCustomRecurrence(prev => ({ ...prev, interval: prev.interval + 1 }))}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
                    >
                      ▲
                    </button>
                  </div>
                  <select
                    value={customRecurrence.frequency}
                    onChange={(e) => setCustomRecurrence(prev => ({ ...prev, frequency: e.target.value }))}
                    className="px-3 py-1 border border-gray-300 rounded bg-white"
                  >
                    <option value="daily">día</option>
                    <option value="weekly">semana</option>
                    <option value="monthly">mes</option>
                    <option value="yearly">año</option>
                  </select>
                  <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded">
                    ▼
                  </button>
                </div>
              </div>

              {/* Days of Week Section */}
              {customRecurrence.frequency === 'weekly' && (
                <div>
                  <div className="text-gray-700 mb-3">Se repite el</div>
                  <div className="flex gap-2">
                    {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, index) => {
                      const isSelected = customRecurrence.daysOfWeek.includes(day);
                      return (
                        <button
                          key={day}
                          onClick={() => {
                            const newDays = isSelected
                              ? customRecurrence.daysOfWeek.filter(d => d !== day)
                              : [...customRecurrence.daysOfWeek, day];
                            setCustomRecurrence(prev => ({ ...prev, daysOfWeek: newDays }));
                          }}
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* End Date Section */}
              <div>
                <div className="text-gray-700 mb-3">Termina</div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="endType"
                      value="never"
                      checked={customRecurrence.endType === 'never'}
                      onChange={(e) => setCustomRecurrence(prev => ({ ...prev, endType: e.target.value }))}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700">Nunca</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="endType"
                      value="date"
                      checked={customRecurrence.endType === 'date'}
                      onChange={(e) => setCustomRecurrence(prev => ({ ...prev, endType: e.target.value }))}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700">El</span>
                    <input
                      type="date"
                      value={customRecurrence.endDate}
                      onChange={(e) => setCustomRecurrence(prev => ({ ...prev, endDate: e.target.value }))}
                      className="px-3 py-1 border border-gray-300 rounded bg-gray-100 text-gray-500"
                      placeholder="18 de sept de 2025"
                    />
                    <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded">
                      ▲
                    </button>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="endType"
                      value="after"
                      checked={customRecurrence.endType === 'after'}
                      onChange={(e) => setCustomRecurrence(prev => ({ ...prev, endType: e.target.value }))}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700">Después de</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCustomRecurrence(prev => ({ ...prev, repetitions: Math.max(1, prev.repetitions - 1) }))}
                        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
                      >
                        ▼
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={customRecurrence.repetitions}
                        onChange={(e) => setCustomRecurrence(prev => ({ ...prev, repetitions: parseInt(e.target.value) || 1 }))}
                        className="w-16 px-2 py-1 text-center border border-gray-300 rounded bg-gray-100"
                      />
                      <button
                        onClick={() => setCustomRecurrence(prev => ({ ...prev, repetitions: prev.repetitions + 1 }))}
                        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
                      >
                        ▲
                      </button>
                    </div>
                    <span className="text-gray-700">repeticiones</span>
                    <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded">
                      ▼
                    </button>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-8">
              <Button
                variant="ghost"
                onClick={() => setShowCustomRecurrence(false)}
                className="text-blue-600 hover:bg-blue-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setRepeatOption('custom');
                  setShowCustomRecurrence(false);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              >
                Hecho
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Notifications Modal */}
        {showNotificationsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <div></div>
                  <button
                    onClick={() => setShowNotificationsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Predefined notification options */}
                  {[5, 10, 15, 30].map((minutes) => (
                    <button
                      key={minutes}
                      onClick={() => {
                        if (!newEvent.notifications.includes(minutes)) {
                          setNewEvent({ 
                            ...newEvent, 
                            notifications: [...newEvent.notifications, minutes].sort((a, b) => a - b)
                          });
                        }
                        setShowNotificationsModal(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b border-gray-100"
                    >
                      {minutes} minutos antes
                    </button>
                  ))}
                  
                  <button
                    onClick={() => {
                      if (!newEvent.notifications.includes(60)) {
                        setNewEvent({ 
                          ...newEvent, 
                          notifications: [...newEvent.notifications, 60].sort((a, b) => a - b)
                        });
                      }
                      setShowNotificationsModal(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b border-gray-100"
                  >
                    1 hora antes
                  </button>
                  
                  <button
                    onClick={() => {
                      if (!newEvent.notifications.includes(1440)) {
                        setNewEvent({ 
                          ...newEvent, 
                          notifications: [...newEvent.notifications, 1440].sort((a, b) => a - b)
                        });
                      }
                      setShowNotificationsModal(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b border-gray-100"
                  >
                    1 día antes
                  </button>

                  <button
                    onClick={() => {
                      setShowNotificationsModal(false);
                      setShowCustomNotification(true);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm"
                  >
                    Personalizar...
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t">
                  <button
                    onClick={() => setShowNotificationsModal(false)}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Añadir una notificación
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Notification Modal */}
        {showCustomNotification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-4">Notificación personalizada</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <select
                      value={customNotification.type}
                      onChange={(e) => setCustomNotification({ ...customNotification, type: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="notification">Notificación</option>
                    </select>
                    
                    <input
                      type="number"
                      value={customNotification.value}
                      onChange={(e) => setCustomNotification({ ...customNotification, value: parseInt(e.target.value) || 0 })}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-20 text-center"
                      min="1"
                    />
                    
                    <div className="relative">
                      <select
                        value={customNotification.unit}
                        onChange={(e) => setCustomNotification({ ...customNotification, unit: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm appearance-none bg-white pr-8"
                      >
                        <option value="minutos">minutos</option>
                        <option value="horas">horas</option>
                        <option value="días">días</option>
                        <option value="semanas">semanas</option>
                      </select>
                      <svg className="w-3 h-3 absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCustomNotification(false)}
                    className="text-blue-600 px-4 py-2 text-sm hover:underline"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      let minutes = customNotification.value;
                      if (customNotification.unit === 'horas') minutes *= 60;
                      else if (customNotification.unit === 'días') minutes *= 1440;
                      else if (customNotification.unit === 'semanas') minutes *= 10080;
                      
                      if (!newEvent.notifications.includes(minutes)) {
                        setNewEvent({ 
                          ...newEvent, 
                          notifications: [...newEvent.notifications, minutes].sort((a, b) => a - b)
                        });
                      }
                      setShowCustomNotification(false);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DragDropContext>
  );
}