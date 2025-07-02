import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, ChevronLeft, ChevronRight, Plus, Settings, Video, Bell, Users, Trash2, Edit, Clock, MapPin } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, isSameDay, parseISO, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location?: string;
  calendarId: number;
  attendees?: string[];
  meetLink?: string;
  reminders?: number[];
  recurrence?: string;
  color?: string;
}

interface CalendarCalendar {
  id: number;
  name: string;
  color: string;
  visible: boolean;
  userId: string;
  isDefault: boolean;
}

type ViewMode = 'month' | 'week' | 'day';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingCalendar, setEditingCalendar] = useState<CalendarCalendar | null>(null);
  const queryClient = useQueryClient();

  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  // Form states
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    allDay: false,
    location: '',
    calendarId: 0,
    attendees: [] as string[],
    meetLink: '',
    reminders: [15] as number[],
    recurrence: 'none'
  });

  const [calendarForm, setCalendarForm] = useState({
    name: '',
    color: '#3B82F6',
    visible: true
  });

  // Fetch calendars
  const { data: calendars = [] } = useQuery<CalendarCalendar[]>({
    queryKey: [`/api/calendar/calendars`],
    refetchInterval: 30000,
  });

  // Fetch events
  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: [`/api/calendar/events`],
    refetchInterval: 15000,
  });

  // Fetch calendar providers (Google Calendar sub-calendars)
  const { data: calendarProviders = [] } = useQuery({
    queryKey: [`/api/calendar/providers`],
    refetchInterval: 30000,
  });

  // Create/update event mutation
  const eventMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingEvent) {
        return apiRequest(`/api/calendar/events/${editingEvent.id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      } else {
        return apiRequest('/api/calendar/events', {
          method: 'POST',
          body: JSON.stringify({ ...data, userId })
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/calendar/events`] });
      setShowEventDialog(false);
      resetEventForm();
    }
  });

  // Create/update calendar mutation
  const calendarMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCalendar) {
        return apiRequest(`/api/calendar/calendars/${editingCalendar.id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      } else {
        return apiRequest('/api/calendar/calendars', {
          method: 'POST',
          body: JSON.stringify({ ...data, userId })
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/calendar/calendars`] });
      setShowCalendarDialog(false);
      resetCalendarForm();
    }
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest(`/api/calendar/events/${eventId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/calendar/events`] });
    }
  });

  // Delete calendar mutation
  const deleteCalendarMutation = useMutation({
    mutationFn: async (calendarId: number) => {
      return apiRequest(`/api/calendar/calendars/${calendarId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/calendar/calendars`] });
      queryClient.invalidateQueries({ queryKey: [`/api/calendar/events`] });
    }
  });

  const resetEventForm = () => {
    setEventForm({
      title: '',
      description: '',
      startTime: '',
      endTime: '',
      allDay: false,
      location: '',
      calendarId: calendars.find(c => c.isDefault)?.id || calendars[0]?.id || 0,
      attendees: [],
      meetLink: '',
      reminders: [15],
      recurrence: 'none'
    });
    setEditingEvent(null);
  };

  const resetCalendarForm = () => {
    setCalendarForm({
      name: '',
      color: '#3B82F6',
      visible: true
    });
    setEditingCalendar(null);
  };

  // Navigation functions
  const goToPreviousPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const goToNextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get visible calendars
  const visibleCalendars = calendars.filter(cal => cal.visible);
  const visibleCalendarIds = visibleCalendars.map(cal => cal.id);

  // Filter events by visible calendars
  const visibleEvents = events.filter(event => visibleCalendarIds.includes(event.calendarId));

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return visibleEvents.filter(event => {
      const eventStart = parseISO(event.startTime);
      return isSameDay(eventStart, date);
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  // Calendar rendering logic
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="grid grid-cols-7 gap-1 h-full">
        {/* Weekday headers */}
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
          <div key={day} className="p-2 text-center font-medium text-gray-500 text-sm">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map((day) => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);
          
          return (
            <div
              key={day.toISOString()}
              className={`border border-gray-200 dark:border-gray-700 min-h-[120px] p-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                !isCurrentMonth ? 'text-gray-400 bg-gray-50 dark:bg-gray-800' : ''
              } ${isTodayDate ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
              onClick={() => {
                setSelectedDate(day);
                setEventForm({
                  ...eventForm,
                  startTime: format(day, "yyyy-MM-dd'T'HH:mm"),
                  endTime: format(addDays(day, 0), "yyyy-MM-dd'T'HH:mm")
                });
                setShowEventDialog(true);
              }}
            >
              <div className={`text-sm font-medium ${isTodayDate ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                {format(day, 'd')}
              </div>
              
              {/* Events for this day */}
              <div className="space-y-1 mt-1">
                {dayEvents.slice(0, 3).map((event) => {
                  const calendar = calendars.find(cal => cal.id === event.calendarId);
                  return (
                    <div
                      key={event.id}
                      className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: calendar?.color || '#3B82F6', color: 'white' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingEvent(event);
                        setEventForm({
                          title: event.title,
                          description: event.description || '',
                          startTime: event.startTime,
                          endTime: event.endTime,
                          allDay: event.allDay,
                          location: event.location || '',
                          calendarId: event.calendarId,
                          attendees: event.attendees || [],
                          meetLink: event.meetLink || '',
                          reminders: event.reminders || [15],
                          recurrence: event.recurrence || 'none'
                        });
                        setShowEventDialog(true);
                      }}
                    >
                      {event.allDay ? event.title : `${format(parseISO(event.startTime), 'HH:mm')} ${event.title}`}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{dayEvents.length - 3} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleEventSubmit = () => {
    if (!eventForm.title.trim()) return;
    
    const eventData = {
      ...eventForm,
      calendarId: eventForm.calendarId || calendars.find(c => c.isDefault)?.id || calendars[0]?.id
    };
    
    eventMutation.mutate(eventData);
  };

  const handleCalendarSubmit = () => {
    if (!calendarForm.name.trim()) return;
    calendarMutation.mutate(calendarForm);
  };

  const handleEventDelete = () => {
    if (editingEvent) {
      deleteEventMutation.mutate(editingEvent.id);
      setShowEventDialog(false);
      resetEventForm();
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 p-4">
        <div className="space-y-4">
          <Button 
            onClick={() => setShowEventDialog(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear evento
          </Button>

          {/* Mini calendar */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{format(currentDate, 'MMMM yyyy', { locale: es })}</h3>
              <div className="flex space-x-1">
                <Button variant="ghost" size="sm" onClick={goToPreviousPeriod}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={goToNextPeriod}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Mini calendar grid would go here */}
          </div>

          {/* My calendars */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Mis calendarios</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowCalendarDialog(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-1">
              {calendars.map((calendar) => (
                <div key={calendar.id} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Switch
                    checked={calendar.visible}
                    onCheckedChange={(checked) => {
                      calendarMutation.mutate({
                        ...calendar,
                        visible: checked
                      });
                    }}
                  />
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: calendar.color }}
                  />
                  <span className="text-sm flex-1">{calendar.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingCalendar(calendar);
                      setCalendarForm({
                        name: calendar.name,
                        color: calendar.color,
                        visible: calendar.visible
                      });
                      setShowCalendarDialog(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main calendar area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">
                {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : 'dd MMMM yyyy', { locale: es })}
              </h1>
              <Button variant="outline" onClick={goToToday}>
                Hoy
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                >
                  Mes
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                >
                  Semana
                </Button>
                <Button
                  variant={viewMode === 'day' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('day')}
                >
                  Día
                </Button>
              </div>
              
              <Button variant="ghost" onClick={goToPreviousPeriod}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={goToNextPeriod}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar content */}
        <div className="flex-1 p-4">
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && <div className="text-center text-gray-500">Vista semanal - en desarrollo</div>}
          {viewMode === 'day' && <div className="text-center text-gray-500">Vista diaria - en desarrollo</div>}
        </div>
      </div>

      {/* Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Editar evento' : 'Crear nuevo evento'}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="details" className="space-y-4">
            <TabsList>
              <TabsTrigger value="details">Detalles</TabsTrigger>
              <TabsTrigger value="guests">Invitados</TabsTrigger>
              <TabsTrigger value="recurrence">Repetición</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-4">
              <div>
                <Label htmlFor="title">Título del evento</Label>
                <Input
                  id="title"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                  placeholder="Añadir título"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Fecha y hora de inicio</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={eventForm.startTime}
                    onChange={(e) => setEventForm({...eventForm, startTime: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">Fecha y hora de fin</Label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    value={eventForm.endTime}
                    onChange={(e) => setEventForm({...eventForm, endTime: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={eventForm.allDay}
                  onCheckedChange={(checked) => setEventForm({...eventForm, allDay: checked})}
                />
                <Label>Todo el día</Label>
              </div>
              
              <div>
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                  placeholder="Añadir ubicación"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={eventForm.description}
                  onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                  placeholder="Añadir descripción"
                />
              </div>
              
              <div>
                <Label htmlFor="calendar">Calendario</Label>
                <Select
                  value={eventForm.calendarId.toString()}
                  onValueChange={(value) => setEventForm({...eventForm, calendarId: parseInt(value)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {calendars.map((calendar) => (
                      <SelectItem key={calendar.id} value={calendar.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: calendar.color }}
                          />
                          <span>{calendar.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="meetLink">Enlace de Google Meet</Label>
                <Input
                  id="meetLink"
                  value={eventForm.meetLink}
                  onChange={(e) => setEventForm({...eventForm, meetLink: e.target.value})}
                  placeholder="https://meet.google.com/..."
                />
              </div>
            </TabsContent>
            
            <TabsContent value="guests" className="space-y-4">
              <div>
                <Label>Invitados</Label>
                <Input
                  placeholder="Añadir correos electrónicos separados por comas"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = e.currentTarget.value.trim();
                      if (value) {
                        setEventForm({
                          ...eventForm,
                          attendees: [...eventForm.attendees, value]
                        });
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
                <div className="mt-2 space-y-1">
                  {eventForm.attendees.map((attendee, index) => (
                    <Badge key={index} variant="secondary" className="mr-2">
                      {attendee}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-2"
                        onClick={() => {
                          setEventForm({
                            ...eventForm,
                            attendees: eventForm.attendees.filter((_, i) => i !== index)
                          });
                        }}
                      >
                        ×
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="recurrence" className="space-y-4">
              <div>
                <Label htmlFor="recurrence">Repetir</Label>
                <Select
                  value={eventForm.recurrence}
                  onValueChange={(value) => setEventForm({...eventForm, recurrence: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No repetir</SelectItem>
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Semanalmente</SelectItem>
                    <SelectItem value="monthly">Mensualmente</SelectItem>
                    <SelectItem value="yearly">Anualmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Recordatorios</Label>
                <div className="space-y-2">
                  {eventForm.reminders.map((reminder, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Select
                        value={reminder.toString()}
                        onValueChange={(value) => {
                          const newReminders = [...eventForm.reminders];
                          newReminders[index] = parseInt(value);
                          setEventForm({...eventForm, reminders: newReminders});
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">En el momento del evento</SelectItem>
                          <SelectItem value="5">5 minutos antes</SelectItem>
                          <SelectItem value="15">15 minutos antes</SelectItem>
                          <SelectItem value="30">30 minutos antes</SelectItem>
                          <SelectItem value="60">1 hora antes</SelectItem>
                          <SelectItem value="1440">1 día antes</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEventForm({
                            ...eventForm,
                            reminders: eventForm.reminders.filter((_, i) => i !== index)
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEventForm({
                        ...eventForm,
                        reminders: [...eventForm.reminders, 15]
                      });
                    }}
                  >
                    Añadir recordatorio
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-between pt-4">
            {editingEvent && (
              <Button variant="destructive" onClick={handleEventDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar evento
              </Button>
            )}
            <div className="flex space-x-2 ml-auto">
              <Button variant="outline" onClick={() => setShowEventDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEventSubmit} disabled={eventMutation.isPending}>
                {editingEvent ? 'Actualizar' : 'Crear'} evento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar Dialog */}
      <Dialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCalendar ? 'Editar calendario' : 'Crear nuevo calendario'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="calendarName">Nombre del calendario</Label>
              <Input
                id="calendarName"
                value={calendarForm.name}
                onChange={(e) => setCalendarForm({...calendarForm, name: e.target.value})}
                placeholder="Nombre del calendario"
              />
            </div>
            
            <div>
              <Label htmlFor="calendarColor">Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="calendarColor"
                  type="color"
                  value={calendarForm.color}
                  onChange={(e) => setCalendarForm({...calendarForm, color: e.target.value})}
                  className="w-16 h-10"
                />
                <span>{calendarForm.color}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={calendarForm.visible}
                onCheckedChange={(checked) => setCalendarForm({...calendarForm, visible: checked})}
              />
              <Label>Visible</Label>
            </div>
          </div>
          
          <div className="flex justify-between pt-4">
            {editingCalendar && !editingCalendar.isDefault && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  deleteCalendarMutation.mutate(editingCalendar.id);
                  setShowCalendarDialog(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar calendario
              </Button>
            )}
            <div className="flex space-x-2 ml-auto">
              <Button variant="outline" onClick={() => setShowCalendarDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCalendarSubmit} disabled={calendarMutation.isPending}>
                {editingCalendar ? 'Actualizar' : 'Crear'} calendario
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}