import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, FolderOpen, Folder, GripVertical, CheckSquare, FileText, Calendar, DollarSign, Briefcase, Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CreateSpaceDialog } from '@/components/spaces/CreateSpaceDialog';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { apiRequest } from '@/lib/queryClient';

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
}

interface SpacesSidebarProps {
  onSpaceSelect?: (space: Space) => void;
  selectedSpaceId?: number;
}

export function SpacesSidebar({ onSpaceSelect, selectedSpaceId }: SpacesSidebarProps) {
  const [expandedSpaces, setExpandedSpaces] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['work', 'personal']));
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [parentSpaceId, setParentSpaceId] = useState<number | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch spaces data
  const { data: spaces, isLoading } = useQuery({
    queryKey: ['/api/spaces'],
    select: (data: any) => {
      if (!data) return [];
      // Handle both array format and object format (categorized)
      if (Array.isArray(data)) return data;
      // If it's an object with categories, flatten to array but preserve childSpaces
      const flatSpaces = Object.values(data).flat();
      console.log('Spaces with children:', flatSpaces.filter(s => s.childSpaces && s.childSpaces.length > 0).map(s => `${s.spaceName}: ${s.childSpaces.length} children`));
      return flatSpaces;
    }
  });

  // Fetch space items for each space
  const { data: spaceItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['/api/space-items'],
    queryFn: async () => {
      const response = await fetch('/api/space-items');
      if (!response.ok) {
        console.warn('Failed to fetch space items:', response.status);
        return [];
      }
      const data = await response.json();
      console.log('Fetched space items:', data);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!spaces && spaces.length > 0
  });

  const toggleExpanded = (spaceId: number) => {
    const newExpanded = new Set(expandedSpaces);
    if (newExpanded.has(spaceId)) {
      newExpanded.delete(spaceId);
    } else {
      newExpanded.add(spaceId);
    }
    setExpandedSpaces(newExpanded);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCreateSubspace = (parentId: number) => {
    // Auto-expand parent when creating subspace
    setExpandedSpaces(prev => new Set([...prev, parentId]));
    setParentSpaceId(parentId);
    setShowCreateDialog(true);
  };

  const handleCreateItem = (spaceId: number, itemType: string) => {
    if (itemType === 'subspace') {
      handleCreateSubspace(spaceId);
    } else {
      setSelectedSpaceId(spaceId);
      setSelectedItemType(itemType);
      setShowCreateItemDialog(true);
    }
  };

  // Expose expand function globally for CreateSpaceDialog
  React.useEffect(() => {
    window.expandSpace = (spaceId: number) => {
      setExpandedSpaces(prev => new Set([...prev, spaceId]));
    };
    window.expandCategory = (category: string) => {
      setExpandedCategories(prev => new Set([...prev, category]));
    };
    return () => {
      delete window.expandSpace;
      delete window.expandCategory;
    };
  }, []);

  const handleCreateRootSpace = () => {
    setParentSpaceId(undefined);
    setShowCreateDialog(true);
  };

  // Update space parent mutation
  const updateSpaceMutation = useMutation({
    mutationFn: async ({ spaceId, newParentId }: { spaceId: number; newParentId?: number }) => {
      const response = await apiRequest('PATCH', `/api/spaces/${spaceId}`, {
        parentSpaceId: newParentId
      });
      return response.json();
    },
    onSuccess: (updatedSpace) => {
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
      
      // Auto-expand parent space when a subspace is created
      if (updatedSpace.parentSpaceId) {
        setExpandedSpaces(prev => new Set([...prev, updatedSpace.parentSpaceId]));
      }
      
      toast({
        title: "Space moved",
        description: "Space hierarchy updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move space",
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const spaceId = parseInt(draggableId.replace('space-', ''));
    
    // Extract parent ID from destination droppableId
    let newParentId: number | undefined;
    
    if (destination.droppableId.startsWith('space-children-')) {
      newParentId = parseInt(destination.droppableId.replace('space-children-', ''));
    } else if (destination.droppableId.startsWith('space-')) {
      // Dropping onto a space makes it a child of that space
      newParentId = parseInt(destination.droppableId.replace('space-', ''));
    } else if (destination.droppableId.startsWith('category-')) {
      // Dropping into category means making it a root space
      newParentId = undefined;
    }

    // Don't allow dropping a space into itself or its children
    const spacesArray = Array.isArray(spaces) ? spaces : Object.values(spaces || {}).flat();
    const draggedSpace = spacesArray.find((s: Space) => s.spaceId === spaceId);
    
    if (draggedSpace && newParentId) {
      const isDescendant = (parentId: number, checkId: number): boolean => {
        const children = spacesArray.filter((s: Space) => s.parentSpaceId === parentId);
        return children.some((child: Space) => 
          child.spaceId === checkId || isDescendant(child.spaceId, checkId)
        );
      };
      
      if (spaceId === newParentId || isDescendant(spaceId, newParentId)) {
        toast({
          title: "Invalid move",
          description: "Cannot move a space into itself or its children.",
          variant: "destructive",
        });
        return;
      }
    }

    // Check if the move actually changes anything
    if (draggedSpace?.parentSpaceId === newParentId) {
      return; // No change needed
    }

    console.log('Moving space:', spaceId, 'to parent:', newParentId);
    updateSpaceMutation.mutate({ spaceId, newParentId });
  };

  const buildHierarchy = (spaces: Space[]): Space[] => {
    const spacesMap = new Map<number, Space>();
    const rootSpaces: Space[] = [];

    // Create map and initialize childSpaces
    spaces.forEach(space => {
      spacesMap.set(space.spaceId, { ...space, childSpaces: [] });
    });

    // Build hierarchy
    spaces.forEach(space => {
      if (space.parentSpaceId) {
        const parent = spacesMap.get(space.parentSpaceId);
        if (parent) {
          parent.childSpaces!.push(spacesMap.get(space.spaceId)!);
        }
      } else {
        rootSpaces.push(spacesMap.get(space.spaceId)!);
      }
    });

    return rootSpaces;
  };

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

  const getSpaceItems = (spaceId: number) => {
    if (!spaceItems) return [];
    const items = spaceItems.filter((item: SpaceItem) => item.spaceId === spaceId);
    console.log(`Space ${spaceId} items:`, items);
    return items;
  };

  const getChildSpaces = (parentSpaceId: number): Space[] => {
    if (!spaces) return [];
    
    // Function to recursively find a space by ID in the nested structure
    const findSpaceById = (spaceList: Space[], targetId: number): Space | null => {
      for (const space of spaceList) {
        if (space.spaceId === targetId) {
          return space;
        }
        if (space.childSpaces && space.childSpaces.length > 0) {
          const found = findSpaceById(space.childSpaces, targetId);
          if (found) return found;
        }
      }
      return null;
    };
    
    const parentSpace = findSpaceById(spaces, parentSpaceId);
    if (parentSpace && parentSpace.childSpaces && parentSpace.childSpaces.length > 0) {
      console.log(`Found children for space ${parentSpaceId}:`, parentSpace.childSpaces.map(c => `${c.spaceName} (ID: ${c.spaceId})`));
      return parentSpace.childSpaces;
    }
    console.log(`No children found for space ${parentSpaceId}`);
    return [];
  };

  const renderSpace = (space: Space, level: number = 0, index: number = 0) => {
    const children = getChildSpaces(space.spaceId);
    const hasChildren = children && children.length > 0;
    const isExpanded = expandedSpaces.has(space.spaceId);
    const isSelected = selectedSpaceId === space.spaceId;
    const items = getSpaceItems(space.spaceId);
    const hasItems = items.length > 0;
    
    console.log(`${'  '.repeat(level)}Space "${space.spaceName}" (ID: ${space.spaceId}, Level: ${level}, Category: ${space.category}):`, {
      hasItems,
      hasChildren,
      itemsCount: items?.length || 0,
      childrenCount: children?.length || 0,
      children: children?.map(c => c.spaceName) || []
    });

    return (
      <Draggable key={space.spaceId} draggableId={`space-${space.spaceId}`} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className="space-y-0.5"
          >
            {/* Make each space a drop target for folder-like behavior */}
            <Droppable droppableId={`space-${space.spaceId}`} type="SPACE">
              {(dropProvided, dropSnapshot) => (
                <div
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                >
                  <div 
                    className={`group flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''
                    } ${dropSnapshot.isDraggingOver ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400' : ''} ${snapshot.isDragging ? 'opacity-50' : ''}`}
                    style={{ 
                      paddingLeft: `${4 + level * 6}px`
                    }}
                    onClick={() => {
                      onSpaceSelect?.(space);
                    }}
                  >
              {/* Drag Handle */}
              <div 
                {...provided.dragHandleProps}
                className="opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-2.5 w-2.5 text-gray-400" />
              </div>

              {/* Expand/Collapse Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-3 w-3 p-0 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren || hasItems) {
                    toggleExpanded(space.spaceId);
                  }
                }}
              >
                {(hasChildren || hasItems) ? (
                  isExpanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />
                ) : (
                  <div className="w-2.5 h-2.5" />
                )}
              </Button>

              {/* Space Icon */}
              <div 
                className="w-4 h-4 rounded flex items-center justify-center text-xs flex-shrink-0"
                style={{ backgroundColor: space.color || '#3B82F6', color: 'white' }}
              >
                {space.icon || (hasChildren ? <FolderOpen className="h-2.5 w-2.5" /> : <Folder className="h-2.5 w-2.5" />)}
              </div>

              {/* Space Name */}
              <span className="flex-1 text-base font-medium truncate">
                {space.spaceName}
              </span>

              {/* Item Count Badge */}
              {hasItems && (
                <Badge variant="outline" className="text-sm h-4 px-1 opacity-60">
                  {items.length}
                </Badge>
              )}

              {/* Category badge removed per user request - redundant with section headers */}

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCreateItem(space.spaceId, 'subspace')}>
                      <Folder className="h-4 w-4 mr-2" />
                      Subspace
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCreateItem(space.spaceId, 'project')}>
                      <Briefcase className="h-4 w-4 mr-2" />
                      Project
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCreateItem(space.spaceId, 'task')}>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Task
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCreateItem(space.spaceId, 'file')}>
                      <FileText className="h-4 w-4 mr-2" />
                      File
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCreateItem(space.spaceId, 'document')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Document
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCreateItem(space.spaceId, 'note')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Note
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCreateItem(space.spaceId, 'event')}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Event
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-2.5 w-2.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCreateSubspace(space.spaceId)}>
                      <Folder className="h-4 w-4 mr-2" />
                      Add Subspace
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <FileText className="h-4 w-4 mr-2" />
                      Edit Space
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      <Folder className="h-4 w-4 mr-2" />
                      Archive Space
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
                  </div>
                  {dropProvided.placeholder}
                </div>
              )}
            </Droppable>

            {/* Space Items Preview */}
            {isExpanded && hasItems && (
              <div 
                className="space-y-0.5 mt-1"
                style={{ marginLeft: `${24 + level * 16}px` }}
              >
                {/* Individual Items as separate rows */}
                {items.slice(0, 5).map((item: SpaceItem) => {
                  const IconComponent = getSpaceItemIcon(item.itemType);
                  return (
                    <div
                      key={item.itemId}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors group"
                      onClick={() => {
                        setLocation(`/spaces/${space.spaceId}?item=${item.itemId}`);
                      }}
                    >
                      <IconComponent className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="truncate flex-1 font-medium">{item.title}</span>
                      
                      {/* Item count or status badge */}
                      {item.itemType === 'task' && item.metadata?.status && (
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {item.metadata.status}
                        </span>
                      )}
                      {item.itemType === 'project' && (
                        <span className="text-xs text-gray-400">
                          {Math.floor(Math.random() * 10) + 1}
                        </span>
                      )}

                      {/* Action buttons on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle more options
                          }}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/spaces/${space.spaceId}?new=true`);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                
                {items.length > 5 && (
                  <div className="px-2 py-1 text-xs text-gray-400">
                    +{items.length - 5} more items
                  </div>
                )}
              </div>
            )}

            {/* Show empty state when expanded but no items */}
            {isExpanded && !hasItems && !hasChildren && (
              <div 
                className="mt-1"
                style={{ marginLeft: `${24 + level * 16}px` }}
              >
                <div className="px-2 py-2 text-xs text-gray-400">
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">No items yet</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => setLocation(`/spaces/${space.spaceId}?new=true`)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add item
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Render Children - No separate drop zone, just use individual space targets */}
            {isExpanded && hasChildren && (
              <div
                className="space-y-0.5 mt-0.5"
                style={{ marginLeft: `${4 + level * 6}px` }}
              >
                {children.map((childSpace, childIndex) => (
                  <div key={childSpace.spaceId}>
                    {renderSpace(childSpace, level + 1, childIndex)}
                  </div>
                ))}
              </div>
            )}

            {/* Space Items Preview */}
            {isExpanded && hasItems && (
              <div 
                className="ml-6 space-y-1"
                style={{ marginLeft: `${32 + level * 12}px` }}
              >
                {items.slice(0, 5).map((item: SpaceItem) => {
                  const IconComponent = getSpaceItemIcon(item.itemType);
                  return (
                    <div
                      key={item.itemId}
                      className="flex items-center gap-2 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors"
                      onClick={() => {
                        // Navigate to specific item view
                        setLocation(`/spaces/${space.spaceId}?item=${item.itemId}`);
                      }}
                    >
                      <IconComponent className="h-3 w-3 opacity-60" />
                      <span className="truncate">{item.title}</span>
                      {item.itemType === 'task' && item.metadata?.status && (
                        <Badge variant="outline" className="text-xs h-4 px-1">
                          {item.metadata.status}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                
                {items.length > 5 && (
                  <div className="px-2 py-1 text-xs text-gray-400">
                    +{items.length - 5} more items
                  </div>
                )}
                
                {/* Quick Add Item */}
                <div className="px-2 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-full justify-start text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => {
                      // Navigate to space with new item dialog
                      setLocation(`/spaces/${space.spaceId}?new=true`);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add item
                  </Button>
                </div>
              </div>
            )}

            {/* Show workspace/content summary when expanded but no items */}
            {isExpanded && !hasItems && !hasChildren && (
              <div 
                className="ml-6 px-2 py-2 text-xs text-gray-400"
                style={{ marginLeft: `${32 + level * 12}px` }}
              >
                <div className="text-center">
                  <Folder className="h-4 w-4 mx-auto mb-1 opacity-40" />
                  <div>Empty space</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 mt-1 text-xs"
                    onClick={() => setLocation(`/spaces/${space.spaceId}?new=true`)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add content
                  </Button>
                </div>
              </div>
            )}


          </div>
        )}
      </Draggable>
    );
  };

  if (isLoading) {
    return (
      <Card className="w-64">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hierarchicalSpaces = buildHierarchy(spaces || []);

  // Group by category
  const categorizedSpaces = hierarchicalSpaces.reduce((acc, space) => {
    const category = space.category || 'uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(space);
    return acc;
  }, {} as Record<string, Space[]>);

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium text-gray-600 dark:text-gray-400">
              Teamspaces
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleCreateRootSpace}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Spaces List */}
          <div className="space-y-2">
            {Object.entries(categorizedSpaces).map(([category, categorySpaces]) => {
              const isCategoryExpanded = expandedCategories.has(category);
              const categoryName = category === 'uncategorized' ? 'Other' : category.charAt(0).toUpperCase() + category.slice(1);
              
              return (
                <div key={category} className="space-y-1">
                  {/* Category Header */}
                  <div 
                    className="flex items-center justify-between px-1 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer group transition-colors"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 opacity-60 hover:opacity-100"
                      >
                        {isCategoryExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </Button>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        {categoryName}
                      </span>
                      <Badge variant="outline" className="text-sm h-5 px-2 opacity-60">
                        {categorySpaces.length}
                      </Badge>
                    </div>
                    
                    {/* Category Actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateRootSpace();
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Category Content */}
                  {isCategoryExpanded && (
                    <Droppable droppableId={`category-${category}`} type="SPACE">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`space-y-1 ml-0.5 ${
                            snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg p-1' : ''
                          }`}
                        >
                          {categorySpaces.map((space, index) => renderSpace(space, 0, index))}
                          {provided.placeholder}
                          
                          {/* Empty state for category */}
                          {categorySpaces.length === 0 && (
                            <div className="text-center py-4 text-gray-400">
                              <div className="text-sm">No spaces in {categoryName.toLowerCase()}</div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-sm"
                                onClick={handleCreateRootSpace}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Space
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              );
            })}
          </div>

          {/* Global Empty State */}
          {hierarchicalSpaces.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <Folder className="h-8 w-8 mx-auto" />
              </div>
              <p className="text-sm text-gray-500 mb-3">
                No spaces yet
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateRootSpace}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Space
              </Button>
            </div>
          )}

          {/* Collapse All / Expand All */}
          {hierarchicalSpaces.length > 0 && (
            <div className="flex justify-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setExpandedCategories(new Set(['work', 'personal', 'uncategorized']))}
                >
                  Expand All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setExpandedCategories(new Set())}
                >
                  Collapse All
                </Button>
              </div>
            </div>
          )}
        </div>
      </DragDropContext>

      {/* Create Space Dialog */}
      <CreateSpaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        parentSpaceId={parentSpaceId}
      />
    </>
  );
}