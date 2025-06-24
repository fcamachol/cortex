import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Plus, 
  MoreHorizontal, 
  CheckSquare, 
  Briefcase, 
  FileText, 
  Calendar, 
  DollarSign,
  Users,
  Settings,
  Archive
} from "lucide-react";
import { Space, SpaceItem } from "@shared/schema";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface SpaceDetailViewProps {
  space: Space;
  onBack: () => void;
}

export function SpaceDetailView({ space, onBack }: SpaceDetailViewProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateItemDialog, setShowCreateItemDialog] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<string>("");

  const handleCreateItem = (itemType: string) => {
    setSelectedItemType(itemType);
    setShowCreateItemDialog(true);
  };

  // Fetch space items
  const { data: spaceItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['/api/space-items', space.spaceId],
    queryFn: async () => {
      const response = await fetch(`/api/space-items?spaceId=${space.spaceId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // Fetch child spaces
  const { data: childSpaces = [] } = useQuery({
    queryKey: ['/api/spaces', 'children', space.spaceId],
    queryFn: async () => {
      const response = await fetch(`/api/spaces?parentId=${space.spaceId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const getSpaceItemIcon = (itemType: string) => {
    switch (itemType) {
      case 'task': return CheckSquare;
      case 'project': return Briefcase;
      case 'note': return FileText;
      case 'document': return FileText;
      case 'event': return Calendar;
      case 'finance': return DollarSign;
      default: return FileText;
    }
  };

  const getItemsByType = (type: string) => {
    return spaceItems.filter((item: SpaceItem) => item.itemType === type);
  };

  const itemTypes = [
    { type: 'project', label: 'Projects', icon: Briefcase },
    { type: 'task', label: 'Tasks', icon: CheckSquare },
    { type: 'file', label: 'Files', icon: FileText },
    { type: 'document', label: 'Documents', icon: FileText },
    { type: 'note', label: 'Notes', icon: FileText },
    { type: 'event', label: 'Events', icon: Calendar }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
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
        </Tabs>
      </div>
      
      <CreateItemDialog
        isOpen={showCreateItemDialog}
        onClose={() => setShowCreateItemDialog(false)}
        spaceId={space.spaceId}
        itemType={selectedItemType}
      />
    </div>
  );
}