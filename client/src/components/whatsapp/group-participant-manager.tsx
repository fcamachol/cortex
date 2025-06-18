import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Crown, Shield, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface GroupParticipant {
  participantJid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface GroupInfo {
  groupJid: string;
  subject: string;
  description: string | null;
  ownerJid: string | null;
  participants: GroupParticipant[];
  participantCount: number;
}

interface GroupParticipantManagerProps {
  instanceId: string;
  groupJid: string;
}

export function GroupParticipantManager({ instanceId, groupJid }: GroupParticipantManagerProps) {
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch group information and participants
  const { data: groupInfo, isLoading, error } = useQuery<GroupInfo>({
    queryKey: ['/api/whatsapp/groups', instanceId, groupJid],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp/groups/${instanceId}/${encodeURIComponent(groupJid)}`);
      if (!response.ok) throw new Error('Failed to fetch group info');
      return response.json();
    },
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  // WebSocket connection for real-time participant updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setIsConnected(true);
      console.log('Group participant WebSocket connected');
    };
    
    ws.onclose = () => {
      setIsConnected(false);
      console.log('Group participant WebSocket disconnected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle group participant updates
        if (data.type === 'group-participants-update' && data.groupJid === groupJid) {
          queryClient.invalidateQueries({
            queryKey: ['/api/whatsapp/groups', instanceId, groupJid]
          });
          
          toast({
            title: "Group Updated",
            description: `Participant ${data.action}: ${data.participantJid}`,
            duration: 3000,
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    return () => {
      ws.close();
    };
  }, [instanceId, groupJid, queryClient, toast]);

  // Sync participants mutation
  const syncParticipantsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/whatsapp/instances/${instanceId}/sync-participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupJid }),
      });
      if (!response.ok) throw new Error('Failed to sync participants');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/whatsapp/groups', instanceId, groupJid]
      });
      toast({
        title: "Sync Complete",
        description: "Group participants synchronized successfully",
        duration: 3000,
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync participants",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const formatPhoneNumber = (jid: string) => {
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  };

  const getParticipantRole = (participant: GroupParticipant) => {
    if (participant.isSuperAdmin) return 'Super Admin';
    if (participant.isAdmin) return 'Admin';
    return 'Member';
  };

  const getRoleIcon = (participant: GroupParticipant) => {
    if (participant.isSuperAdmin) return <Crown className="h-4 w-4 text-yellow-500" />;
    if (participant.isAdmin) return <Shield className="h-4 w-4 text-blue-500" />;
    return <Users className="h-4 w-4 text-gray-500" />;
  };

  const getRoleBadgeVariant = (participant: GroupParticipant) => {
    if (participant.isSuperAdmin) return 'default';
    if (participant.isAdmin) return 'secondary';
    return 'outline';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading group participants...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Failed to load group information
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Group Participants
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? 'Live' : 'Offline'}
            </Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncParticipantsMutation.mutate()}
            disabled={syncParticipantsMutation.isPending}
          >
            {syncParticipantsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Sync Participants
          </Button>
        </div>
        {groupInfo && (
          <div className="text-sm text-muted-foreground">
            <div className="font-semibold">{groupInfo.subject}</div>
            <div>{groupInfo.participantCount} participants</div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {groupInfo?.participants.map((participant) => (
              <div
                key={participant.participantJid}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getRoleIcon(participant)}
                  <div>
                    <div className="font-medium">
                      {formatPhoneNumber(participant.participantJid)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {participant.participantJid}
                    </div>
                  </div>
                </div>
                <Badge variant={getRoleBadgeVariant(participant)}>
                  {getParticipantRole(participant)}
                </Badge>
              </div>
            ))}
            {(!groupInfo?.participants || groupInfo.participants.length === 0) && (
              <div className="text-center text-muted-foreground py-8">
                No participants found
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}