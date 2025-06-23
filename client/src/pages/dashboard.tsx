import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import ConversationList from "@/components/conversations/conversation-list";
import ChatInterface from "@/components/conversations/chat-interface";
import { TasksPage } from "@/pages/TasksPage";
import ContactModule from "@/components/contacts/contact-module";
import CalendarModule from "@/components/calendar/calendar-module";
import IntegrationModule from "@/components/integrations/integration-module";
import { ActionsDashboard } from "@/components/actions/actions-dashboard";
import SimpleDBViewer from "@/pages/SimpleDBViewer";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const [activeModule, setActiveModule] = useState("conversations");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<{[chatId: string]: string}>({});

  // Auto-select the first conversation with messages when none is selected
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";
  const { data: conversations = [] } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/conversations/${userId}`],
  });

  useEffect(() => {
    if (!selectedConversation && conversations.length > 0) {
      // Set to a specific conversation that has messages
      setSelectedConversation("5214422501780@s.whatsapp.net");
    }
  }, [conversations, selectedConversation]);

  const renderModule = () => {
    switch (activeModule) {
      case "conversations":
        return (
          <div className="flex-1 flex">
            <ConversationList
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
              drafts={drafts}
            />
            <ChatInterface 
              conversationId={selectedConversation} 
              drafts={drafts}
              onDraftsChange={setDrafts}
            />
          </div>
        );
      case "tasks":
        return <TasksPage />;
      case "contacts":
        return <ContactModule />;
      case "calendar":
        return <CalendarModule />;
      case "actions":
        return <ActionsDashboard />;
      case "integrations":
        return <IntegrationModule />;
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
