import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Star, 
  Share2, 
  Settings, 
  Folder, 
  Users, 
  Activity,
  Search,
  MoreHorizontal,
  Grid3X3,
  List
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DriveSpace {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  visibility: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  isArchived: boolean;
  sortOrder: number;
  parentSpaceId?: string;
  metadata: any;
}

interface DriveSpaceItem {
  id: string;
  spaceId: string;
  itemId: string;
  itemType: string;
  name: string;
  addedBy: string;
  addedAt: string;
  lastAccessedAt: string;
  isStarred: boolean;
  isPinned: boolean;
  sortOrder: number;
  metadata: any;
}

interface DriveSpaceMember {
  id: string;
  spaceId: string;
  entityId: string;
  entityType: string;
  role: string;
  canShare: boolean;
  canEdit: boolean;
  canComment: boolean;
  addedBy: string;
  addedAt: string;
}

export default function DriveSpacesPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpace, setSelectedSpace] = useState<DriveSpace | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [newSpaceColor, setNewSpaceColor] = useState('#3B82F6');
  const [newSpaceIcon, setNewSpaceIcon] = useState('📁');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch drive spaces
  const { data: spaces = [], isLoading: isLoadingSpaces } = useQuery({
    queryKey: ['/api/drive-spaces'],
    queryFn: () => apiRequest('/api/drive-spaces'),
  });

  // Fetch space items for selected space
  const { data: spaceItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['/api/drive-spaces', selectedSpace?.id, 'items'],
    queryFn: () => apiRequest(`/api/drive-spaces/${selectedSpace?.id}/items`),
    enabled: !!selectedSpace?.id,
  });

  // Fetch space members for selected space
  const { data: spaceMembers = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['/api/drive-spaces', selectedSpace?.id, 'members'],
    queryFn: () => apiRequest(`/api/drive-spaces/${selectedSpace?.id}/members`),
    enabled: !!selectedSpace?.id,
  });

  // Create space mutation
  const createSpaceMutation = useMutation({
    mutationFn: (spaceData: any) => apiRequest('/api/drive-spaces', {
      method: 'POST',
      body: JSON.stringify(spaceData),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drive-spaces'] });
      setIsCreateDialogOpen(false);
      setNewSpaceName('');
      setNewSpaceDescription('');
      setNewSpaceColor('#3B82F6');
      setNewSpaceIcon('📁');
      toast({
        title: "Space created",
        description: "Your new space has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create space. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Toggle star mutation
  const toggleStarMutation = useMutation({
    mutationFn: ({ spaceId, itemId, starred }: { spaceId: string; itemId: string; starred: boolean }) =>
      apiRequest(`/api/drive-spaces/${spaceId}/items/${itemId}/star`, {
        method: 'POST',
        body: JSON.stringify({ starred }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drive-spaces', selectedSpace?.id, 'items'] });
      toast({
        title: "Item updated",
        description: "Item star status updated successfully.",
      });
    },
  });

  const handleCreateSpace = () => {
    if (!newSpaceName.trim()) {
      toast({
        title: "Validation error",
        description: "Space name is required.",
        variant: "destructive",
      });
      return;
    }

    createSpaceMutation.mutate({
      name: newSpaceName.trim(),
      description: newSpaceDescription.trim(),
      color: newSpaceColor,
      icon: newSpaceIcon,
      visibility: 'private',
      createdBy: 'current-user', // TODO: Replace with actual user ID
    });
  };

  const filteredSpaces = spaces.filter((space: DriveSpace) =>
    space.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    space.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'contact': return '👤';
      case 'company': return '🏢';
      case 'project': return '📋';
      case 'task': return '✓';
      case 'note': return '📝';
      case 'document': return '📄';
      case 'event': return '📅';
      case 'payable': return '💰';
      case 'receivable': return '💵';
      case 'loan': return '🏦';
      case 'account': return '💳';
      case 'transaction': return '💸';
      default: return '📁';
    }
  };

  if (isLoadingSpaces) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-lg font-medium">Loading spaces...</div>
          <div className="text-sm text-muted-foreground">Please wait while we fetch your spaces</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Drive Spaces</h1>
          <p className="text-muted-foreground">
            Organize and collaborate on your content with Google Drive-like spaces
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search spaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <div className="flex items-center border rounded-lg">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Space
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Space</DialogTitle>
                <DialogDescription>
                  Create a new collaborative space to organize your content.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Icon (emoji)"
                    value={newSpaceIcon}
                    onChange={(e) => setNewSpaceIcon(e.target.value)}
                    className="w-20"
                  />
                  <Input
                    placeholder="Space name"
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <Textarea
                  placeholder="Description (optional)"
                  value={newSpaceDescription}
                  onChange={(e) => setNewSpaceDescription(e.target.value)}
                />
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Color:</label>
                  <input
                    type="color"
                    value={newSpaceColor}
                    onChange={(e) => setNewSpaceColor(e.target.value)}
                    className="w-12 h-8 rounded border"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateSpace}
                    disabled={createSpaceMutation.isPending}
                  >
                    {createSpaceMutation.isPending ? 'Creating...' : 'Create Space'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Spaces Grid/List */}
      {!selectedSpace ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredSpaces.map((space: DriveSpace) => (
            <Card 
              key={space.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedSpace(space)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{space.icon || '📁'}</span>
                    <div>
                      <CardTitle className="text-lg">{space.name}</CardTitle>
                      <CardDescription>{space.description}</CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <Badge variant="secondary" style={{ backgroundColor: space.color + '20', color: space.color }}>
                    {space.visibility}
                  </Badge>
                  <span>
                    Updated {new Date(space.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredSpaces.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No spaces found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search terms.' : 'Create your first space to get started.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Space
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Space Detail View */
        <div className="space-y-6">
          {/* Space Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setSelectedSpace(null)}>
                ← Back to Spaces
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{selectedSpace.icon || '📁'}</span>
                <div>
                  <h2 className="text-2xl font-bold">{selectedSpace.name}</h2>
                  <p className="text-muted-foreground">{selectedSpace.description}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Space Tabs */}
          <Tabs defaultValue="items" className="w-full">
            <TabsList>
              <TabsTrigger value="items">
                <Folder className="h-4 w-4 mr-2" />
                Items ({spaceItems.length})
              </TabsTrigger>
              <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-2" />
                Members ({spaceMembers.length})
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Activity className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-4">
              {isLoadingItems ? (
                <div className="text-center py-8">Loading items...</div>
              ) : spaceItems.length === 0 ? (
                <div className="text-center py-12">
                  <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No items in this space</h3>
                  <p className="text-muted-foreground">
                    Add content to this space to see it here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {spaceItems.map((item: DriveSpaceItem) => (
                    <Card key={item.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{getItemTypeIcon(item.itemType)}</span>
                            <div>
                              <h4 className="font-medium">{item.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {item.itemType}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStarMutation.mutate({
                              spaceId: selectedSpace.id,
                              itemId: item.itemId,
                              starred: !item.isStarred
                            })}
                          >
                            <Star 
                              className={`h-4 w-4 ${item.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} 
                            />
                          </Button>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          Added {new Date(item.addedAt).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="members" className="space-y-4">
              {isLoadingMembers ? (
                <div className="text-center py-8">Loading members...</div>
              ) : spaceMembers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No members</h3>
                  <p className="text-muted-foreground">
                    Invite people to collaborate on this space.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {spaceMembers.map((member: DriveSpaceMember) => (
                    <Card key={member.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {member.entityType === 'user' ? '👤' : member.entityType === 'group' ? '👥' : '📞'}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-medium">{member.entityId}</h4>
                              <p className="text-sm text-muted-foreground">
                                {member.entityType} • {member.role}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            {member.canEdit && <Badge variant="outline">Edit</Badge>}
                            {member.canShare && <Badge variant="outline">Share</Badge>}
                            {member.canComment && <Badge variant="outline">Comment</Badge>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Activity feed</h3>
                <p className="text-muted-foreground">
                  Space activity will appear here.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}