import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckSquare, Calendar, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  created_at: string;
}

interface CalendarEvent {
  event_id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  is_all_day: boolean;
  location?: string;
  meet_link?: string;
}

interface ContactTasksAndEventsProps {
  contactJid: string;
  contactName: string;
  instanceId?: string;
}

export function ContactTasksAndEvents({ contactJid, contactName, instanceId }: ContactTasksAndEventsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  const fetchContactTasks = async () => {
    if (tasksLoaded) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/contacts/tasks?contactJid=${encodeURIComponent(contactJid)}&userId=7804247f-3ae8-4eb2-8c6d-2c44f967ad42`);
      if (response.ok) {
        const contactTasks = await response.json();
        setTasks(contactTasks);
      }
      setTasksLoaded(true);
    } catch (error) {
      console.error('Error fetching contact tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContactEvents = async () => {
    if (eventsLoaded) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/contacts/events?contactJid=${encodeURIComponent(contactJid)}&userId=7804247f-3ae8-4eb2-8c6d-2c44f967ad42`);
      if (response.ok) {
        const contactEvents = await response.json();
        setUpcomingEvents(contactEvents);
      }
      setEventsLoaded(true);
    } catch (error) {
      console.error('Error fetching contact events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && (!tasksLoaded || !eventsLoaded)) {
      fetchContactTasks();
      fetchContactEvents();
    }
  }, [isOpen, tasksLoaded, eventsLoaded]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: dateString.includes('T') ? '2-digit' : undefined,
      minute: dateString.includes('T') ? '2-digit' : undefined,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-600 dark:text-red-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'low':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400" />;
      default:
        return <CheckSquare className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto font-medium text-left"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              <span>Tasks & Events</span>
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            {/* Tasks Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckSquare className="h-5 w-5" />
                <h3 className="font-semibold text-base">Tasks for {contactName}</h3>
              </div>
              
              {loading && !tasksLoaded ? (
                <div className="text-gray-500 dark:text-gray-400">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">No tasks found for this contact</div>
              ) : (
                <div className="space-y-2">
                  {tasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      {getStatusIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                            {task.description}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className={`font-medium ${getPriorityColor(task.priority)}`}>
                            {task.priority?.toUpperCase()}
                          </span>
                          {task.due_date && (
                            <span className="text-gray-500 dark:text-gray-400">
                              Due: {formatDate(task.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Events Section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5" />
                <h3 className="font-semibold text-base">Upcoming Events</h3>
              </div>
              
              {loading && !eventsLoaded ? (
                <div className="text-gray-500 dark:text-gray-400">Loading events...</div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">No upcoming events</div>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.event_id}
                      className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                    >
                      <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{event.title}</div>
                        {event.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                            {event.description}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>
                            {event.is_all_day 
                              ? formatDate(event.start_time).split(',')[0] 
                              : formatDate(event.start_time)
                            }
                          </span>
                          {event.location && (
                            <span className="truncate">📍 {event.location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* View All Tasks Button */}
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => {
                // Navigate to tasks page with contact filter
                window.location.href = `/tasks?contact=${encodeURIComponent(contactJid)}`;
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              View All Tasks for Contact
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}