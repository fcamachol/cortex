import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Activity, Users, MessageSquare, Settings, Clock } from 'lucide-react';

interface RealtimeEvent {
  id: string;
  type: string;
  timestamp: string;
  groupJid: string;
  instanceId: string;
  data: any;
}

interface RealtimeMonitorProps {
  spaceId: string;
}

export function RealtimeMonitor({ spaceId }: RealtimeMonitorProps) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    if (!spaceId) return;

    const eventSource = new EventSource('/api/sse');
    
    eventSource.onopen = () => {
      console.log('SSE connection opened');
      setConnectionStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'group_update') {
          const newEvent: RealtimeEvent = {
            id: `${Date.now()}-${Math.random()}`,
            type: data.data.type,
            timestamp: data.data.timestamp,
            groupJid: data.data.groupJid,
            instanceId: data.data.instanceId,
            data: data.data.data
          };

          setEvents(prev => [newEvent, ...prev.slice(0, 49)]); // Keep last 50 events
        }
      } catch (error) {
        console.error('Error processing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setConnectionStatus('disconnected');
    };

    return () => {
      eventSource.close();
      setConnectionStatus('disconnected');
    };
  }, [spaceId]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'subject_changed':
        return <MessageSquare className="h-4 w-4" />;
      case 'participants_changed':
        return <Users className="h-4 w-4" />;
      case 'description_changed':
        return <MessageSquare className="h-4 w-4" />;
      case 'settings_changed':
        return <Settings className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'subject_changed':
        return 'bg-blue-100 text-blue-800';
      case 'participants_changed':
        return 'bg-green-100 text-green-800';
      case 'description_changed':
        return 'bg-purple-100 text-purple-800';
      case 'settings_changed':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatEventDescription = (event: RealtimeEvent) => {
    switch (event.type) {
      case 'subject_changed':
        return `Group name changed from "${event.data.oldSubject}" to "${event.data.newSubject}"`;
      case 'participants_changed':
        const action = event.data.action;
        const count = event.data.participants.length;
        return `${count} participant(s) ${action === 'add' ? 'added' : action === 'remove' ? 'removed' : action}`;
      case 'description_changed':
        return `Group description updated`;
      case 'settings_changed':
        return `Group settings modified`;
      default:
        return 'Unknown event';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800';
      case 'disconnected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Real-time Group Monitor</h2>
          <p className="text-muted-foreground">Live updates from WhatsApp groups via webhooks</p>
        </div>
        <Badge className={getConnectionStatusColor()}>
          <Activity className="h-3 w-3 mr-1" />
          {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="text-xs text-muted-foreground">Real-time updates received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subject Changes</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events.filter(e => e.type === 'subject_changed').length}
            </div>
            <p className="text-xs text-muted-foreground">Group name updates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participant Changes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {events.filter(e => e.type === 'participants_changed').length}
            </div>
            <p className="text-xs text-muted-foreground">Member updates</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Event Stream</CardTitle>
          <CardDescription>Real-time group updates as they happen</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {events.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No events yet. Make changes to WhatsApp groups to see real-time updates.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event, index) => (
                  <div key={event.id}>
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <Badge className={getEventColor(event.type)}>
                            {event.type.replace('_', ' ')}
                          </Badge>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <p className="text-sm mt-1">{formatEventDescription(event)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Group: {event.groupJid.split('@')[0]}
                        </p>
                      </div>
                    </div>
                    {index < events.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}