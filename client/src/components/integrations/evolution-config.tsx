import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings, CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react";

interface EvolutionSettings {
  baseUrl: string;
  enabled: boolean;
  configured: boolean;
}

interface EvolutionConfigProps {
  onConfigured?: () => void;
}

export function EvolutionConfig({ onConfigured }: EvolutionConfigProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<EvolutionSettings>({
    queryKey: ["/api/evolution/settings"],
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/evolution/health"],
    enabled: settings?.configured || false,
    refetchInterval: 30000, // Check health every 30 seconds
  });

  const updateSettings = useMutation({
    mutationFn: async (data: { baseUrl: string; apiKey: string; enabled: boolean }) => {
      return apiRequest("POST", "/api/evolution/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evolution/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/evolution/health"] });
      toast({
        title: "Settings Updated",
        description: "Evolution API settings have been configured successfully.",
      });
      onConfigured?.();
    },
    onError: (error: any) => {
      toast({
        title: "Configuration Error",
        description: error.message || "Failed to update Evolution API settings.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (settings) {
      setBaseUrl(settings.baseUrl || "");
      setEnabled(settings.enabled);
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!baseUrl.trim() || !apiKey.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide both Base URL and API Key.",
        variant: "destructive",
      });
      return;
    }

    updateSettings.mutate({
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      enabled
    });
  };

  const getHealthStatus = () => {
    if (healthLoading) {
      return (
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Checking...</span>
        </div>
      );
    }

    if (health?.status === "healthy") {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      );
    }

    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
        <AlertCircle className="w-3 h-3 mr-1" />
        Disconnected
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading Evolution API settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <CardTitle>Evolution API Configuration</CardTitle>
            </div>
            {settings?.configured && getHealthStatus()}
          </div>
          <CardDescription>
            Configure your Evolution API connection to enable WhatsApp functionality. 
            You'll need an Evolution API server URL and API key.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Evolution API Base URL</Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://your-evolution-api.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The base URL of your Evolution API server (without trailing slash)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Your Evolution API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your Evolution API authentication key
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="enabled">Enable Evolution API integration</Label>
            </div>

            <Button 
              type="submit" 
              disabled={updateSettings.isPending}
              className="w-full"
            >
              {updateSettings.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {settings?.configured && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">API Status:</span>
              {getHealthStatus()}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Base URL:</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-mono">{settings.baseUrl}</span>
                <Button variant="ghost" size="sm" asChild>
                  <a href={settings.baseUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Integration:</span>
              <Badge variant={settings.enabled ? "default" : "secondary"}>
                {settings.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            {health?.message && (
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                {health.message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>1. Deploy an Evolution API server or use an existing one</p>
          <p>2. Obtain your API base URL and authentication key</p>
          <p>3. Enter the credentials above and save the configuration</p>
          <p>4. Once connected, you can create and manage WhatsApp instances</p>
        </CardContent>
      </Card>
    </div>
  );
}