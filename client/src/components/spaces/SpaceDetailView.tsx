import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { 
  Plus, 
  MoreHorizontal, 
  FolderOpen, 
  Briefcase, 
  CheckSquare, 
  FileText, 
  Calendar,
  Users,
  Settings,
  Star,
  Archive,
  Filter,
  Search,
  Grid,
  List,
  Table,
  Edit,
  Trash2,
  Share,
  Copy,
  EyeOff,
  Folder,
  File,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle
} from 'lucide-react';

interface Space {
  spaceId: number;
  spaceName: string;
  description?: string;
  icon?: string;
  color?: string;
  category?: string;
  parentSpaceId?: number;
  childSpaces?: Space[];
  isArchived: boolean;
  isFavorite: boolean;
}

interface SpaceItem {
  itemId: number;
  spaceId: number;
  itemType: string;
  title: string;
  description?: string;
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

interface SpaceDetailViewProps {
  spaceId: number;
  parentSpaceId?: number;
}

export function SpaceDetailView({ spaceId, parentSpaceId }: SpaceDetailViewProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Fetch space details
  const { data: space, isLoading: spaceLoading } = useQuery({
    queryKey: ['/api/spaces', spaceId],
    queryFn: async () => {
      const response = await fetch(`/api/spaces/${spaceId}`);
      if (!response.ok) throw new Error('Failed to fetch space');
      return response.json();
    }
  });

  // Fetch space items
  const { data: spaceItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['/api/space-items', spaceId],
    queryFn: async () => {
      const response = await fetch(`/api/space-items?spaceId=${spaceId}`);
      if (!response.ok) throw new Error('Failed to fetch space items');
      return response.json();
    }
  });

  // Update space mutation
  const updateSpaceMutation = useMutation({
    mutationFn: async (data: { title?: string; description?: string }) => {
      return await apiRequest(`/api/spaces/${spaceId}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/spaces', spaceId] });
      toast({ title: "Space updated successfully" });
      setEditingTitle(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating space", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  if (spaceLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FolderOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Space not found</h2>
          <p className="text-gray-500">The space you're looking for doesn't exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  const getItemsByType = (type: string) => {
    const items = spaceItems?.filter((item: SpaceItem) => item.itemType === type) || [];
    return searchTerm 
      ? items.filter((item: SpaceItem) => 
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : items;
  };

  const subspaces = space.childSpaces || [];
  const projects = getItemsByType('project');
  const tasks = getItemsByType('task');
  const files = getItemsByType('file');
  const documents = getItemsByType('document');
  const notes = getItemsByType('note');
  const events = getItemsByType('event');

  const handleTitleEdit = () => {
    if (newTitle.trim() && newTitle !== space.spaceName) {
      updateSpaceMutation.mutate({ title: newTitle.trim() });
    } else {
      setEditingTitle(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in-progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'pending': return <Circle className="h-4 w-4 text-gray-400" />;
      default: return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const renderItemGrid = (items: SpaceItem[], type: string) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-gray-100 flex items-center justify-center">
            {type === 'project' && <Briefcase className="h-8 w-8 text-gray-400" />}
            {type === 'task' && <CheckSquare className="h-8 w-8 text-gray-400" />}
            {type === 'file' && <FileText className="h-8 w-8 text-gray-400" />}
            {type === 'event' && <Calendar className="h-8 w-8 text-gray-400" />}
          </div>
          <p className="mb-4">No {type}s yet</p>
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create First {type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item: SpaceItem) => (
            <Card key={item.itemId} className="hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {type === 'project' && <Briefcase className="h-4 w-4 text-blue-500" />}
                    {type === 'task' && getStatusIcon(item.metadata?.status || 'pending')}
                    {(type === 'file' || type === 'document' || type === 'note') && <FileText className="h-4 w-4 text-gray-500" />}
                    {type === 'event' && <Calendar className="h-4 w-4 text-purple-500" />}
                    <Badge variant="outline" className="text-xs capitalize">
                      {item.itemType}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h3 className="font-medium text-sm mb-2 line-clamp-2">{item.title}</h3>
                {item.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{item.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                  </span>
                  {item.metadata?.priority && (
                    <Badge 
                      variant={item.metadata.priority === 'high' ? 'destructive' : 
                             item.metadata.priority === 'medium' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {item.metadata.priority}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (viewMode === 'list') {
      return (
        <div className="space-y-2">
          {items.map((item: SpaceItem) => (
            <div key={item.itemId} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 group">
              <div className="flex items-center gap-2 flex-1">
                {type === 'project' && <Briefcase className="h-4 w-4 text-blue-500" />}
                {type === 'task' && getStatusIcon(item.metadata?.status || 'pending')}
                {(type === 'file' || type === 'document' || type === 'note') && <FileText className="h-4 w-4 text-gray-500" />}
                {type === 'event' && <Calendar className="h-4 w-4 text-purple-500" />}
                <div className="flex-1">
                  <h3 className="font-medium text-sm">{item.title}</h3>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">
                  {item.itemType}
                </Badge>
                {item.metadata?.priority && (
                  <Badge 
                    variant={item.metadata.priority === 'high' ? 'destructive' : 
                           item.metadata.priority === 'medium' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {item.metadata.priority}
                  </Badge>
                )}
                <span className="text-xs text-gray-400">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Breadcrumb and Actions Bar */}
      <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/spaces')}>
              <span>Spaces</span>
            </Button>
            {parentSpaceId && (
              <>
                <span>/</span>
                <Button variant="ghost" size="sm" onClick={() => setLocation(`/spaces/${parentSpaceId}`)}>
                  <span>Parent Space</span>
                </Button>
              </>
            )}
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">{space.spaceName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Star className={`h-4 w-4 mr-2 ${space.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              {space.isFavorite ? 'Favorited' : 'Favorite'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Space Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Users className="h-4 w-4 mr-2" />
                  Manage Permissions
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Space
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Header with Title and Description */}
      <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-6">
        <div className="flex items-start gap-4">
          {space.icon && (
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-2xl">
              {space.icon}
            </div>
          )}
          <div className="flex-1">
            {editingTitle ? (
              <div className="space-y-3">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onBlur={handleTitleEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleEdit();
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  className="text-2xl font-bold border-none p-0 h-auto focus-visible:ring-0"
                  autoFocus
                />
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="resize-none border-none p-0 focus-visible:ring-0"
                  rows={2}
                />
              </div>
            ) : (
              <div 
                className="cursor-pointer group"
                onClick={() => {
                  setEditingTitle(true);
                  setNewTitle(space.spaceName);
                  setNewDescription(space.description || '');
                }}
              >
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  {space.spaceName}
                  <Edit className="inline-block h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h1>
                {space.description ? (
                  <p className="text-gray-600 dark:text-gray-400 mt-2 group-hover:text-gray-800 dark:group-hover:text-gray-300">
                    {space.description}
                  </p>
                ) : (
                  <p className="text-gray-400 mt-2 italic group-hover:text-gray-600">
                    Click to add description...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs and Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800">
          <div className="px-6">
            <TabsList className="h-12 bg-transparent p-0">
              <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">
                Overview
              </TabsTrigger>
              <TabsTrigger value="subspaces" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">
                Subspaces ({subspaces.length})
              </TabsTrigger>
              <TabsTrigger value="projects" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">
                Projects ({projects.length})
              </TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">
                Tasks ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="files" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">
                Files ({files.length + documents.length + notes.length})
              </TabsTrigger>
              <TabsTrigger value="events" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">
                Events ({events.length})
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Quick Stats */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      Subspaces
                    </span>
                    <Badge variant="outline">{subspaces.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Projects
                    </span>
                    <Badge variant="outline">{projects.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      Tasks
                    </span>
                    <Badge variant="outline">{tasks.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Files
                    </span>
                    <Badge variant="outline">{files.length + documents.length + notes.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Events
                    </span>
                    <Badge variant="outline">{events.length}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Folder className="h-4 w-4 mr-2" />
                    Add Subspace
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Create Project
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Upload File
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    Create Event
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Recent Items */}
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Recent Items</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...projects.slice(0, 2), ...tasks.slice(0, 2), ...files.slice(0, 2)].slice(0, 6).map((item: SpaceItem) => (
                  <Card key={item.itemId} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {item.itemType === 'project' && <Briefcase className="h-5 w-5 text-blue-500" />}
                        {item.itemType === 'task' && <CheckSquare className="h-5 w-5 text-green-500" />}
                        {['file', 'document', 'note'].includes(item.itemType) && <FileText className="h-5 w-5 text-gray-500" />}
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{item.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {item.itemType}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Individual Content Tabs */}
          {['subspaces', 'projects', 'tasks', 'files', 'events'].map((tabName) => (
            <TabsContent key={tabName} value={tabName} className="mt-0">
              <div className="p-6">
                {/* Header with Search and View Controls */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold capitalize">{tabName}</h2>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder={`Search ${tabName}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex border rounded-lg p-1">
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className="h-8 w-8 p-0"
                      >
                        <Grid className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="h-8 w-8 p-0"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add {tabName.slice(0, -1).charAt(0).toUpperCase() + tabName.slice(0, -1).slice(1)}
                    </Button>
                  </div>
                </div>

                {/* Content */}
                {tabName === 'subspaces' && (
                  <div>
                    {subspaces.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Folder className="h-8 w-8 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No subspaces yet</h3>
                        <p className="text-gray-500 mb-4">Create subspaces to organize your work</p>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Create First Subspace
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {subspaces.map((subspace: Space) => (
                          <Card 
                            key={subspace.spaceId} 
                            className="hover:shadow-md transition-shadow cursor-pointer group"
                            onClick={() => {
                              // Navigate to subspace using hierarchical URL
                              if (parentSpaceId) {
                                setLocation(`/spaces/${parentSpaceId}/${spaceId}/${subspace.spaceId}`);
                              } else {
                                setLocation(`/spaces/${spaceId}/${subspace.spaceId}`);
                              }
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                  {subspace.icon ? (
                                    <span className="text-lg">{subspace.icon}</span>
                                  ) : (
                                    <Folder className="h-5 w-5 text-blue-500" />
                                  )}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0">
                                      <MoreHorizontal className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600">
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <h3 className="font-medium mb-2">{subspace.spaceName}</h3>
                              {subspace.description && (
                                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{subspace.description}</p>
                              )}
                              <div className="flex items-center justify-between text-xs text-gray-400">
                                <Badge variant="outline" className="capitalize">
                                  {subspace.category || 'workspace'}
                                </Badge>
                                <span>
                                  {subspace.childSpaces ? `${subspace.childSpaces.length} items` : '0 items'}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {tabName === 'projects' && renderItemGrid(projects, 'project')}
                {tabName === 'tasks' && renderItemGrid(tasks, 'task')}
                {tabName === 'files' && renderItemGrid([...files, ...documents, ...notes], 'file')}
                {tabName === 'events' && renderItemGrid(events, 'event')}
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: space.color || '#3B82F6' }}
            >
              {space.icon || space.spaceName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{space.spaceName}</h1>
              {space.description && (
                <p className="text-gray-600 dark:text-gray-400">{space.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {space.category || 'uncategorized'}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Space Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Users className="h-4 w-4 mr-2" />
                Manage Members
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                <Archive className="h-4 w-4 mr-2" />
                Archive Space
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subspaces">Subspaces ({childSpaces.length})</TabsTrigger>
            <TabsTrigger value="projects">Projects ({getItemsByType('project').length})</TabsTrigger>
            <TabsTrigger value="content">Content ({getItemsByType('task').length + getItemsByType('file').length + getItemsByType('document').length + getItemsByType('note').length + getItemsByType('event').length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{spaceItems.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Subspaces</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{childSpaces.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-medium capitalize">
                    {space.category || 'Uncategorized'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Content Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {itemTypes.map(({ type, label, icon: Icon }) => {
                const count = getItemsByType(type).length;
                if (count === 0) return null; // Only show if there are items
                return (
                  <Card key={type}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-gray-600" />
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-sm text-gray-600">{count} items</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="mt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Projects</h3>
              <Button onClick={() => handleCreateItem('project')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </div>

            {getItemsByType('project').length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                <p className="text-sm mb-4">Create your first project to organize your work</p>
                <Button onClick={() => handleCreateItem('project')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Project
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getItemsByType('project').map((project: SpaceItem) => (
                  <Card key={project.itemId} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        {project.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {project.description && (
                        <p className="text-sm text-gray-600 mb-3">{project.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Active</Badge>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="content" className="mt-6">
            <div className="space-y-6">
              {/* Tasks Section */}
              {getItemsByType('task').length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5" />
                        Tasks ({getItemsByType('task').length})
                      </CardTitle>
                      <Button size="sm" onClick={() => handleCreateItem('task')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Task
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getItemsByType('task').map((task: SpaceItem) => (
                        <div 
                          key={task.itemId} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <CheckSquare className="h-4 w-4 text-gray-600" />
                            <div>
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="text-sm text-gray-600">{task.description}</div>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Files Section */}
              {getItemsByType('file').length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Files ({getItemsByType('file').length})
                      </CardTitle>
                      <Button size="sm" onClick={() => handleCreateItem('file')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add File
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getItemsByType('file').map((file: SpaceItem) => (
                        <div 
                          key={file.itemId} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-gray-600" />
                            <div>
                              <div className="font-medium">{file.title}</div>
                              {file.description && (
                                <div className="text-sm text-gray-600">{file.description}</div>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Documents Section */}
              {getItemsByType('document').length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Documents ({getItemsByType('document').length})
                      </CardTitle>
                      <Button size="sm" onClick={() => onCreateItem?.('document')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Document
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getItemsByType('document').map((document: SpaceItem) => (
                        <div 
                          key={document.itemId} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-gray-600" />
                            <div>
                              <div className="font-medium">{document.title}</div>
                              {document.description && (
                                <div className="text-sm text-gray-600">{document.description}</div>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes Section */}
              {getItemsByType('note').length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Notes ({getItemsByType('note').length})
                      </CardTitle>
                      <Button size="sm" onClick={() => handleCreateItem('note')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Note
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getItemsByType('note').map((note: SpaceItem) => (
                        <div 
                          key={note.itemId} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-gray-600" />
                            <div>
                              <div className="font-medium">{note.title}</div>
                              {note.description && (
                                <div className="text-sm text-gray-600">{note.description}</div>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Documents Section */}
              {getItemsByType('document').length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Documents ({getItemsByType('document').length})
                      </CardTitle>
                      <Button size="sm" onClick={() => onCreateItem?.('document')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Document
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getItemsByType('document').map((document: SpaceItem) => (
                        <div 
                          key={document.itemId} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-gray-600" />
                            <div>
                              <div className="font-medium">{document.title}</div>
                              {document.description && (
                                <div className="text-sm text-gray-600">{document.description}</div>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty state for content tab */}
              {getItemsByType('task').length === 0 && 
               getItemsByType('file').length === 0 && 
               getItemsByType('document').length === 0 && 
               getItemsByType('note').length === 0 && 
               getItemsByType('event').length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No content yet</h3>
                  <p className="text-sm mb-4">Add tasks, files, documents, notes, or events to this space</p>
                  <div className="flex justify-center gap-2 flex-wrap">
                    <Button onClick={() => handleCreateItem('task')}>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                    <Button variant="outline" onClick={() => handleCreateItem('file')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Add File
                    </Button>
                    <Button variant="outline" onClick={() => handleCreateItem('note')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="subspaces" className="mt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Subspaces</h3>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Subspace
              </Button>
            </div>

            {childSpaces.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No subspaces yet</h3>
                <p className="text-sm mb-4">Organize your work by creating subspaces</p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Subspace
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {childSpaces.map((childSpace: Space) => (
                  <Card key={childSpace.spaceId} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: childSpace.color || '#3B82F6' }}
                        >
                          {childSpace.icon || childSpace.spaceName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{childSpace.spaceName}</h4>
                          {childSpace.description && (
                            <p className="text-sm text-gray-600 truncate">{childSpace.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs capitalize">
                          {childSpace.category || 'uncategorized'}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}