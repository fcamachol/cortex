import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, MoreVertical, Users } from "lucide-react";
import TaskForm from "@/components/forms/task-form";

export default function TaskModule() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Mock user ID - in real app this would come from auth context
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/crm/tasks'],
  });

  const filteredTasks = tasks.filter((task: any) => {
    if (activeFilter === "all") return true;
    return task.taskStatus === activeFilter;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      case "medium":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return "No due date";
    
    const date = new Date(dueDate);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Due: Today";
    if (diffDays === 1) return "Due: Tomorrow";
    if (diffDays === -1) return "Due: Yesterday";
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
    return `Due: ${diffDays} days`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-gray-500 dark:text-gray-400">
            Loading tasks...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tasks</h1>
          <Button 
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>

        {/* Task Filters */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex items-center space-x-2">
            {[
              { key: "all", label: "All Tasks" },
              { key: "to_do", label: "To Do" },
              { key: "in_progress", label: "In Progress" },
              { key: "done", label: "Done" }
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={activeFilter === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(filter.key)}
                className={activeFilter === filter.key ? "bg-green-500 hover:bg-green-600 text-white" : ""}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Tasks Grid */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No tasks found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {activeFilter === "all" ? "Create your first task to get started" : `No tasks in ${activeFilter.replace('_', ' ')} status`}
            </p>
            <Button 
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={() => setIsFormOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks.map((task: any) => (
              <div key={task.id} className="task-card">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-5">
                    {task.title}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Badge className={`text-xs px-2 py-1 ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {task.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                    {task.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {task.contact ? (
                      <>
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={task.contact.avatar} />
                          <AvatarFallback className="text-xs">
                            {task.contact.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {task.contact.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <Users className="w-3 h-3 text-gray-400" />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          No contact
                        </span>
                      </>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDueDate(task.dueDate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <TaskForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          userId={userId}
        />
      </div>
    </div>
  );
}
