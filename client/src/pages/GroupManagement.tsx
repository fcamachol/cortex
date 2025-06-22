import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Users, Settings, MessageSquare, Shield, Lock, Volume2 } from 'lucide-react';

interface Group {
  jid: string;
  instanceId: string;
  subject: string;
  description?: string;
  participantCount: number;
  isAnnounce: boolean;
  isLocked: boolean;
  createdAt: string;
}

interface GroupManagementProps {
  spaceId: string;
}

export function GroupManagement({ spaceId }: GroupManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // Setup real-time group updates via SSE
  useEffect(() => {
    if (!spaceId) return;

    const eventSource = new EventSource('/api/sse');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'group_update') {
          const update = data.payload;
          
          // Immediately update the groups list in the cache
          queryClient.setQueryData(['/api/whatsapp/groups', spaceId], (oldData: Group[] | undefined) => {
            if (!oldData) return oldData;
            
            return oldData.map(group => 
              group.jid === update.groupJid 
                ? { ...group, subject: update.subject }
                : group
            );
          });
          
          // Show toast notification for group name changes
          if (update.type === 'subject_changed') {
            toast({
              title: "Group Name Updated",
              description: `"${update.oldSubject}" is now "${update.subject}"`,
              duration: 4000,
            });
          } else if (update.type === 'participants_changed') {
            const action = update.data.action;
            const count = update.data.participants.length;
            toast({
              title: "Group Members Updated",
              description: `${count} member(s) ${action === 'add' ? 'added' : action === 'remove' ? 'removed' : action}`,
            });
          } else if (update.type === 'description_changed') {
            toast({
              title: "Group Description Updated",
              description: "Group description has been changed",
            });
          }

          // Refresh groups data to show latest changes
          queryClient.invalidateQueries({ 
            queryKey: ['/api/whatsapp/groups', spaceId] 
          });
        }
      } catch (error) {
        console.error('Error processing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, [spaceId, toast, queryClient]);

  // Fetch groups for the space
  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ['/api/whatsapp/groups', spaceId],
    enabled: !!spaceId,
  });

  // Group update mutation
  const updateGroupMutation = useMutation({
    mutationFn: async (data: { groupJid: string; instanceId: string; updates: Partial<Group> }) => {
      return apiRequest(`/api/whatsapp/groups/${data.instanceId}/${data.groupJid}`, {
        method: 'PATCH',
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      toast({
        title: "Group Updated",
        description: "Group settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/groups', spaceId] });
      setEditingGroup(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed", 
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Group sync mutation
  const syncGroupsMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      return apiRequest(`/api/whatsapp/groups/${instanceId}/sync-from-api`, {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${data.count} groups from Evolution API.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/groups', spaceId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateGroup = (updates: Partial<Group>) => {
    if (!editingGroup) return;
    
    updateGroupMutation.mutate({
      groupJid: editingGroup.jid,
      instanceId: editingGroup.instanceId,
      updates,
    });
  };

  const handleSyncGroups = (instanceId: string) => {
    syncGroupsMutation.mutate(instanceId);
  };

  // Get unique instances
  const instances = Array.from(new Set(groups.map(g => g.instanceId)));
  
  // Group statistics
  const stats = {
    total: groups.length,
    authentic: groups.filter(g => g.subject && !g.subject.includes('Unknown')).length,
    placeholder: groups.filter(g => !g.subject || g.subject.includes('Unknown')).length,
    announceOnly: groups.filter(g => g.isAnnounce).length,
    locked: groups.filter(g => g.isLocked).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Group Management</h1>
          <p className="text-muted-foreground">Manage WhatsApp groups across all instances</p>
        </div>
        <div className="flex gap-2">
          {instances.map(instanceId => (
            <Button
              key={instanceId}
              variant="outline"
              onClick={() => handleSyncGroups(instanceId)}
              disabled={syncGroupsMutation.isPending}
            >
              Sync {instanceId.split('-').pop()}
            </Button>
          ))}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Groups</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.authentic}</p>
                <p className="text-xs text-muted-foreground">Authentic Names</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats.placeholder}</p>
                <p className="text-xs text-muted-foreground">Pending Updates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.announceOnly}</p>
                <p className="text-xs text-muted-foreground">Announce Only</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.locked}</p>
                <p className="text-xs text-muted-foreground">Locked Groups</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups List */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Groups ({stats.total})</TabsTrigger>
          <TabsTrigger value="authentic">Authentic ({stats.authentic})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({stats.placeholder})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          <GroupsList groups={groups} onEdit={setEditingGroup} />
        </TabsContent>
        
        <TabsContent value="authentic" className="space-y-4">
          <GroupsList 
            groups={groups.filter(g => g.subject && !g.subject.includes('Unknown'))} 
            onEdit={setEditingGroup} 
          />
        </TabsContent>
        
        <TabsContent value="pending" className="space-y-4">
          <GroupsList 
            groups={groups.filter(g => !g.subject || g.subject.includes('Unknown'))} 
            onEdit={setEditingGroup} 
          />
        </TabsContent>
      </Tabs>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update group settings using Evolution API
            </DialogDescription>
          </DialogHeader>
          
          {editingGroup && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Group Subject</Label>
                <Input
                  id="subject"
                  value={editingGroup.subject}
                  onChange={(e) => setEditingGroup({...editingGroup, subject: e.target.value})}
                  placeholder="Enter group subject"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editingGroup.description || ''}
                  onChange={(e) => setEditingGroup({...editingGroup, description: e.target.value})}
                  placeholder="Enter group description"
                  rows={3}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="announce">Announce Only</Label>
                <Switch
                  id="announce"
                  checked={editingGroup.isAnnounce}
                  onCheckedChange={(isAnnounce) => setEditingGroup({...editingGroup, isAnnounce})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="locked">Group Locked</Label>
                <Switch
                  id="locked"
                  checked={editingGroup.isLocked}
                  onCheckedChange={(isLocked) => setEditingGroup({...editingGroup, isLocked})}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => handleUpdateGroup({
                    subject: editingGroup.subject,
                    description: editingGroup.description,
                    isAnnounce: editingGroup.isAnnounce,
                    isLocked: editingGroup.isLocked,
                  })}
                  disabled={updateGroupMutation.isPending}
                  className="flex-1"
                >
                  {updateGroupMutation.isPending ? 'Updating...' : 'Update Group'}
                </Button>
                <Button variant="outline" onClick={() => setEditingGroup(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface GroupsListProps {
  groups: Group[];
  onEdit: (group: Group) => void;
}

function GroupsList({ groups, onEdit }: GroupsListProps) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No groups found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <Card key={group.jid} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold">{group.subject || 'Unknown Group'}</h3>
                  <div className="flex gap-1">
                    {group.isAnnounce && (
                      <Badge variant="secondary" className="text-xs">
                        <Volume2 className="h-3 w-3 mr-1" />
                        Announce
                      </Badge>
                    )}
                    {group.isLocked && (
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {group.participantCount} members
                  </span>
                  <span>Instance: {group.instanceId.split('-').pop()}</span>
                  <span>Created: {new Date(group.createdAt).toLocaleDateString()}</span>
                </div>
                
                {group.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {group.description}
                  </p>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(group)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}