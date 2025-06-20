import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface MessageHoverActionsProps {
  messageId: string;
  messageContent: string;
  chatId: string;
  instanceId: string;
  isVisible: boolean;
}

export function MessageHoverActions({ 
  messageId, 
  messageContent, 
  chatId, 
  instanceId, 
  isVisible 
}: MessageHoverActionsProps) {
  const queryClient = useQueryClient();

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/whatsapp/create-task-from-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          messageContent,
          chatId,
          instanceId,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
    },
  });

  if (!isVisible) return null;

  return (
    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 p-1 z-10">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-2 text-sm"
        onClick={() => createTaskMutation.mutate()}
        disabled={createTaskMutation.isPending}
      >
        <CheckSquare className="h-4 w-4" />
        {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
      </Button>
    </div>
  );
}