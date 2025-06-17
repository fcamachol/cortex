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
import { QrCode, Smartphone, WifiOff, Wifi, Plus, Trash2, AlertTriangle, Edit2, Check, X } from "lucide-react";
import { QRCodeDisplay } from "./qr-code-display";
import { PhoneNumberDisplay } from "@/components/ui/phone-number-display";

interface WhatsAppInstance {
  id: string;
  instanceName: string;
  displayName: string;
  status: string;
  phoneNumber?: string;
  profileName?: string;
  createdAt: string;
  updatedAt: string;
}

export function WhatsAppInstanceManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [selectedInstanceForQR, setSelectedInstanceForQR] = useState<string | null>(null);
  const [instanceToDelete, setInstanceToDelete] = useState<WhatsAppInstance | null>(null);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock user ID - in real app this would come from auth context
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  const { data: instances = [], isLoading } = useQuery<WhatsAppInstance[]>({
    queryKey: [`/api/whatsapp/instances/${userId}`],
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
      deleteInstance.mutate(instanceToDelete.id);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setInstanceToDelete(null);
  };

  const handleStartEdit = (instance: WhatsAppInstance) => {
    setEditingInstanceId(instance.id);
    setEditingDisplayName(instance.displayName || instance.instanceName);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <Wifi className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case "connecting":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
            <QrCode className="w-3 h-3 mr-1" />
            Connecting
          </Badge>
        );
      case "qr_pending":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            <QrCode className="w-3 h-3 mr-1" />
            QR Pending
          </Badge>
        );
      default:
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
            <WifiOff className="w-3 h-3 mr-1" />
            Disconnected
          </Badge>
        );
    }
  };

  const selectedInstance = instances.find(instance => instance.id === selectedInstanceForQR);

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
            <Card key={instance.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 flex-1">
                    <Smartphone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    {editingInstanceId === instance.id ? (
                      <div className="flex items-center space-x-2 flex-1">
                        <Input
                          value={editingDisplayName}
                          onChange={(e) => setEditingDisplayName(e.target.value)}
                          className="text-lg font-semibold h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit(instance.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveEdit(instance.id)}
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
                        <CardTitle className="text-lg">{instance.displayName || instance.instanceName}</CardTitle>
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
                  {getStatusBadge(instance.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {instance.phoneNumber && (
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                    <div className="ml-2">
                      <PhoneNumberDisplay phoneNumber={instance.phoneNumber} />
                    </div>
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
                <div className="pt-2">
                  {instance.status === "connected" ? (
                    <Button disabled className="w-full">
                      <Wifi className="w-4 h-4 mr-2" />
                      Connected
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => setSelectedInstanceForQR(instance.id)}
                      className="w-full"
                      variant={instance.status === "connecting" || instance.status === "qr_pending" ? "secondary" : "default"}
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      {instance.status === "connecting" || instance.status === "qr_pending" ? "Show QR" : "Connect"}
                    </Button>
                  )}
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
              instanceId={selectedInstance.id}
              instanceName={selectedInstance.instanceName}
              onConnectionSuccess={() => {
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
            <DialogDescription>
              Are you sure you want to delete "{instanceToDelete?.displayName}"? This action will:
              <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
                <li>Remove the instance from your dashboard</li>
                <li>Delete it from the Evolution API</li>
                <li>Disconnect any active WhatsApp session</li>
                <li>Remove all associated data</li>
              </ul>
              <p className="mt-2 font-medium text-red-600">This action cannot be undone.</p>
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
    </div>
  );
}