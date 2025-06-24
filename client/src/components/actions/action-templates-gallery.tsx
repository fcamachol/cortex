import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Star, TrendingUp, Clock, MessageSquare, Calendar, CheckSquare, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ActionTemplate {
  templateId: string;
  templateName: string;
  description: string;
  category: string;
  triggerType: string;
  actionType: string;
  defaultConfig: any;
  usageCount: number;
  rating: number;
}

export function ActionTemplatesGallery() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(null);
  const [showUseDialog, setShowUseDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/actions/templates', selectedCategory],
  });

  const useTemplateMutation = useMutation({
    mutationFn: (data: { templateId: string; ruleName: string; customConfig?: any }) => 
      apiRequest(`/api/actions/rules/from-template/${data.templateId}`, {
        method: 'POST',
        body: {
          ruleName: data.ruleName,
          customConfig: data.customConfig,
        },
      }),
    onSuccess: () => {
      toast({
        title: "Rule created",
        description: "Action rule has been created from template successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/actions/rules'] });
      setShowUseDialog(false);
      setSelectedTemplate(null);
    },
  });

  const filteredTemplates = templates.filter((template: ActionTemplate) => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    const templateName = template.templateName || '';
    const description = template.description || '';
    const matchesSearch = templateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { value: "all", label: "All Templates" },
    { value: "productivity", label: "Productivity" },
    { value: "crm", label: "CRM" },
    { value: "automation", label: "Automation" },
    { value: "communication", label: "Communication" },
    { value: "tasks", label: "Task Management" },
  ];

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'create_task': return <CheckSquare className="w-4 h-4" />;
      case 'create_calendar_event': return <Calendar className="w-4 h-4" />;
      case 'send_message': return <MessageSquare className="w-4 h-4" />;
      case 'add_label': return <Tag className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'hashtag': return <Tag className="w-4 h-4" />;
      case 'reaction': return <Star className="w-4 h-4" />;
      case 'keyword': return <MessageSquare className="w-4 h-4" />;
      case 'time_based': return <Clock className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  const formatTriggerType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatActionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Mock templates for demonstration
  const mockTemplates = [
    {
      templateId: "template-1",
      templateName: "Todo from Hashtag",
      description: "Automatically create tasks when messages contain #todo hashtag",
      category: "productivity",
      triggerType: "hashtag",
      actionType: "create_task",
      defaultConfig: {
        triggerConditions: { hashtags: ["todo"] },
        actionConfig: { 
          title: "Task: {{content}}", 
          description: "Created from WhatsApp message by {{sender}}",
          priority: "medium"
        }
      },
      usageCount: 156,
      rating: 4.8
    },
    {
      templateId: "template-2",
      templateName: "Meeting Scheduler",
      description: "Create calendar events when messages contain meeting keywords",
      category: "productivity",
      triggerType: "keyword",
      actionType: "create_calendar_event",
      defaultConfig: {
        triggerConditions: { keywords: ["meeting", "call", "appointment"] },
        actionConfig: { 
          title: "Meeting: {{content}}", 
          durationMinutes: 60,
          location: "To be determined"
        }
      },
      usageCount: 89,
      rating: 4.6
    },
    {
      templateId: "template-3",
      templateName: "Auto Reply for Urgent",
      description: "Send automatic replies to messages marked as urgent",
      category: "communication",
      triggerType: "hashtag",
      actionType: "send_message",
      defaultConfig: {
        triggerConditions: { hashtags: ["urgent"] },
        actionConfig: { 
          message: "I've received your urgent message and will respond as soon as possible.",
          targetType: "same_chat"
        }
      },
      usageCount: 234,
      rating: 4.9
    },
    {
      templateId: "template-4",
      templateName: "Label Important Messages",
      description: "Add 'important' label to messages with thumbs up reaction",
      category: "crm",
      triggerType: "reaction",
      actionType: "add_label",
      defaultConfig: {
        triggerConditions: { reactions: ["👍", "⭐"] },
        actionConfig: { labels: ["important", "follow-up"] }
      },
      usageCount: 67,
      rating: 4.4
    },
    {
      templateId: "template-5",
      templateName: "Reminder Notifications",
      description: "Send notifications for messages with reminder hashtags",
      category: "automation",
      triggerType: "hashtag",
      actionType: "send_notification",
      defaultConfig: {
        triggerConditions: { hashtags: ["reminder", "remember"] },
        actionConfig: { 
          title: "Reminder Alert",
          message: "Don't forget: {{content}}",
          type: "info"
        }
      },
      usageCount: 123,
      rating: 4.7
    }
  ];

  const displayTemplates = templates.length > 0 ? filteredTemplates : mockTemplates.filter((template: ActionTemplate) => {
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    const matchesSearch = template.templateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : displayTemplates.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search criteria or browse different categories
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayTemplates.map((template: ActionTemplate) => (
            <Card key={template.templateId} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getActionIcon(template.actionType)}
                      {template.templateName}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {template.description}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="gap-1">
                    {getTriggerIcon(template.triggerType)}
                    {formatTriggerType(template.triggerType)}
                  </Badge>
                  <Badge variant="secondary">
                    {formatActionType(template.actionType)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Category:</span>
                    <span className="font-medium capitalize">{template.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Used by:</span>
                    <span className="font-medium flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {template.usageCount} users
                    </span>
                  </div>
                  {template.rating && (
                    <div className="flex justify-between">
                      <span>Rating:</span>
                      <span className="font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {template.rating}/5
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  className="w-full mt-4"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setShowUseDialog(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showUseDialog} onOpenChange={setShowUseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Use Template: {selectedTemplate?.templateName}</DialogTitle>
            <DialogDescription>
              Create a new action rule based on this template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rule Name</label>
              <Input
                placeholder="Enter a name for your rule"
                defaultValue={selectedTemplate?.templateName}
                id="rule-name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUseDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  const ruleName = (document.getElementById('rule-name') as HTMLInputElement)?.value;
                  if (selectedTemplate && ruleName) {
                    useTemplateMutation.mutate({
                      templateId: selectedTemplate.templateId,
                      ruleName,
                    });
                  }
                }}
                disabled={useTemplateMutation.isPending}
              >
                Create Rule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}