import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare } from 'lucide-react';

interface MessageHoverActionsProps {
  messageId: string;
  messageContent: string;
  chatId: string;
  instanceId: string;
  isVisible: boolean;
  onOpenModal: () => void;
}

export function MessageHoverActions({ 
  isVisible,
  onOpenModal
}: MessageHoverActionsProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 p-1 z-10">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={onOpenModal}
      >
        <CheckSquare className="h-4 w-4" />
      </Button>
    </div>
  );
}