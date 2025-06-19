import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, Calendar, User, Tag, ChevronRight, ChevronDown, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { TaskBoard } from '@/components/tasks/TaskBoard';
// import { TaskList } from '@/components/tasks/TaskList';
// import { TaskForm } from '@/components/tasks/TaskForm';
// import { ProjectForm } from '@/components/tasks/ProjectForm';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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

interface Project {
  project_id: number;
  project_name: string;
  description?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  tasks?: Task[];
}

interface ChecklistItem {
  item_id: number;
  content: string;
  is_completed: boolean;
  display_order: number;
}

export function TasksPage() {
  const [view, setView] = useState<'board' | 'list'>('board');
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch tasks
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/crm/tasks'],
    select: (data: Task[]) => {
      // Build hierarchical structure
      const taskMap = new Map<number, Task>();
      const rootTasks: Task[] = [];
      
      // First pass: create task map
      data.forEach(task => {
        taskMap.set(task.task_id, { ...task, subtasks: [] });
      });
      
      // Second pass: build hierarchy
      data.forEach(task => {
        const taskWithSubtasks = taskMap.get(task.task_id)!;
        if (task.parent_task_id) {
          const parent = taskMap.get(task.parent_task_id);
          if (parent) {
            parent.subtasks!.push(taskWithSubtasks);
          }
        } else {
          rootTasks.push(taskWithSubtasks);
        }
      });
      
      return rootTasks;
    }
  });

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/crm/projects'],
    select: (data: any) => data || []
  });

  // Fetch checklist items for tasks
  const { data: checklistItems } = useQuery({
    queryKey: ['/api/crm/checklist-items']
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: (taskData: any) => apiRequest('POST', '/api/crm/tasks', taskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
      toast({ title: 'Task created successfully' });
      setShowTaskForm(false);
      setEditingTask(null);
    },
    onError: () => {
      toast({ title: 'Failed to create task', variant: 'destructive' });
    }
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: number; updates: any }) => 
      apiRequest('PATCH', `/api/crm/tasks/${taskId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
      toast({ title: 'Task updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update task', variant: 'destructive' });
    }
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: (projectData: any) => apiRequest('POST', '/api/crm/projects', projectData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/projects'] });
      toast({ title: 'Project created successfully' });
      setShowProjectForm(false);
      setEditingProject(null);
    },
    onError: () => {
      toast({ title: 'Failed to create project', variant: 'destructive' });
    }
  });

  // Filter tasks based on search and filters
  const filteredTasks = tasks?.filter(task => {
    const matchesSearch = !searchQuery || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesProject = !selectedProject || task.project_id === selectedProject;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesProject;
  }) || [];

  const handleTaskStatusChange = (taskId: number, newStatus: string) => {
    updateTaskMutation.mutate({ taskId, updates: { status: newStatus } });
  };

  const handleTaskPriorityChange = (taskId: number, newPriority: string) => {
    updateTaskMutation.mutate({ taskId, updates: { priority: newPriority } });
  };

  const handleCreateSubtask = (parentTaskId: number, subtaskData: Partial<Task>) => {
    createTaskMutation.mutate({ ...subtaskData, parent_task_id: parentTaskId });
  };

  if (tasksLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Manage your tasks and projects with Notion-style organization
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowProjectForm(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
          <Button onClick={() => setShowTaskForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedProject?.toString() || 'all'} onValueChange={(value) => 
              setSelectedProject(value === 'all' ? null : parseInt(value))
            }>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {(projects || []).map((project: Project) => (
                  <SelectItem key={project.project_id} value={project.project_id.toString()}>
                    {project.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="to_do">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task Display */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-muted-foreground">
              <h3 className="text-lg font-medium mb-2">No tasks found</h3>
              <p className="text-sm">Create your first task to get started with your productivity journey.</p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTasks.map((task) => (
              <Card key={task.task_id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={task.status === 'done'}
                      onCheckedChange={(checked) => 
                        handleTaskStatusChange(task.task_id, checked ? 'done' : 'to_do')
                      }
                    />
                    <div className="flex-1">
                      <h3 className={`font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={`text-xs ${
                          task.status === 'to_do' ? 'bg-slate-100 text-slate-800' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          task.status === 'done' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                        {task.priority && (
                          <Badge variant="outline" className={`text-xs ${
                            task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                            task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {task.priority}
                          </Badge>
                        )}
                        {task.related_chat_jid && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                            WhatsApp
                          </Badge>
                        )}
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTask(task)}
                    >
                      Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleTaskStatusChange(task.task_id, 'in_progress')}>
                          Start Task
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTaskPriorityChange(task.task_id, 'urgent')}>
                          Mark Urgent
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTaskStatusChange(task.task_id, 'done')}>
                          Complete Task
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                {/* Subtasks */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="ml-6 mt-3 space-y-2">
                    {task.subtasks.map((subtask) => (
                      <div key={subtask.task_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <Checkbox
                          checked={subtask.status === 'done'}
                          onCheckedChange={(checked) => 
                            handleTaskStatusChange(subtask.task_id, checked ? 'done' : 'to_do')
                          }
                        />
                        <span className={`text-sm ${subtask.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                          {subtask.title}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {subtask.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}