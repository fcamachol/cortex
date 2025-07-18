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
  taskId: string; // Changed to string for UUID support
  id: string; // Added id field
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  projectId?: number;
  parentTaskId?: string; // Changed to string for UUID support
  assignedToUserId?: string;
  relatedChatJid?: string;
  createdAt: string;
  updatedAt: string;
  subtasks?: Task[];
  checklistItems?: ChecklistItem[]; // Fixed field name
  triggeringMessageId?: string;
  instanceId?: string;
  userId?: string; // Added userId field
  completedAt?: string; // Added completedAt field
  estimatedHours?: string; // Added estimatedHours field
  actualHours?: string; // Added actualHours field
  tags?: string[]; // Added tags field
}

interface Project {
  projectId: number;
  projectName: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  tasks?: Task[];
}

interface ChecklistItem {
  item_id: number;
  content: string;
  is_completed: boolean;
  display_order: number;
}

export function TasksPage() {
  const [view, setView] = useState<'board' | 'list' | 'projects'>('board');
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [instanceFilter, setInstanceFilter] = useState<string>('all');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedSubtask, setSelectedSubtask] = useState<Task | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Set up real-time task updates via Server-Sent Events
  useEffect(() => {
    const eventSource = new EventSource('/api/events/tasks');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'task_created') {
          console.log('Real-time task update received:', data.task);
          
          // Immediately invalidate and refetch tasks
          queryClient.invalidateQueries({ queryKey: ['/api/events/tasks'] });
          
          // Show notification toast
          toast({
            title: "New Task Created",
            description: `Task "${data.task.title}" has been created automatically`,
            duration: 5000
          });
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Connection will automatically retry
    };

    // Cleanup on component unmount
    return () => {
      eventSource.close();
    };
  }, [queryClient, toast]);

  // Helper function to transform raw task data into hierarchical structure
  const transformTasksData = (data: any[]) => {
    const taskMap = new Map<string, Task>(); 
    const rootTasks: Task[] = [];
    
    // First pass: create task map with field mapping and preserved subtasks
    data.forEach(rawTask => {
      const task: Task = {
        id: rawTask.id,
        taskId: rawTask.id, // Map id to taskId for frontend compatibility
        title: rawTask.title,
        description: rawTask.description,
        status: rawTask.status,
        priority: rawTask.priority,
        dueDate: rawTask.due_date, // Map due_date to dueDate
        parentTaskId: rawTask.parent_task_id, // Map parent_task_id to parentTaskId
        createdAt: rawTask.created_at,
        updatedAt: rawTask.updated_at,
        subtasks: rawTask.subtasks || [] // Preserve existing subtasks from API
      };
      taskMap.set(task.taskId, task);
    });
    
    // Second pass: build hierarchy from parentTaskId relationships
    data.forEach(rawTask => {
      const task = taskMap.get(rawTask.id)!;
      if (rawTask.parent_task_id) {
        const parent = taskMap.get(rawTask.parent_task_id);
        if (parent) {
          // Only add if not already in subtasks array
          const existsInSubtasks = parent.subtasks!.some(st => st.taskId === task.taskId);
          if (!existsInSubtasks) {
            parent.subtasks!.push(task);
          }
        }
      } else {
        rootTasks.push(task);
      }
    });
    
    return rootTasks;
  };

  // Fetch tasks with SSE-based updates
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/events/tasks'],
    select: (data: any) => {
      console.log('Raw API data:', data?.slice(0, 2));
      
      // Transform and return all tasks for proper board rendering
      const transformed = transformTasksData(data || []);
      console.log('Transformed data:', transformed?.slice(0, 2));
      
      return transformed;
    },
    refetchInterval: false, // Disable polling - use SSE for updates
    staleTime: 300000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on focus
  });

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/crm/projects'],
    select: (data: any) => data || []
  });

  // Fetch WhatsApp instances
  const { data: instances } = useQuery({
    queryKey: ['/api/actions/whatsapp-instances'],
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
    mutationFn: ({ taskId, updates }: { taskId: string; updates: any }) => // Changed to string
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
    mutationFn: (taskId: string) => apiRequest('DELETE', `/api/crm/tasks/${taskId}`), // Changed to string
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
      toast({ title: 'Task deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete task', variant: 'destructive' });
    }
  });

  // Set up SSE connection for real-time task updates
  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_task') {
          // Refresh tasks when new task is created
          queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
        }
      } catch (error) {
        console.error('Error processing SSE event:', error);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);

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

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: ({ projectId, updates }: { projectId: number; updates: any }) => 
      apiRequest('PATCH', `/api/crm/projects/${projectId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/projects'] });
      toast({ title: 'Project updated successfully' });
      setShowProjectForm(false);
      setEditingProject(null);
    },
    onError: () => {
      toast({ title: 'Failed to update project', variant: 'destructive' });
    }
  });

  // Filter tasks based on search and filters
  const filteredTasks = tasks?.filter(task => {
    const matchesSearch = !searchQuery || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesProject = !selectedProject || task.projectId === selectedProject;
    const matchesInstance = instanceFilter === 'all' || task.instanceId === instanceFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesProject && matchesInstance;
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

  const handleTaskCreate = (taskData: Partial<Task>) => {
    createTaskMutation.mutate(taskData);
  };

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => { // Changed to string
    updateTaskMutation.mutate({ taskId, updates });
  };

  const handleTaskDelete = (taskId: string) => { // Changed to string
    deleteTaskMutation.mutate(taskId);
  };

  const handleProjectCreate = (projectData: any) => {
    createProjectMutation.mutate(projectData);
  };

  const handleProjectUpdate = (projectId: number, updates: any) => {
    // Add project update mutation if needed
    updateProjectMutation.mutate({ projectId, updates });
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
            <Select value={selectedProject || 'all'} onValueChange={(value) => 
              setSelectedProject(value === 'all' ? null : value)
            }>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {(projects || []).map((project: any) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name || project.description || 'Unnamed Project'}
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
            <Select value={instanceFilter} onValueChange={setInstanceFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All Instances" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Instances</SelectItem>
                {(instances || []).map((instance: any) => (
                  <SelectItem key={instance.instanceId} value={instance.instanceId}>
                    {instance.displayName || instance.instanceId}
                    {instance.phoneNumber && ` (${instance.phoneNumber})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task Display */}
      <Tabs value={view} onValueChange={(value) => setView(value as 'board' | 'list' | 'projects')} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="board">Board View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="space-y-4 h-[calc(100vh-220px)] overflow-hidden">
          <TaskBoard 
            tasks={filteredTasks || []}
            onStatusChange={handleTaskStatusChange}
            onPriorityChange={handleTaskPriorityChange}
            onEditTask={setEditingTask}
            onCreateSubtask={handleCreateSubtask}
            onTaskClick={setSelectedTask}
          />
        </TabsContent>
        <TabsContent value="list" className="space-y-4 h-[calc(100vh-220px)] overflow-hidden">
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
              onTaskClick={setSelectedTask}
            />
          )}
        </TabsContent>

        <TabsContent value="projects">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(projects || []).map((project: any) => (
              <Card key={project.project_id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{project.project_name}</CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                            setEditingProject(project);
                            setShowProjectForm(true);
                          }}
                        >
                          Edit Project
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedProject(project.project_id);
                          setView('board');
                        }}>
                          View Tasks
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Badge 
                    variant={
                      project.status === 'active' ? 'default' :
                      project.status === 'completed' ? 'secondary' :
                      project.status === 'on_hold' ? 'outline' : 'destructive'
                    }
                    className="w-fit"
                  >
                    {project.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {project.start_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Started: {new Date(project.start_date).toLocaleDateString()}
                      </div>
                    )}
                    {project.end_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {new Date(project.end_date).toLocaleDateString()}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {tasks?.filter(task => task.projectId === project.project_id).length || 0} tasks
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Create New Project Card */}
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow border-dashed border-2 flex items-center justify-center min-h-[200px]"
              onClick={() => setShowProjectForm(true)}
            >
              <div className="text-center">
                <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Create New Project</p>
                <p className="text-xs text-muted-foreground">Organize your tasks</p>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Detail Modal */}
      <TaskDetailModal
        key={selectedTask?.task_id} // Force re-render when task changes
        task={selectedTask}
        isOpen={!!selectedTask && !selectedSubtask} // Only show if no subtask is selected
        onClose={() => setSelectedTask(null)}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
        onTaskClick={(subtask) => {
          setSelectedSubtask(subtask);
          // Keep selectedTask for the return functionality
        }}
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
                setSelectedTask(updatedTask);
              }
            }
          }
        }}
      />

      {/* Subtask Detail Modal */}
      <TaskDetailModal
        key={selectedSubtask?.task_id}
        task={selectedSubtask}
        isOpen={!!selectedSubtask}
        onClose={() => setSelectedSubtask(null)}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
        allowSubtasks={false} // Subtasks cannot have their own subtasks
        parentTask={selectedTask}
        onReturnToParent={() => {
          setSelectedSubtask(null);
          // selectedTask is already set, so parent modal will show
        }}
        onRefresh={async () => {
          await queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
          
          if (selectedSubtask) {
            const freshData = await queryClient.fetchQuery({ queryKey: ['/api/crm/tasks'] });
            if (freshData && Array.isArray(freshData)) {
              const allTasks = freshData as Task[];
              const updatedSubtask = allTasks.find(t => t.task_id === selectedSubtask.task_id);
              if (updatedSubtask) {
                setSelectedSubtask(updatedSubtask);
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