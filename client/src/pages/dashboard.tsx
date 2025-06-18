import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import ConversationList from "@/components/conversations/conversation-list";
import ChatInterface from "@/components/conversations/chat-interface";
import TaskModule from "@/components/tasks/task-module";
import ContactModule from "@/components/contacts/contact-module";
import CalendarModule from "@/components/calendar/calendar-module";
import IntegrationModule from "@/components/integrations/integration-module";
import { ActionsDashboard } from "@/components/actions/actions-dashboard";

export default function Dashboard() {
  const [activeModule, setActiveModule] = useState("conversations");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const renderModule = () => {
    switch (activeModule) {
      case "conversations":
        return (
          <div className="flex-1 flex">
            <ConversationList
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
            />
            <ChatInterface conversationId={selectedConversation} />
          </div>
        );
      case "tasks":
        return <TaskModule />;
      case "contacts":
        return <ContactModule />;
      case "calendar":
        return <CalendarModule />;
      case "actions":
        return <ActionsDashboard />;
      case "integrations":
        return <IntegrationModule />;
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
