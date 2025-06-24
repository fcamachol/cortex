import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, FolderOpen, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CreateSpaceDialog } from '@/components/spaces/CreateSpaceDialog';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

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

  const handleCreateSubspace = (parentId: number) => {
    setParentSpaceId(parentId);
    setShowCreateDialog(true);
  };

  const handleCreateRootSpace = () => {
    setParentSpaceId(undefined);
    setShowCreateDialog(true);
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

  const renderSpace = (space: Space, level: number = 0) => {
    const hasChildren = space.childSpaces && space.childSpaces.length > 0;
    const isExpanded = expandedSpaces.has(space.spaceId);
    const isSelected = selectedSpaceId === space.spaceId;

    return (
      <div key={space.spaceId} className="space-y-1">
        <div 
          className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
            isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''
          }`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={() => {
            onSpaceSelect?.(space);
            setLocation(`/spaces?spaceId=${space.spaceId}`);
          }}
        >
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

        {/* Render Children */}
        {isExpanded && hasChildren && (
          <div className="space-y-1">
            {space.childSpaces!.map(childSpace => renderSpace(childSpace, level + 1))}
          </div>
        )}
      </div>
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
          <div className="space-y-3">
            {Object.entries(categorizedSpaces).map(([category, categorySpaces]) => (
              <div key={category} className="space-y-1">
                {category !== 'uncategorized' && (
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide px-2">
                    {category}
                  </div>
                )}
                <div className="space-y-1">
                  {categorySpaces.map(space => renderSpace(space))}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
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
                Create Space
              </Button>
            </div>
          )}
        </div>

      {/* Create Space Dialog */}
      <CreateSpaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        parentSpaceId={parentSpaceId}
      />
    </>
  );
}