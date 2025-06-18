import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Send, 
  CheckCircle, 
  CheckCircle2, 
  Eye, 
  Play, 
  AlertCircle,
  RefreshCw 
} from 'lucide-react';
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

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    label: 'Pending'
  },
  sent: {
    icon: Send,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    label: 'Sent'
  },
  delivered: {
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    label: 'Delivered'
  },
  read: {
    icon: CheckCircle2,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    label: 'Read'
  },
  played: {
    icon: Play,
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
    label: 'Played'
  },
  error: {
    icon: AlertCircle,
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    label: 'Error'
  }
};

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

  const latestStatus = updates?.[0]?.status || initialStatus || 'pending';
  const StatusIcon = statusConfig[latestStatus as keyof typeof statusConfig]?.icon || Clock;
  const statusColor = statusConfig[latestStatus as keyof typeof statusConfig]?.color || statusConfig.pending.color;
  const statusLabel = statusConfig[latestStatus as keyof typeof statusConfig]?.label || 'Unknown';

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
        <Badge variant="outline" className={`flex items-center gap-1 ${statusColor}`}>
          <StatusIcon className="h-3 w-3" />
          {statusLabel}
        </Badge>
        
        {updates && updates.length > 0 && (
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
                {updates.map((update, index) => {
                  const UpdateIcon = statusConfig[update.status]?.icon || Clock;
                  const updateColor = statusConfig[update.status]?.color || statusConfig.pending.color;
                  
                  return (
                    <div key={update.updateId} className="flex items-start gap-3">
                      <div className={`rounded-full p-1 ${updateColor}`}>
                        <UpdateIcon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {statusConfig[update.status]?.label || update.status}
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
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}