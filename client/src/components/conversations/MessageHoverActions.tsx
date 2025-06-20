import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare, Smile } from 'lucide-react';

interface MessageHoverActionsProps {
  messageId: string;
  messageContent: string;
  chatId: string;
  instanceId: string;
  isVisible: boolean;
  isFromMe: boolean;
  onOpenModal: () => void;
}

export function MessageHoverActions({ 
  isVisible,
  isFromMe,
  onOpenModal
}: MessageHoverActionsProps) {
  if (!isVisible) return null;

  return (
    <div className={`absolute top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 shadow-lg rounded-full border border-gray-200 dark:border-gray-700 p-1 z-10 ${
      isFromMe ? '-left-20' : '-right-20'
    }`}>
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={onOpenModal}
        >
          <CheckSquare className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Smile className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}