import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Smartphone, WifiOff, Wifi, Plus, Trash2, AlertTriangle, Edit2, Check, X, RefreshCw, Palette, Smile } from "lucide-react";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { QRCodeDisplay } from "./qr-code-display";

interface WhatsAppInstance {
  instanceId: string;
  displayName: string;
  ownerJid?: string;
  clientId: string;
  apiKey?: string;
  webhookUrl?: string;
  isConnected: boolean;
  lastConnectionAt?: string;
  phoneNumber?: string;
  profileName?: string;
  createdAt: string;
  updatedAt: string;
}

interface InstanceStatus {
  instanceId: string;
  instanceName: string;
  phoneNumber: string;
  status: string;
  webhookConfigured: boolean;
  lastConnected: string | null;
  connectionState: string;
}

export function WhatsAppInstanceManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [selectedInstanceForQR, setSelectedInstanceForQR] = useState<string | null>(null);
  const [instanceToDelete, setInstanceToDelete] = useState<WhatsAppInstance | null>(null);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState("");
  const [customizingInstanceId, setCustomizingInstanceId] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState("");
  const [customLetter, setCustomLetter] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock user ID - in real app this would come from auth context
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  const { data: instances = [], isLoading } = useQuery<WhatsAppInstance[]>({
    queryKey: [`/api/whatsapp/instances/${userId}`],
  });

  const { data: instanceStatuses = [] } = useQuery<any[]>({
    queryKey: ['/api/whatsapp/instances/status'],
    refetchInterval: 3000, // Auto refresh every 3 seconds
    refetchIntervalInBackground: true,
  });

  const createInstance = useMutation({
    mutationFn: async (data: { instance_name: string; display_name: string }) => {
      const webhookUrl = `${window.location.origin}/api/whatsapp/webhook/${data.instance_name}`;
      
      return apiRequest("POST", "/api/whatsapp/instances", {
        userId,
        instanceName: data.instance_name,
        displayName: data.display_name,
        apiKey: "will_be_generated",
        webhookUrl,
        status: "disconnected",
        isActive: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/instances/${userId}`] });
      setIsCreateDialogOpen(false);
      setInstanceName("");
      toast({
        title: "Instance Created",
        description: "WhatsApp instance has been created successfully. Click Connect to generate QR code.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create WhatsApp instance. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      return apiRequest("DELETE", `/api/whatsapp/instances/${instanceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/instances/${userId}`] });
      setIsDeleteDialogOpen(false);
      setInstanceToDelete(null);
      toast({
        title: "Instance Deleted",
        description: "WhatsApp instance has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete WhatsApp instance. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateDisplayName = useMutation({
    mutationFn: async ({ instanceId, displayName }: { instanceId: string; displayName: string }) => {
      return apiRequest("PATCH", `/api/whatsapp/instances/${instanceId}`, {
        displayName: displayName.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/instances/${userId}`] });
      setEditingInstanceId(null);
      setEditingDisplayName("");
      toast({
        title: "Display Name Updated",
        description: "Instance display name has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update display name. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConfirmDelete = () => {
    if (instanceToDelete) {
      deleteInstance.mutate(instanceToDelete.instanceId);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setInstanceToDelete(null);
  };

  const handleStartEdit = (instance: WhatsAppInstance) => {
    setEditingInstanceId(instance.instanceId);
    setEditingDisplayName(instance.displayName);
  };

  const handleSaveEdit = (instanceId: string) => {
    if (!editingDisplayName.trim()) {
      toast({
        title: "Error",
        description: "Display name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    updateDisplayName.mutate({ instanceId, displayName: editingDisplayName });
  };

  const handleCancelEdit = () => {
    setEditingInstanceId(null);
    setEditingDisplayName("");
  };

  const updateInstanceCustomization = useMutation({
    mutationFn: async ({ instanceId, color, letter }: { instanceId: string; color: string; letter: string }) => {
      return apiRequest("PATCH", `/api/whatsapp/instances/${instanceId}`, {
        customColor: color,
        customLetter: letter,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/instances/${userId}`] });
      setCustomizingInstanceId(null);
      setCustomColor("");
      setCustomLetter("");
      toast({
        title: "Customization Updated",
        description: "Instance appearance has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update instance customization. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartCustomization = (instance: WhatsAppInstance) => {
    setCustomizingInstanceId(instance.instanceId);
    // Set current values or defaults
    setCustomColor((instance as any).customColor || "");
    setCustomLetter((instance as any).customLetter || "");
  };

  const handleSaveCustomization = () => {
    if (!customizingInstanceId) return;
    updateInstanceCustomization.mutate({
      instanceId: customizingInstanceId,
      color: customColor,
      letter: customLetter,
    });
  };

  const handleCancelCustomization = () => {
    setCustomizingInstanceId(null);
    setCustomColor("");
    setCustomLetter("");
  };

  const syncStatus = useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await fetch(`/api/whatsapp/instances/${instanceId}/sync-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to sync status: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data, instanceId) => {
      toast({
        title: "Status synced",
        description: `Instance status updated to: ${data.status}`,
      });
      // Invalidate all related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/websocket/status"] });
      // Force refetch to get latest data
      queryClient.refetchQueries({ queryKey: ["/api/whatsapp/instances"] }).then(() => {
        // Additional refresh after a brief delay to ensure data is updated
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ["/api/whatsapp/instances"] });
        }, 1000);
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync status",
        variant: "destructive",
      });
    },
  });

  const handleSyncStatus = (instanceId: string) => {
    syncStatus.mutate(instanceId);
  };

  const getInstanceStatus = (instanceId: string) => {
    return instanceStatuses.find(status => status.instanceId === instanceId);
  };

  const getStatusBadge = (instanceId: string) => {
    const status = getInstanceStatus(instanceId);
    if (status?.webhookConfigured && status?.status === 'connected') {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          <Wifi className="w-3 h-3 mr-1" />
          Webhook Connected
        </Badge>
      );
    } else if (status?.webhookConfigured) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
          <WifiOff className="w-3 h-3 mr-1" />
          Webhook Configured
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
          <WifiOff className="w-3 h-3 mr-1" />
          No Webhook
        </Badge>
      );
    }
  };

  const handleCreateInstance = async () => {
    if (!instanceName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an instance name.",
        variant: "destructive",
      });
      return;
    }

    await createInstance.mutateAsync({
      instance_name: instanceName.trim(),
      display_name: instanceName.trim(),
    });
  };



  const selectedInstance = instances.find(instance => instance.instanceId === selectedInstanceForQR);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading WhatsApp instances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            WhatsApp Instances
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your WhatsApp connections
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Instance
        </Button>
      </div>

      {instances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Smartphone className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No WhatsApp Instances
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              Create your first WhatsApp instance to start receiving and sending messages.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Instance
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance) => (
            <Card key={instance.instanceId} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 flex-1">
                    <Smartphone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    {editingInstanceId === instance.instanceId ? (
                      <div className="flex items-center space-x-2 flex-1">
                        <Input
                          value={editingDisplayName}
                          onChange={(e) => setEditingDisplayName(e.target.value)}
                          className="text-lg font-semibold h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit(instance.instanceId);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveEdit(instance.instanceId)}
                          disabled={updateDisplayName.isPending}
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={updateDisplayName.isPending}
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 flex-1 group">
                        <CardTitle className="text-lg">{instance.displayName}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(instance)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setInstanceToDelete(instance);
                      setIsDeleteDialogOpen(true);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  {getStatusBadge(instance.instanceId)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {instance.phoneNumber && (
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                    <span className="ml-2 font-medium">{instance.phoneNumber}</span>
                  </div>
                )}
                {instance.profileName && (
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Profile:</span>
                    <span className="ml-2 font-medium">{instance.profileName}</span>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="ml-2">{new Date(instance.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="pt-2 space-y-2">
                  {instance.isConnected ? (
                    <Button disabled className="w-full">
                      <Wifi className="w-4 h-4 mr-2" />
                      Connected
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => setSelectedInstanceForQR(instance.instanceId)}
                      className="w-full"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Connect
                    </Button>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleSyncStatus(instance.instanceId)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={syncStatus.isPending}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${syncStatus.isPending ? 'animate-spin' : ''}`} />
                      {syncStatus.isPending ? 'Syncing...' : 'Sync Status'}
                    </Button>
                    <Button 
                      onClick={() => handleStartCustomization(instance)}
                      variant="outline"
                      size="sm"
                      className="px-3"
                      title="Customize appearance"
                    >
                      <Palette className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Instance Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create WhatsApp Instance</DialogTitle>
            <DialogDescription>
              This will create a new WhatsApp instance. The phone number will be set after QR scan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="instanceName">Instance Name</Label>
              <Input
                id="instanceName"
                placeholder="my-whatsapp-instance"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateInstance();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateInstance}
              disabled={createInstance.isPending || !instanceName.trim()}
            >
              {createInstance.isPending ? "Creating..." : "Create Instance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!selectedInstanceForQR} onOpenChange={() => setSelectedInstanceForQR(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Connect {selectedInstance?.displayName}
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your WhatsApp mobile app to connect this instance.
            </DialogDescription>
          </DialogHeader>
          {selectedInstance && (
            <QRCodeDisplay
              instanceId={selectedInstance.instanceId}
              instanceName={selectedInstance.displayName}
              onConnected={() => {
                setSelectedInstanceForQR(null);
                queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/instances/${userId}`] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete WhatsApp Instance
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p>Are you sure you want to delete "{instanceToDelete?.displayName}"? This action will:</p>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
                  <li>Remove the instance from your dashboard</li>
                  <li>Delete it from the Evolution API</li>
                  <li>Disconnect any active WhatsApp session</li>
                  <li>Remove all associated data</li>
                </ul>
                <p className="mt-2 font-medium text-red-600">This action cannot be undone.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteInstance.isPending}
            >
              {deleteInstance.isPending ? "Deleting..." : "Delete Instance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customization Dialog */}
      <Dialog open={!!customizingInstanceId} onOpenChange={() => handleCancelCustomization()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize Instance Appearance</DialogTitle>
            <DialogDescription>
              Choose a color and letter/emoji to identify this instance in conversations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Color Selection */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Background Color</Label>
              <div className="grid grid-cols-6 gap-2">
                {/* Transparent/None option */}
                <button
                  onClick={() => setCustomColor("")}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                    customColor === "" ? "border-blue-500" : "border-gray-300"
                  }`}
                  style={{ 
                    background: "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                    backgroundSize: "4px 4px",
                    backgroundPosition: "0 0, 0 2px, 2px -2px, -2px 0px"
                  }}
                  title="No background color"
                >
                  {customColor === "" && <Check className="w-3 h-3 text-gray-700" />}
                </button>
                {/* Color options */}
                {[
                  { name: 'Blue', value: 'bg-blue-500', color: '#3b82f6' },
                  { name: 'Green', value: 'bg-green-500', color: '#10b981' },
                  { name: 'Purple', value: 'bg-purple-500', color: '#8b5cf6' },
                  { name: 'Pink', value: 'bg-pink-500', color: '#ec4899' },
                  { name: 'Yellow', value: 'bg-yellow-500', color: '#eab308' },
                  { name: 'Orange', value: 'bg-orange-500', color: '#f97316' },
                  { name: 'Red', value: 'bg-red-500', color: '#ef4444' },
                  { name: 'Indigo', value: 'bg-indigo-500', color: '#6366f1' },
                  { name: 'Teal', value: 'bg-teal-500', color: '#14b8a6' },
                  { name: 'Cyan', value: 'bg-cyan-500', color: '#06b6d4' },
                  { name: 'Lime', value: 'bg-lime-500', color: '#84cc16' },
                  { name: 'Amber', value: 'bg-amber-500', color: '#f59e0b' },
                ].map((colorOption) => (
                  <button
                    key={colorOption.value}
                    onClick={() => setCustomColor(colorOption.value)}
                    className={`w-8 h-8 rounded-full border-2 ${
                      customColor === colorOption.value ? "border-blue-500" : "border-gray-300"
                    }`}
                    style={{ backgroundColor: colorOption.color }}
                    title={colorOption.name}
                  />
                ))}
              </div>
            </div>

            {/* Letter/Emoji Input */}
            <div>
              <Label htmlFor="customLetter" className="text-sm font-medium">
                Letter or Emoji
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="customLetter"
                  value={customLetter}
                  onChange={(e) => {
                    // Allow up to 4 characters to support complex emojis like flags
                    const value = e.target.value.slice(0, 4);
                    setCustomLetter(value);
                  }}
                  placeholder="A, 1, 🔥, 🇲🇽, etc."
                  className="flex-1"
                  maxLength={4}
                />
                <EmojiPicker 
                  onEmojiSelect={(emoji) => setCustomLetter(emoji)}
                  trigger={
                    <Button variant="outline" size="sm" type="button">
                      <Smile className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Use a letter, number, or emoji (including flags like 🇲🇽) to identify this instance
              </p>
            </div>

            {/* Preview */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Preview</Label>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-600">U</span>
                  </div>
                  {/* Preview indicator */}
                  <div 
                    className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${
                      customColor ? `${customColor} text-white` : 'text-gray-600'
                    }`}
                    style={{
                      fontSize: '14px',
                      fontWeight: customLetter && customLetter.length > 1 ? 'normal' : 'bold',
                      lineHeight: '1',
                      fontFamily: customLetter && customLetter.length > 1 ? 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' : 'inherit'
                    }}
                  >
                    {customLetter || "I"}
                  </div>
                </div>
                <span className="text-sm text-gray-600">Sample conversation with this indicator</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelCustomization}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCustomization}
              disabled={updateInstanceCustomization.isPending}
            >
              {updateInstanceCustomization.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}