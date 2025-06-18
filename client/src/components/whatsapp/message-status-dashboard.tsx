import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Clock, 
  Send, 
  CheckCircle, 
  CheckCircle2, 
  Play, 
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  MessageSquare,
  TrendingUp,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { MessageStatusTracker } from './message-status-tracker';

interface Message {
  messageId: string;
  instanceId: string;
  chatId: string;
  content: string;
  timestamp: string;
  fromMe: boolean;
  messageType: string;
  senderJid: string;
}

interface MessageUpdate {
  updateId: number;
  messageId: string;
  instanceId: string;
  status: 'error' | 'pending' | 'sent' | 'delivered' | 'read' | 'played';
  timestamp: string;
}

interface MessageStatusDashboardProps {
  instanceId: string;
  userId: string;
}

const statusStats = {
  pending: { label: 'Pending', color: 'bg-yellow-500', icon: Clock },
  sent: { label: 'Sent', color: 'bg-blue-500', icon: Send },
  delivered: { label: 'Delivered', color: 'bg-green-500', icon: CheckCircle },
  read: { label: 'Read', color: 'bg-purple-500', icon: CheckCircle2 },
  played: { label: 'Played', color: 'bg-indigo-500', icon: Play },
  error: { label: 'Error', color: 'bg-red-500', icon: AlertCircle },
};

export function MessageStatusDashboard({ instanceId, userId }: MessageStatusDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch recent messages with their latest status
  const { data: messages, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['messages-status-overview', instanceId],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp/messages/all/${instanceId}?limit=50`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      return data as Message[];
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch all message updates for status analytics
  const { data: allUpdates, isLoading: updatesLoading } = useQuery({
    queryKey: ['message-updates-analytics', instanceId],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp/message-updates/analytics/${instanceId}`);
      if (!response.ok) throw new Error('Failed to fetch update analytics');
      const data = await response.json();
      return data as MessageUpdate[];
    },
    refetchInterval: 30000,
  });

  // Calculate status statistics
  const statusCounts = allUpdates?.reduce((acc, update) => {
    acc[update.status] = (acc[update.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const totalMessages = messages?.length || 0;
  const totalUpdates = allUpdates?.length || 0;

  // Filter messages based on search and status
  const filteredMessages = messages?.filter(message => {
    const matchesSearch = message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.chatId.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    
    // For status filtering, we'd need to get the latest status for each message
    return matchesSearch;
  }) || [];

  if (messagesLoading || updatesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading message status data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalMessages}</p>
                <p className="text-xs text-muted-foreground">Total Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {Object.entries(statusStats).map(([status, config]) => {
          const count = statusCounts[status] || 0;
          const Icon = config.icon;
          
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 text-white`} />
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Message Status Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Search Messages</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by content or contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="status-filter">Filter by Status</Label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="all">All Status</option>
                {Object.entries(statusStats).map(([status, config]) => (
                  <option key={status} value={status}>{config.label}</option>
                ))}
              </select>
            </div>

            <Button onClick={() => void refetchMessages()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Message List with Status Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Messages ({filteredMessages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {filteredMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {messages?.length === 0 ? 'No messages found' : 'No messages match your filters'}
                </div>
              ) : (
                filteredMessages.map((message) => (
                  <div
                    key={message.messageId}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={message.fromMe ? "default" : "secondary"}>
                            {message.fromMe ? "Sent" : "Received"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {message.messageType}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(message.timestamp), 'MMM dd, HH:mm')}
                          </span>
                        </div>
                        
                        <div className="mb-2">
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            {message.fromMe ? 'To:' : 'From:'} {message.senderJid}
                          </p>
                          <p className="text-sm">
                            {message.content || <em>No content available</em>}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Message Status Tracker */}
                    {message.fromMe && (
                      <div className="pl-4 border-l-2 border-blue-200">
                        <p className="text-xs text-muted-foreground mb-2">Delivery Status:</p>
                        <MessageStatusTracker
                          messageId={message.messageId}
                          instanceId={message.instanceId}
                          initialStatus="pending"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Real-time Updates Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Status Update Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Total status updates received: <span className="font-medium">{totalUpdates}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Messages being tracked: <span className="font-medium">{totalMessages}</span>
            </p>
            <div className="flex items-center gap-2 mt-4">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">
                Real-time webhook monitoring active
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}