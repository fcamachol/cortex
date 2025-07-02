import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings } from "lucide-react";
import { SiWhatsapp, SiGoogle, SiSlack, SiTrello, SiNotion } from "react-icons/si";
import { WhatsAppInstanceManager } from "./whatsapp-manager";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";


export default function IntegrationModule() {
  const [showWhatsAppManager, setShowWhatsAppManager] = useState(false);
  const { toast } = useToast();

  // Fetch real calendar providers from backend
  const { data: calendarProviders = [], isLoading: providersLoading } = useQuery({
    queryKey: ['/api/calendar/providers'],
    enabled: true
  });

  // Google Calendar connection mutation
  const connectGoogleCalendarMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/auth/google/calendar', 'GET');
    },
    onSuccess: (data: any) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to connect Google Calendar",
        description: error.message || "Could not initiate Google Calendar connection.",
        variant: "destructive"
      });
    }
  });

  // No longer needed - using real data directly in buildIntegrationsFromRealData()

  // Always show core integrations: WhatsApp (connected) and Google Calendar (connected/disconnected based on real data)
  const buildCoreIntegrations = () => {
    const integrations = [
      {
        id: "whatsapp",
        name: "WhatsApp",
        description: "Evolution API",
        icon: SiWhatsapp,
        status: "connected",
        color: "bg-green-500",
        details: {
          instanceName: "personal_phone",
          additionalInfo: "Real-time WhatsApp messaging integration for seamless communication."
        }
      }
    ];

    // Always show Google Calendar as a core integration
    const googleProvider = calendarProviders.find((p: any) => p.provider_type === 'google');
    integrations.push({
      id: "google-calendar",
      name: "Google Calendar",
      description: "Calendar Sync",
      icon: SiGoogle,
      status: googleProvider ? "connected" : "disconnected",
      color: "bg-blue-500",
      details: {
        instanceName: googleProvider?.account_name || "Not connected", 
        additionalInfo: googleProvider 
          ? `Sync status: ${googleProvider.sync_status}. Last sync: ${googleProvider.last_sync_at ? new Date(googleProvider.last_sync_at).toLocaleDateString() : 'Never'}`
          : "Connect your Google Calendar to sync events and create meetings directly from conversations."
      } as any
    });

    return integrations;
  };

  const connectedIntegrations = buildCoreIntegrations();

  const availableIntegrations = [
    {
      id: "slack",
      name: "Slack",
      description: "Team communication",
      icon: SiSlack
    },
    {
      id: "trello",
      name: "Trello",
      description: "Project management",
      icon: SiTrello
    },
    {
      id: "notion",
      name: "Notion",
      description: "Knowledge management",
      icon: SiNotion
    },
    {
      id: "microsoft-teams",
      name: "Microsoft Teams",
      description: "Video conferencing",
      icon: null
    }
  ];

  const handleConnect = (integrationId: string) => {
    if (integrationId === "whatsapp") {
      setShowWhatsAppManager(true);
    } else if (integrationId === "google-calendar") {
      connectGoogleCalendarMutation.mutate();
    } else {
      console.log(`Connecting to ${integrationId}`);
      // This would handle the OAuth flow or connection process
    }
  };

  const handleConfigure = (integrationId: string) => {
    if (integrationId === "whatsapp") {
      setShowWhatsAppManager(true);
    } else if (integrationId === "google-calendar") {
      // Open Google Calendar sync configuration
      toast({
        title: "Google Calendar Configuration",
        description: "Calendar sync settings will be available soon. Events are automatically synced.",
      });
    } else {
      console.log(`Configuring ${integrationId}`);
      // This would open configuration modal or redirect to settings
    }
  };



  if (showWhatsAppManager) {
    return (
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center mb-6">
            <Button 
              variant="outline" 
              onClick={() => setShowWhatsAppManager(false)}
            >
              ← Back to Integrations
            </Button>
          </div>
          <WhatsAppInstanceManager />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Integrations</h1>
          <Button className="bg-green-500 hover:bg-green-600 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Browse Integrations
          </Button>
        </div>

        {/* Integration Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {connectedIntegrations.map((integration) => {
            const IconComponent = integration.icon;
            const isConnected = integration.status === "connected";

            return (
              <div key={integration.id} className="integration-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 ${integration.color} rounded-lg flex items-center justify-center`}>
                      {IconComponent ? (
                        <IconComponent className="text-white text-xl" />
                      ) : (
                        <div className="text-white font-bold">⚡</div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {integration.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <span className={`text-sm font-medium ${
                      isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {isConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {integration.details.additionalInfo}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {integration.id === 'whatsapp' && 'Instance:'}
                      {integration.id === 'google-calendar' && 'Account:'}
                      {integration.id === 'zapier' && 'Enable powerful automations'}
                    </span>
                    {(integration.details as any).instanceName && (
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(integration.details as any).instanceName}
                      </span>
                    )}
                    {(integration.details as any).email && (
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(integration.details as any).email}
                      </span>
                    )}
                  </div>
                  {isConnected ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleConfigure(integration.id)}
                    >
                      Configure
                    </Button>
                  ) : (
                    <Button 
                      size="sm"
                      className={integration.color}
                      onClick={() => handleConnect(integration.id)}
                      disabled={integration.id === 'google-calendar' && connectGoogleCalendarMutation.isPending}
                    >
                      {integration.id === 'google-calendar' && connectGoogleCalendarMutation.isPending ? 'Connecting...' : 'Connect'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Available Integrations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Available Integrations</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Expand your workflow with these powerful integrations
            </p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableIntegrations.map((integration) => {
                const IconComponent = integration.icon;
                
                return (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                        {IconComponent ? (
                          <IconComponent className="text-gray-600 dark:text-gray-300" />
                        ) : (
                          <div className="text-gray-600 dark:text-gray-300 font-bold">?</div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {integration.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {integration.description}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleConnect(integration.id)}
                    >
                      Connect
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
