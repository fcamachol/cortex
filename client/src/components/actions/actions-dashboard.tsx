import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings, Activity, TrendingUp, Zap, Play, Pause, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionRuleForm } from "./action-rule-form";
import { ActionTemplatesGallery } from "./action-templates-gallery";
import { ActionExecutionLog } from "./action-execution-log";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ActionRule {
  ruleId: string;
  ruleName: string;
  description?: string;
  isActive: boolean;
  triggerType: string;
  actionType: string;
  triggerConditions: any;
  actionConfig: any;
  totalExecutions: number;
  lastExecutedAt?: string;
  createdAt: string;
}

interface ActionStats {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  recentExecutions: number;
}

export function ActionsDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ActionRule | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['/api/actions/rules'],
  });

  const { data: stats } = useQuery<ActionStats>({
    queryKey: ['/api/actions/stats'],
  });

  // Fetch GTD templates
  const { data: gtdTemplates = [] } = useQuery({
    queryKey: ['/api/actions/gtd-templates'],
    staleTime: 10 * 60 * 1000,
  });

  const toggleRuleMutation = useMutation({
    mutationFn: (ruleId: string) => apiRequest(`/api/actions/rules/${ruleId}/toggle`, {
      method: 'PATCH',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/actions/rules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions/stats'] });
      toast({
        title: "Rule updated",
        description: "Action rule status has been updated successfully",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => apiRequest(`/api/actions/rules/${ruleId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/actions/rules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions/stats'] });
      toast({
        title: "Rule deleted",
        description: "Action rule has been deleted successfully",
      });
    },
  });

  const getTriggerBadgeColor = (triggerType: string) => {
    switch (triggerType) {
      case 'reaction': return 'bg-yellow-500';
      case 'hashtag': return 'bg-blue-500';
      case 'keyword': return 'bg-green-500';
      case 'time_based': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType) {
      case 'create_task': return 'bg-orange-500';
      case 'create_calendar_event': return 'bg-indigo-500';
      case 'send_message': return 'bg-green-500';
      case 'add_label': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTriggerType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatActionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (showForm) {
    return (
      <ActionRuleForm
        rule={editingRule}
        onClose={() => {
          setShowForm(false);
          setEditingRule(null);
        }}
        onSave={() => {
          setShowForm(false);
          setEditingRule(null);
          queryClient.invalidateQueries({ queryKey: ['/api/actions/rules'] });
          queryClient.invalidateQueries({ queryKey: ['/api/actions/stats'] });
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-3xl font-bold">Actions & Automation</h1>
          <p className="text-muted-foreground mt-2">
            Create automated workflows triggered by WhatsApp events
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Rule
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Statistics Cards */}
        {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRules}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeRules}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalExecutions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent (24h)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.recentExecutions}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="gtd-templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gtd-templates">GTD Templates</TabsTrigger>
          <TabsTrigger value="rules">Custom Rules</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="executions">Execution Log</TabsTrigger>
        </TabsList>

        <TabsContent value="gtd-templates" className="space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">GTD Enhanced Emoji System</h3>
                <p className="text-sm text-muted-foreground">
                  Active automation rules using Getting Things Done methodology
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">{rules.filter(r => r.gtdTemplate).length} active rules</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetch('/api/actions/init-gtd-rules', { method: 'POST' })
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ['/api/actions/rules'] });
                        toast({
                          title: "GTD Rules Created",
                          description: "All GTD emoji rules are now active and can be modified",
                        });
                      });
                  }}
                >
                  Reset GTD Rules
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rules.filter((rule: any) => rule.gtdTemplate).map((rule: any) => (
                <Card key={rule.ruleId} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                          <span className="text-xl">{rule.triggerConditions.emoji}</span>
                        </div>
                        <div>
                          <CardTitle className="text-base">{rule.ruleName}</CardTitle>
                          <Badge variant="outline" className="text-xs mt-1">
                            {rule.actionType.replace('create_', '')}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingRule(rule);
                            setShowForm(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => toggleRuleMutation.mutate(rule.ruleId)}
                        />
                      </div>
                    </div>
                    <CardDescription className="text-sm mt-2">
                      {rule.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Category:</span>
                        <Badge variant="secondary" size="sm">
                          {rule.category?.replace('gtd-', '') || 'custom'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Priority:</span>
                        <Badge variant="outline" size="sm">
                          {rule.actionConfig.priority || 'medium'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="outline" size="sm" className={rule.isActive ? "text-green-600 border-green-300" : "text-gray-500 border-gray-300"}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {rule.actionConfig.tags && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rule.actionConfig.tags.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {rules.filter((rule: any) => rule.gtdTemplate).length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center space-y-2">
                    <Zap className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No GTD rules found. Click "Reset GTD Rules" to create all emoji automation rules.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* How to Use GTD */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  How to Use GTD System
                </CardTitle>
                <CardDescription>
                  Transform any WhatsApp message into organized tasks with simple emoji reactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <h4 className="font-semibold">1. Find a Message</h4>
                    <p className="text-sm text-muted-foreground">
                      Navigate to any WhatsApp conversation and find a message you want to convert
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">2. React with Emoji</h4>
                    <p className="text-sm text-muted-foreground">
                      React to the message with the appropriate GTD emoji (✅ for tasks, 🎯 for projects, etc.)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">3. Auto-Creation</h4>
                    <p className="text-sm text-muted-foreground">
                      The system automatically creates the appropriate item with full context and details
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 h-full overflow-auto">
          {rulesLoading ? (
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
          ) : Array.isArray(rules) && rules.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No action rules yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first automation rule to get started with WhatsApp event triggers
                </p>
                <Button onClick={() => setShowForm(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Your First Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
              {Array.isArray(rules) && rules.map((rule: ActionRule) => (
                <Card key={rule.ruleId} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{rule.ruleName}</CardTitle>
                        {rule.description && (
                          <CardDescription className="mt-1">
                            {rule.description}
                          </CardDescription>
                        )}
                      </div>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => toggleRuleMutation.mutate(rule.ruleId)}
                        disabled={toggleRuleMutation.isPending}
                      />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Badge 
                        variant="secondary" 
                        className={`text-white ${getTriggerBadgeColor(rule.triggerType)}`}
                      >
                        {formatTriggerType(rule.triggerType)}
                      </Badge>
                      <Badge 
                        variant="secondary"
                        className={`text-white ${getActionBadgeColor(rule.actionType)}`}
                      >
                        {formatActionType(rule.actionType)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Executions:</span>
                        <span className="font-medium">{rule.totalExecutions}</span>
                      </div>
                      {rule.lastExecutedAt && (
                        <div className="flex justify-between">
                          <span>Last run:</span>
                          <span className="font-medium">
                            {new Date(rule.lastExecutedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span className="font-medium">
                          {new Date(rule.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingRule(rule);
                          setShowForm(true);
                        }}
                        className="flex-1"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteRuleMutation.mutate(rule.ruleId)}
                        disabled={deleteRuleMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <ActionTemplatesGallery />
        </TabsContent>

        <TabsContent value="executions">
          <ActionExecutionLog />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}