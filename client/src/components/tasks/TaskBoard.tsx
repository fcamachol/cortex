import { useState, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar, MessageSquare, User, MoreHorizontal, Plus, ChevronDown, ChevronRight } from 'lucide-react';


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

interface TaskBoardProps {
  tasks: Task[];
  onStatusChange: (taskId: number, newStatus: string) => void;
  onPriorityChange: (taskId: number, newPriority: string) => void;
  onEditTask: (task: Task) => void;
  onCreateSubtask: (parentTaskId: number, subtaskData: Partial<Task>) => void;
  onTaskClick: (task: Task) => void;
}

const statusColumns = [
  { id: 'to_do', title: 'To Do', color: 'bg-slate-100' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-100' },
  { id: 'review', title: 'Review', color: 'bg-yellow-100' },
  { id: 'done', title: 'Done', color: 'bg-green-100' }
];

export function TaskBoard({ 
  tasks, 
  onStatusChange, 
  onPriorityChange, 
  onEditTask, 
  onCreateSubtask,
  onTaskClick 
}: TaskBoardProps) {
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

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    
    // Only handle task board drags
    const statusIds = ['to_do', 'in_progress', 'review', 'done'];
    if (!statusIds.includes(destination.droppableId)) {
      return;
    }

    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId;

    onStatusChange(taskId, newStatus);
  };

  // Listen for global drag events from App.tsx
  useEffect(() => {
    const handleGlobalDragEnd = (event: any) => {
      handleDragEnd(event.detail);
    };

    window.addEventListener('globalDragEnd', handleGlobalDragEnd);
    return () => window.removeEventListener('globalDragEnd', handleGlobalDragEnd);
  }, [tasks, onStatusChange]);

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  const renderTask = (task: Task, index: number) => (
    <Draggable key={task.task_id} draggableId={task.task_id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-3 ${snapshot.isDragging ? 'rotate-2' : ''}`}
        >
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onTaskClick(task)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm line-clamp-2 flex-1">
                  {task.title}
                </h4>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditTask(task)}>
                      Edit Task
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCreateSubtask(task.task_id, { title: 'New Subtask' })}>
                      Add Subtask
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onPriorityChange(task.task_id, 'urgent')}
                      className="text-red-600"
                    >
                      Mark Urgent
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {task.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {task.description}
                </p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {task.priority && (
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                  )}
                  {task.due_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(task.due_date)}
                    </div>
                  )}
                  {task.related_chat_jid && (
                    <MessageSquare className="h-3 w-3 text-blue-500" />
                  )}
                </div>
                
                {task.assigned_to_user_id && (
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-xs">
                      {task.assigned_to_user_id.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>

              {task.subtasks && task.subtasks.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs p-0 hover:bg-transparent"
                    onClick={() => toggleTaskExpansion(task.task_id)}
                  >
                    {expandedTasks.has(task.task_id) ? (
                      <ChevronDown className="h-3 w-3 mr-1" />
                    ) : (
                      <ChevronRight className="h-3 w-3 mr-1" />
                    )}
                    {task.subtasks.length} subtask{task.subtasks.length !== 1 ? 's' : ''}
                  </Button>
                  
                  {expandedTasks.has(task.task_id) && (
                    <div className="mt-2 space-y-1">
                      {task.subtasks.map((subtask) => (
                        <div key={subtask.task_id} className="text-xs p-2 bg-gray-50 rounded border-l-2 border-gray-300">
                          <div className="flex items-center justify-between">
                            <span className="flex-1">{subtask.title}</span>
                            <Badge variant="outline" className="text-xs py-0">
                              {subtask.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );

  return (
    <div className="h-full overflow-auto">
      <div className="flex gap-6 min-w-max p-4">
          {statusColumns.map((column) => (
            <div key={column.id} className="flex flex-col w-80 flex-shrink-0">
              <div className={`rounded-t-lg p-3 ${column.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {getTasksByStatus(column.id).length}
                  </Badge>
                </div>
              </div>
              
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-3 bg-gray-50 rounded-b-lg min-h-96 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 scroll-smooth ${
                      snapshot.isDraggingOver ? 'bg-blue-50' : ''
                    }`}
                  >
                    {getTasksByStatus(column.id).map((task, index) => 
                      renderTask(task, index)
                    )}
                    {provided.placeholder}
                    
                    <Button
                      variant="ghost"
                      className="w-full h-8 text-xs text-muted-foreground border-dashed border-2 border-gray-300 hover:border-gray-400"
                      onClick={() => onCreateSubtask(0, { status: column.id, title: 'New Task' })}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Task
                    </Button>
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </div>
  );
}