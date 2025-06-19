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
  Hash
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

  useEffect(() => {
    if (task) {
      setEditedTask(task);
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
    }
  }, [task]);

  if (!task) return null;

  const handleSave = () => {
    if (task) {
      const updates = {
        ...editedTask,
        due_date: dueDate?.toISOString() || null
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
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
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
                  {getStatusIcon(editedTask.status || task.status)}
                  Status
                </div>
                <Select
                  value={editedTask.status || task.status}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger className={cn("w-40 h-8", getStatusColor(editedTask.status || task.status))}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
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
                  value={editedTask.priority || task.priority}
                  onValueChange={handlePriorityChange}
                >
                  <SelectTrigger className={cn("w-40 h-8", getPriorityColor(editedTask.priority || task.priority))}>
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
                <div className="p-3 bg-blue-50 rounded-lg space-y-2">
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