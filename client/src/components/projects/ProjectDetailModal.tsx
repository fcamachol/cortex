import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Calendar,
  Clock,
  DollarSign,
  FileText,
  CheckCircle,
  Circle,
  Users,
  BarChart3,
} from 'lucide-react';

interface ProjectDetailModalProps {
  projectId: string | null;
  onClose: () => void;
}

interface ProjectDetail {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  spentAmount?: number;
  progress?: number;
  tags?: string[];
  color?: string;
  tasks: Task[];
  files: any[];
  taskCount: number;
  completedTasks: number;
  taskProgress: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
}

const statusColors = {
  planning: 'bg-gray-100 text-gray-800',
  active: 'bg-blue-100 text-blue-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

export function ProjectDetailModal({ projectId, onClose }: ProjectDetailModalProps) {
  const { data: project, isLoading } = useQuery<ProjectDetail>({
    queryKey: ['/api/crm/projects', projectId, 'detail'],
    enabled: !!projectId,
  });

  if (!projectId) return null;

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Dialog open={!!projectId} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold">
                {project?.name || 'Loading...'}
              </DialogTitle>
              {project && (
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[project.status as keyof typeof statusColors] || statusColors.planning}>
                    {project.status?.replace('_', ' ').toUpperCase()}
                  </Badge>
                  {project.priority && (
                    <Badge variant="outline" className={priorityColors[project.priority as keyof typeof priorityColors]}>
                      {project.priority.toUpperCase()}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : project ? (
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="overview" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="tasks">Tasks ({project.taskCount || 0})</TabsTrigger>
                <TabsTrigger value="files">Files ({project.files?.length || 0})</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-auto">
                <TabsContent value="overview" className="space-y-6 p-1">
                  {/* Project Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Progress</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{project.progress || 0}%</div>
                        <Progress value={project.progress || 0} className="mt-2" />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasks</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {project.completedTasks || 0}/{project.taskCount || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {project.taskProgress || 0}% complete
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Budget</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(project.budget || 0)}</div>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(project.spentAmount || 0)} spent
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Duration</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm font-bold">
                          {project.startDate ? formatDate(project.startDate) : 'Not set'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          to {project.endDate ? formatDate(project.endDate) : 'Not set'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Description</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{project.description}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tags */}
                  {project.tags && project.tags.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Tags</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {project.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="space-y-4 p-1">
                  {!project.tasks || project.tasks.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center text-muted-foreground">
                          <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <h3 className="text-lg font-medium mb-2">No tasks yet</h3>
                          <p className="text-sm">Tasks will appear here when they're linked to this project.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {(project.tasks || []).map((task) => (
                        <Card key={task.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {task.status === 'done' ? (
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                  <Circle className="h-5 w-5 text-gray-400" />
                                )}
                                <div>
                                  <h4 className="font-medium">{task.title}</h4>
                                  {task.dueDate && (
                                    <p className="text-sm text-muted-foreground">
                                      Due: {formatDate(task.dueDate)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{task.status}</Badge>
                                {task.priority && (
                                  <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
                                    {task.priority}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="files" className="space-y-4 p-1">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">No files yet</h3>
                        <p className="text-sm">Project files will appear here when uploaded.</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4 p-1">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">Timeline coming soon</h3>
                        <p className="text-sm">Project timeline and milestones will be displayed here.</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <h3 className="text-lg font-medium mb-2">Project not found</h3>
              <p className="text-sm">The requested project could not be loaded.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}