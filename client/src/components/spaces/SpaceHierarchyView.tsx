import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  FolderIcon, 
  ProjectorIcon, 
  CheckSquareIcon, 
  StickyNoteIcon, 
  FileTextIcon, 
  CalendarIcon, 
  DollarSignIcon,
  PlusIcon,
  ChevronRightIcon
} from 'lucide-react';

interface SpaceHierarchyViewProps {
  spaceId: number;
}

const SpaceHierarchyView: React.FC<SpaceHierarchyViewProps> = ({ spaceId }) => {
  const { data: hierarchy, isLoading } = useQuery({
    queryKey: [`/api/spaces/${spaceId}/hierarchy`],
    enabled: !!spaceId
  });

  if (isLoading) {
    return <div className="p-6">Loading space hierarchy...</div>;
  }

  if (!hierarchy) {
    return <div className="p-6">Space not found</div>;
  }

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'project': return <ProjectorIcon className="h-4 w-4" />;
      case 'task': return <CheckSquareIcon className="h-4 w-4" />;
      case 'note': return <StickyNoteIcon className="h-4 w-4" />;
      case 'document': return <FileTextIcon className="h-4 w-4" />;
      case 'event': return <CalendarIcon className="h-4 w-4" />;
      case 'finance': return <DollarSignIcon className="h-4 w-4" />;
      default: return <FolderIcon className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'todo': return 'bg-gray-100 text-gray-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'approved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderItems = (items: any[], type: string) => {
    if (!items || items.length === 0) return null;

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {getItemIcon(type)}
            {type.charAt(0).toUpperCase() + type.slice(1)}s
            <Badge variant="secondary">{items.length}</Badge>
            <Button size="sm" variant="ghost" className="ml-auto">
              <PlusIcon className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item: any) => (
            <div key={item.itemId} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{item.title}</h4>
                <div className="flex items-center gap-2">
                  {item.priority && (
                    <Badge variant="outline" className="text-xs">
                      {item.priority}
                    </Badge>
                  )}
                  <Badge className={`text-xs ${getStatusColor(item.status)}`}>
                    {item.status}
                  </Badge>
                </div>
              </div>
              {item.description && (
                <p className="text-sm text-gray-600">{item.description}</p>
              )}
              {item.content && type === 'finance' && (
                <div className="text-sm text-gray-600">
                  Amount: {item.content.currency} {item.content.amount?.toLocaleString()}
                </div>
              )}
              {item.dueDate && (
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  Due: {new Date(item.dueDate).toLocaleDateString()}
                </div>
              )}
              {item.childItems && item.childItems.length > 0 && (
                <div className="ml-4 mt-2 space-y-1">
                  {item.childItems.map((child: any) => (
                    <div key={child.itemId} className="text-sm border-l-2 border-gray-200 pl-3">
                      <div className="flex items-center justify-between">
                        <span>{child.title}</span>
                        <Badge className={`text-xs ${getStatusColor(child.status)}`}>
                          {child.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Space Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{hierarchy.icon}</span>
          <div>
            <h1 className="text-2xl font-bold">{hierarchy.spaceName}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Badge variant="outline">{hierarchy.category}</Badge>
              <span>•</span>
              <span>Level {hierarchy.level}</span>
              <span>•</span>
              <span>{hierarchy.path}</span>
            </div>
          </div>
        </div>
        {hierarchy.description && (
          <p className="text-gray-600">{hierarchy.description}</p>
        )}
      </div>

      <Separator />

      {/* Subspaces */}
      {hierarchy.subspaces && hierarchy.subspaces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderIcon className="h-5 w-5" />
              Subspaces
              <Badge variant="secondary">{hierarchy.subspaces.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hierarchy.subspaces.map((subspace: any) => (
                <div key={subspace.spaceId} className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{subspace.icon}</span>
                    <h3 className="font-medium">{subspace.spaceName}</h3>
                    <ChevronRightIcon className="h-4 w-4 ml-auto text-gray-400" />
                  </div>
                  {subspace.description && (
                    <p className="text-sm text-gray-600">{subspace.description}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects */}
      {renderItems(hierarchy.projects, 'project')}

      {/* Tasks */}
      {renderItems(hierarchy.tasks, 'task')}

      {/* Notes */}
      {renderItems(hierarchy.notes, 'note')}

      {/* Documents */}
      {renderItems(hierarchy.documents, 'document')}

      {/* Events */}
      {renderItems(hierarchy.events, 'event')}

      {/* Finance */}
      {renderItems(hierarchy.finance, 'finance')}
    </div>
  );
};

export default SpaceHierarchyView;