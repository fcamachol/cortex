import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, Star, Archive, Grid3X3, List, MoreHorizontal, Users, Settings, Folder, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { SpaceForm } from './SpaceForm';
import { SpaceTemplateModal } from './SpaceTemplateModal';
import { SpaceDetailsModal } from './SpaceDetailsModal';
import { CreateSpaceDialog } from './CreateSpaceDialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Space {
  spaceId: number;
  spaceName: string;
  description?: string;
  icon?: string;
  color?: string;
  coverImage?: string;
  spaceType: 'workspace' | 'project' | 'team' | 'personal' | 'archive';
  privacy: 'public' | 'private' | 'restricted';
  parentSpaceId?: number;
  isArchived: boolean;
  isFavorite: boolean;
  creatorUserId: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  taskCount?: number;
  projectCount?: number;
  childSpaces?: Space[];
}

interface SpaceTemplate {
  templateId: number;
  templateName: string;
  description?: string;
  icon?: string;
  category: string;
  templateType: 'space' | 'project' | 'task' | 'document';
  config: any;
  usageCount: number;
}

export function SpacesPage() {
  const [view, setView] = useState<'grid' | 'list' | 'hierarchy'>('grid');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'personal' | 'team' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSpaceForm, setShowSpaceForm] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<number>>(new Set());
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch spaces
  const { data: spaces, isLoading: spacesLoading } = useQuery({
    queryKey: ['/api/spaces'],
    select: (data: any) => data || []
  });

  // Fetch space templates
  const { data: templates } = useQuery({
    queryKey: ['/api/space-templates'],
    select: (data: any) => data || []
  });

  // Create space mutation
  const createSpaceMutation = useMutation({
    mutationFn: (spaceData: any) => apiRequest('POST', '/api/spaces', spaceData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
      toast({ title: 'Space created successfully' });
      setShowSpaceForm(false);
      setEditingSpace(null);
    },
    onError: () => {
      toast({ title: 'Failed to create space', variant: 'destructive' });
    }
  });

  // Update space mutation
  const updateSpaceMutation = useMutation({
    mutationFn: ({ spaceId, updates }: { spaceId: number; updates: any }) => 
      apiRequest('PATCH', `/api/spaces/${spaceId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
      toast({ title: 'Space updated successfully' });
      setShowSpaceForm(false);
      setEditingSpace(null);
    },
    onError: () => {
      toast({ title: 'Failed to update space', variant: 'destructive' });
    }
  });

  // Delete space mutation
  const deleteSpaceMutation = useMutation({
    mutationFn: (spaceId: number) => apiRequest('DELETE', `/api/spaces/${spaceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
      toast({ title: 'Space deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete space', variant: 'destructive' });
    }
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ spaceId, isFavorite }: { spaceId: number; isFavorite: boolean }) =>
      apiRequest('PATCH', `/api/spaces/${spaceId}`, { isFavorite: !isFavorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
    }
  });

  // Filter spaces based on current filter and search
  const filteredSpaces = spaces?.filter((space: Space) => {
    const matchesSearch = !searchQuery || 
      space.spaceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      space.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filter === 'all' || 
      (filter === 'favorites' && space.isFavorite) ||
      (filter === 'archived' && space.isArchived) ||
      (filter === 'personal' && space.spaceType === 'personal') ||
      (filter === 'team' && space.spaceType === 'team');
    
    return matchesSearch && matchesFilter && !space.isArchived;
  }) || [];

  const handleSpaceCreate = (spaceData: any) => {
    createSpaceMutation.mutate(spaceData);
  };

  const handleSpaceUpdate = (spaceId: number, updates: any) => {
    updateSpaceMutation.mutate({ spaceId, updates });
  };

  const toggleSpaceExpansion = (spaceId: number) => {
    const newExpanded = new Set(expandedSpaces);
    if (newExpanded.has(spaceId)) {
      newExpanded.delete(spaceId);
    } else {
      newExpanded.add(spaceId);
    }
    setExpandedSpaces(newExpanded);
  };

  const renderSpaceCard = (space: Space) => (
    <Card 
      key={space.spaceId} 
      className="group cursor-pointer hover:shadow-md transition-all duration-200 relative overflow-hidden"
      onClick={() => setSelectedSpace(space)}
    >
      {space.coverImage && (
        <div className="h-24 bg-gradient-to-r from-blue-500 to-purple-600 relative">
          <img src={space.coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
              style={{ backgroundColor: space.color || '#3B82F6' }}
            >
              {space.icon || '📁'}
            </div>
            <div>
              <CardTitle className="text-lg line-clamp-1">{space.spaceName}</CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {space.spaceType}
                </Badge>
                <Badge variant={space.privacy === 'public' ? 'default' : 'secondary'} className="text-xs">
                  {space.privacy}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavoriteMutation.mutate({ spaceId: space.spaceId, isFavorite: space.isFavorite });
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Star className={`h-4 w-4 ${space.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setEditingSpace(space);
                  setShowSpaceForm(true);
                }}>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Space
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Members
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => deleteSpaceMutation.mutate(space.spaceId)}
                  className="text-red-600"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Delete Space
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {space.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {space.description}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>{space.memberCount || 0} members</span>
            <span>{space.taskCount || 0} tasks</span>
            <span>{space.projectCount || 0} projects</span>
          </div>
          <span>{new Date(space.createdAt).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );

  const renderHierarchicalView = (spaces: Space[], level = 0) => {
    const rootSpaces = spaces.filter(space => !space.parentSpaceId);
    
    return rootSpaces.map(space => (
      <div key={space.spaceId} className={`${level > 0 ? 'ml-6' : ''}`}>
        <div className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSpaceExpansion(space.spaceId)}
            className="p-0 h-6 w-6"
          >
            {space.childSpaces?.length ? (
              expandedSpaces.has(space.spaceId) ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />
            ) : (
              <div className="w-4 h-4" />
            )}
          </Button>
          <div 
            className="w-6 h-6 rounded flex items-center justify-center text-sm"
            style={{ backgroundColor: space.color || '#3B82F6', color: 'white' }}
          >
            {space.icon || '📁'}
          </div>
          <span className="flex-1 truncate">{space.spaceName}</span>
          <Badge variant="outline" className="text-xs">{space.spaceType}</Badge>
          {space.isFavorite && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
        </div>
        {expandedSpaces.has(space.spaceId) && space.childSpaces?.length && (
          <div className="mt-1">
            {renderHierarchicalView(space.childSpaces, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  if (spacesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Spaces</h1>
          <p className="text-muted-foreground mt-1">
            Organize your work with Notion-style spaces and hierarchical structure
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowTemplateModal(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            From Template
          </Button>
          <Button onClick={() => setShowSpaceForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Space
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search spaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Spaces</SelectItem>
                <SelectItem value="favorites">Favorites</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center border rounded-lg">
              <Button
                variant={view === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={view === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={view === 'hierarchy' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('hierarchy')}
              >
                <Folder className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Spaces Content */}
      {view === 'grid' && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSpaces.map(renderSpaceCard)}
          
          {/* Create New Space Card */}
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow border-dashed border-2 flex items-center justify-center min-h-[200px]"
            onClick={() => setShowSpaceForm(true)}
          >
            <div className="text-center">
              <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Create New Space</p>
              <p className="text-xs text-muted-foreground">Start organizing your work</p>
            </div>
          </Card>
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-2">
          {filteredSpaces.map(space => (
            <Card key={space.spaceId} className="p-4 hover:shadow-sm transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center text-white text-sm"
                    style={{ backgroundColor: space.color || '#3B82F6' }}
                  >
                    {space.icon || '📁'}
                  </div>
                  <div>
                    <h3 className="font-medium">{space.spaceName}</h3>
                    <p className="text-sm text-muted-foreground">{space.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <Badge variant="outline">{space.spaceType}</Badge>
                  <span>{space.memberCount || 0} members</span>
                  <span>{new Date(space.createdAt).toLocaleDateString()}</span>
                  {space.isFavorite && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {view === 'hierarchy' && (
        <Card className="p-4">
          <div className="space-y-1">
            {renderHierarchicalView(filteredSpaces)}
          </div>
        </Card>
      )}

      {/* Modals */}
      {showSpaceForm && (
        <SpaceForm
          isOpen={showSpaceForm}
          onClose={() => {
            setShowSpaceForm(false);
            setEditingSpace(null);
          }}
          onSubmit={editingSpace ? handleSpaceUpdate : handleSpaceCreate}
          space={editingSpace}
          spaces={spaces}
        />
      )}

      {showTemplateModal && (
        <SpaceTemplateModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          templates={templates}
          onSelectTemplate={(template, customData) => {
            // Create space from template
            const spaceData = {
              ...customData,
              templateId: template.templateId,
              ...template.config
            };
            handleSpaceCreate(spaceData);
            setShowTemplateModal(false);
          }}
        />
      )}

      {selectedSpace && (
        <SpaceDetailsModal
          isOpen={!!selectedSpace}
          onClose={() => setSelectedSpace(null)}
          space={selectedSpace}
          onEdit={(space) => {
            setEditingSpace(space);
            setShowSpaceForm(true);
            setSelectedSpace(null);
          }}
        />
      )}
    </div>
  );
}