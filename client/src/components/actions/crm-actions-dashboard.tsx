import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Hash, MessageSquare, Calendar, Bell, CheckSquare, Activity, Settings, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CRMActionMapping {
  mapping_id: number;
  instance_id: string;
  trigger_type: string;
  trigger_value: string;
  action_type: string;
  default_title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ActionStats {
  totalMappings: number;
  activeMappings: number;
  totalExecutions: number;
  recentExecutions: number;
}

export function CRMActionsDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");

  // Fetch CRM action mappings
  const { data: actionMappings = [], isLoading: mappingsLoading } = useQuery<CRMActionMapping[]>({
    queryKey: ['/api/crm/action-mappings'],
  });

  // Fetch execution stats
  const { data: executionStats } = useQuery<ActionStats>({
    queryKey: ['/api/crm/action-stats'],
  });

  // Calculate real stats
  const stats: ActionStats = executionStats || {
    totalMappings: actionMappings.length,
    activeMappings: actionMappings.filter(mapping => mapping.is_active).length,
    totalExecutions: 0,
    recentExecutions: 0,
  };

  // Filter mappings
  const filteredMappings = actionMappings.filter(mapping => {
    const matchesSearch = 
      mapping.trigger_value?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mapping.default_title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && mapping.is_active) ||
      (statusFilter === "inactive" && !mapping.is_active);
    const matchesTrigger = triggerFilter === "all" || mapping.trigger_type === triggerFilter;
    
    return matchesSearch && matchesStatus && matchesTrigger;
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

  const formatTriggerType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatActionType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CRM Actions & Automation</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage WhatsApp to CRM automation workflows and triggers
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Mapping
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search action mappings..."
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
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={triggerFilter} onValueChange={setTriggerFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Triggers</SelectItem>
              <SelectItem value="hashtag">Hashtag</SelectItem>
              <SelectItem value="reaction">Reaction</SelectItem>
              <SelectItem value="keyword">Keyword</SelectItem>
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
              <CardTitle className="text-sm font-medium">Total Mappings</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMappings}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Mappings</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeMappings}</div>
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

        {/* CRM Action Mappings List */}
        <Card>
          <CardHeader>
            <CardTitle>CRM Action Mappings</CardTitle>
            <CardDescription>
              WhatsApp trigger to CRM action mappings for your instances
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mappingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No CRM action mappings found</h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery || statusFilter !== "all" || triggerFilter !== "all"
                    ? "No mappings match your current filters." 
                    : "Create your first CRM action mapping to automate WhatsApp to CRM workflows."}
                </p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Mapping
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMappings.map((mapping) => (
                  <div key={mapping.mapping_id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        {getTriggerIcon(mapping.trigger_type)}
                        <span className="text-sm text-gray-500">→</span>
                        {getActionIcon(mapping.action_type)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {mapping.default_title || `${formatTriggerType(mapping.trigger_type)} → ${formatActionType(mapping.action_type)}`}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Trigger: <span className="font-mono">{mapping.trigger_value}</span> → {formatActionType(mapping.action_type)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Instance: {mapping.instance_id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={mapping.is_active ? "default" : "secondary"}>
                        {mapping.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
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
    </div>
  );
}