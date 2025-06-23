import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Check, CheckCheck, Users, ChevronDown, Archive, Bell, BellOff, Pin, Heart, Ban, Trash2, X, EyeOff } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneUtils";
import { formatConversationTimestamp } from "@/lib/timeUtils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ConversationListProps {
  selectedConversation: string | null;
  onSelectConversation: (conversationId: string) => void;
}

export default function ConversationList({ selectedConversation, onSelectConversation }: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredConversation, setHoveredConversation] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [hiddenChats, setHiddenChats] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  const [selectedInstance, setSelectedInstance] = useState<string>('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Load hidden chats from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('hiddenChats');
    if (stored) {
      try {
        const hiddenArray = JSON.parse(stored);
        setHiddenChats(new Set(hiddenArray));
      } catch (error) {
        console.warn('Failed to load hidden chats from localStorage');
      }
    }
  }, []);

  // Save hidden chats to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('hiddenChats', JSON.stringify(Array.from(hiddenChats)));
  }, [hiddenChats]);

  // Toggle chat visibility (internal only)
  const toggleChatVisibility = (chatId: string, instanceId: string) => {
    const chatKey = `${instanceId}:${chatId}`;
    const newHiddenChats = new Set(hiddenChats);
    
    if (hiddenChats.has(chatKey)) {
      newHiddenChats.delete(chatKey);
      toast({
        title: "Chat visible",
        description: "El chat se mostró en la lista de conversaciones"
      });
    } else {
      newHiddenChats.add(chatKey);
      toast({
        title: "Chat oculto",
        description: "El chat se ocultó de la lista de conversaciones"
      });
    }
    
    setHiddenChats(newHiddenChats);
    setOpenDropdown(null);
  };

  // Get emoji for instance directly from the instance data
  const getInstanceEmoji = (instanceId: string) => {
    const instance = instances.find((i: any) => i.instanceId === instanceId);
    return instance?.customLetter || '📱';
  };

  // Get display name for instance
  const getInstanceDisplayName = (instanceId: string) => {
    const instance = instances.find((i: any) => i.instanceId === instanceId);
    return instance?.displayName || instanceId;
  };

  // Chat management mutations
  const archiveChatMutation = useMutation({
    mutationFn: async ({ chatId, instanceId, archived }: { chatId: string; instanceId: string; archived: boolean }) => {
      return apiRequest(`/api/whatsapp/conversations/${chatId}/archive`, {
        method: 'PATCH',
        body: { instanceId, archived }
      });
    },
    onSuccess: (_, { archived }) => {
      toast({
        title: archived ? "Chat archivado" : "Chat desarchivado",
        description: archived ? "El chat se movió al archivo" : "El chat se restauró del archivo"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
    }
  });

  const muteChatMutation = useMutation({
    mutationFn: async ({ chatId, instanceId, muted }: { chatId: string; instanceId: string; muted: boolean }) => {
      return apiRequest(`/api/whatsapp/conversations/${chatId}/mute`, {
        method: 'PATCH',
        body: { instanceId, muted }
      });
    },
    onSuccess: (_, { muted }) => {
      toast({
        title: muted ? "Chat silenciado" : "Chat no silenciado",
        description: muted ? "No recibirás notificaciones" : "Recibirás notificaciones normalmente"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
    }
  });

  const pinChatMutation = useMutation({
    mutationFn: async ({ chatId, instanceId, pinned }: { chatId: string; instanceId: string; pinned: boolean }) => {
      return apiRequest(`/api/whatsapp/conversations/${chatId}/pin`, {
        method: 'PATCH',
        body: { instanceId, pinned }
      });
    },
    onSuccess: (_, { pinned }) => {
      toast({
        title: pinned ? "Chat fijado" : "Chat no fijado",
        description: pinned ? "El chat aparecerá al principio" : "El chat se ordenará normalmente"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
    }
  });

  const markUnreadMutation = useMutation({
    mutationFn: async ({ chatId, instanceId, unread, silent = false }: { chatId: string; instanceId: string; unread: boolean; silent?: boolean }) => {
      return apiRequest('PATCH', `/api/whatsapp/conversations/read-status`, { chatId, instanceId, unread });
    },
    onSuccess: (_, { unread, silent = false }) => {
      if (!silent) {
        toast({
          title: unread ? "Marcado como no leído" : "Marcado como leído",
          description: unread ? "El chat aparecerá como nuevo" : "El chat aparecerá como leído"
        });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
    },
    onError: (error, { silent = false }) => {
      console.error('Failed to update read status:', error);
      if (!silent) {
        toast({
          title: "Error",
          description: "No se pudo actualizar el estado de lectura",
          variant: "destructive"
        });
      }
    }
  });

  const favoriteChatMutation = useMutation({
    mutationFn: async ({ chatId, instanceId, favorite }: { chatId: string; instanceId: string; favorite: boolean }) => {
      return apiRequest('PATCH', `/api/whatsapp/conversations/favorite`, { chatId, instanceId, favorite });
    },
    onSuccess: (_, { favorite }) => {
      toast({
        title: favorite ? "Añadido a favoritos" : "Eliminado de favoritos",
        description: favorite ? "El chat está en tu lista de favoritos" : "El chat se eliminó de favoritos"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
    },
    onError: (error) => {
      console.error('Failed to update favorite status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de favorito",
        variant: "destructive"
      });
    }
  });

  const blockChatMutation = useMutation({
    mutationFn: async ({ chatId, instanceId, blocked }: { chatId: string; instanceId: string; blocked: boolean }) => {
      return apiRequest(`/api/whatsapp/conversations/${chatId}/block`, {
        method: 'PATCH',
        body: { instanceId, blocked }
      });
    },
    onSuccess: (_, { blocked }) => {
      toast({
        title: blocked ? "Contacto bloqueado" : "Contacto desbloqueado",
        description: blocked ? "No recibirás mensajes de este contacto" : "Puedes recibir mensajes normalmente"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
    }
  });

  const closeChatMutation = useMutation({
    mutationFn: async ({ chatId, instanceId }: { chatId: string; instanceId: string }) => {
      return apiRequest(`/api/whatsapp/conversations/${chatId}/close`, {
        method: 'PATCH',
        body: { instanceId }
      });
    },
    onSuccess: () => {
      toast({
        title: "Chat cerrado",
        description: "El chat se cerró pero los datos se conservan"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
    }
  });

  const deleteChatMutation = useMutation({
    mutationFn: async ({ chatId, instanceId }: { chatId: string; instanceId: string }) => {
      return apiRequest('DELETE', `/api/whatsapp/conversations/delete`, { chatId, instanceId });
    },
    onSuccess: () => {
      toast({
        title: "Chat eliminado",
        description: "El chat y todos sus mensajes han sido eliminados",
        variant: "destructive"
      });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/conversations/${userId}`] });
    },
    onError: (error) => {
      console.error('Failed to delete chat:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el chat",
        variant: "destructive"
      });
    }
  });

  // Mock user ID - in real app this would come from auth context
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  // Fetch instances with customization data
  const { data: instances = [] } = useQuery({
    queryKey: [`/api/whatsapp/instances/${userId}`],
  });

  // Real-time waiting reply messages state
  const [waitingReplyMessages, setWaitingReplyMessages] = useState<any[]>([]);

  // Fetch initial waiting reply messages to show blue bookmark indicator
  const { data: initialWaitingReplies = [] } = useQuery({
    queryKey: [`/api/whatsapp/waiting-reply/all`, instances.map(i => i.instanceId).sort().join(',')],
    queryFn: async () => {
      if (instances.length === 0) return [];
      try {
        // Get all waiting replies for all instances and add instanceId to each
        const allWaitingReplies = [];
        for (const instance of instances) {
          const response = await fetch(`/api/whatsapp/waiting-reply/${instance.instanceId}`);
          if (response.ok) {
            const data = await response.json();
            // Add instanceId to each waiting reply
            const repliesWithInstance = data.map((reply: any) => ({
              ...reply,
              instanceId: instance.instanceId
            }));
            allWaitingReplies.push(...repliesWithInstance);
          }
        }
        return allWaitingReplies;
      } catch (error) {
        console.error('Error fetching waiting replies:', error);
        return [];
      }
    },
    enabled: instances.length > 0,
    refetchInterval: false, // Disable polling - use SSE for updates
    staleTime: 30000 // Cache for 30 seconds, refresh via SSE
  });

  // Initialize waiting reply messages from query - prevent infinite loops
  useEffect(() => {
    if (initialWaitingReplies.length !== waitingReplyMessages.length) {
      setWaitingReplyMessages(initialWaitingReplies);
    }
  }, [initialWaitingReplies.length, waitingReplyMessages.length]);

  // Set up SSE listener for real-time waiting reply updates
  useEffect(() => {
    const eventSource = new EventSource('/api/events');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'waiting_reply_added') {
          const { messageId, chatId, instanceId } = data.payload;
          setWaitingReplyMessages(prev => [
            ...prev,
            {
              message_id: messageId,
              chat_id: chatId,
              instanceId: instanceId
            }
          ]);
        } else if (data.type === 'waiting_reply_removed') {
          const { messageId } = data.payload;
          setWaitingReplyMessages(prev => 
            prev.filter(msg => msg.message_id !== messageId)
          );
        } else if (data.type === 'draft_updated') {
          const { chatId, instanceId, content, messageId } = data.payload;
          setAllDrafts(prev => {
            const existing = prev.find(d => d.chatId === chatId && d.instanceId === instanceId);
            if (existing) {
              // Update existing draft
              return prev.map(d => 
                d.chatId === chatId && d.instanceId === instanceId 
                  ? { ...d, content, messageId, updatedAt: new Date().toISOString() }
                  : d
              );
            } else {
              // Add new draft
              return [...prev, { chatId, instanceId, content, messageId, updatedAt: new Date().toISOString() }];
            }
          });
        } else if (data.type === 'draft_deleted') {
          const { chatId, instanceId } = data.payload;
          setAllDrafts(prev => 
            prev.filter(d => !(d.chatId === chatId && d.instanceId === instanceId))
          );
        }
      } catch (error) {
        console.error('Error processing waiting reply SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, []);

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

  // Helper function to get display name for conversation
  const getConversationDisplayName = (conv: any) => {
    // Use displayName from API response (already contains contact name or group subject)
    if (conv.displayName && conv.displayName !== conv.chatId) {
      return conv.displayName;
    }
    
    // Fallback to formatted phone number for individuals
    if (conv.chatId && !conv.chatId.includes('@g.us')) {
      const phoneNumber = conv.chatId.replace('@s.whatsapp.net', '');
      return formatPhoneNumber(phoneNumber);
    }
    
    // Fallback for groups without names
    if (conv.chatId && conv.chatId.includes('@g.us')) {
      const groupId = conv.chatId.replace('@g.us', '').split('-')[0];
      return `Group ${formatPhoneNumber(groupId)}`;
    }
    
    return conv.chatId || 'Unknown';
  };

  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/conversations/${userId}`],
    refetchInterval: false, // Disable polling - use SSE for updates
    staleTime: 0, // Always fresh data when invalidated by SSE
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
  });

  // Also fetch contacts for display names - no polling
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: [`/api/contacts/${userId}`],
    refetchInterval: false, // Disable polling completely
    refetchOnWindowFocus: false, // Don't refetch on focus
    staleTime: Infinity, // Keep data fresh - updates come via SSE
  });

  // Use conversations data directly since it already contains message info
  const messages = conversations;

  // Real-time drafts state
  const [allDrafts, setAllDrafts] = useState<any[]>([]);

  // Fetch initial drafts for display in conversation list - stable query key
  const instanceIdsKey = useMemo(() => 
    instances.map(i => i.instanceId).sort().join(','), 
    [instances]
  );

  const { data: initialDrafts = [] } = useQuery({
    queryKey: [`/api/whatsapp/drafts/all/${userId}`, instanceIdsKey],
    queryFn: async () => {
      if (instances.length === 0) return [];
      try {
        const draftsPromises = instances.map(async (instance: any) => {
          const response = await fetch(`/api/whatsapp/drafts/${instance.instanceId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          if (response.ok) {
            return response.json();
          }
          return [];
        });
        const draftsArrays = await Promise.all(draftsPromises);
        return draftsArrays.flat();
      } catch (error) {
        console.error('Error loading all drafts:', error);
        return [];
      }
    },
    enabled: instances.length > 0,
    refetchInterval: false,
    staleTime: 60000
  });

  // Initialize drafts from query - use ref to prevent loops
  const draftsInitialized = useRef(false);
  useEffect(() => {
    if (!draftsInitialized.current && initialDrafts.length > 0) {
      setAllDrafts(initialDrafts);
      draftsInitialized.current = true;
    }
  }, [initialDrafts.length]);

  // Helper function to check if conversation has waiting reply messages
  const hasWaitingReply = (conversation: any) => {
    const hasWaiting = waitingReplyMessages.some((waitingMsg: any) => 
      // Check both camelCase and snake_case field names
      (waitingMsg.chatId === conversation.chatId || waitingMsg.chat_id === conversation.chatId) && 
      (waitingMsg.instanceId === conversation.instanceId || waitingMsg.instance_id === conversation.instanceId)
    );
    return hasWaiting;
  };

  // Helper function to get latest message for a conversation (including drafts)
  const getLatestMessage = (conversation: any) => {
    // Check if there's a draft message for this conversation
    const draftMessage = allDrafts.find((draft: any) => 
      draft.chatId === conversation.chatId && draft.instanceId === conversation.instanceId
    );
    if (draftMessage && draftMessage.content && draftMessage.content.trim()) {
      return {
        content: draftMessage.content,
        fromMe: true,
        messageType: 'draft',
        timestamp: draftMessage.updatedAt || new Date().toISOString(),
        isDraft: true
      };
    }
    
    // Use the lastMessageContent from the conversation data if available
    if (conversation.lastMessageContent !== undefined && conversation.lastMessageContent !== null) {
      return {
        content: conversation.lastMessageContent,
        fromMe: conversation.lastMessageFromMe,
        messageType: conversation.lastMessageType,
        timestamp: conversation.actualLastMessageTime || conversation.lastMessageTimestamp
      };
    }
    
    // Fallback to searching in messages array
    if (!Array.isArray(messages) || messages.length === 0) return null;
    
    return messages
      .filter((msg: any) => msg.chatId === conversation.chatId)
      .sort((a: any, b: any) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime())[0];
  };

  // Note: SSE connection removed - now handled by ChatInterface which propagates updates to conversation list

  const filteredConversations = conversations
    .filter((conv: any) => {
      // Skip status broadcasts
      if (conv.chatId === 'status@broadcast') {
        return false;
      }
      
      // Skip internal CMC conversation IDs that don't have actual messages
      if (conv.chatId && conv.chatId.startsWith('cmc')) {
        return false;
      }
      
      // Only show conversations with actual WhatsApp JIDs (phone numbers or groups)
      if (conv.chatId && !conv.chatId.includes('@')) {
        return false;
      }
      
      // Skip hidden chats (internal archiving)
      const chatKey = `${conv.instanceId}:${conv.chatId}`;
      if (hiddenChats.has(chatKey)) {
        return false;
      }
      
      // Instance filter
      if (selectedInstance !== 'all' && conv.instanceId !== selectedInstance) {
        return false;
      }
      
      // Filter by type (All, Unread, Favorites, Groups)
      if (activeFilter === 'unread' && (!conv.unreadCount || conv.unreadCount === 0)) {
        return false;
      }
      if (activeFilter === 'favorites' && !conv.favorite) {
        return false;
      }
      if (activeFilter === 'groups' && !conv.chatId?.includes('@g.us')) {
        return false;
      }
      
      // Apply search filter if there's a search query
      if (searchQuery.trim() === '') {
        return true; // Show all conversations when no search
      }
      
      // Search by chat ID (phone number for individuals) or group name
      const searchTerm = searchQuery.toLowerCase();
      const chatId = conv.chatId?.toLowerCase() || '';
      const displayName = getConversationDisplayName(conv).toLowerCase();
      
      return chatId.includes(searchTerm) || displayName.includes(searchTerm);
    })
    .sort((a: any, b: any) => {
      // Get latest messages (including drafts)
      const aLatestMessage = getLatestMessage(a);
      const bLatestMessage = getLatestMessage(b);
      
      // Prioritize conversations with drafts at the top
      const aHasDraft = aLatestMessage?.isDraft || false;
      const bHasDraft = bLatestMessage?.isDraft || false;
      
      if (aHasDraft && !bHasDraft) return -1;
      if (!aHasDraft && bHasDraft) return 1;
      
      // Sort by most recent message timestamp (newest first)
      const aTime = aLatestMessage?.timestamp || a.lastMessageAt || a.updatedAt || 0;
      const bTime = bLatestMessage?.timestamp || b.lastMessageAt || b.updatedAt || 0;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

  if (isLoading) {
    return (
      <div className="w-80 whatsapp-sidebar">
        <div className="p-3 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search conversations..."
              className="pl-10"
              value=""
              disabled
            />
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="text-center text-gray-500 dark:text-gray-400">
            Loading conversations...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 whatsapp-sidebar flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search or start a new chat"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Filter Tabs */}
        <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as any)}>
          <TabsList className="grid w-full grid-cols-4 h-9 mb-2 bg-gray-50 dark:bg-gray-800">
            <TabsTrigger value="all" className="text-xs px-2 data-[state=active]:bg-green-100 data-[state=active]:text-green-800 dark:data-[state=active]:bg-green-900 dark:data-[state=active]:text-green-200">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs px-2 data-[state=active]:bg-green-100 data-[state=active]:text-green-800 dark:data-[state=active]:bg-green-900 dark:data-[state=active]:text-green-200">
              Unread
              {(() => {
                const unreadCount = conversations.filter((conv: any) => 
                  conv.unreadCount && conv.unreadCount > 0 && 
                  (selectedInstance === 'all' || conv.instanceId === selectedInstance) &&
                  !hiddenChats.has(`${conv.instanceId}:${conv.chatId}`) // Exclude archived/hidden chats
                ).length;
                return unreadCount > 0 ? (
                  <Badge variant="secondary" className="ml-1 h-4 text-xs bg-green-500 text-white">
                    {unreadCount}
                  </Badge>
                ) : null;
              })()}
            </TabsTrigger>
            <TabsTrigger value="favorites" className="text-xs px-2 data-[state=active]:bg-green-100 data-[state=active]:text-green-800 dark:data-[state=active]:bg-green-900 dark:data-[state=active]:text-green-200">
              Favorites
            </TabsTrigger>
            <TabsTrigger value="groups" className="text-xs px-2 data-[state=active]:bg-green-100 data-[state=active]:text-green-800 dark:data-[state=active]:bg-green-900 dark:data-[state=active]:text-green-200">
              Groups
              {(() => {
                const groupCount = conversations.filter((conv: any) => 
                  conv.chatId?.includes('@g.us') && 
                  (selectedInstance === 'all' || conv.instanceId === selectedInstance) &&
                  !hiddenChats.has(`${conv.instanceId}:${conv.chatId}`) // Exclude archived/hidden chats
                ).length;
                return groupCount > 0 ? (
                  <Badge variant="secondary" className="ml-1 h-4 text-xs">
                    {groupCount}
                  </Badge>
                ) : null;
              })()}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Instance Filter */}
        <Select value={selectedInstance} onValueChange={setSelectedInstance}>
          <SelectTrigger className="w-full h-8">
            <SelectValue placeholder="All Instances">
              {selectedInstance === 'all' ? (
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>All Instances</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getInstanceEmoji(selectedInstance)}</span>
                  <span>{getInstanceDisplayName(selectedInstance)}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                {selectedInstance === 'all' && <Check className="h-4 w-4 text-green-600" />}
                <span>All Instances</span>
              </div>
            </SelectItem>
            {instances.map((instance: any) => (
              <SelectItem key={instance.instanceId} value={instance.instanceId}>
                <div className="flex items-center gap-2">
                  {selectedInstance === instance.instanceId && <Check className="h-4 w-4 text-green-600" />}
                  <span className="text-lg">{getInstanceEmoji(instance.instanceId)}</span>
                  <span>{getInstanceDisplayName(instance.instanceId)}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Archived Section */}
      {hiddenChats.size > 0 && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-2 py-1">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Archived</span>
            </div>
            <Badge variant="secondary" className="h-5 text-xs">
              {hiddenChats.size}
            </Badge>
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-120px)] scroll-smooth scrollbar-thin conversations-scroll">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {conversations.length === 0 ? "No conversations yet" : "No conversations match your search"}
          </div>
        ) : (
          filteredConversations.map((conversation: any) => {
            const conversationKey = `${conversation.instanceId}:${conversation.chatId}`;
            const isSelected = selectedConversation === conversationKey;
            
            return (
              <div
                key={`${conversation.instanceId}-${conversation.chatId}`}
                className={`whatsapp-conversation-item ${
                  isSelected ? 'active' : ''
                } relative group`}
                onClick={async () => {
                  onSelectConversation(conversationKey);
                  // Auto-mark as read if conversation has unread messages
                  if (conversation.unreadCount > 0) {
                    try {
                      markUnreadMutation.mutate({
                        chatId: conversation.chatId,
                        instanceId: conversation.instanceId,
                        unread: false
                      });
                    } catch (error) {
                      console.error('Failed to mark conversation as read:', error);
                    }
                  }
                }}
              onMouseEnter={() => setHoveredConversation(conversationKey)}
              onMouseLeave={() => setHoveredConversation(null)}
            >
              <div className="flex items-start space-x-3">
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={conversation.contact?.profilePictureUrl} />
                    <AvatarFallback>
                      {conversation.type === 'group' ? (
                        <Users className="h-6 w-6" />
                      ) : (
                        conversation.title?.charAt(0) || 'U'
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {/* Unread message indicator - small green dot */}
                  {conversation.unreadCount > 0 && !hiddenChats.has(`${conversation.instanceId}:${conversation.chatId}`) && (
                    <div className="absolute -top-1 -left-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                  )}
                  
                  {/* Instance indicator circle */}
                  {conversation.instanceId && (() => {
                    const indicator = getInstanceIndicator(conversation.instanceId);
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
                        title={`Instance: ${conversation.instanceId}`}
                      >
                        {indicator.letter}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-semibold truncate pr-2 ${conversation.unreadCount > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-900 dark:text-gray-100'}`}>
                      {getConversationDisplayName(conversation)}
                    </h3>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs ${conversation.unreadCount > 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        {(() => {
                          const latestMessage = getLatestMessage(conversation);
                          const timestamp = latestMessage?.timestamp || conversation.actualLastMessageTime || conversation.lastMessageTimestamp;
                          return timestamp ? formatConversationTimestamp(timestamp) : '';
                        })()}
                      </span>
                      <div className="mt-1 flex items-center gap-1">
                        {conversation.unreadCount > 0 && !hiddenChats.has(`${conversation.instanceId}:${conversation.chatId}`) && (
                          <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-0.5 min-w-[20px] h-5 rounded-full flex items-center justify-center">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                        {/* Blue corner indicator for conversations with waiting responses */}
                        {hasWaitingReply(conversation) && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" title="Has waiting response messages"></div>
                        )}
                        {/* Dropdown arrow that appears on hover or when open */}
                        {(hoveredConversation === conversationKey || openDropdown === conversationKey) && (
                          <DropdownMenu 
                            open={openDropdown === conversationKey}
                            onOpenChange={(open) => {
                              if (open) {
                                setOpenDropdown(conversationKey);
                              } else {
                                setOpenDropdown(null);
                              }
                            }}
                          >
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 rounded-full bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setOpenDropdown(conversationKey);
                              }}
                            >
                              <ChevronDown className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="end" 
                            className="w-52"
                            onCloseAutoFocus={(e) => e.preventDefault()}
                          >
                            <DropdownMenuItem 
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                archiveChatMutation.mutate({
                                  chatId: conversation.chatId,
                                  instanceId: conversation.instanceId,
                                  archived: true
                                });
                                setOpenDropdown(null);
                              }}
                            >
                              <Archive className="h-4 w-4" />
                              Archivar chat
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                muteChatMutation.mutate({
                                  chatId: conversation.chatId,
                                  instanceId: conversation.instanceId,
                                  muted: true
                                });
                                setOpenDropdown(null);
                              }}
                            >
                              <BellOff className="h-4 w-4" />
                              Silenciar notificaciones
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                pinChatMutation.mutate({
                                  chatId: conversation.chatId,
                                  instanceId: conversation.instanceId,
                                  pinned: true
                                });
                                setOpenDropdown(null);
                              }}
                            >
                              <Pin className="h-4 w-4" />
                              Fijar chat
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                markUnreadMutation.mutate({
                                  chatId: conversation.chatId,
                                  instanceId: conversation.instanceId,
                                  unread: true
                                });
                                setOpenDropdown(null);
                              }}
                            >
                              <CheckCheck className="h-4 w-4" />
                              Marcar como no leído
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                favoriteChatMutation.mutate({
                                  chatId: conversation.chatId,
                                  instanceId: conversation.instanceId,
                                  favorite: true
                                });
                                setOpenDropdown(null);
                              }}
                            >
                              <Heart className="h-4 w-4" />
                              Añadir a Favoritos
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                blockChatMutation.mutate({
                                  chatId: conversation.chatId,
                                  instanceId: conversation.instanceId,
                                  blocked: true
                                });
                                setOpenDropdown(null);
                              }}
                            >
                              <Ban className="h-4 w-4" />
                              Bloquear
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleChatVisibility(conversation.chatId, conversation.instanceId);
                              }}
                            >
                              <EyeOff className="h-4 w-4" />
                              No mostrar chat
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                closeChatMutation.mutate({
                                  chatId: conversation.chatId,
                                  instanceId: conversation.instanceId
                                });
                                setOpenDropdown(null);
                              }}
                            >
                              <X className="h-4 w-4" />
                              Cerrar chat
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChatMutation.mutate({
                                  chatId: conversation.chatId,
                                  instanceId: conversation.instanceId
                                });
                                setOpenDropdown(null);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar chat
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1 pr-16">
                    {(() => {
                      const latestMessage = getLatestMessage(conversation);
                      if (latestMessage && latestMessage.content) {
                        return (
                          <>
                            {latestMessage.isDraft ? (
                              <span className="text-gray-600 dark:text-gray-300">
                                <span className="font-bold">Draft: </span>{latestMessage.content}
                              </span>
                            ) : (
                              <>
                                {latestMessage.fromMe && (
                                  <span className="text-gray-500">You: </span>
                                )}
                                {latestMessage.messageType === 'image' ? '📷 Photo' :
                                 latestMessage.messageType === 'audio' ? '🎵 Audio' :
                                 latestMessage.messageType === 'video' ? '🎥 Video' :
                                 latestMessage.messageType === 'document' ? '📄 Document' :
                                 latestMessage.content}
                              </>
                            )}
                          </>
                        );
                      }
                      return conversation.lastMessageTimestamp ? 'Tap to view messages' : 'No messages yet';
                    })()}
                  </p>
                  <div className="flex items-center mt-2">
                    {conversation.latestMessage?.fromMe && (
                      <CheckCheck className="h-3 w-3 text-blue-500 mr-1" />
                    )}
                    {conversation.isPinned && (
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
