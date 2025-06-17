import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, Clock, Phone } from 'lucide-react';

interface WebSocketStatus {
  instanceId: string;
  instanceName: string;
  phoneNumber: string;
  status: string;
  websocketConnected: boolean;
  bridgeExists: boolean;
  lastConnected: string | null;
  connectionState: string;
}

export function WebSocketStatus() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: statuses, isLoading, refetch } = useQuery({
    queryKey: ['/api/whatsapp/websocket/status'],
    refetchInterval: autoRefresh ? 3000 : false, // Auto refresh every 3 seconds
    refetchIntervalInBackground: true,
  });

  const getConnectionBadge = (status: WebSocketStatus) => {
    if (status.websocketConnected) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
        <Wifi className="w-3 h-3 mr-1" />
        Connected
      </Badge>;
    } else if (status.bridgeExists) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
        <WifiOff className="w-3 h-3 mr-1" />
        Disconnected
      </Badge>;
    } else {
      return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
        <WifiOff className="w-3 h-3 mr-1" />
        No Bridge
      </Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      connected: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      connecting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      disconnected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      created: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    };

    return <Badge className={statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}>
      {status}
    </Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>WebSocket Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <RefreshCw className="animate-spin w-5 h-5 mr-2" />
            Loading connection status...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>WebSocket Connection Status</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {statuses?.map((status: WebSocketStatus) => (
            <div
              key={status.instanceId}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{status.instanceName}</p>
                    <p className="text-sm text-muted-foreground">{status.phoneNumber}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-muted-foreground">WebSocket:</span>
                    {getConnectionBadge(status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {getStatusBadge(status.status)}
                  </div>
                </div>

                {status.lastConnected && (
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(status.lastConnected).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {(!statuses || statuses.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No WhatsApp instances found
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}