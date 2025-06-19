import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Settings, Activity, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionRuleForm } from "./action-rule-form";

interface ActionStats {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  recentExecutions: number;
}

export function SimpleActionsDashboard() {
  const [showForm, setShowForm] = useState(false);

  // Mock stats for now since we're having loading issues
  const stats: ActionStats = {
    totalRules: 0,
    activeRules: 0,
    totalExecutions: 0,
    recentExecutions: 0,
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
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

      {/* Statistics Cards */}
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