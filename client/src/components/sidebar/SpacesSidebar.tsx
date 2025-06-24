import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, FolderOpen, Folder, GripVertical } from 'lucide-react';
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
      // If it's an object with categories, flatten to array
      return Object.values(data).flat();
    }
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

  const renderSpace = (space: Space, level: number = 0, index: number = 0) => {
    const hasChildren = space.childSpaces && space.childSpaces.length > 0;
    const isExpanded = expandedSpaces.has(space.spaceId);
    const isSelected = selectedSpaceId === space.spaceId;

    return (
      <Draggable key={space.spaceId} draggableId={`space-${space.spaceId}`} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className="space-y-1"
          >
            <div 
              className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''
              } ${snapshot.isDragging ? 'shadow-lg bg-white dark:bg-gray-800 border border-blue-300' : ''}`}
              style={{ 
                paddingLeft: `${8 + level * 12}px`,
                borderLeft: level > 0 ? '2px solid #e5e7eb' : 'none',
                marginLeft: level > 0 ? '8px' : '0px'
              }}
              onClick={() => {
                onSpaceSelect?.(space);
                setLocation(`/spaces?spaceId=${space.spaceId}`);
              }}
            >
              {/* Drag Handle */}
              <div 
                {...provided.dragHandleProps}
                className="opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-3 w-3 text-gray-400" />
              </div>

              {/* Expand/Collapse Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) {
                    toggleExpanded(space.spaceId);
                  }
                }}
              >
                {hasChildren ? (
                  isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                ) : (
                  <div className="w-3 h-3" />
                )}
              </Button>

              {/* Space Icon */}
              <div 
                className="w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0"
                style={{ backgroundColor: space.color || '#3B82F6', color: 'white' }}
              >
                {space.icon || (hasChildren ? <FolderOpen className="h-3 w-3" /> : <Folder className="h-3 w-3" />)}
              </div>

              {/* Space Name */}
              <span className="flex-1 text-sm font-medium truncate">
                {space.spaceName}
              </span>

              {/* Category Badge */}
              {space.category && level === 0 && (
                <Badge variant="outline" className="text-xs h-4 px-1">
                  {space.category}
                </Badge>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateSubspace(space.spaceId);
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCreateSubspace(space.spaceId)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Subspace
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      Edit Space
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      Archive Space
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Render Children with Drop Zone */}
            {isExpanded && hasChildren && (
              <Droppable droppableId={`space-children-${space.spaceId}`} type="SPACE">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-1 ${
                      snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/20 rounded-md p-1' : ''
                    }`}
                    style={{ marginLeft: `${16 + level * 8}px` }}
                  >
                    {space.childSpaces!.map((childSpace, childIndex) => 
                      renderSpace(childSpace, level + 1, childIndex)
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}

            {/* Always show drop zone for spaces (whether they have children or not) */}
            <Droppable droppableId={`space-children-${space.spaceId}`} type="SPACE">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[8px] ${
                    snapshot.isDraggingOver 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 rounded-md p-1 my-1' 
                      : ''
                  }`}
                  style={{ marginLeft: `${24 + level * 12}px` }}
                >
                  {snapshot.isDraggingOver && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 text-center py-1">
                      Drop here to make subspace
                    </div>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
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
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
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
                    className="flex items-center justify-between px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer group transition-colors"
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
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        {categoryName}
                      </span>
                      <Badge variant="outline" className="text-xs h-4 px-1 opacity-60">
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
                          className={`space-y-1 ml-4 ${
                            snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2' : ''
                          }`}
                        >
                          {categorySpaces.map((space, index) => renderSpace(space, 0, index))}
                          {provided.placeholder}
                          
                          {/* Empty state for category */}
                          {categorySpaces.length === 0 && (
                            <div className="text-center py-4 text-gray-400">
                              <div className="text-xs">No spaces in {categoryName.toLowerCase()}</div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-xs"
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