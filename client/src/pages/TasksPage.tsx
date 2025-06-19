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
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskForm } from '@/components/tasks/TaskForm';
import { ProjectForm } from '@/components/tasks/ProjectForm';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface Task {
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
  triggering_message_id?: string;
  instance_id?: string;
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Helper function to transform raw task data into hierarchical structure
  const transformTasksData = (data: Task[]) => {
    const taskMap = new Map<number, Task>();
    const rootTasks: Task[] = [];
    
    // First pass: create task map with existing subtasks preserved
    data.forEach(task => {
      taskMap.set(task.task_id, { 
        ...task, 
        subtasks: task.subtasks || [] // Preserve existing subtasks from API
      });
    });
    
    // Second pass: build hierarchy from parent_task_id relationships
    data.forEach(task => {
      const taskWithSubtasks = taskMap.get(task.task_id)!;
      if (task.parent_task_id) {
        const parent = taskMap.get(task.parent_task_id);
        if (parent) {
          // Only add if not already in subtasks array
          const existsInSubtasks = parent.subtasks!.some(st => st.task_id === task.task_id);
          if (!existsInSubtasks) {
            parent.subtasks!.push(taskWithSubtasks);
          }
        }
      } else {
        rootTasks.push(taskWithSubtasks);
      }
    });
    
    return rootTasks;
  };

  // Fetch tasks
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/crm/tasks'],
    select: transformTasksData
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

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => apiRequest('DELETE', `/api/crm/tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
      toast({ title: 'Task deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete task', variant: 'destructive' });
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

  const handleTaskUpdate = (taskId: number, updates: Partial<Task>) => {
    updateTaskMutation.mutate({ taskId, updates });
  };

  const handleTaskDelete = (taskId: number) => {
    deleteTaskMutation.mutate(taskId);
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
      <Tabs defaultValue="board" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="board">Board View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="space-y-4">
          <TaskBoard 
            tasks={filteredTasks || []}
            onStatusChange={handleTaskStatusChange}
            onPriorityChange={handleTaskPriorityChange}
            onEditTask={setEditingTask}
            onCreateSubtask={handleCreateSubtask}
            onTaskClick={setSelectedTask}
          />
        </TabsContent>
        <TabsContent value="list" className="space-y-4">
          {filteredTasks.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-muted-foreground">
                <h3 className="text-lg font-medium mb-2">No tasks found</h3>
                <p className="text-sm">Create your first task to get started with your productivity journey.</p>
              </div>
            </Card>
          ) : (
            <TaskList 
              tasks={filteredTasks || []}
              onStatusChange={handleTaskStatusChange}
              onPriorityChange={handleTaskPriorityChange}
              onEditTask={setEditingTask}
              onCreateSubtask={handleCreateSubtask}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Task Detail Modal */}
      <TaskDetailModal
        key={selectedTask?.task_id} // Force re-render when task changes
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
        onRefresh={async () => {
          // Invalidate and refetch the tasks query
          await queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
          
          // Wait for the query to refetch and update selectedTask with fresh data
          if (selectedTask) {
            const freshData = await queryClient.fetchQuery({ queryKey: ['/api/crm/tasks'] });
            if (freshData && Array.isArray(freshData)) {
              const transformedData = transformTasksData(freshData as Task[]);
              const updatedTask = transformedData.find(t => t.task_id === selectedTask.task_id);
              if (updatedTask) {
                console.log('Updating selectedTask with fresh data:', updatedTask);
                setSelectedTask(updatedTask);
              }
            }
          }
        }}
      />

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskForm
          isOpen={showTaskForm}
          onClose={() => {
            setShowTaskForm(false);
            setEditingTask(null);
          }}
          onSubmit={editingTask ? handleTaskUpdate : handleTaskCreate}
          task={editingTask}
        />
      )}

      {/* Project Form Modal */}
      {showProjectForm && (
        <ProjectForm
          isOpen={showProjectForm}
          onClose={() => {
            setShowProjectForm(false);
            setEditingProject(null);
          }}
          onSubmit={handleProjectCreate}
          project={editingProject}
        />
      )}
    </div>
  );
}