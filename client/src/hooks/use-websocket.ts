import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WebSocketManager } from "@/lib/websocket";

export function useWebSocket(userId: string) {
  const wsRef = useRef<WebSocketManager | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Create WebSocket connection
    wsRef.current = new WebSocketManager(userId);

    // Listen for new messages
    wsRef.current.on('new_message', (data: any) => {
      console.log('Received new message:', data);
      
      // Invalidate relevant queries to update UI
      queryClient.invalidateQueries({ 
        queryKey: [`/api/whatsapp/messages/${data.data.conversationId}`] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/whatsapp/conversations/${userId}`] 
      });
    });

    // Listen for conversation updates
    wsRef.current.on('conversation_updated', (data: any) => {
      console.log('Conversation updated:', data);
      
      queryClient.invalidateQueries({ 
        queryKey: [`/api/whatsapp/conversations/${userId}`] 
      });
    });

    // Listen for contact updates
    wsRef.current.on('contact_updated', (data: any) => {
      console.log('Contact updated:', data);
      
      queryClient.invalidateQueries({ 
        queryKey: [`/api/whatsapp/contacts/${userId}`] 
      });
    });

    // Listen for instance status updates
    wsRef.current.on('instance_status_updated', (data: any) => {
      console.log('Instance status updated:', data);
      
      queryClient.invalidateQueries({ 
        queryKey: [`/api/whatsapp/instances/${userId}`] 
      });
    });

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [userId, queryClient]);

  // Return methods to send messages via WebSocket
  return {
    sendMessage: (messageData: any) => {
      if (wsRef.current) {
        wsRef.current.send({
          type: 'send_message',
          data: messageData
        });
      }
    },
    updateTypingStatus: (conversationId: string, isTyping: boolean) => {
      if (wsRef.current) {
        wsRef.current.send({
          type: 'typing_status',
          data: {
            conversationId,
            isTyping
          }
        });
      }
    },
    markMessageAsRead: (messageId: string) => {
      if (wsRef.current) {
        wsRef.current.send({
          type: 'mark_as_read',
          data: {
            messageId
          }
        });
      }
    }
  };
}
