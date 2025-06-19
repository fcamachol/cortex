import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarIcon,
  Clock,
  User,
  Tag,
  Link2,
  Flag,
  MessageSquare,
  CheckCircle2,
  Circle,
  Trash2,
  Edit3,
  Save,
  X,
  UserPlus,
  Calendar as CalendarDays,
  Timer,
  Hash,
  Send,
  Reply
} from "lucide-react";
import type { Task } from "../../pages/TasksPage";

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (taskId: number, updates: Partial<Task>) => void;
  onDelete: (taskId: number) => void;
}

export function TaskDetailModal({ task, isOpen, onClose, onUpdate, onDelete }: TaskDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const { toast } = useToast();

  // Fetch WhatsApp message data if task has triggering message
  const { data: messageData } = useQuery({
    queryKey: ['/api/whatsapp/message-content', task?.triggering_message_id, task?.instance_id, Date.now()],
    queryFn: async () => {
      if (!task?.triggering_message_id || !task?.instance_id) return null;
      
      // Direct API call with cache-busting
      const response = await fetch(`/api/whatsapp/message-content?messageId=${task.triggering_message_id}&instanceId=${task.instance_id}&userId=7804247f-3ae8-4eb2-8c6d-2c44f967ad42&_=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    },
    enabled: !!(task?.triggering_message_id && task?.instance_id),
    staleTime: 0,
    gcTime: 0,
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async (data: { instanceId: string; chatId: string; message: string; quotedMessageId?: string }) => {
      return fetch(`/api/whatsapp/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: data.instanceId,
          chatId: data.chatId,
          message: data.message,
          quotedMessageId: data.quotedMessageId
        })
      }).then(res => res.json());
    },
    onSuccess: () => {
      toast({
        title: "Message sent",
        description: "Your reply has been sent successfully.",
      });
      setReplyMessage("");
      setIsReplying(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "An error occurred while sending the message.",
        variant: "destructive",
      });
    }
  });

  const handleSendReply = () => {
    if (!replyMessage.trim() || !task?.instance_id || !task?.related_chat_jid) return;
    
    replyMutation.mutate({
      instanceId: task.instance_id,
      chatId: task.related_chat_jid,
      message: replyMessage.trim(),
      quotedMessageId: task.triggering_message_id
    });
  };

  useEffect(() => {
    if (task) {
      setEditedTask(task);
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setIsEditing(false); // Reset editing state when task changes
    }
  }, [task]);

  if (!task) return null;

  const handleSave = () => {
    if (task) {
      const updates = {
        ...editedTask,
        due_date: dueDate?.toISOString() || undefined
      };
      onUpdate(task.task_id, updates);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedTask(task);
    setDueDate(task.due_date ? new Date(task.due_date) : undefined);
    setIsEditing(false);
  };

  const handleStatusChange = (newStatus: string) => {
    const updates = { status: newStatus };
    setEditedTask(prev => ({ ...prev, status: newStatus }));
    onUpdate(task.task_id, updates);
  };

  const handlePriorityChange = (newPriority: string) => {
    const updates = { priority: newPriority };
    setEditedTask(prev => ({ ...prev, priority: newPriority }));
    onUpdate(task.task_id, updates);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'todo':
      case 'to_do':
        return <Circle className="h-4 w-4 text-gray-400" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'todo':
      case 'to_do':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string | undefined) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editedTask.title || ''}
                  onChange={(e) => setEditedTask(prev => ({ ...prev, title: e.target.value }))}
                  className="text-xl font-semibold border-none p-0 h-auto focus-visible:ring-0"
                  placeholder="Task name"
                />
              ) : (
                <DialogTitle className="text-xl font-semibold text-left">
                  {task.title}
                </DialogTitle>
              )}
              {task.triggering_message_id && (
                <div className="flex items-center gap-2 mt-2 text-sm text-purple-600">
                  <MessageSquare className="h-4 w-4" />
                  <span>Created from WhatsApp message reaction</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} size="sm" className="h-8">
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm" className="h-8">
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="h-8">
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    onClick={() => {
                      onDelete(task.task_id);
                      onClose();
                    }} 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Edit3 className="h-4 w-4" />
              Description
            </div>
            {isEditing ? (
              <Textarea
                value={editedTask.description || ''}
                onChange={(e) => setEditedTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Add a description..."
                className="min-h-[100px]"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg min-h-[100px]">
                {task.description || (
                  <span className="text-gray-500 italic">No description</span>
                )}
              </div>
            )}
          </div>

          {/* Task Properties Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  {getStatusIcon(task.status)}
                  Status
                </div>
                <Select
                  value={task.status || "to_do"}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger className={cn("w-40 h-8", getStatusColor(task.status))}>
                    <SelectValue placeholder="Select status">
                      {task.status ? 
                        (task.status === 'in_progress' ? 'In Progress' : 
                         task.status === 'completed' ? 'Completed' :
                         task.status === 'todo' || task.status === 'to_do' ? 'To Do' : task.status) 
                        : 'Select status'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_do">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <CalendarIcon className="h-4 w-4" />
                  Due Date
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-40 h-8 justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      {dueDate ? format(dueDate, "PPP") : "Set date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(date) => {
                        setDueDate(date);
                        if (!isEditing && date) {
                          onUpdate(task.task_id, { due_date: date.toISOString() });
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Flag className="h-4 w-4" />
                  Priority
                </div>
                <Select
                  value={task.priority || "medium"}
                  onValueChange={handlePriorityChange}
                >
                  <SelectTrigger className={cn("w-40 h-8", getPriorityColor(task.priority))}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Created Date */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <CalendarDays className="h-4 w-4" />
                  Created
                </div>
                <div className="text-sm text-gray-600">
                  {format(new Date(task.created_at), "PPP")}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Assignee */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <User className="h-4 w-4" />
                  Assignee
                </div>
                <Button variant="outline" size="sm" className="h-8 text-gray-500">
                  <UserPlus className="h-4 w-4 mr-1" />
                  Assign
                </Button>
              </div>

              {/* Time Tracking */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Timer className="h-4 w-4" />
                  Time Tracking
                </div>
                <Button variant="outline" size="sm" className="h-8 text-gray-500">
                  Add time
                </Button>
              </div>

              {/* Tags */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Tag className="h-4 w-4" />
                  Tags
                </div>
                <Button variant="outline" size="sm" className="h-8 text-gray-500">
                  <Hash className="h-4 w-4 mr-1" />
                  Add tag
                </Button>
              </div>

              {/* Relations */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Link2 className="h-4 w-4" />
                  Relations
                </div>
                <Button variant="outline" size="sm" className="h-8 text-gray-500">
                  Link task
                </Button>
              </div>
            </div>
          </div>

          {/* WhatsApp Integration Info */}
          {task.related_chat_jid && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp Integration
                </h3>
                <div className="p-3 bg-blue-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Related Chat:</span>
                    <Badge variant="outline" className="bg-white">
                      {task.related_chat_jid}
                    </Badge>
                  </div>
                  {task.triggering_message_id && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Message ID:</span>
                      <Badge variant="outline" className="bg-white font-mono text-xs">
                        {task.triggering_message_id}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Instance:</span>
                    <Badge variant="outline" className="bg-white">
                      {task.instance_id}
                    </Badge>
                  </div>

                  {/* Original Message Display */}
                  {messageData ? (
                    <div className="mt-3 p-3 bg-white rounded-lg border">
                      <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                        <span>Original WhatsApp Message</span>
                        <span>
                          {messageData.timestamp 
                            ? format(new Date(messageData.timestamp), "MMM dd, yyyy 'at' h:mm a")
                            : 'Unknown time'
                          }
                        </span>
                      </div>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-2 rounded">
                        "{messageData.content || "No message content available"}"
                      </div>
                      <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                        <span>From: {messageData.sender_jid || messageData.senderJid || "Unknown sender"}</span>
                        {messageData.message_type && messageData.message_type !== 'text' && (
                          <Badge variant="secondary" className="text-xs">
                            {messageData.message_type}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : task.triggering_message_id ? (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-dashed">
                      <div className="text-sm text-gray-500 text-center">
                        Loading message content...
                      </div>
                    </div>
                  ) : null}

                  {/* Reply Interface */}
                  <div className="mt-3 space-y-2">
                    {!isReplying ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsReplying(true)}
                        className="w-full"
                      >
                        <Reply className="h-4 w-4 mr-2" />
                        Reply to Message
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Type your reply..."
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          rows={3}
                          className="resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSendReply}
                            disabled={!replyMessage.trim() || replyMutation.isPending}
                          >
                            {replyMutation.isPending ? (
                              <>Sending...</>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Send
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsReplying(false);
                              setReplyMessage("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Task Timeline */}
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Activity</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Task created</div>
                  <div className="text-xs text-gray-500">
                    {format(new Date(task.created_at), "PPP 'at' p")}
                  </div>
                </div>
              </div>
              {task.updated_at !== task.created_at && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Task updated</div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(task.updated_at), "PPP 'at' p")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}