import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Wifi, 
  WifiOff, 
  Play, 
  Pause, 
  Trash2, 
  Download,
  MessageSquare,
  Users,
  Phone,
  Activity
} from "lucide-react";

interface WebSocketEvent {
  id: string;
  timestamp: string;
  type: string;
  event: string;
  data: any;
  source: 'evolution' | 'internal';
}

export default function DebugPage() {
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const wsRef = useRef<WebSocket | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // WebSocket connection to Evolution API debug endpoint
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/debug-ws`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        addEvent('connection', 'WebSocket connected to debug stream', {}, 'internal');
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
        addEvent('connection', 'WebSocket disconnected', {}, 'internal');
        
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        addEvent('error', 'WebSocket error', { error: error.toString() }, 'internal');
      };
      
      wsRef.current.onmessage = (event) => {
        if (!isPaused) {
          try {
            const data = JSON.parse(event.data);
            addEvent(data.event || 'message', data.event || 'Incoming data', data, 'evolution');
          } catch (e) {
            addEvent('raw', 'Raw message', { raw: event.data }, 'evolution');
          }
        }
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isPaused]);

  const addEvent = (type: string, event: string, data: any, source: 'evolution' | 'internal') => {
    const newEvent: WebSocketEvent = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type,
      event,
      data,
      source
    };
    
    setEvents(prev => [...prev, newEvent].slice(-100)); // Keep only last 100 events
  };

  const clearEvents = () => {
    setEvents([]);
  };

  const exportEvents = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `whatsapp-debug-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    if (filter === 'messages') return event.type.includes('message') || event.event.includes('message');
    if (filter === 'connections') return event.type.includes('connect') || event.event.includes('connect');
    if (filter === 'errors') return event.type.includes('error') || event.event.includes('error');
    return event.type === filter;
  });

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const getEventIcon = (type: string) => {
    if (type.includes('message')) return <MessageSquare className="h-4 w-4" />;
    if (type.includes('contact')) return <Users className="h-4 w-4" />;
    if (type.includes('connect')) return <Phone className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getEventColor = (source: string, type: string) => {
    if (source === 'internal') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (type.includes('error')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (type.includes('message')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            WhatsApp WebSocket Debug
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Monitor real-time Evolution API events and data flow
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <Wifi className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              <WifiOff className="h-3 w-3 mr-1" />
              Disconnected
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setIsPaused(!isPaused)}
              variant={isPaused ? "default" : "secondary"}
              className="w-full"
            >
              {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            
            <Button onClick={clearEvents} variant="outline" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Events
            </Button>
            
            <Button onClick={exportEvents} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            
            <Separator />
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter Events:</label>
              <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)}
                className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="all">All Events</option>
                <option value="messages">Messages</option>
                <option value="connections">Connections</option>
                <option value="errors">Errors</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Event Stream */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Event Stream
              <Badge variant="outline">{filteredEvents.length} events</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] w-full">
              <div className="space-y-3">
                {filteredEvents.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    {isPaused ? 'Stream paused - click Resume to continue' : 'Waiting for events...'}
                  </div>
                ) : (
                  filteredEvents.map((event) => (
                    <div key={event.id} className="border rounded-lg p-4 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getEventIcon(event.type)}
                          <Badge className={getEventColor(event.source, event.type)}>
                            {event.source}
                          </Badge>
                          <span className="font-medium text-sm">{event.event}</span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 mt-2">
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
                <div ref={eventsEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}