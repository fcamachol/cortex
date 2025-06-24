import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, RefreshCw, CheckSquare, DollarSign, Receipt, Clock, Target, FileText, Lightbulb, Calendar, FileImage, Bookmark } from "lucide-react";

export function GTDDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch GTD templates
  const { data: gtdTemplates = [], isLoading } = useQuery({
    queryKey: ["/api/actions/gtd-templates"],
    staleTime: 10 * 60 * 1000,
  });

  // Initialize GTD templates
  const initializeGTD = useMutation({
    mutationFn: () => apiRequest("/api/actions/init-gtd-templates", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions/gtd-templates"] });
      toast({
        title: "GTD System Initialized",
        description: "All GTD emoji templates are now active and ready to use",
      });
    },
  });

  const getEmojiIcon = (emoji: string) => {
    const iconMap: { [key: string]: any } = {
      "✅": CheckSquare,
      "💳": DollarSign,
      "🧾": Receipt,
      "⏳": Clock,
      "🎯": Target,
      "📋": FileText,
      "💡": Lightbulb,
      "📅": Calendar,
      "📝": Bookmark,
      "💾": FileImage,
    };
    return iconMap[emoji] || Sparkles;
  };

  const getCategoryColor = (category: string) => {
    const colorMap: { [key: string]: string } = {
      "gtd-actionable": "bg-green-50 text-green-700 border-green-200",
      "gtd-projects": "bg-blue-50 text-blue-700 border-blue-200",
      "gtd-future": "bg-purple-50 text-purple-700 border-purple-200",
      "gtd-reference": "bg-orange-50 text-orange-700 border-orange-200",
    };
    return colorMap[category] || "bg-gray-50 text-gray-700 border-gray-200";
  };

  const groupedTemplates = gtdTemplates.reduce((acc: any, template: any) => {
    const category = template.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">GTD Enhanced Emoji System</h2>
          <p className="text-muted-foreground">
            Transform WhatsApp messages into organized tasks using Getting Things Done methodology
          </p>
        </div>
        <Button
          onClick={() => initializeGTD.mutate()}
          disabled={initializeGTD.isPending}
          variant="outline"
        >
          {initializeGTD.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Initialize GTD System
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Templates</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gtdTemplates.length}</div>
            <p className="text-xs text-muted-foreground">GTD emoji triggers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actionable Items</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groupedTemplates["gtd-actionable"]?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Ready to execute</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groupedTemplates["gtd-projects"]?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Multi-step outcomes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reference</CardTitle>
            <Bookmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groupedTemplates["gtd-reference"]?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Information filing</p>
          </CardContent>
        </Card>
      </div>

      {/* GTD Templates by Category */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="actionable">Actionable Items</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="reference">Reference</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {Object.entries(groupedTemplates).map(([category, templates]: [string, any]) => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold capitalize">
                  {category.replace('gtd-', '').replace('-', ' ')}
                </h3>
                <Badge variant="secondary">{templates.length} templates</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template: any) => {
                  const IconComponent = getEmojiIcon(template.defaultConfig.triggerConditions.emoji);
                  return (
                    <Card key={template.templateId} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                              <span className="text-xl">{template.defaultConfig.triggerConditions.emoji}</span>
                            </div>
                            <div>
                              <CardTitle className="text-base">{template.templateName}</CardTitle>
                              <Badge variant="outline" className={`text-xs mt-1 ${getCategoryColor(category)}`}>
                                {template.actionType.replace('create_', '')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <CardDescription className="text-sm mt-2">
                          {template.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Priority:</span>
                            <Badge variant="outline" size="sm">
                              {template.defaultConfig.actionConfig.priority || 'medium'}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant="outline" size="sm">
                              {template.defaultConfig.actionConfig.status || 'active'}
                            </Badge>
                          </div>
                          {template.defaultConfig.actionConfig.tags && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.defaultConfig.actionConfig.tags.slice(0, 3).map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="actionable" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedTemplates["gtd-actionable"]?.map((template: any) => (
              <Card key={template.templateId} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{template.defaultConfig.triggerConditions.emoji}</span>
                    <div>
                      <CardTitle className="text-base">{template.templateName}</CardTitle>
                      <CardDescription className="text-sm">{template.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedTemplates["gtd-projects"]?.map((template: any) => (
              <Card key={template.templateId} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{template.defaultConfig.triggerConditions.emoji}</span>
                    <div>
                      <CardTitle className="text-base">{template.templateName}</CardTitle>
                      <CardDescription className="text-sm">{template.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reference" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupedTemplates["gtd-reference"]?.map((template: any) => (
              <Card key={template.templateId} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{template.defaultConfig.triggerConditions.emoji}</span>
                    <div>
                      <CardTitle className="text-base">{template.templateName}</CardTitle>
                      <CardDescription className="text-sm">{template.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* How to Use */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            How to Use GTD System
          </CardTitle>
          <CardDescription>
            Transform any WhatsApp message into organized tasks with simple emoji reactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-semibold">Step 1: Find a Message</h4>
              <p className="text-sm text-muted-foreground">
                Navigate to any WhatsApp conversation and find a message you want to convert
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Step 2: React with Emoji</h4>
              <p className="text-sm text-muted-foreground">
                React to the message with the appropriate GTD emoji (✅ for tasks, 🎯 for projects, etc.)
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Step 3: Auto-Creation</h4>
              <p className="text-sm text-muted-foreground">
                The system automatically creates the appropriate item with full context and details
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {gtdTemplates.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Sparkles className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">GTD System Not Initialized</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Click the "Initialize GTD System" button to set up all emoji templates
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}