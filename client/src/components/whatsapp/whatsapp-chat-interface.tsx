import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WhatsAppMessageBubble, WhatsAppStatusIndicator } from './whatsapp-status-indicator';
import { MessageStatusTracker } from './message-status-tracker';
import { Send, Phone, Video, MoreVertical, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  messageId: string;
  instanceId: string;
  chatId: string;
  content: string;
  timestamp: string;
  fromMe: boolean;
  messageType: string;
  senderJid: string;
}

interface Chat {
  chatId: string;
  chatName: string;
  lastMessage: string;
  lastMessageTimestamp: string;
  unreadCount: number;
  chatType: 'individual' | 'group';
}

interface WhatsAppChatInterfaceProps {
  instanceId: string;
  userId: string;
}

export function WhatsAppChatInterface({ instanceId, userId }: WhatsAppChatInterfaceProps) {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ['whatsapp-chats', instanceId],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp/conversations/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch chats');
      const data = await response.json();
      return data as Chat[];
    },
    refetchInterval: 30000,
  });

  // Fetch messages for selected chat
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['whatsapp-messages', selectedChat],
    queryFn: async () => {
      if (!selectedChat) return [];
      const response = await fetch(`/api/whatsapp/messages/${selectedChat}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      return data as Message[];
    },
    enabled: !!selectedChat,
    refetchInterval: 10000, // More frequent updates for real-time messaging
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedChat) throw new Error('No chat selected');
      
      const response = await fetch(`/api/whatsapp/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId,
          chatId: selectedChat,
          message: text,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedChat] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', instanceId] });
    },
  });

  const selectedChatData = chats?.find(chat => chat.chatId === selectedChat);

  const handleSendMessage = () => {
    if (messageText.trim() && !sendMessage.isPending) {
      sendMessage.mutate(messageText.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[600px] border rounded-lg overflow-hidden">
      {/* Chat List */}
      <div className={`${selectedChat ? 'hidden md:block' : 'block'} w-full md:w-1/3 border-r bg-background`}>
        <div className="p-4 border-b">
          <h3 className="font-semibold">WhatsApp Chats</h3>
          <p className="text-sm text-muted-foreground">Instance: {instanceId}</p>
        </div>
        
        <ScrollArea className="h-[500px]">
          {chatsLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading chats...
            </div>
          ) : chats?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No conversations found
            </div>
          ) : (
            <div className="space-y-1">
              {chats?.map((chat) => (
                <button
                  key={chat.chatId}
                  onClick={() => setSelectedChat(chat.chatId)}
                  className={`w-full p-3 text-left hover:bg-accent transition-colors ${
                    selectedChat === chat.chatId ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">
                          {chat.chatName || chat.chatId}
                        </h4>
                        {chat.chatType === 'group' && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">
                            Group
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {chat.lastMessage || 'No messages'}
                      </p>
                      {chat.lastMessageTimestamp && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(chat.lastMessageTimestamp), 'MMM dd, HH:mm')}
                        </p>
                      )}
                    </div>
                    {chat.unreadCount > 0 && (
                      <div className="bg-green-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                        {chat.unreadCount}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Interface */}
      <div className={`${selectedChat ? 'block' : 'hidden md:block'} flex-1 flex flex-col`}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between bg-background">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChat(null)}
                  className="md:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h3 className="font-semibold">
                    {selectedChatData?.chatName || selectedChat}
                  </h3>
                  {selectedChatData?.chatType === 'group' && (
                    <p className="text-sm text-muted-foreground">Group chat</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Video className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-gray-50 dark:bg-gray-900">
              {messagesLoading ? (
                <div className="text-center text-muted-foreground">
                  Loading messages...
                </div>
              ) : messages?.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No messages in this chat
                </div>
              ) : (
                <div className="space-y-4">
                  {messages?.map((message) => (
                    <div
                      key={message.messageId}
                      className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[80%] space-y-1">
                        <WhatsAppMessageBubble
                          content={message.content}
                          timestamp={message.timestamp}
                          fromMe={message.fromMe}
                          messageType={message.messageType}
                          senderName={message.senderJid}
                          isGroupMessage={selectedChatData?.chatType === 'group'}
                        />
                        
                        {/* Real-time status tracking for sent messages */}
                        {message.fromMe && (
                          <div className="flex justify-end">
                            <MessageStatusTracker
                              messageId={message.messageId}
                              instanceId={message.instanceId}
                              initialStatus="sent"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-background">
              <div className="flex items-center gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  disabled={sendMessage.isPending}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sendMessage.isPending}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {sendMessage.isError && (
                <p className="text-sm text-red-500 mt-2">
                  Failed to send message. Please try again.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">Select a chat</h3>
              <p>Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}