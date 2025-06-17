import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Smartphone, Loader2, Wifi, RefreshCw } from "lucide-react";

interface QRCodeDisplayProps {
  instanceId: string;
  instanceName: string;
  onConnected: () => void;
}

export function QRCodeDisplay({ instanceId, instanceName, onConnected }: QRCodeDisplayProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("disconnected");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateQR = useMutation({
    mutationFn: async () => {
      // First, initiate connection
      await apiRequest("POST", `/api/whatsapp/instances/${instanceId}/connect`);
      
      // Then fetch QR code
      const response = await apiRequest("GET", `/api/whatsapp/instances/${instanceId}/qr`);
      return response;
    },
    onSuccess: (data) => {
      if (data.qrCode) {
        // Strip data URL prefix if present
        const cleanQrCode = data.qrCode.replace(/^data:image\/png;base64,/, "");
        setQrCode(cleanQrCode);
        setStatus(data.status || "qr_pending");
        startRefreshing();
        
        toast({
          title: "QR Code Generated",
          description: "Scan the QR code with your WhatsApp mobile app to connect.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
    },
  });

  const checkStatus = async () => {
    try {
      setIsRefreshing(true);
      const response = await apiRequest("GET", `/api/whatsapp/instances/${instanceId}/status`);
      
      setStatus(response.instance.status);
      
      if (response.instance.status === "connected") {
        setQrCode(null);
        stopRefreshing();
        onConnected();
        
        toast({
          title: "Connected!",
          description: "WhatsApp instance connected successfully.",
        });
      } else if (response.instance.status === "qr_pending" && response.qrCode) {
        const cleanQrCode = response.qrCode.replace(/^data:image\/png;base64,/, "");
        setQrCode(cleanQrCode);
      }
    } catch (error) {
      console.error("Status check failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const startRefreshing = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    const interval = setInterval(() => {
      checkStatus();
    }, 3000); // Check every 3 seconds
    
    setRefreshInterval(interval);
  };

  const stopRefreshing = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  };

  useEffect(() => {
    return () => {
      stopRefreshing();
    };
  }, []);

  const getStatusDisplay = () => {
    switch (status) {
      case "connected":
        return {
          icon: <Wifi className="w-6 h-6 text-green-600" />,
          title: "Connected",
          description: "WhatsApp instance is connected and ready",
          color: "text-green-600"
        };
      case "connecting":
        return {
          icon: <Loader2 className="w-6 h-6 text-yellow-600 animate-spin" />,
          title: "Connecting",
          description: "Establishing connection...",
          color: "text-yellow-600"
        };
      case "qr_pending":
        return {
          icon: <QrCode className="w-6 h-6 text-blue-600" />,
          title: "QR Code Ready",
          description: "Scan the QR code with WhatsApp",
          color: "text-blue-600"
        };
      default:
        return {
          icon: <Smartphone className="w-6 h-6 text-gray-600" />,
          title: "Ready to Connect",
          description: "Generate QR code to start connection",
          color: "text-gray-600"
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            {statusDisplay.icon}
          </div>
          <CardTitle className={statusDisplay.color}>
            {statusDisplay.title}
          </CardTitle>
          <CardDescription>
            {statusDisplay.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrCode ? (
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                />
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-64 h-64 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">
                    QR code will appear here
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {status === "qr_pending" && (
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                {isRefreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>
                  {isRefreshing ? "Checking status..." : "Auto-refreshing every 3 seconds"}
                </span>
              </div>
            </div>
          )}
          
          <div className="flex space-x-2">
            {!qrCode && status !== "connected" && (
              <Button
                onClick={() => generateQR.mutate()}
                disabled={generateQR.isPending}
                className="flex-1"
              >
                {generateQR.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Generate QR Code
                  </>
                )}
              </Button>
            )}
            
            {qrCode && status !== "connected" && (
              <Button
                onClick={() => generateQR.mutate()}
                disabled={generateQR.isPending}
                variant="outline"
                className="flex-1"
              >
                {generateQR.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh QR
                  </>
                )}
              </Button>
            )}
            
            {status !== "connected" && (
              <Button
                onClick={checkStatus}
                disabled={isRefreshing}
                variant="secondary"
              >
                {isRefreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
          
          {status === "connected" && (
            <div className="text-center">
              <Button onClick={onConnected} className="w-full">
                <Wifi className="w-4 h-4 mr-2" />
                Continue
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="text-center text-sm text-gray-600 dark:text-gray-400">
        <p>Open WhatsApp on your phone and scan this QR code:</p>
        <p className="mt-1">
          <strong>Settings</strong> → <strong>Linked Devices</strong> → <strong>Link a Device</strong>
        </p>
      </div>
    </div>
  );
}