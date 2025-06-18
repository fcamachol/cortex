import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, CheckCircle, XCircle, Clock, Filter, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ActionExecution {
  executionId: string;
  ruleId: string;
  triggeredBy: string;
  triggerData: any;
  status: string;
  result?: any;
  errorMessage?: string;
  executedAt: string;
  processingTimeMs?: number;
}

interface ActionRule {
  ruleId: string;
  ruleName: string;
  triggerType: string;
  actionType: string;
}

export function ActionExecutionLog() {
  const [selectedRule, setSelectedRule] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: rules = [] } = useQuery({
    queryKey: ['/api/actions/rules'],
  });

  const { data: executions = [], isLoading } = useQuery({
    queryKey: ['/api/actions/executions', selectedRule, statusFilter],
    enabled: selectedRule !== "all" || statusFilter !== "all",
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skipped':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500 text-white';
      case 'failed':
        return 'bg-red-500 text-white';
      case 'skipped':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const formatTriggerType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatActionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const filteredExecutions = executions.filter((execution: ActionExecution) => {
    if (searchQuery) {
      const rule = rules.find((r: ActionRule) => r.ruleId === execution.ruleId);
      const matchesSearch = 
        rule?.ruleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        execution.triggeredBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        execution.status.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
    }
    return true;
  });

  // Mock executions for demonstration
  const mockExecutions = [
    {
      executionId: "exec-1",
      ruleId: "rule-1",
      triggeredBy: "message-123",
      triggerData: {
        messageId: "message-123",
        content: "Don't forget the meeting tomorrow #todo",
        sender: "John Doe",
        hashtags: ["todo"]
      },
      status: "success",
      result: {
        taskId: "task-456",
        title: "Don't forget the meeting tomorrow"
      },
      executedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      processingTimeMs: 245
    },
    {
      executionId: "exec-2",
      ruleId: "rule-2",
      triggeredBy: "reaction-789",
      triggerData: {
        messageId: "message-456",
        reaction: "👍",
        content: "Great presentation today!",
        sender: "Jane Smith"
      },
      status: "success",
      result: {
        labels: ["important", "follow-up"]
      },
      executedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      processingTimeMs: 128
    },
    {
      executionId: "exec-3",
      ruleId: "rule-1",
      triggeredBy: "message-789",
      triggerData: {
        messageId: "message-789",
        content: "Schedule meeting for next week",
        sender: "Bob Wilson",
        keywords: ["meeting"]
      },
      status: "failed",
      errorMessage: "Calendar API not available",
      executedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      processingTimeMs: 2341
    },
    {
      executionId: "exec-4",
      ruleId: "rule-3",
      triggeredBy: "message-101",
      triggerData: {
        messageId: "message-101",
        content: "This is urgent! #urgent",
        sender: "Alice Johnson",
        hashtags: ["urgent"]
      },
      status: "success",
      result: {
        messageId: "reply-102",
        content: "I've received your urgent message and will respond as soon as possible."
      },
      executedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      processingTimeMs: 567
    }
  ];

  const displayExecutions = executions.length > 0 ? filteredExecutions : mockExecutions;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search executions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={selectedRule} onValueChange={setSelectedRule}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Rules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rules</SelectItem>
            {rules.map((rule: ActionRule) => (
              <SelectItem key={rule.ruleId} value={rule.ruleId}>
                {rule.ruleName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 rounded flex-1"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : displayExecutions.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No executions found</h3>
            <p className="text-muted-foreground">
              No action executions match your current filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Execution History</CardTitle>
            <CardDescription>
              Recent executions of your action rules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Executed</TableHead>
                  <TableHead>Processing Time</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayExecutions.map((execution: ActionExecution) => {
                  const rule = rules.find((r: ActionRule) => r.ruleId === execution.ruleId);
                  return (
                    <TableRow key={execution.executionId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(execution.status)}
                          <Badge className={getStatusBadgeColor(execution.status)}>
                            {execution.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {rule?.ruleName || 'Unknown Rule'}
                          </div>
                          {rule && (
                            <div className="text-sm text-muted-foreground">
                              {formatTriggerType(rule.triggerType)} → {formatActionType(rule.actionType)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{execution.triggeredBy}</div>
                          {execution.triggerData?.content && (
                            <div className="text-muted-foreground truncate max-w-32">
                              {execution.triggerData.content}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(execution.executedAt).toLocaleDateString()}
                          <div className="text-muted-foreground">
                            {new Date(execution.executedAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {execution.processingTimeMs && (
                          <Badge variant="outline">
                            {execution.processingTimeMs}ms
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {execution.status === 'success' && execution.result && (
                          <div className="text-sm text-green-600">
                            {execution.result.taskId && `Task: ${execution.result.taskId}`}
                            {execution.result.messageId && `Reply sent`}
                            {execution.result.labels && `Labels: ${execution.result.labels.join(', ')}`}
                          </div>
                        )}
                        {execution.status === 'failed' && execution.errorMessage && (
                          <div className="text-sm text-red-600">
                            {execution.errorMessage}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}