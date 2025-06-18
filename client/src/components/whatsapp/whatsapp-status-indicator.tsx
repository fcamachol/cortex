import { Check, CheckCheck, Clock, AlertCircle, Eye, Volume2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppStatusIndicatorProps {
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'played' | 'error';
  timestamp?: string;
  isDeleted?: boolean;
  className?: string;
  showTime?: boolean;
}

export function WhatsAppStatusIndicator({ 
  status, 
  timestamp, 
  isDeleted, 
  className,
  showTime = true 
}: WhatsAppStatusIndicatorProps) {
  if (isDeleted) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <X className="h-3 w-3" />
        <span className="italic">This message was deleted</span>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3 text-gray-400" />;
      case 'sent':
        return <Check className="h-3 w-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'played':
        return (
          <div className="flex items-center">
            <CheckCheck className="h-3 w-3 text-blue-500" />
            <Volume2 className="h-2 w-2 text-blue-500 ml-0.5" />
          </div>
        );
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Sending...';
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'read':
        return 'Read';
      case 'played':
        return 'Played';
      case 'error':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      {getStatusIcon()}
      {showTime && timestamp && (
        <span>{formatTime(timestamp)}</span>
      )}
      <span className="sr-only">{getStatusText()}</span>
    </div>
  );
}

// Message bubble component with integrated status
interface WhatsAppMessageBubbleProps {
  content: string;
  timestamp: string;
  fromMe: boolean;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'played' | 'error';
  isDeleted?: boolean;
  messageType?: string;
  senderName?: string;
  isGroupMessage?: boolean;
}

export function WhatsAppMessageBubble({
  content,
  timestamp,
  fromMe,
  status = 'sent',
  isDeleted = false,
  messageType = 'text',
  senderName,
  isGroupMessage = false
}: WhatsAppMessageBubbleProps) {
  const bubbleClass = fromMe 
    ? "bg-green-500 text-white ml-auto" 
    : "bg-white dark:bg-gray-800 border";

  return (
    <div className={cn(
      "max-w-xs lg:max-w-md px-3 py-2 rounded-lg shadow-sm",
      bubbleClass,
      fromMe ? "rounded-br-none" : "rounded-bl-none"
    )}>
      {/* Group message sender name */}
      {!fromMe && isGroupMessage && senderName && (
        <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
          {senderName}
        </div>
      )}

      {/* Message type indicator */}
      {messageType !== 'text' && (
        <div className="text-xs opacity-75 mb-1 capitalize">
          {messageType.replace('_', ' ')}
        </div>
      )}

      {/* Message content */}
      <div className="break-words">
        {isDeleted ? (
          <span className="italic opacity-75">This message was deleted</span>
        ) : (
          content || <span className="italic opacity-75">No content</span>
        )}
      </div>

      {/* Timestamp and status */}
      <div className="flex items-center justify-end gap-1 mt-1">
        <span className="text-xs opacity-75">
          {new Date(timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          })}
        </span>
        {fromMe && (
          <WhatsAppStatusIndicator 
            status={status} 
            showTime={false}
            className="opacity-75"
          />
        )}
      </div>
    </div>
  );
}