import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus } from 'lucide-react';

interface Reaction {
  reactionId: string;
  messageId: string;
  senderJid: string;
  reaction: string;
  fromMe: boolean;
  timestamp: string;
}

interface MessageReactionsProps {
  messageId: string;
  reactions: Reaction[];
  onAddReaction: (messageId: string, reaction: string) => void;
  isFromMe: boolean;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '✅', '❌'];

export function MessageReactions({ messageId, reactions, onAddReaction, isFromMe }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.reaction]) {
      acc[reaction.reaction] = [];
    }
    acc[reaction.reaction].push(reaction);
    return acc;
  }, {} as Record<string, Reaction[]>);

  const handleReactionClick = (emoji: string) => {
    onAddReaction(messageId, emoji);
    setShowPicker(false);
  };

  return (
    <div className={`flex items-center gap-1 mt-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
      {/* Display existing reactions */}
      {Object.entries(groupedReactions).map(([emoji, reactionList]) => (
        <button
          key={emoji}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs transition-colors"
          onClick={() => handleReactionClick(emoji)}
        >
          <span>{emoji}</span>
          <span className="text-gray-600 dark:text-gray-400">{reactionList.length}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align={isFromMe ? 'end' : 'start'}>
          <div className="grid grid-cols-5 gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="flex items-center justify-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                onClick={() => handleReactionClick(emoji)}
              >
                <span className="text-lg">{emoji}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}