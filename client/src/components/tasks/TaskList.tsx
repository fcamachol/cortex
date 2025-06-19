import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar, MessageSquare, User, MoreHorizontal, Plus, ChevronDown, ChevronRight, Clock, Flag } from 'lucide-react';

interface Task {
  task_id: number;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  due_date?: string;
  project_id?: number;
  parent_task_id?: number;
  assigned_to_user_id?: string;
  related_chat_jid?: string;
  created_at: string;
  updated_at: string;
  subtasks?: Task[];
  checklist_items?: ChecklistItem[];
}

interface ChecklistItem {
  item_id: number;
  content: string;
  is_completed: boolean;
  display_order: number;
}

interface TaskListProps {
  tasks: Task[];
  onStatusChange: (taskId: number, newStatus: string) => void;
  onPriorityChange: (taskId: number, newPriority: string) => void;
  onEditTask: (task: Task) => void;
  onCreateSubtask: (parentTaskId: number, subtaskData: Partial<Task>) => void;
}

export function TaskList({ 
  tasks, 
  onStatusChange, 
  onPriorityChange, 
  onEditTask, 
  onCreateSubtask 
}: TaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  const toggleTaskExpansion = (taskId: number) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'to_do': return 'bg-slate-100 text-slate-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'review': return 'bg-yellow-100 text-yellow-800';
      case 'done': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days`;
    return date.toLocaleDateString();
  };

  const isOverdue = (dateString?: string) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  const renderTask = (task: Task, depth = 0) => (
    <div key={task.task_id} className={`${depth > 0 ? 'ml-8' : ''}`}>
      <Card className="mb-2 hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Status Checkbox */}
            <Checkbox
              checked={task.status === 'done'}
              onCheckedChange={(checked) => 
                onStatusChange(task.task_id, checked ? 'done' : 'to_do')
              }
              className="mt-1"
            />

            {/* Expand/Collapse for subtasks */}
            {task.subtasks && task.subtasks.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleTaskExpansion(task.task_id)}
              >
                {expandedTasks.has(task.task_id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Task Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={`font-medium text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </h4>
                
                {task.priority && (
                  <Flag className={`h-3 w-3 ${getPriorityColor(task.priority)}`} />
                )}
                
                <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`}>
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>

              {task.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                  {task.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {task.due_date && (
                  <div className={`flex items-center gap-1 ${isOverdue(task.due_date) ? 'text-red-500' : ''}`}>
                    <Clock className="h-3 w-3" />
                    {formatDate(task.due_date)}
                  </div>
                )}
                
                {task.related_chat_jid && (
                  <div className="flex items-center gap-1 text-blue-500">
                    <MessageSquare className="h-3 w-3" />
                    WhatsApp
                  </div>
                )}
                
                {task.subtasks && task.subtasks.length > 0 && (
                  <span className="text-muted-foreground">
                    {task.subtasks.filter(st => st.status === 'done').length}/{task.subtasks.length} subtasks
                  </span>
                )}
              </div>
            </div>

            {/* Assigned User */}
            {task.assigned_to_user_id && (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {task.assigned_to_user_id.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditTask(task)}>
                  Edit Task
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateSubtask(task.task_id, { title: 'New Subtask' })}>
                  Add Subtask
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(task.task_id, 'in_progress')}>
                  Start Task
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onPriorityChange(task.task_id, 'urgent')}
                  className="text-red-600"
                >
                  Mark Urgent
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onStatusChange(task.task_id, 'cancelled')}
                  className="text-red-600"
                >
                  Cancel Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Checklist Items */}
          {task.checklist_items && task.checklist_items.length > 0 && (
            <div className="mt-3 pl-6">
              <div className="space-y-1">
                {task.checklist_items.map((item) => (
                  <div key={item.item_id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={item.is_completed}
                      className="h-3 w-3"
                    />
                    <span className={item.is_completed ? 'line-through text-muted-foreground' : ''}>
                      {item.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Render Subtasks */}
      {expandedTasks.has(task.task_id) && task.subtasks && task.subtasks.length > 0 && (
        <div className="ml-4 border-l-2 border-gray-200 pl-4">
          {task.subtasks.map(subtask => renderTask(subtask, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      {tasks.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No tasks found</h3>
            <p className="text-sm">Create your first task to get started with your productivity journey.</p>
          </div>
        </Card>
      ) : (
        <>
          {tasks.map(task => renderTask(task))}
          
          <Card className="border-dashed border-2 border-gray-300 hover:border-gray-400 transition-colors">
            <CardContent className="p-4">
              <Button
                variant="ghost"
                className="w-full h-8 text-sm text-muted-foreground"
                onClick={() => onCreateSubtask(0, { title: 'New Task', status: 'to_do' })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Task
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}