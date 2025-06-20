import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const [conversationsWithMessages, setConversationsWithMessages] = useState<any[]>([]);

  // Mock user ID - in real app this would come from auth context
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/conversations/${userId}`],
  });

  // Fetch latest message for each conversation
  useEffect(() => {
    const fetchLatestMessages = async () => {
      if (conversations.length === 0) return;

      const conversationsWithLatestMessages = await Promise.all(
        conversations.map(async (conversation: any) => {
          try {
            const response = await fetch(`/api/whatsapp/messages/${conversation.chatId || conversation.id}?limit=1`);
            if (response.ok) {
              const messages = await response.json();
              const latestMessage = messages[0];
              return {
                ...conversation,
                latestMessage: latestMessage ? {
                  content: latestMessage.textContent || latestMessage.content,
                  createdAt: latestMessage.createdAt,
                  fromMe: latestMessage.fromMe,
                  messageType: latestMessage.messageType
                } : null
              };
            }
          } catch (error) {
            console.error('Error fetching messages for conversation:', conversation.chatId || conversation.id, error);
          }
          return conversation;
        })
      );

      setConversationsWithMessages(conversationsWithLatestMessages);
    };

    fetchLatestMessages();
  }, [conversations]);

  const filteredConversations = conversationsWithMessages.filter((conv: any) =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.latestMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {conversationsWithMessages.length === 0 ? "No conversations yet" : "No conversations match your search"}
          </div>
        ) : (
          filteredConversations.map((conversation: any) => (
            <div
              key={conversation.chatId || conversation.id}
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
                      {conversation.title ? 
                        (conversation.title.includes('@') ? formatPhoneNumber(conversation.title) : conversation.title) : 
                        'Unknown Contact'}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {conversation.latestMessage?.createdAt ? new Date(conversation.latestMessage.createdAt).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      }) : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1">
                    {conversation.latestMessage ? (
                      <span className="flex items-center">
                        {conversation.latestMessage.fromMe && (
                          <span className="mr-1 text-gray-500">You: </span>
                        )}
                        {conversation.latestMessage.messageType === 'image' ? '📷 Photo' :
                         conversation.latestMessage.messageType === 'audio' ? '🎵 Audio' :
                         conversation.latestMessage.messageType === 'video' ? '🎥 Video' :
                         conversation.latestMessage.messageType === 'document' ? '📄 Document' :
                         conversation.latestMessage.content || 'Message'}
                      </span>
                    ) : 'No messages yet'}
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
