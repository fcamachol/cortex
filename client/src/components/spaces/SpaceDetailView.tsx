import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

import { ProjectForm } from '../tasks/ProjectForm';
import { TaskForm } from '../tasks/TaskForm';
import { SpaceForm } from './SpaceForm';
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
  Circle,
  ChevronRight,
  ChevronLeft
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

// Helper function to build space path recursively
function buildSpacePath(spaceId: number, allSpaces: Space[]): string {
  const space = allSpaces.find(s => s.spaceId === spaceId);
  if (!space || !space.parentSpaceId) {
    return spaceId.toString();
  }
  
  const parentPath = buildSpacePath(space.parentSpaceId, allSpaces);
  return `${parentPath}/${spaceId}`;
}

// Helper function to build breadcrumb trail
function buildBreadcrumbPath(spaceId: number, allSpaces: Space[]): Space[] {
  const space = allSpaces.find(s => s.spaceId === spaceId);
  if (!space) return [];
  
  if (!space.parentSpaceId) {
    return [space];
  }
  
  const parentPath = buildBreadcrumbPath(space.parentSpaceId, allSpaces);
  return [...parentPath, space];
}

export function SpaceDetailView({ spaceId, parentSpaceId }: SpaceDetailViewProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedSpace, setEditedSpace] = useState<Partial<Space>>({});
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showSubspaceForm, setShowSubspaceForm] = useState(false);
  const [showFileForm, setShowFileForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  // Fetch all spaces first
  const { data: allSpaces = [], isLoading: spacesLoading } = useQuery({
    queryKey: ['/api/spaces'],
    select: (data: any) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      return Object.values(data).flat();
    }
  });

  // Fetch space items
  const { data: spaceItems = [] } = useQuery({
    queryKey: ['/api/spaces', spaceId, 'items'],
    enabled: !!spaceId,
  });

  // Flatten all spaces including nested children
  const flattenSpaces = (spaces: Space[]): Space[] => {
    const result: Space[] = [];
    for (const space of spaces) {
      result.push(space);
      if (space.childSpaces && space.childSpaces.length > 0) {
        result.push(...flattenSpaces(space.childSpaces));
      }
    }
    return result;
  };

  // Find the specific space from all spaces (including nested)
  const spacesArray = Array.isArray(allSpaces) ? allSpaces : 
    allSpaces ? Object.values(allSpaces).flat() : [];
  const allFlatSpaces = flattenSpaces(spacesArray);
  const space = allFlatSpaces.find((s: Space) => s.spaceId === spaceId);

  if (spacesLoading) {
    return <div className="flex-1 flex items-center justify-center">Loading space...</div>;
  }

  if (!space) {
    return <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div>Space not found (ID: {spaceId})</div>
        <div className="text-sm text-gray-500 mt-2">
          Available spaces: {spacesArray.map(s => `${s.spaceName} (${s.spaceId})`).join(', ')}
        </div>
      </div>
    </div>;
  }

  if (!space) {
    return <div className="flex-1 flex items-center justify-center">Space not found</div>;
  }

  // Categorize items
  const allSpacesArray = Array.isArray(allSpaces) ? allSpaces : (allSpaces ? Object.values(allSpaces).flat() : []);
  const spaceItemsArray = Array.isArray(spaceItems) ? spaceItems : [];
  
  // Use childSpaces from the space object if available, otherwise filter all flat spaces
  const subspaces = space.childSpaces || allFlatSpaces.filter((s: Space) => s.parentSpaceId === spaceId);
  const projects = spaceItemsArray.filter((item: SpaceItem) => item.itemType === 'project');
  const tasks = spaceItemsArray.filter((item: SpaceItem) => item.itemType === 'task');
  const files = spaceItemsArray.filter((item: SpaceItem) => item.itemType === 'file');
  const documents = spaceItemsArray.filter((item: SpaceItem) => item.itemType === 'document');
  const notes = spaceItemsArray.filter((item: SpaceItem) => item.itemType === 'note');
  const events = spaceItemsArray.filter((item: SpaceItem) => item.itemType === 'event');
  


  // Find parent space
  const parentSpace = parentSpaceId ? allFlatSpaces.find((s: Space) => s.spaceId === parentSpaceId) : null;

  // Get status icon for tasks
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'blocked':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  // Render items based on view mode and type
  const renderItems = (items: SpaceItem[], type: string) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">
            {type === 'subspaces' && <FolderOpen className="h-12 w-12 mx-auto mb-4" />}
            {type === 'projects' && <Briefcase className="h-12 w-12 mx-auto mb-4" />}
            {type === 'tasks' && <CheckSquare className="h-12 w-12 mx-auto mb-4" />}
            {type === 'files' && <FileText className="h-12 w-12 mx-auto mb-4" />}
            {type === 'events' && <Calendar className="h-12 w-12 mx-auto mb-4" />}
          </div>
          <p className="text-gray-500">No {type} found</p>
          <Button className="mt-4" onClick={() => {}}>
            <Plus className="h-4 w-4 mr-2" />
            Create {type.slice(0, -1)}
          </Button>
        </div>
      );
    }

    const filteredItems = searchTerm 
      ? items.filter((item: SpaceItem) => 
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : items;

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item: SpaceItem) => (
            <Card key={item.itemId} className="hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {type === 'projects' && <Briefcase className="h-4 w-4 text-blue-500" />}
                    {type === 'tasks' && getStatusIcon(item.metadata?.status || 'pending')}
                    {(type === 'files' || type === 'documents' || type === 'notes') && <FileText className="h-4 w-4 text-gray-500" />}
                    {type === 'events' && <Calendar className="h-4 w-4 text-purple-500" />}
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
                <h4 className="font-medium mb-2 line-clamp-2">{item.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">{item.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'No date'}</span>
                  {item.metadata?.priority && (
                    <Badge variant={item.metadata.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
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

    return (
      <div className="space-y-2">
        {filteredItems.map((item: SpaceItem) => (
          <Card key={item.itemId} className="hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {type === 'projects' && <Briefcase className="h-4 w-4 text-blue-500" />}
                  {type === 'tasks' && getStatusIcon(item.metadata?.status || 'pending')}
                  {(type === 'files' || type === 'documents' || type === 'notes') && <FileText className="h-4 w-4 text-gray-500" />}
                  {type === 'events' && <Calendar className="h-4 w-4 text-purple-500" />}
                  <div className="flex-1">
                    <h4 className="font-medium">{item.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.itemType}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-auto">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="p-6">
          {/* Breadcrumb - Dynamic for any depth */}
          {(() => {
            const breadcrumbPath = buildBreadcrumbPath(spaceId, allFlatSpaces);
            if (breadcrumbPath.length === 0) return null;
            
            return (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <button
                  onClick={() => {
                    // Navigate back to all spaces view
                    window.dispatchEvent(new CustomEvent('spaceSelected', { detail: { spaceId: null } }));
                  }}
                  className="hover:text-gray-900 dark:hover:text-gray-100"
                >
                  All
                </button>
                {breadcrumbPath.map((breadcrumbSpace, index) => (
                  <div key={breadcrumbSpace.spaceId} className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4" />
                    {index === breadcrumbPath.length - 1 ? (
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        {breadcrumbSpace.spaceName}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          // Navigate to parent space using event system
                          window.dispatchEvent(new CustomEvent('spaceSelected', { detail: breadcrumbSpace }));
                        }}
                        className="hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        {breadcrumbSpace.spaceName}
                      </button>
                    )}
                  </div>
                ))}
                <ChevronRight className="h-4 w-4" />
                <span className="text-gray-900 dark:text-gray-100">{space.spaceName}</span>
              </div>
            );
          })()}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: space.color || '#3b82f6' }}
                >
                  {space.icon || (space.spaceName ? space.spaceName.charAt(0).toUpperCase() : 'S')}
                </div>
                <div>
                  {isEditing ? (
                    <Input
                      value={editedSpace.spaceName || space.spaceName || ''}
                      onChange={(e) => setEditedSpace({...editedSpace, spaceName: e.target.value})}
                      className="text-2xl font-bold h-8 border-none p-0 focus:ring-0"
                      onBlur={() => setIsEditing(false)}
                      autoFocus
                    />
                  ) : (
                    <h1 
                      className="text-2xl font-bold cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={() => setIsEditing(true)}
                    >
                      {space.spaceName || 'Unnamed Space'}
                    </h1>
                  )}
                  <p className="text-gray-600 dark:text-gray-400">{space.description || 'No description'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <Star className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Share className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Space
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Access
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
          <TabsContent value="overview" className="mt-0">
            <div className="p-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{subspaces.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Subspaces</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{projects.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Projects</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{tasks.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Tasks</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{files.length + documents.length + notes.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Files</div>
                </div>
              </div>

              {/* Child Spaces */}
              {subspaces.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Subspaces</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subspaces.map((childSpace: Space) => (
                      <Card key={childSpace.spaceId} className="hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => {
                              // Navigate to subspace using event system
                              window.dispatchEvent(new CustomEvent('spaceSelected', { detail: childSpace }));
                            }}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: childSpace.color || '#3b82f6' }}></div>
                                <span className="text-xs text-gray-500 uppercase">{childSpace.category || 'general'}</span>
                              </div>
                              <h4 className="font-medium mb-1">{childSpace.spaceName}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{childSpace.description}</p>
                            </div>
                            <Button variant="ghost" size="sm">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Individual Content Tabs */}
          {[
            { key: 'subspaces', items: subspaces, label: 'Subspaces' },
            { key: 'projects', items: projects, label: 'Projects' },
            { key: 'tasks', items: tasks, label: 'Tasks' },
            { key: 'files', items: [...files, ...documents, ...notes], label: 'Files' },
            { key: 'events', items: events, label: 'Events' }
          ].map(({ key, items, label }) => (
            <TabsContent key={key} value={key} className="mt-0">
              <div className="p-6">
                {/* Header with Search and View Controls */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold">{label}</h2>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder={`Search ${label.toLowerCase()}...`}
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
                    <Button onClick={() => {
                      const itemType = key === 'files' ? 'file' : key.slice(0, -1);
                      if (itemType === 'project') {
                        setShowProjectForm(true);
                      } else if (itemType === 'task') {
                        setShowTaskForm(true);
                      } else if (itemType === 'subspace') {
                        setShowSubspaceForm(true);
                      } else if (itemType === 'file') {
                        setShowFileForm(true);
                      } else if (itemType === 'event') {
                        setShowEventForm(true);
                      }
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add {label.slice(0, -1)}
                    </Button>
                  </div>
                </div>

                {/* Content */}
                {key === 'subspaces' ? (
                  subspaces.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subspaces.map((subspace: Space) => (
                        <Card key={subspace.spaceId} className="hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => {
                                const currentPath = buildSpacePath(space.spaceId, allFlatSpaces);
                                navigate(`/spaces/${currentPath}/${subspace.spaceId}`);
                              }}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subspace.color || '#3b82f6' }}></div>
                                  <span className="text-xs text-gray-500 uppercase">{subspace.category || 'general'}</span>
                                </div>
                                <h4 className="font-medium mb-1">{subspace.spaceName}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{subspace.description}</p>
                              </div>
                              <Button variant="ghost" size="sm">
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">No subspaces found</p>
                      <Button className="mt-4" onClick={() => setShowSubspaceForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Subspace
                      </Button>
                    </div>
                  )
                ) : (
                  renderItems(items, key)
                )}
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Project Form Modal */}
      {showProjectForm && (
        <ProjectForm
          isOpen={showProjectForm}
          onClose={() => setShowProjectForm(false)}
          onSubmit={(projectData) => {
            // Handle project creation with space assignment
            const projectWithSpace = {
              ...projectData,
              space_id: spaceId,
              space_name: space?.spaceName
            };
            
            // Make API call to create project
            apiRequest('POST', `/api/crm/projects`, projectWithSpace).then(() => {
              toast({
                title: "Project Created",
                description: `Project created and assigned to "${space?.spaceName}" space.`,
              });
              setShowProjectForm(false);
              queryClient.invalidateQueries({ queryKey: ['/api/spaces', spaceId, 'items'] });
              queryClient.invalidateQueries({ queryKey: ['/api/crm/projects'] });
            }).catch((error) => {
              toast({
                title: "Error",
                description: "Failed to create project. Please try again.",
                variant: "destructive"
              });
            });
          }}
        />
      )}

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskForm
          isOpen={showTaskForm}
          onClose={() => setShowTaskForm(false)}
          onSubmit={(taskData) => {
            // Handle task creation with space assignment
            const taskWithSpace = {
              ...taskData,
              space_id: spaceId,
              space_name: space?.spaceName
            };
            
            // Make API call to create task
            apiRequest('POST', `/api/crm/tasks`, taskWithSpace).then(() => {
              toast({
                title: "Task Created", 
                description: `Task created and assigned to "${space?.spaceName}" space.`,
              });
              setShowTaskForm(false);
              queryClient.invalidateQueries({ queryKey: ['/api/spaces', spaceId, 'items'] });
              queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
            }).catch((error) => {
              toast({
                title: "Error",
                description: "Failed to create task. Please try again.",
                variant: "destructive"
              });
            });
          }}
        />
      )}

      {/* Subspace Form Modal */}
      {showSubspaceForm && allSpaces && (
        <SpaceForm
          isOpen={showSubspaceForm}
          onClose={() => setShowSubspaceForm(false)}
          spaces={Array.isArray(allSpaces) ? allSpaces : []}
          onSubmit={(spaceIdParam, subspaceData) => {
            // Handle subspace creation with parent assignment
            const subspaceWithParent = {
              ...subspaceData,
              parentSpaceId: spaceId,
              category: space?.category || 'work'
            };
            
            apiRequest('POST', '/api/spaces', subspaceWithParent).then(() => {
              toast({
                title: "Subspace Created",
                description: `Subspace created within "${space?.spaceName}".`,
              });
              setShowSubspaceForm(false);
              queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
              queryClient.invalidateQueries({ queryKey: ['/api/spaces', spaceId, 'items'] });
            }).catch((error) => {
              toast({
                title: "Error",
                description: "Failed to create subspace. Please try again.",
                variant: "destructive"
              });
            });
          }}
        />
      )}

      {/* File/Document Placeholder Modal */}
      {showFileForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">File Management</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              File creation and management features will be implemented soon. For now, you can manage files through the main CRM modules.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setShowFileForm(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Event Placeholder Modal */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Event Management</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Event creation features will be implemented soon. For now, you can manage events through the main CRM modules.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setShowEventForm(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}