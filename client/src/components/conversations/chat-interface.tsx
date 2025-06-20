import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Paperclip, Smile, Send, CheckSquare, Plus, MoreVertical } from "lucide-react";
import { ContactTasksAndEvents } from "@/components/contacts/ContactTasksAndEvents";
import { MessageReactions } from "@/components/conversations/MessageReactions";
import { MessageHoverActions } from "@/components/conversations/MessageHoverActions";
import { CreateTaskFromMessageModal } from "@/components/tasks/CreateTaskFromMessageModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Mock user ID - in real app this would come from auth context
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  // Note: Real-time messaging now handled via webhook-based Evolution API

  // Get conversation details first to identify instance
  const { data: conversations = [] } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/conversations/${userId}`],
  });

  const conversation = conversations.find(conv => conv.chatId === conversationId);
  const instanceId = conversation?.instanceId;

  const { data: rawMessages = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/chat-messages`, conversationId, instanceId],
    queryFn: async () => {
      if (!conversationId || !instanceId) return [];
      const response = await fetch(`/api/whatsapp/chat-messages?chatId=${encodeURIComponent(conversationId)}&instanceId=${instanceId}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      return data.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    },
    enabled: !!conversationId && conversationId !== 'undefined' && !!instanceId,
    refetchInterval: 2000, // Faster refresh for active chat
  });

  // Auto-refresh messages and conversations when new messages arrive
  useEffect(() => {
    const refreshMessages = () => {
      if (conversationId && instanceId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/whatsapp/chat-messages`, conversationId, instanceId]
        });
        // Also refresh conversation list to update latest message preview
        queryClient.invalidateQueries({
          queryKey: [`/api/whatsapp/conversations/${userId}`]
        });
      }
    };

    // Set up aggressive refresh for active conversation
    const interval = setInterval(refreshMessages, 3000);
    
    return () => clearInterval(interval);
  }, [conversationId, instanceId, queryClient, userId]);

  // Transform messages to match frontend expectations
  const messages = rawMessages.map((msg: any) => ({
    ...msg,
    content: msg.textContent || msg.content,
    isFromMe: msg.fromMe || msg.isFromMe
  }));

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!conversationId || !instanceId) throw new Error('Missing conversation or instance ID');
      
      const response = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId,
          chatId: conversationId,
          message: text,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/chat-messages`, conversationId, instanceId] });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
      setMessageInput("");
    },
  });

  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, reaction }: { messageId: string; reaction: string }) => {
      if (!conversationId || !instanceId) throw new Error('Missing conversation or instance ID');
      
      const response = await fetch('/api/whatsapp/add-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          instanceId,
          chatId: conversationId,
          reaction,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to add reaction');
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Refresh message reactions
      queryClient.invalidateQueries({ 
        queryKey: [`/api/whatsapp/message-reactions`, variables.messageId, instanceId] 
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !conversationId || !instanceId) return;
    sendMessageMutation.mutate(messageInput.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={conversation?.contact?.profilePictureUrl} />
              <AvatarFallback>
                {conversation?.title?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                {conversation?.type === 'group' ? 
                  (conversation.chatId || 'Unknown Group') :
                  (conversation?.title && conversation.title.includes('@') ? 
                    formatPhoneNumber(conversation.title) : 
                    (conversation?.title || formatPhoneNumber(conversation?.chatId || 'Unknown Contact')))}
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
                  contactName={conversation.title || 'Unknown Contact'}
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 chat-area max-h-[calc(100vh-200px)] scroll-smooth scrollbar-thin chat-messages-scroll">
        <div className="space-y-4">
          {messages.length === 0 ? (
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
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative ${
                    message.isFromMe
                      ? 'whatsapp-message-sent'
                      : 'whatsapp-message-received'
                  }`}
                >
                  {/* Sender name for group chats */}
                  {conversation?.type === 'group' && !message.isFromMe && (
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                      {message.senderJid ? formatPhoneNumber(message.senderJid.replace('@s.whatsapp.net', '')) : 'Unknown'}
                    </p>
                  )}
                  <p className="text-sm">{message.content}</p>
                  <div className={`flex items-center justify-end mt-1 space-x-1 ${
                    message.isFromMe ? 'justify-end' : 'justify-start'
                  }`}>
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

      {/* Message Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Paperclip className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <Input
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
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
          chatId={conversationId!}
          instanceId={instanceId!}
          contactName={conversation?.contactName}
        />
      )}
    </div>
  );
}
