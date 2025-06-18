import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WhatsAppStatusIndicator } from './whatsapp-status-indicator';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface MessageUpdate {
  updateId: number;
  messageId: string;
  instanceId: string;
  status: 'error' | 'pending' | 'sent' | 'delivered' | 'read' | 'played';
  timestamp: string;
}

interface MessageStatusTrackerProps {
  messageId: string;
  instanceId: string;
  initialStatus?: string;
}

// Use WhatsApp-style status indicators

export function MessageStatusTracker({ messageId, instanceId, initialStatus }: MessageStatusTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: updates, isLoading, refetch } = useQuery({
    queryKey: ['message-updates', messageId, instanceId],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp/messages/${messageId}/updates?instanceId=${instanceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch message updates');
      }
      const data = await response.json();
      return data as MessageUpdate[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  const latestStatus = updates?.[0]?.status || (initialStatus as any) || 'pending';

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <WhatsAppStatusIndicator 
          status={latestStatus} 
          timestamp={updates?.[0]?.timestamp}
        />
        
        {updates && updates.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2 text-xs"
          >
            {isExpanded ? 'Hide' : 'Show'} History ({updates.length})
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="h-6 px-2"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {isExpanded && updates && updates.length > 0 && (
        <Card className="w-full max-w-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Message Status History</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-48">
              <div className="space-y-3">
                {updates.map((update, index) => (
                  <div key={update.updateId} className="flex items-start gap-3">
                    <WhatsAppStatusIndicator 
                      status={update.status}
                      timestamp={update.timestamp}
                      showTime={false}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">
                          {update.status}
                        </span>
                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(update.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}