import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import ConversationList from "@/components/conversations/conversation-list";
import ChatInterface from "@/components/conversations/chat-interface";
import { TasksPage } from "@/pages/TasksPage";
import FinancePage from "@/pages/FinancePage";
import ContactModule from "@/components/contacts/contact-module";
import ContactsPage from "@/pages/ContactsPage";
import CalendarModule from "@/components/calendar/calendar-module";
import IntegrationModule from "@/components/integrations/integration-module";
import { ActionsDashboard } from "@/components/actions/actions-dashboard";
import SimpleDBViewer from "@/pages/SimpleDBViewer";
import { SpacesPage } from "@/components/spaces/SpacesPage";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [activeModule, setActiveModule] = useState("conversations");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Central data fetching for conversations module - eliminates duplicate polling
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";
  
  // Fetch conversations once at dashboard level
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/conversations/${userId}`],
    refetchInterval: false, // No polling - updates via SSE from ChatInterface
    refetchOnWindowFocus: false,
    staleTime: 0, // Fresh when invalidated by SSE
  });
  
  // Fetch contacts once at dashboard level
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<any[]>({
    queryKey: [`/api/contacts/${userId}`],
    refetchInterval: false, // No polling - updates via SSE from ChatInterface
    refetchOnWindowFocus: false,
    staleTime: 300000, // 5 minutes - contacts change less frequently
  });
  
  // Fetch instances once at dashboard level
  const { data: instances = [], isLoading: instancesLoading } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/instances/${userId}`],
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 600000, // 10 minutes - instances rarely change
  });

  useEffect(() => {
    if (!selectedConversation && conversations.length > 0) {
      // Find the first conversation with messages and use proper instanceId:chatId format
      const firstConversation = conversations.find(conv => conv.lastMessageTimestamp);
      if (firstConversation) {
        setSelectedConversation(`${firstConversation.instanceId}:${firstConversation.chatId}`);
      }
    }
  }, [conversations, selectedConversation]);

  // Listen for space selection events
  useEffect(() => {
    const handleSpaceSelection = (event: CustomEvent) => {
      // Handle both individual space selection and "back to all spaces"
      if (event.detail && event.detail.spaceId === null) {
        setSelectedSpaceId(null); // Back to all spaces
      } else if (event.detail && event.detail.spaceId) {
        setSelectedSpaceId(event.detail.spaceId);
      }
    };

    window.addEventListener('spaceSelected', handleSpaceSelection as EventListener);
    return () => {
      window.removeEventListener('spaceSelected', handleSpaceSelection as EventListener);
    };
  }, []);

  const renderModule = () => {
    switch (activeModule) {
      case "conversations":
        return (
          <div className="flex-1 flex h-full">
            <ConversationList
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
              conversations={conversations}
              contacts={contacts}
              instances={instances}
              isLoading={conversationsLoading || contactsLoading || instancesLoading}
              userId={userId}
            />
            <ChatInterface 
              conversationId={selectedConversation}
              conversations={conversations}
              contacts={contacts}
              instances={instances}
              userId={userId}
            />
          </div>
        );
      case "tasks":
        return <TasksPage />;
      case "finance":
        return <FinancePage />;
      case "contacts":
        return <ContactsPage userId={userId} />;
      case "calendar":
        return <CalendarModule />;
      case "actions":
        return <ActionsDashboard />;
      case "integrations":
        return <IntegrationModule />;
      case "spaces":
        return <SpacesPage selectedSpaceId={selectedSpaceId || undefined} />;
      case "database":
        return <SimpleDBViewer />;
      default:
        return (
          <div className="flex-1 flex">
            <ConversationList
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
            />
            <ChatInterface conversationId={selectedConversation} />
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      <Sidebar activeModule={activeModule} onSetActiveModule={setActiveModule} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderModule()}
      </div>
    </div>
  );
}
