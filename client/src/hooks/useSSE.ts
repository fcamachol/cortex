import { useEffect, useRef, useCallback } from 'react';

interface SSEHook {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

let globalEventSource: EventSource | null = null;
let connectionCount = 0;
let isConnecting = false;

export function useSSE(onMessage: (data: any) => void): SSEHook {
  const callbackRef = useRef(onMessage);
  const isActiveRef = useRef(true);
  
  // Update callback ref when it changes
  callbackRef.current = onMessage;

  const connect = useCallback(() => {
    if (globalEventSource && globalEventSource.readyState === EventSource.OPEN) {
      connectionCount++;
      return;
    }

    if (isConnecting) return;
    isConnecting = true;

    // Close any existing connection
    if (globalEventSource) {
      globalEventSource.close();
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 1000;

    const createConnection = () => {
      const eventSource = new EventSource('/api/events');
      globalEventSource = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection established');
        reconnectAttempts = 0;
        isConnecting = false;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle heartbeat messages
          if (data.type === 'heartbeat') {
            return;
          }

          // Broadcast to all active components
          const messageEvent = new CustomEvent('sse-message', { detail: data });
          window.dispatchEvent(messageEvent);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = () => {
        console.log('SSE connection lost');
        eventSource.close();
        
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
          reconnectAttempts++;
          
          setTimeout(() => {
            if (connectionCount > 0) {
              createConnection();
            }
          }, delay);
        } else {
          isConnecting = false;
        }
      };
    };

    createConnection();
    connectionCount++;
  }, []);

  const disconnect = useCallback(() => {
    connectionCount = Math.max(0, connectionCount - 1);
    isActiveRef.current = false;
    
    if (connectionCount === 0 && globalEventSource) {
      globalEventSource.close();
      globalEventSource = null;
      isConnecting = false;
    }
  }, []);

  useEffect(() => {
    const handleSSEMessage = (event: CustomEvent) => {
      if (isActiveRef.current) {
        callbackRef.current(event.detail);
      }
    };

    window.addEventListener('sse-message', handleSSEMessage as EventListener);
    connect();

    return () => {
      window.removeEventListener('sse-message', handleSSEMessage as EventListener);
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: globalEventSource?.readyState === EventSource.OPEN,
    connect,
    disconnect
  };
}