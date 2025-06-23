import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Flag } from 'lucide-react';

interface CreateTaskFromMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  messageContent: string;
  chatId: string;
  instanceId: string;
  contactName?: string;
  senderJid?: string;
}

export function CreateTaskFromMessageModal({
  isOpen,
  onClose,
  messageId,
  messageContent,
  chatId,
  instanceId,
  contactName,
  senderJid
}: CreateTaskFromMessageModalProps) {
  const [taskTitle, setTaskTitle] = useState(
    messageContent.length > 50 ? messageContent.substring(0, 47) + '...' : messageContent
  );
  const [taskDescription, setTaskDescription] = useState(messageContent);
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [taskType, setTaskType] = useState('task');

  const queryClient = useQueryClient();

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/whatsapp/create-task-from-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          messageContent,
          description: taskDescription,
          chatId,
          instanceId,
          senderJid,
          title: taskTitle,
          priority,
          dueDate: dueDate || null,
          taskType,
          contactName,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
      onClose();
      // Reset form values
      setTaskTitle(messageContent.length > 50 ? messageContent.substring(0, 47) + '...' : messageContent);
      setTaskDescription(messageContent);
      setPriority('medium');
      setDueDate('');
      setTaskType('task');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTaskMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create Task from Message
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taskType">Type</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="reminder">Reminder</SelectItem>
                <SelectItem value="event">Event</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taskTitle">Title</Label>
            <Input
              id="taskTitle"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Enter task title..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taskDescription">Description</Label>
            <Textarea
              id="taskDescription"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows={4}
              placeholder="Enter task description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority" className="flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Priority
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="dueDate" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Due Date
              </Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending ? 'Creating...' : `Create ${taskType}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}