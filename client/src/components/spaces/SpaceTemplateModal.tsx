import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Users, Briefcase, User, Archive, Zap } from 'lucide-react';

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

interface SpaceTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: SpaceTemplate[];
  onSelectTemplate: (template: SpaceTemplate, customData: any) => void;
}

const defaultTemplates: SpaceTemplate[] = [
  {
    templateId: 1,
    templateName: 'Team Workspace',
    description: 'Collaborative workspace for team projects with kanban boards and task management',
    icon: '👥',
    category: 'Team',
    templateType: 'space',
    config: {
      spaceType: 'team',
      privacy: 'private',
      defaultViews: ['board', 'calendar', 'list'],
      features: ['tasks', 'projects', 'files', 'discussions']
    },
    usageCount: 1250
  },
  {
    templateId: 2,
    templateName: 'Project Management',
    description: 'Complete project management setup with milestones, tasks, and timeline tracking',
    icon: '🚀',
    category: 'Project',
    templateType: 'space',
    config: {
      spaceType: 'project',
      privacy: 'restricted',
      defaultViews: ['timeline', 'board', 'calendar'],
      features: ['milestones', 'tasks', 'gantt', 'reports']
    },
    usageCount: 890
  },
  {
    templateId: 3,
    templateName: 'Personal Productivity',
    description: 'Personal workspace for managing your tasks, goals, and habits',
    icon: '📝',
    category: 'Personal',
    templateType: 'space',
    config: {
      spaceType: 'personal',
      privacy: 'private',
      defaultViews: ['list', 'calendar'],
      features: ['tasks', 'goals', 'habits', 'notes']
    },
    usageCount: 2100
  },
  {
    templateId: 4,
    templateName: 'Client Portal',
    description: 'Client-facing workspace for project collaboration and communication',
    icon: '🤝',
    category: 'Business',
    templateType: 'space',
    config: {
      spaceType: 'workspace',
      privacy: 'restricted',
      defaultViews: ['board', 'files'],
      features: ['client-access', 'messaging', 'files', 'invoicing']
    },
    usageCount: 567
  },
  {
    templateId: 5,
    templateName: 'Knowledge Base',
    description: 'Documentation and knowledge sharing workspace',
    icon: '📚',
    category: 'Documentation',
    templateType: 'space',
    config: {
      spaceType: 'workspace',
      privacy: 'public',
      defaultViews: ['pages', 'search'],
      features: ['wiki', 'search', 'comments', 'versions']
    },
    usageCount: 445
  },
  {
    templateId: 6,
    templateName: 'Marketing Campaign',
    description: 'Marketing campaign management with content calendar and asset tracking',
    icon: '📢',
    category: 'Marketing',
    templateType: 'space',
    config: {
      spaceType: 'project',
      privacy: 'private',
      defaultViews: ['calendar', 'board', 'table'],
      features: ['content-calendar', 'assets', 'campaigns', 'analytics']
    },
    usageCount: 332
  }
];

export function SpaceTemplateModal({ isOpen, onClose, templates = [], onSelectTemplate }: SpaceTemplateModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<SpaceTemplate | null>(null);
  const [customSpaceName, setCustomSpaceName] = useState('');

  // Combine provided templates with defaults
  const allTemplates = [...defaultTemplates, ...templates];

  // Get unique categories
  const categories = ['all', ...new Set(allTemplates.map(t => t.category))];

  // Filter templates
  const filteredTemplates = allTemplates.filter(template => {
    const matchesSearch = !searchQuery || 
      template.templateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'team': return <Users className="h-4 w-4" />;
      case 'project': return <Briefcase className="h-4 w-4" />;
      case 'personal': return <User className="h-4 w-4" />;
      case 'business': return <Briefcase className="h-4 w-4" />;
      case 'documentation': return <Archive className="h-4 w-4" />;
      case 'marketing': return <Zap className="h-4 w-4" />;
      default: return <Briefcase className="h-4 w-4" />;
    }
  };

  const handleTemplateSelect = (template: SpaceTemplate) => {
    if (selectedTemplate?.templateId === template.templateId) {
      // If clicking the same template, deselect it
      setSelectedTemplate(null);
      setCustomSpaceName('');
    } else {
      setSelectedTemplate(template);
      setCustomSpaceName(template.templateName);
    }
  };

  const handleCreateFromTemplate = () => {
    if (!selectedTemplate) return;
    
    const customData = {
      spaceName: customSpaceName || selectedTemplate.templateName,
      description: selectedTemplate.description,
      icon: selectedTemplate.icon,
      ...selectedTemplate.config
    };
    
    onSelectTemplate(selectedTemplate, customData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Space from Template</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Categories */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.filter(c => c !== 'all').map(category => (
                <TabsTrigger key={category} value={category} className="flex items-center gap-1">
                  {getCategoryIcon(category)}
                  <span className="hidden sm:inline">{category}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="flex-1 overflow-y-auto">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.templateId}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate?.templateId === template.templateId 
                        ? 'ring-2 ring-primary border-primary' 
                        : ''
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-2xl">{template.icon}</div>
                          <div>
                            <CardTitle className="text-base">{template.templateName}</CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {template.category}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {template.usageCount} uses
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {template.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {template.config.features?.slice(0, 3).map((feature: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {template.config.features?.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.config.features.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Selected Template Details */}
          {selectedTemplate && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-2xl">{selectedTemplate.icon}</span>
                  {selectedTemplate.templateName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Space Name</label>
                  <Input
                    value={customSpaceName}
                    onChange={(e) => setCustomSpaceName(e.target.value)}
                    placeholder="Enter space name..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Features Included:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.config.features?.map((feature: string, index: number) => (
                      <Badge key={index} variant="default" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Default Views:</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.config.defaultViews?.map((view: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {view}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateFromTemplate} 
            disabled={!selectedTemplate || !customSpaceName.trim()}
          >
            Create Space
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}