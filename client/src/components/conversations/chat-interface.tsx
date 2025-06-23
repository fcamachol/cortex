import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Paperclip, Smile, Send, CheckSquare, Plus, MoreVertical, ChevronDown, Reply, Copy, Forward, Pin, Star, Trash2, X, Check } from "lucide-react";
import { ContactTasksAndEvents } from "@/components/contacts/ContactTasksAndEvents";
import { MessageReactions } from "@/components/conversations/MessageReactions";
import { MessageHoverActions } from "@/components/conversations/MessageHoverActions";
import { CreateTaskFromMessageModal } from "@/components/tasks/CreateTaskFromMessageModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// WebSocket functionality removed - using webhook-based system
import { apiRequest } from "@/lib/queryClient";
import { formatPhoneNumber } from "@/lib/phoneUtils";

interface ChatInterfaceProps {
  conversationId: string | null;
}

export default function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const [messageInput, setMessageInput] = useState("");
  const [messageReactions, setMessageReactions] = useState<Record<string, any[]>>({});
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMessageForTask, setSelectedMessageForTask] = useState<any>(null);
  const [openMessageDropdown, setOpenMessageDropdown] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<any>(null);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [selectedMessageForForward, setSelectedMessageForForward] = useState<any>(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState("");
  
  // Draft storage per conversation (now database-backed)
  const [replyStates, setReplyStates] = useState<{[chatId: string]: any}>({});
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);
  
  // Waiting reply state
  const [waitingReplyMessages, setWaitingReplyMessages] = useState<Set<string>>(new Set());
  
  // Multi-select forwarding state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Mock user ID - in real app this would come from auth context
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  // Fetch instances with customization data
  const { data: instances = [] } = useQuery({
    queryKey: [`/api/whatsapp/instances/${userId}`],
  });

  // Get current instance ID from selected conversation
  const currentInstanceId = instances.find((inst: any) => 
    conversationId?.startsWith(inst.instanceId)
  )?.instanceId;

  // Fetch waiting reply messages for current instance
  const { data: waitingReplyData = [] } = useQuery({
    queryKey: [`/api/whatsapp/waiting-reply/${currentInstanceId}`],
    enabled: !!currentInstanceId,
  });

  // Update waiting reply state when data changes
  useEffect(() => {
    if (waitingReplyData) {
      const messageIds = new Set(waitingReplyData.map((item: any) => item.message_id));
      setWaitingReplyMessages(messageIds);
    }
  }, [waitingReplyData]);

  // Get instance indicator with custom colors and letters
  const getInstanceIndicator = (instanceId: string) => {
    const instance = instances.find((inst: any) => inst.instanceId === instanceId);
    
    if (instance && (instance.customColor || instance.customLetter)) {
      return {
        color: instance.customColor || "",
        letter: instance.customLetter || "I"
      };
    }
    
    // Fallback to generated colors if no customization
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 
      'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-indigo-500',
      'bg-teal-500', 'bg-cyan-500', 'bg-lime-500', 'bg-amber-500'
    ];
    
    let hash = 0;
    for (let i = 0; i < instanceId.length; i++) {
      hash = instanceId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    
    let letter = 'I';
    if (instanceId.includes('live')) letter = 'L';
    else if (instanceId.includes('test')) letter = 'T';
    else if (instanceId.includes('prod')) letter = 'P';
    else if (instanceId.includes('instance')) {
      const match = instanceId.match(/\d+/);
      if (match) {
        const num = parseInt(match[0]);
        letter = String.fromCharCode(65 + (num % 26));
      }
    } else {
      letter = instanceId.charAt(0).toUpperCase();
    }
    
    return {
      color: colors[colorIndex],
      letter: letter
    };
  };

  // Note: Real-time messaging now handled via webhook-based Evolution API

  // Get conversation details first to identify instance
  const { data: conversations = [] } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/conversations/${userId}`],
  });

  // Also fetch contacts for display names
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: [`/api/contacts/${userId}`],
    refetchInterval: false, // Disable polling - use SSE for updates
    staleTime: 600000, // Cache for 10 minutes - contacts change rarely
  });

  // Helper function to get display name for conversation
  const getConversationDisplayName = (conv: any) => {
    // Try to find contact name for both groups and individuals
    const contact = contacts.find((c: any) => c.jid === conv.chatId);
    
    if (conv.chatId.includes('@g.us')) {
      // For groups, use group name from contacts
      if (contact && (contact.pushName || contact.verifiedName)) {
        return contact.pushName || contact.verifiedName;
      }
      // Fallback to group identifier if no name found
      const groupId = conv.chatId.replace('@g.us', '').split('-')[0];
      return `Group ${formatPhoneNumber(groupId)}`;
    } else {
      // For individuals, use contact name if available
      if (contact && (contact.pushName || contact.verifiedName)) {
        return contact.pushName || contact.verifiedName;
      }
      // Fallback to formatted phone number if no contact name
      const phoneNumber = conv.chatId.replace('@s.whatsapp.net', '');
      return formatPhoneNumber(phoneNumber);
    }
  };

  // Helper function to get display name for a sender JID
  const getSenderDisplayName = (senderJid: string) => {
    // Try to find matching contact first
    const contact = contacts.find((c: any) => c.jid === senderJid);
    
    if (contact) {
      return contact.pushName || contact.verifiedName || formatPhoneNumber(senderJid.replace('@s.whatsapp.net', ''));
    }
    
    // If no contact found, format the phone number
    return formatPhoneNumber(senderJid.replace('@s.whatsapp.net', ''));
  };

  // Parse the composite conversation identifier (instanceId:chatId)
  const [instanceId, chatId] = conversationId?.includes(':') 
    ? conversationId.split(':') 
    : [null, conversationId];
  
  // Find the specific conversation, preferring exact instance match
  const conversation = instanceId 
    ? conversations.find(conv => conv.chatId === chatId && conv.instanceId === instanceId)
    : conversations.find(conv => conv.chatId === chatId);
  
  // Use the conversation's instanceId if we found one, otherwise use the parsed instanceId
  const finalInstanceId = conversation?.instanceId || instanceId;

  const { data: rawMessages = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/chat-messages`, conversationId, finalInstanceId],
    queryFn: async () => {
      if (!chatId || !finalInstanceId) return [];
      console.log('Fetching messages for chatId:', chatId, 'instanceId:', finalInstanceId);
      const response = await fetch(`/api/whatsapp/chat-messages?chatId=${encodeURIComponent(chatId)}&instanceId=${finalInstanceId}&userId=${userId}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      console.log('Fetched messages:', data.length, 'messages for chat:', chatId);
      return data.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    },
    enabled: !!chatId && chatId !== 'undefined' && !!finalInstanceId,
    refetchInterval: false, // Disable polling - use SSE for real-time updates
    staleTime: 300000, // Cache for 5 minutes
  });

  // Set up Server-Sent Events for real-time message updates
  useEffect(() => {
    if (!conversationId || !instanceId) return;

    console.log('Setting up SSE connection for real-time messages');
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message') {
          const newMessage = data.payload;
          
          // Only process messages for the current conversation
          if (newMessage.chatId === chatId && newMessage.instanceId === finalInstanceId) {
            console.log('Received real-time message update:', newMessage);
            
            // Update the query cache with the new message
            queryClient.setQueryData(
              [`/api/whatsapp/chat-messages`, conversationId, instanceId],
              (oldMessages: any[] = []) => {
                // Check if message already exists to avoid duplicates
                const messageExists = oldMessages.some(msg => msg.messageId === newMessage.messageId);
                if (messageExists) return oldMessages;
                
                // Add new message and sort by timestamp
                const updatedMessages = [...oldMessages, newMessage];
                return updatedMessages.sort((a: any, b: any) => 
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
              }
            );

            // Also refresh conversation list to update latest message preview
            queryClient.invalidateQueries({
              queryKey: [`/api/whatsapp/conversations/${userId}`]
            });
          }
        }
      } catch (error) {
        console.error('Error processing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return () => {
      console.log('Closing SSE connection');
      eventSource.close();
    };
  }, [conversationId, instanceId, queryClient, userId]);

  // Force invalidation when conversation changes
  useEffect(() => {
    if (conversationId && instanceId) {
      // Force invalidate all message queries when switching conversations
      queryClient.invalidateQueries({
        queryKey: [`/api/whatsapp/chat-messages`]
      });
    }
  }, [conversationId, instanceId, queryClient]);

  // Remove the aggressive polling interval since we now use SSE for real-time updates

  // Transform messages to match frontend expectations
  const messages = rawMessages.map((msg: any) => ({
    ...msg,
    content: msg.textContent || msg.content,
    isFromMe: msg.fromMe || msg.isFromMe
  }));

  // Debug logging
  console.log('Raw messages received:', rawMessages.length, rawMessages.slice(0, 2));
  console.log('Transformed messages:', messages.length, messages.slice(0, 2));
  console.log('Current conversationId:', conversationId);
  console.log('Current instanceId:', instanceId);

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!chatId || !finalInstanceId) throw new Error('Missing conversation or instance ID');
      
      const payload: any = {
        instanceId: finalInstanceId,
        chatId: chatId,
        message: text,
      };

      // Add reply information if replying to a message
      if (replyToMessage) {
        payload.quotedMessageId = replyToMessage.messageId;
      }
      
      const response = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chat-messages`, conversationId, finalInstanceId] });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
      setMessageInput("");
      setReplyToMessage(null);
      
      // Clear draft and reply state for current conversation
      if (conversationId) {
        setDrafts(prev => ({
          ...prev,
          [conversationId]: ""
        }));
        setReplyStates(prev => ({
          ...prev,
          [conversationId]: null
        }));
      }
    },
  });

  const forwardMessageMutation = useMutation({
    mutationFn: async ({ targetChatId, targetInstanceId }: { targetChatId: string; targetInstanceId: string }) => {
      if (!selectedMessageForForward) throw new Error('No message selected for forwarding');
      
      // Handle multiple messages if it's an array
      const messagesToForward = Array.isArray(selectedMessageForForward) 
        ? selectedMessageForForward 
        : [selectedMessageForForward];
      
      // Send each message separately
      const promises = messagesToForward.map(async (message) => {
        const payload = {
          instanceId: targetInstanceId,
          chatId: targetChatId,
          message: message.content,
          isForwarded: true,
        };
        
        const response = await fetch('/api/whatsapp/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) throw new Error('Failed to forward message');
        return response.json();
      });
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chat-messages`] });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
      setForwardModalOpen(false);
      setSelectedMessageForForward(null);
      // Clear multi-select state after successful forwarding
      setIsMultiSelectMode(false);
      setSelectedMessages(new Set());
    }
  });

  // Query to get all conversations for forward modal
  const { data: allConversations } = useQuery({
    queryKey: [`/api/whatsapp/conversations/${userId}`],
    enabled: !!userId && forwardModalOpen
  });



  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, reaction }: { messageId: string; reaction: string }) => {
      if (!chatId || !finalInstanceId) throw new Error('Missing conversation or instance ID');
      
      const response = await fetch('/api/whatsapp/add-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          instanceId: finalInstanceId,
          chatId: chatId,
          reaction,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to add reaction');
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Refresh message reactions
      queryClient.invalidateQueries({ 
        queryKey: [`/api/whatsapp/message-reactions`, variables.messageId, finalInstanceId] 
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !chatId || !finalInstanceId) return;
    sendMessageMutation.mutate(messageInput.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Message action handlers
  const handleReplyToMessage = (message: any) => {
    setReplyToMessage(message);
    // Save reply state for current conversation
    if (conversationId) {
      setReplyStates(prev => ({
        ...prev,
        [conversationId]: message
      }));
    }
    setOpenMessageDropdown(null);
  };

  const handleCopyMessage = (message: any) => {
    navigator.clipboard.writeText(message.content);
    setCopiedMessage(message.messageId);
    setOpenMessageDropdown(null);
    setTimeout(() => setCopiedMessage(null), 2000);
  };

  const handleForwardMessage = (message: any) => {
    // Enter multi-select mode for forwarding
    setIsMultiSelectMode(true);
    setSelectedMessages(new Set([message.messageId || message.id]));
    setOpenMessageDropdown(null);
  }

  const handleMultiSelectForward = () => {
    setIsMultiSelectMode(true);
    setSelectedMessages(new Set());
  };

  const handleCancelMultiSelect = () => {
    setIsMultiSelectMode(false);
    setSelectedMessages(new Set());
  };

  const handleToggleMessageSelect = (messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleForwardSelectedMessages = () => {
    if (selectedMessages.size > 0) {
      const selectedMessageData = messages.filter(msg => 
        selectedMessages.has(msg.messageId || msg.id)
      );
      setSelectedMessageForForward(selectedMessageData);
      setForwardModalOpen(true);
      // Don't clear selection yet - do it after forwarding is complete
    }
  };;

  const handleStarMessage = (message: any) => {
    // Implement star functionality
    console.log('Star message:', message);
    setOpenMessageDropdown(null);
  };

  const handleDeleteMessage = (message: any) => {
    // Implement delete functionality
    console.log('Delete message:', message);
    setOpenMessageDropdown(null);
  };

  const cancelReply = () => {
    setReplyToMessage(null);
    // Also clear reply state for current conversation
    if (conversationId) {
      setReplyStates(prev => ({
        ...prev,
        [conversationId]: null
      }));
    }
  };

  // Load draft for current conversation
  const { data: currentDraft } = useQuery({
    queryKey: [`/api/whatsapp/drafts/${finalInstanceId}/${chatId}`],
    queryFn: async () => {
      if (!finalInstanceId || !chatId) return null;
      try {
        console.log('Fetching draft for:', { instanceId: finalInstanceId, chatId });
        const response = await fetch(`/api/whatsapp/drafts/${finalInstanceId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const drafts = await response.json();
          console.log('All drafts for instance:', drafts);
          const foundDraft = drafts.find((d: any) => d.chatId === chatId);
          console.log('Found draft for conversation:', foundDraft);
          return foundDraft || null;
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
      return null;
    },
    enabled: !!finalInstanceId && !!chatId,
    staleTime: 1000, // Reduce stale time for more responsive draft loading
    refetchOnWindowFocus: true
  });

  // Save current draft when switching conversations
  const saveDraftOnSwitch = (oldChatId: string, oldInstanceId: string, messageContent: string) => {
    if (oldChatId && oldInstanceId && messageContent && messageContent.trim()) {
      saveDraftMutation.mutate({
        chatId: oldChatId, // Use raw chatId, not conversationId
        instanceId: oldInstanceId,
        content: messageContent,
        replyToMessageId: replyToMessage?.messageId || null
      });
    }
  };

  // Refs to track previous conversation state for draft saving
  const prevConversationId = useRef<string | null>(null);
  const prevInstanceId = useRef<string | null>(null);
  const prevMessageInput = useRef<string>("");

  // Load draft content when conversation changes
  useEffect(() => {
    console.log('Draft loading effect triggered:', { currentDraft, conversationId, instanceId: finalInstanceId });
    
    // Save draft for previous conversation if there was content
    if (prevConversationId.current && prevInstanceId.current && prevMessageInput.current.trim()) {
      // Extract chatId from previous conversationId
      const prevChatId = prevConversationId.current?.includes(':') 
        ? prevConversationId.current.split(':')[1] 
        : prevConversationId.current;
      saveDraftOnSwitch(prevChatId, prevInstanceId.current, prevMessageInput.current);
    }

    // Always clear input first when switching conversations
    if (conversationId !== prevConversationId.current) {
      console.log('Conversation changed, clearing input first');
      setMessageInput("");
      setReplyToMessage(null);
    }

    // Load draft for new conversation only if it matches the current chat
    if (currentDraft?.content && currentDraft.chatId === chatId && currentDraft.instanceId === finalInstanceId) {
      console.log('Loading draft content for correct chat:', currentDraft.content);
      setMessageInput(currentDraft.content);
      if (currentDraft.replyToMessageId) {
        setReplyToMessage({ messageId: currentDraft.replyToMessageId });
      }
    }

    // Update refs for next conversation switch - use current values, not stale ones
    prevConversationId.current = conversationId;
    prevInstanceId.current = finalInstanceId;
    // Don't update prevMessageInput here - it will be updated when user types
  }, [currentDraft, conversationId, finalInstanceId, chatId]);

  // Update message input ref when user types
  useEffect(() => {
    prevMessageInput.current = messageInput;
  }, [messageInput]);

  // Draft saving mutation
  const saveDraftMutation = useMutation({
    mutationFn: async ({ chatId, instanceId, content, replyToMessageId }: any) => {
      // Ensure we always use raw chatId, never composite identifier
      const rawChatId = chatId?.includes(':') ? chatId.split(':')[1] : chatId;
      
      const response = await fetch('/api/whatsapp/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: rawChatId, // Always use raw chat ID
          instanceId,
          content,
          replyToMessageId
        })
      });
      if (!response.ok) throw new Error('Failed to save draft');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all draft-related queries to refresh the conversation list
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/drafts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations`] });
    }
  });

  // Draft deletion mutation
  const deleteDraftMutation = useMutation({
    mutationFn: async ({ instanceId, chatId }: { instanceId: string, chatId: string }) => {
      const response = await fetch(`/api/whatsapp/drafts/${instanceId}/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to delete draft');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all draft-related queries to refresh the conversation list
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/drafts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations`] });
    }
  });

  // Waiting reply mutations
  const markWaitingReplyMutation = useMutation({
    mutationFn: async ({ messageId, instanceId, chatId }: { messageId: string, instanceId: string, chatId: string }) => {
      return apiRequest('POST', '/api/whatsapp/waiting-reply', { messageId, instanceId, chatId });
    },
    onSuccess: (_, { messageId }) => {
      setWaitingReplyMessages(prev => new Set(prev).add(messageId));
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/waiting-reply/${currentInstanceId}`] });
    },
    onError: (error) => {
      console.error('Failed to mark message as waiting reply:', error);
    }
  });

  const unmarkWaitingReplyMutation = useMutation({
    mutationFn: async ({ messageId }: { messageId: string }) => {
      return apiRequest('DELETE', `/api/whatsapp/waiting-reply/${messageId}`, {});
    },
    onSuccess: (_, { messageId }) => {
      setWaitingReplyMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/waiting-reply/${currentInstanceId}`] });
    },
    onError: (error) => {
      console.error('Failed to unmark message from waiting reply:', error);
    }
  });

  // Save draft only when leaving window with unfinished message
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (conversationId && instanceId && messageInput && messageInput.trim()) {
        // Use sendBeacon with JSON blob for beforeunload
        const data = JSON.stringify({
          chatId: conversationId,
          instanceId,
          content: messageInput,
          replyToMessageId: replyToMessage?.messageId || null
        });
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon('/api/whatsapp/drafts', blob);
      }
    };

    const handleWindowBlur = () => {
      if (conversationId && instanceId && messageInput && messageInput.trim()) {
        saveDraftMutation.mutate({
          chatId: conversationId,
          instanceId,
          content: messageInput,
          replyToMessageId: replyToMessage?.messageId || null
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [conversationId, instanceId, messageInput, replyToMessage, saveDraftMutation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Temporarily disable reactions loading to fix database errors
  // useEffect(() => {
  //   if (messages.length > 0 && instanceId) {
  //     const loadReactions = async () => {
  //       const reactionPromises = messages.map(async (message: any) => {
  //         const messageId = message.messageId || message.id;
  //         try {
  //           const response = await fetch(`/api/whatsapp/message-reactions?messageId=${messageId}&instanceId=${instanceId}`);
  //           if (response.ok) {
  //             const reactions = await response.json();
  //             return { messageId, reactions };
  //           }
  //         } catch (error) {
  //           console.error('Error loading reactions for message:', messageId, error);
  //         }
  //         return { messageId, reactions: [] };
  //       });

  //       const results = await Promise.all(reactionPromises);
  //       const reactionsMap = results.reduce((acc, { messageId, reactions }) => {
  //         acc[messageId] = reactions;
  //         return acc;
  //       }, {} as Record<string, any[]>);

  //       setMessageReactions(reactionsMap);
  //     };

  //     loadReactions();
  //   }
  // }, [messages, instanceId]);

  const handleOpenTaskModal = (message: any) => {
    setSelectedMessageForTask(message);
    setModalOpen(true);
  };

  const handleCloseTaskModal = () => {
    setModalOpen(false);
    setSelectedMessageForTask(null);
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center chat-area">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Welcome to your Personal CRM
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Select a conversation to start messaging
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center chat-area">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={conversation?.contact?.profilePictureUrl} />
                <AvatarFallback>
                  {conversation?.title?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              {/* Instance indicator circle */}
              {instanceId && (() => {
                const indicator = getInstanceIndicator(instanceId);
                return (
                  <div 
                    className={`absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center ${
                      indicator.color ? `${indicator.color} rounded-full text-white` : ''
                    }`}
                    style={{
                      fontSize: indicator.letter.length > 1 ? '18px' : '10px',
                      fontWeight: indicator.letter.length > 1 ? 'normal' : 'bold',
                      lineHeight: '1',
                      overflow: 'visible',
                      fontFamily: indicator.letter.length > 1 ? 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' : 'inherit',
                      color: indicator.color ? 'white' : '#666'
                    }}
                    title={`Instance: ${instanceId}`}
                  >
                    {indicator.letter}
                  </div>
                );
              })()}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                {conversation ? getConversationDisplayName(conversation) : 'Unknown Contact'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {conversation?.status || 'Online'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm">
                  <CheckSquare className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                <ContactTasksAndEvents
                  contactJid={conversation.chatId}
                  contactName={conversation ? getConversationDisplayName(conversation) : 'Unknown Contact'}
                  instanceId={instanceId}
                />
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 chat-area scroll-smooth scrollbar-thin chat-messages-scroll">
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message: any, index: number) => (
              <div
                key={message.messageId || message.id || `message-${index}`}
                className={`flex ${message.isFromMe ? 'justify-end' : 'justify-start'} relative group`}
                onMouseEnter={() => setHoveredMessageId(message.messageId || message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                {/* Multi-select checkbox */}
                {isMultiSelectMode && (
                  <div className="flex items-start mt-2 mr-2">
                    <input
                      type="checkbox"
                      checked={selectedMessages.has(message.messageId || message.id)}
                      onChange={() => handleToggleMessageSelect(message.messageId || message.id)}
                      className="w-4 h-4 text-blue-500 border-2 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </div>
                )}
              
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative ${
                    message.isFromMe
                      ? 'whatsapp-message-sent'
                      : 'whatsapp-message-received'
                  }`}
                >
                  {/* Sender name for group chats */}
                  {(conversation?.type === 'group' || conversation?.chatId?.includes('@g.us')) && !message.isFromMe && (
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                      {message.senderJid ? getSenderDisplayName(message.senderJid) : 'Unknown'}
                    </p>
                  )}

                  {/* Forwarded message indicator */}
                  {message.isForwarded && (
                    <div className="message-forward-indicator">
                      <Forward className="h-3 w-3" />
                      <span>Reenviado</span>
                    </div>
                  )}

                  {/* Reply to message indicator */}
                  {message.quotedMessageId && (
                    <div className="message-reply-indicator">
                      <div className="text-xs">
                        <p className="font-medium text-green-600 dark:text-green-400 mb-1">
                          {(() => {
                            const quotedMsg = messages.find(m => m.messageId === message.quotedMessageId);
                            if (quotedMsg) {
                              return quotedMsg.isFromMe ? 'You' : getSenderDisplayName(quotedMsg.senderJid);
                            }
                            return 'Unknown';
                          })()}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 truncate">
                          {(() => {
                            const quotedMsg = messages.find(m => m.messageId === message.quotedMessageId);
                            return quotedMsg?.content || 'Message not found';
                          })()}
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="text-sm">{message.content}</p>
                  <div className={`flex items-center justify-end mt-1 space-x-1 ${
                    message.isFromMe ? 'justify-end' : 'justify-start'
                  }`}>
                    {/* Waiting reply checkbox - appears on hover */}
                    {(hoveredMessageId === (message.messageId || message.id)) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-4 w-4 p-0 rounded-sm transition-colors ${
                          waitingReplyMessages.has(message.messageId || message.id) 
                            ? 'bg-blue-500 text-white hover:bg-blue-600' 
                            : 'bg-transparent border border-blue-500 text-blue-500 hover:bg-blue-50'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const messageId = message.messageId || message.id;
                          const isWaiting = waitingReplyMessages.has(messageId);
                          
                          if (isWaiting) {
                            unmarkWaitingReplyMutation.mutate({ messageId });
                          } else {
                            markWaitingReplyMutation.mutate({ 
                              messageId, 
                              instanceId: currentInstanceId || '',
                              chatId: chatId || ''
                            });
                          }
                        }}
                        title={waitingReplyMessages.has(message.messageId || message.id) ? 'Unmark awaiting reply' : 'Mark as awaiting reply'}
                      >
                        {waitingReplyMessages.has(message.messageId || message.id) && (
                          <Check className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    {message.isFromMe && (
                      <div className="text-xs text-blue-500">
                        {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
                      </div>
                    )}
                  </div>

                  {/* Dropdown arrow in top-right corner */}
                  {(hoveredMessageId === (message.messageId || message.id) || openMessageDropdown === (message.messageId || message.id)) && (
                    <div className="absolute -top-2 -right-2 z-20">
                      <DropdownMenu 
                        open={openMessageDropdown === (message.messageId || message.id)}
                        onOpenChange={(open) => {
                          if (open) {
                            setOpenMessageDropdown(message.messageId || message.id);
                          } else {
                            setOpenMessageDropdown(null);
                          }
                        }}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setOpenMessageDropdown(message.messageId || message.id);
                            }}
                          >
                            <ChevronDown className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          className="w-48"
                          onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                          <DropdownMenuItem 
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplyToMessage(message);
                              setOpenMessageDropdown(null);
                            }}
                          >
                            <Reply className="h-4 w-4" />
                            Responder
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyMessage(message);
                              setOpenMessageDropdown(null);
                            }}
                          >
                            <Copy className="h-4 w-4" />
                            {copiedMessage === message.messageId ? 'Copiado!' : 'Copiar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTaskModal(message);
                              setOpenMessageDropdown(null);
                            }}
                          >
                            <Smile className="h-4 w-4" />
                            Reaccionar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleForwardMessage(message);
                              setOpenMessageDropdown(null);
                            }}
                          >
                            <Forward className="h-4 w-4" />
                            Reenviar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStarMessage(message);
                              setOpenMessageDropdown(null);
                            }}
                          >
                            <Star className="h-4 w-4" />
                            Destacar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMessage(message);
                              setOpenMessageDropdown(null);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  
                  {/* Message Hover Actions */}
                  <MessageHoverActions
                    messageId={message.messageId || message.id}
                    messageContent={message.content}
                    chatId={conversationId!}
                    instanceId={instanceId!}
                    isVisible={hoveredMessageId === (message.messageId || message.id)}
                    isFromMe={message.isFromMe}
                    onOpenModal={() => handleOpenTaskModal(message)}
                  />
                </div>
                
                {/* Message Reactions - Temporarily disabled to fix database errors */}
                {/* <MessageReactions
                  messageId={message.messageId || message.id}
                  reactions={messageReactions[message.messageId || message.id] || []}
                  onAddReaction={(messageId, reaction) => {
                    addReactionMutation.mutate({ messageId, reaction });
                  }}
                  isFromMe={message.isFromMe}
                /> */}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Multi-select control bar */}
      {isMultiSelectMode && (
        <div className="bg-gray-100 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 p-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelMultiSelect}
            className="text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {selectedMessages.size} seleccionado{selectedMessages.size !== 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForwardSelectedMessages}
            disabled={selectedMessages.size === 0}
            className="text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            <Forward className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
        {/* Reply indicator */}
        {replyToMessage && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Respondiendo a {replyToMessage.isFromMe ? 'ti mismo' : getSenderDisplayName(replyToMessage.senderJid)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                  {replyToMessage.content}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelReply}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Paperclip className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <Input
              placeholder={replyToMessage ? "Escribe tu respuesta..." : "Type a message..."}
              value={messageInput}
              onChange={(e) => {
                const newValue = e.target.value;
                setMessageInput(newValue);
                
                // If message is manually cleared (empty), delete any existing draft
                // Only delete if we're not already in the process of deleting to prevent loops
                if (newValue.trim() === '' && currentDraft && !isDeletingDraft) {
                  setIsDeletingDraft(true);
                  deleteDraftMutation.mutate({
                    instanceId: finalInstanceId!,
                    chatId: chatId!
                  }, {
                    onSettled: () => {
                      setIsDeletingDraft(false);
                    }
                  });
                }
              }}
              onKeyPress={handleKeyPress}
              disabled={sendMessageMutation.isPending}
            />
          </div>
          <Button variant="ghost" size="sm">
            <Smile className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || sendMessageMutation.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Task Creation Modal */}
      {selectedMessageForTask && (
        <CreateTaskFromMessageModal
          isOpen={modalOpen}
          onClose={handleCloseTaskModal}
          messageId={selectedMessageForTask.messageId || selectedMessageForTask.id}
          messageContent={selectedMessageForTask.content}
          chatId={chatId!}
          instanceId={finalInstanceId!}
          contactName={conversation?.contactName}
        />
      )}

      {/* Forward Message Modal */}
      <Dialog open={forwardModalOpen} onOpenChange={(open) => {
        setForwardModalOpen(open);
        if (!open) {
          setForwardSearchQuery(""); // Clear search when modal closes
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reenviar mensaje</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              {Array.isArray(selectedMessageForForward) && selectedMessageForForward.length > 1 
                ? `Selecciona una conversación para reenviar ${selectedMessageForForward.length} mensajes:`
                : "Selecciona una conversación para reenviar el mensaje:"
              }
            </div>
            {Array.isArray(selectedMessageForForward) && selectedMessageForForward.length > 1 && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-500 mb-2">Mensajes seleccionados:</div>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {selectedMessageForForward.map((msg, index) => (
                    <div key={msg.messageId || msg.id} className="text-xs text-gray-700 truncate">
                      {index + 1}. {msg.content}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Input
              placeholder="Buscar conversación..."
              value={forwardSearchQuery}
              onChange={(e) => setForwardSearchQuery(e.target.value)}
              className="w-full"
            />
            <div className="max-h-64 overflow-y-auto space-y-2">
              {allConversations?.filter((conv: any) => {
                if (!forwardSearchQuery) return true;
                const searchLower = forwardSearchQuery.toLowerCase();
                const displayName = getConversationDisplayName(conv);
                return displayName.toLowerCase().includes(searchLower) ||
                       conv.chatId.toLowerCase().includes(searchLower);
              }).map((conv: any) => (
                <div
                  key={`${conv.instanceId}:${conv.chatId}`}
                  className="p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    forwardMessageMutation.mutate({
                      targetChatId: conv.chatId,
                      targetInstanceId: conv.instanceId
                    });
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {getConversationDisplayName(conv).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {/* Instance indicator */}
                      {conv.instanceId && (() => {
                        const indicator = getInstanceIndicator(conv.instanceId);
                        return (
                          <div 
                            className={`absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center ${
                              indicator.color ? `${indicator.color} rounded-full text-white` : ''
                            }`}
                            style={{
                              fontSize: indicator.letter.length > 1 ? '18px' : '10px',
                              fontWeight: indicator.letter.length > 1 ? 'normal' : 'bold',
                              lineHeight: '1',
                              overflow: 'visible',
                              fontFamily: indicator.letter.length > 1 ? 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' : 'inherit',
                              color: indicator.color ? 'white' : '#666'
                            }}
                          >
                            {indicator.letter}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {getConversationDisplayName(conv)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {forwardMessageMutation.isPending && (
              <div className="text-sm text-gray-500 text-center">
                Reenviando mensaje...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
