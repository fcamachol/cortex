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
  onCreateItem?: (itemType: string) => void;
}

export function SpaceDetailView({ space, onBack, onCreateItem }: SpaceDetailViewProps) {
  const [activeTab, setActiveTab] = useState("overview");

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
    { type: 'task', label: 'Tasks', icon: CheckSquare },
    { type: 'project', label: 'Projects', icon: Briefcase },
    { type: 'note', label: 'Notes', icon: FileText },
    { type: 'document', label: 'Documents', icon: FileText },
    { type: 'event', label: 'Events', icon: Calendar },
    { type: 'finance', label: 'Finance', icon: DollarSign }
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Items ({spaceItems.length})</TabsTrigger>
            <TabsTrigger value="subspaces">Subspaces ({childSpaces.length})</TabsTrigger>
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

            {/* Items by Type */}
            <Card>
              <CardHeader>
                <CardTitle>Items by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {itemTypes.map(({ type, label, icon: Icon }) => {
                    const count = getItemsByType(type).length;
                    return (
                      <div key={type} className="flex items-center gap-3 p-3 rounded-lg border">
                        <Icon className="h-5 w-5 text-gray-600" />
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-sm text-gray-600">{count} items</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="items" className="mt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Space Items</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {itemTypes.map(({ type, label, icon: Icon }) => (
                    <DropdownMenuItem 
                      key={type}
                      onClick={() => onCreateItem?.(type)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {spaceItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No items yet</h3>
                <p className="text-sm mb-4">Start by adding your first item to this space</p>
                <Button onClick={() => onCreateItem?.('note')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {itemTypes.map(({ type, label, icon: Icon }) => {
                  const items = getItemsByType(type);
                  if (items.length === 0) return null;

                  return (
                    <Card key={type}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Icon className="h-5 w-5" />
                          {label} ({items.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {items.map((item: SpaceItem) => (
                            <div 
                              key={item.itemId} 
                              className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <Icon className="h-4 w-4 text-gray-600" />
                                <div>
                                  <div className="font-medium">{item.title}</div>
                                  {item.description && (
                                    <div className="text-sm text-gray-600">{item.description}</div>
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
                  );
                })}
              </div>
            )}
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
    </div>
  );
}