import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const actionRuleSchema = z.object({
  ruleName: z.string().min(1, "Rule name is required"),
  description: z.string().optional(),
  triggerType: z.enum(["reaction", "hashtag", "keyword", "time_based", "location", "contact_group"]),
  actionType: z.enum(["create_task", "create_calendar_event", "send_message", "add_label", "update_contact", "move_to_folder", "send_notification", "webhook"]),
  isActive: z.boolean().default(true),
  cooldownMinutes: z.number().min(0).default(0),
  maxExecutionsPerDay: z.number().min(1).default(100),
  performerFilter: z.enum(["user_only", "contacts_only", "both"]).default("both"),
  instanceFilterType: z.enum(["all", "include", "exclude"]).default("all"),
  selectedInstances: z.array(z.string()).default([]),
});

interface ActionRuleFormProps {
  rule?: any;
  onClose: () => void;
  onSave: () => void;
}

export function ActionRuleForm({ rule, onClose, onSave }: ActionRuleFormProps) {
  const [triggerConditions, setTriggerConditions] = useState(rule?.triggerConditions || {});
  const [actionConfig, setActionConfig] = useState(rule?.actionConfig || {});
  const { toast } = useToast();

  // Fetch available WhatsApp instances for multi-instance support
  const { data: whatsappInstances = [] } = useQuery({
    queryKey: ['/api/whatsapp/instances'],
  });

  const form = useForm<z.infer<typeof actionRuleSchema>>({
    resolver: zodResolver(actionRuleSchema),
    defaultValues: {
      ruleName: rule?.ruleName || "",
      description: rule?.description || "",
      triggerType: rule?.triggerType || "hashtag",
      actionType: rule?.actionType || "create_task",
      isActive: rule?.isActive ?? true,
      cooldownMinutes: rule?.cooldownMinutes || 0,
      maxExecutionsPerDay: rule?.maxExecutionsPerDay || 100,
      performerFilter: rule?.performerFilters?.allowedPerformers?.[0] || "both",
      instanceFilterType: rule?.instanceFilters?.type || "all",
      selectedInstances: rule?.instanceFilters?.instances || [],
    },
  });

  const { data: instances = [] } = useQuery({
    queryKey: ['/api/whatsapp/instances'],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/actions/rules', data),
    onSuccess: () => {
      toast({
        title: "Rule created",
        description: "Action rule has been created successfully",
      });
      onSave();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', `/api/actions/rules/${rule.ruleId}`, data),
    onSuccess: () => {
      toast({
        title: "Rule updated",
        description: "Action rule has been updated successfully",
      });
      onSave();
    },
  });

  const testMutation = useMutation({
    mutationFn: (testContext: any) => apiRequest('POST', `/api/actions/rules/${rule?.ruleId}/test`, { testContext }),
    onSuccess: async (result: Response) => {
      const data = await result.json();
      toast({
        title: data.wouldTrigger ? "Test passed" : "Test failed",
        description: data.wouldTrigger 
          ? "The rule would trigger with the test conditions"
          : "The rule would not trigger with the test conditions",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof actionRuleSchema>) => {
    const payload = {
      ...values,
      triggerConditions,
      actionConfig,
      performerFilters: {
        allowedPerformers: [values.performerFilter]
      },
      instanceFilters: values.selectedInstances.length > 0 ? {
        include: values.selectedInstances
      } : null
    };

    if (rule) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleTriggerConditionChange = (key: string, value: any) => {
    setTriggerConditions((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleActionConfigChange = (key: string, value: any) => {
    setActionConfig((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  const triggerType = form.watch("triggerType");
  const actionType = form.watch("actionType");

  const renderTriggerConfig = () => {
    switch (triggerType) {
      case "reaction":
        return (
          <div className="space-y-4">
            <FormItem>
              <FormLabel>Reaction Emojis</FormLabel>
              <FormControl>
                <Input
                  placeholder="👍,❤️,🔥"
                  value={triggerConditions.reactions?.join(',') || ''}
                  onChange={(e) => handleTriggerConditionChange('reactions', e.target.value.split(',').map(r => r.trim()))}
                />
              </FormControl>
              <FormDescription>
                Comma-separated list of emoji reactions that will trigger this action
              </FormDescription>
            </FormItem>
          </div>
        );

      case "hashtag":
        return (
          <div className="space-y-4">
            <FormItem>
              <FormLabel>Hashtags</FormLabel>
              <FormControl>
                <Input
                  placeholder="todo,urgent,reminder"
                  value={triggerConditions.hashtags?.join(',') || ''}
                  onChange={(e) => handleTriggerConditionChange('hashtags', e.target.value.split(',').map(h => h.trim()))}
                />
              </FormControl>
              <FormDescription>
                Comma-separated list of hashtags (without #) that will trigger this action
              </FormDescription>
            </FormItem>
          </div>
        );

      case "keyword":
        return (
          <div className="space-y-4">
            <FormItem>
              <FormLabel>Keywords</FormLabel>
              <FormControl>
                <Input
                  placeholder="meeting,call,deadline"
                  value={triggerConditions.keywords?.join(',') || ''}
                  onChange={(e) => handleTriggerConditionChange('keywords', e.target.value.split(',').map(k => k.trim()))}
                />
              </FormControl>
              <FormDescription>
                Comma-separated list of keywords in message content that will trigger this action
              </FormDescription>
            </FormItem>
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground">
            Configure trigger conditions for {triggerType}
          </div>
        );
    }
  };

  const renderActionConfig = () => {
    switch (actionType) {
      case "create_task":
        return (
          <div className="space-y-4">
            <FormItem>
              <FormLabel>Task Title Template</FormLabel>
              <FormControl>
                <Input
                  placeholder="New task from {{sender}}: {{content}}"
                  value={actionConfig.title || ''}
                  onChange={(e) => handleActionConfigChange('title', e.target.value)}
                />
              </FormControl>
              <FormDescription>
                Use templates: {'{{sender}}'}, {'{{content}}'}, {'{{hashtags}}'}, {'{{timestamp}}'}
              </FormDescription>
            </FormItem>
            <FormItem>
              <FormLabel>Task Description Template</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Task created from WhatsApp message. Content: {{content}}"
                  value={actionConfig.description || ''}
                  onChange={(e) => handleActionConfigChange('description', e.target.value)}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select value={actionConfig.priority || 'medium'} onValueChange={(value) => handleActionConfigChange('priority', value)}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          </div>
        );

      case "create_calendar_event":
        return (
          <div className="space-y-4">
            <FormItem>
              <FormLabel>Event Title Template</FormLabel>
              <FormControl>
                <Input
                  placeholder="Meeting: {{content}}"
                  value={actionConfig.title || ''}
                  onChange={(e) => handleActionConfigChange('title', e.target.value)}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>Duration (minutes)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="60"
                  value={actionConfig.durationMinutes || ''}
                  onChange={(e) => handleActionConfigChange('durationMinutes', parseInt(e.target.value))}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>Default Location</FormLabel>
              <FormControl>
                <Input
                  placeholder="Office, Zoom, etc."
                  value={actionConfig.location || ''}
                  onChange={(e) => handleActionConfigChange('location', e.target.value)}
                />
              </FormControl>
            </FormItem>
          </div>
        );

      case "send_message":
        return (
          <div className="space-y-4">
            <FormItem>
              <FormLabel>Message Template</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Auto-reply: Thanks for your message {{sender}}. I'll get back to you soon!"
                  value={actionConfig.message || ''}
                  onChange={(e) => handleActionConfigChange('message', e.target.value)}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>Target Chat</FormLabel>
              <Select value={actionConfig.targetType || 'same_chat'} onValueChange={(value) => handleActionConfigChange('targetType', value)}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="same_chat">Same Chat</SelectItem>
                  <SelectItem value="specific_chat">Specific Chat</SelectItem>
                  <SelectItem value="sender_private">Private Message to Sender</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
            {actionConfig.targetType === 'specific_chat' && (
              <FormItem>
                <FormLabel>Target Chat ID</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Chat ID or phone number"
                    value={actionConfig.targetChat || ''}
                    onChange={(e) => handleActionConfigChange('targetChat', e.target.value)}
                  />
                </FormControl>
              </FormItem>
            )}
          </div>
        );

      case "add_label":
        return (
          <div className="space-y-4">
            <FormItem>
              <FormLabel>Labels to Add</FormLabel>
              <FormControl>
                <Input
                  placeholder="important,follow-up,urgent"
                  value={actionConfig.labels?.join(',') || ''}
                  onChange={(e) => handleActionConfigChange('labels', e.target.value.split(',').map(l => l.trim()))}
                />
              </FormControl>
              <FormDescription>
                Comma-separated list of labels to add to the chat
              </FormDescription>
            </FormItem>
          </div>
        );

      case "send_notification":
        return (
          <div className="space-y-4">
            <FormItem>
              <FormLabel>Notification Title</FormLabel>
              <FormControl>
                <Input
                  placeholder="New WhatsApp Alert"
                  value={actionConfig.title || ''}
                  onChange={(e) => handleActionConfigChange('title', e.target.value)}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>Notification Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="{{sender}} sent: {{content}}"
                  value={actionConfig.message || ''}
                  onChange={(e) => handleActionConfigChange('message', e.target.value)}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>Notification Type</FormLabel>
              <Select value={actionConfig.type || 'info'} onValueChange={(value) => handleActionConfigChange('type', value)}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground">
            Configure action settings for {actionType}
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-4 p-6 border-b">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {rule ? 'Edit Action Rule' : 'Create Action Rule'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure automated workflows triggered by WhatsApp events
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Set up the basic details for your action rule
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="ruleName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rule Name</FormLabel>
                        <FormControl>
                          <Input placeholder="My automation rule" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe what this rule does..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                          <FormDescription>
                            Enable this rule to start processing triggers
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trigger Configuration</CardTitle>
                  <CardDescription>
                    Define what events will trigger this action
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="triggerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select trigger type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="reaction">Message Reaction</SelectItem>
                            <SelectItem value="hashtag">Hashtag</SelectItem>
                            <SelectItem value="keyword">Keyword</SelectItem>
                            <SelectItem value="time_based">Time Based</SelectItem>
                            <SelectItem value="location">Location</SelectItem>
                            <SelectItem value="contact_group">Contact Group</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {renderTriggerConfig()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Action Configuration</CardTitle>
                  <CardDescription>
                    Define what action will be performed when triggered
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="actionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Action Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select action type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="create_task">Create Task</SelectItem>
                            <SelectItem value="create_calendar_event">Create Calendar Event</SelectItem>
                            <SelectItem value="send_message">Send Message</SelectItem>
                            <SelectItem value="add_label">Add Label</SelectItem>
                            <SelectItem value="update_contact">Update Contact</SelectItem>
                            <SelectItem value="move_to_folder">Move to Folder</SelectItem>
                            <SelectItem value="send_notification">Send Notification</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {renderActionConfig()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active WhatsApp Instances</CardTitle>
                  <CardDescription>
                    Select which WhatsApp instances this automation rule should be active on
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="selectedInstances"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Enable Rule On These Instances</FormLabel>
                        <div className="grid grid-cols-1 gap-3">
                          {whatsappInstances.map((instance: any) => (
                            <div key={instance.instanceId} className="flex items-center space-x-3 p-3 border rounded-lg">
                              <input
                                type="checkbox"
                                id={instance.instanceId}
                                checked={field.value?.includes(instance.instanceId) || false}
                                onChange={(e) => {
                                  const currentValue = field.value || [];
                                  if (e.target.checked) {
                                    field.onChange([...currentValue, instance.instanceId]);
                                  } else {
                                    field.onChange(currentValue.filter((id: string) => id !== instance.instanceId));
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                              <div className="flex-1">
                                <label htmlFor={instance.instanceId} className="text-sm font-medium cursor-pointer">
                                  {instance.displayName || instance.instanceId}
                                </label>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                    instance.isConnected 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {instance.isConnected ? "Connected" : "Disconnected"}
                                  </span>
                                  {instance.ownerJid && (
                                    <span className="text-xs text-muted-foreground">
                                      {instance.ownerJid.replace('@s.whatsapp.net', '')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <FormDescription>
                          If no instances are selected, the rule will be active on all instances
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Execution Settings</CardTitle>
                  <CardDescription>
                    Control when and how often this rule can execute
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="cooldownMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cooldown Period (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum time between executions to prevent spam
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxExecutionsPerDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Executions Per Day</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="100"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 100)}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum number of times this rule can execute in 24 hours
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="performerFilter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Who Can Trigger</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select who can trigger this action" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="both">Anyone (You or Contacts)</SelectItem>
                            <SelectItem value="user_only">Only Me</SelectItem>
                            <SelectItem value="contacts_only">Only Contacts</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Control whether this action triggers from your actions or contact actions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {rule ? 'Update Rule' : 'Create Rule'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                {rule && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testMutation.mutate({})}
                    disabled={testMutation.isPending}
                    className="gap-2"
                  >
                    <TestTube className="w-4 h-4" />
                    Test Rule
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Variables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="space-y-1">
                <code className="bg-muted px-1 rounded">{'{{sender}}'}</code>
                <p className="text-muted-foreground">Sender's WhatsApp ID</p>
              </div>
              <div className="space-y-1">
                <code className="bg-muted px-1 rounded">{'{{content}}'}</code>
                <p className="text-muted-foreground">Message content</p>
              </div>
              <div className="space-y-1">
                <code className="bg-muted px-1 rounded">{'{{hashtags}}'}</code>
                <p className="text-muted-foreground">Detected hashtags</p>
              </div>
              <div className="space-y-1">
                <code className="bg-muted px-1 rounded">{'{{reaction}}'}</code>
                <p className="text-muted-foreground">Reaction emoji</p>
              </div>
              <div className="space-y-1">
                <code className="bg-muted px-1 rounded">{'{{timestamp}}'}</code>
                <p className="text-muted-foreground">Event timestamp</p>
              </div>
              <div className="space-y-1">
                <code className="bg-muted px-1 rounded">{'{{chatId}}'}</code>
                <p className="text-muted-foreground">Chat identifier</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Use hashtags for task categorization</p>
              <p>• Set cooldowns to prevent spam</p>
              <p>• Test rules before enabling</p>
              <p>• Use descriptive rule names</p>
              <p>• Monitor execution logs</p>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}