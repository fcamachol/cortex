import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Check, CheckCheck, Users } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phoneUtils";

interface ConversationListProps {
  selectedConversation: string | null;
  onSelectConversation: (conversationId: string) => void;
}

export default function ConversationList({ selectedConversation, onSelectConversation }: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Mock user ID - in real app this would come from auth context
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  // Helper function to get display name for conversation
  const getConversationDisplayName = (conv: any) => {
    // Use chat ID as the primary identifier
    if (conv.chatId.includes('@g.us')) {
      // For groups, try to find the group name in contacts
      const contact = contacts.find((c: any) => c.jid === conv.chatId);
      if (contact && (contact.pushName || contact.verifiedName)) {
        return contact.pushName || contact.verifiedName;
      }
      // Fallback to group identifier if no name found
      const groupId = conv.chatId.replace('@g.us', '').split('-')[0];
      return `Group ${formatPhoneNumber(groupId)}`;
    } else {
      // For individuals, return formatted phone number from chat ID
      const phoneNumber = conv.chatId.replace('@s.whatsapp.net', '');
      return formatPhoneNumber(phoneNumber);
    }
  };

  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/conversations/${userId}`],
    refetchInterval: false, // Disable polling - use SSE for updates
    staleTime: 300000, // Cache for 5 minutes
  });

  // Also fetch contacts for display names
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: [`/api/contacts/${userId}`],
    refetchInterval: false, // Disable polling
    staleTime: 600000, // Cache for 10 minutes - contacts change rarely
  });

  // Fetch recent messages to show latest message per conversation
  const { data: messagesResponse = [] } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/conversations/${userId}`],
    queryFn: () => fetch(`/api/whatsapp/conversations/${userId}`).then(res => res.json()),
    refetchInterval: false, // Disable polling - use SSE for updates
    staleTime: 300000, // Cache for 5 minutes
  });

  // Ensure messages is always an array
  const messages = Array.isArray(messagesResponse) ? messagesResponse : [];

  // Helper function to get latest message for a conversation
  const getLatestMessage = (chatId: string) => {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    
    return messages
      .filter((msg: any) => msg.chatId === chatId)
      .sort((a: any, b: any) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime())[0];
  };

  // Set up SSE connection for real-time conversation updates
  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message' || data.type === 'new_reaction') {
          // Invalidate conversations to refresh latest message previews
          queryClient.invalidateQueries({
            queryKey: [`/api/whatsapp/conversations/${userId}`]
          });
        }
      } catch (error) {
        console.error('Error processing SSE event:', error);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient, userId]);

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
      // Sort by most recent message timestamp (newest first)
      const aTime = a.latestMessage?.timestamp || a.lastMessageAt || a.updatedAt || 0;
      const bTime = b.latestMessage?.timestamp || b.lastMessageAt || b.updatedAt || 0;
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search conversations..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-120px)] scroll-smooth scrollbar-thin conversations-scroll">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {conversations.length === 0 ? "No conversations yet" : "No conversations match your search"}
          </div>
        ) : (
          filteredConversations.map((conversation: any) => (
            <div
              key={`${conversation.instanceId}-${conversation.chatId}`}
              className={`whatsapp-conversation-item ${
                selectedConversation === (conversation.chatId || conversation.id) ? 'active' : ''
              }`}
              onClick={() => onSelectConversation(conversation.chatId || conversation.id)}
            >
              <div className="flex items-start space-x-3">
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {getConversationDisplayName(conversation)}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {(() => {
                        const latestMessage = getLatestMessage(conversation.chatId);
                        const timestamp = latestMessage?.timestamp || latestMessage?.createdAt || conversation.lastMessageTimestamp;
                        return timestamp ? new Date(timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : '';
                      })()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1">
                    {(() => {
                      const latestMessage = getLatestMessage(conversation.chatId);
                      if (latestMessage) {
                        return (
                          <span className="flex items-center">
                            {latestMessage.fromMe && (
                              <span className="mr-1 text-gray-500">You: </span>
                            )}
                            {latestMessage.messageType === 'image' ? '📷 Photo' :
                             latestMessage.messageType === 'audio' ? '🎵 Audio' :
                             latestMessage.messageType === 'video' ? '🎥 Video' :
                             latestMessage.messageType === 'document' ? '📄 Document' :
                             latestMessage.content || 'Message'}
                          </span>
                        );
                      }
                      return conversation.lastMessageTimestamp ? 'Tap to view messages' : 'No messages yet';
                    })()}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                      {conversation.latestMessage?.fromMe && (
                        <CheckCheck className="h-3 w-3 text-blue-500" />
                      )}
                      {conversation.isPinned && (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      )}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <Badge className="bg-green-500 text-white text-xs px-2 py-0.5">
                        {conversation.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
