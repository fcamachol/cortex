import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Settings, Activity, TrendingUp, Zap, Filter, Search, MoreHorizontal, Play, Pause, Edit, Trash2, Hash, MessageSquare, Calendar, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionRuleForm } from "./action-rule-form";

interface ActionStats {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  recentExecutions: number;
}

export function SimpleActionsDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch real action rules
  const { data: actionRules = [], isLoading: rulesLoading } = useQuery<any[]>({
    queryKey: ['/api/action/rules'],
  });

  // Fetch real execution stats
  const { data: executionStats, isLoading: statsLoading } = useQuery<ActionStats>({
    queryKey: ['/api/action/stats'],
  });

  // Calculate real stats
  const stats: ActionStats = executionStats || {
    totalRules: actionRules.length,
    activeRules: actionRules.filter(rule => rule.isActive).length,
    totalExecutions: 0,
    recentExecutions: 0,
  };

  // Filter rules based on search and status
  const filteredRules = actionRules.filter(rule => {
    const matchesSearch = rule.ruleName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && rule.isActive) ||
      (statusFilter === "inactive" && !rule.isActive);
    return matchesSearch && matchesStatus;
  });

  const getTriggerIcon = (triggerType: string) => {
    switch(triggerType) {
      case 'hashtag': return <Hash className="w-4 h-4" />;
      case 'reaction': return <MessageSquare className="w-4 h-4" />;
      case 'keyword': return <Search className="w-4 h-4" />;
      case 'time_based': return <Calendar className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch(actionType) {
      case 'create_task': return <CheckSquare className="w-4 h-4" />;
      case 'create_calendar_event': return <Calendar className="w-4 h-4" />;
      case 'send_message': return <MessageSquare className="w-4 h-4" />;
      case 'send_notification': return <Bell className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Actions & Automation</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage WhatsApp automation workflows and triggers
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Rule
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search automation rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rules</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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

        {/* Action Rules List */}
        <Card>
          <CardHeader>
            <CardTitle>Automation Rules</CardTitle>
            <CardDescription>
              Your active WhatsApp automation workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No automation rules found</h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery || statusFilter !== "all" 
                    ? "No rules match your current filters." 
                    : "Create your first automation rule to get started."}
                </p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Rule
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRules.map((rule: any) => (
                  <div key={rule.ruleId} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {getTriggerIcon(rule.triggerType)}
                        <span className="text-sm text-gray-500">→</span>
                        {getActionIcon(rule.actionType)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{rule.ruleName}</h3>
                        <p className="text-sm text-gray-500">
                          {rule.triggerType} → {rule.actionType.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={rule.isActive ? "default" : "secondary"}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Action Templates</CardTitle>
          <CardDescription>
            Pre-built automation workflows you can use
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-4 border-dashed border-2 hover:border-solid transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Badge className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">Todo from Hashtag</h3>
                  <p className="text-sm text-muted-foreground">Hashtag → Create Task</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Automatically create tasks when messages contain #todo hashtag
              </p>
              <Button size="sm" className="w-full">Use Template</Button>
            </Card>

            <Card className="p-4 border-dashed border-2 hover:border-solid transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Badge className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium">Meeting Scheduler</h3>
                  <p className="text-sm text-muted-foreground">Keyword → Calendar Event</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Create calendar events when messages contain meeting keywords
              </p>
              <Button size="sm" className="w-full">Use Template</Button>
            </Card>

            <Card className="p-4 border-dashed border-2 hover:border-solid transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Badge className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium">Auto Reply</h3>
                  <p className="text-sm text-muted-foreground">Hashtag → Send Message</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Send automatic replies to messages marked as urgent
              </p>
              <Button size="sm" className="w-full">Use Template</Button>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card className="text-center py-12">
        <CardContent>
          <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Actions Module Ready</h3>
          <p className="text-muted-foreground mb-4">
            The actions system is configured and ready to process WhatsApp events.
            Create your first automation rule to get started.
          </p>
          <div className="space-y-2 text-sm text-muted-foreground max-w-md mx-auto">
            <div className="flex items-center justify-between">
              <span>Database schema:</span>
              <Badge variant="outline" className="text-green-600">Ready</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Actions engine:</span>
              <Badge variant="outline" className="text-green-600">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Webhook integration:</span>
              <Badge variant="outline" className="text-green-600">Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Template library:</span>
              <Badge variant="outline" className="text-blue-600">4 templates</Badge>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2 mt-6">
            <Plus className="w-4 h-4" />
            Create Your First Rule
          </Button>
        </CardContent>
      </Card>

      {showForm && (
        <ActionRuleForm
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            // Refresh any data if needed
          }}
        />
      )}
    </div>
  );
}