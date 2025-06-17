import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Smartphone, Loader2, Wifi, RefreshCw, CheckCircle } from "lucide-react";

interface QRCodeDisplayProps {
  instanceId: string;
  instanceName: string;
  onConnected: () => void;
}

export function QRCodeDisplay({ instanceId, instanceName, onConnected }: QRCodeDisplayProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("disconnected");
  const [isPolling, setIsPolling] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step 1: Generate QR Code
  const generateQR = useMutation({
    mutationFn: async () => {
      // Initiate connection with Evolution API
      const connectResponse = await apiRequest("POST", `/api/whatsapp/instances/${instanceId}/connect`);
      
      // Wait for connection initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get QR code from Evolution API
      const qrResponse = await apiRequest("GET", `/api/whatsapp/instances/${instanceId}/qr`);
      return qrResponse;
    },
    onSuccess: (data: any) => {
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setStatus("qr_pending");
        startStatusPolling();
        
        // Update database with QR pending status
        apiRequest("PATCH", `/api/whatsapp/instances/${instanceId}`, {
          status: "qr_pending",
          qrCode: data.qrCode
        });
        
        toast({
          title: "QR Code Ready",
          description: "Scan with WhatsApp: Settings → Linked Devices → Link a Device",
        });
      } else if (data.message?.includes("connecting")) {
        setStatus("connecting");
        toast({
          title: "Preparing Connection",
          description: "Initializing WhatsApp instance...",
        });
        // Retry QR generation after delay
        setTimeout(() => {
          generateQR.mutate();
        }, 5000);
      } else {
        toast({
          title: "Connection Issue",
          description: data.message || "Unable to generate QR code. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("QR generation failed:", error);
      toast({
        title: "Failed to Generate QR Code", 
        description: error.message || "Please check Evolution API configuration and try again.",
        variant: "destructive",
      });
    },
  });

  // Step 2: Status polling function - checks every 3 seconds for connection
  const checkConnectionStatus = async () => {
    try {
      const response: any = await apiRequest("GET", `/api/whatsapp/instances/${instanceId}/status`);
      return response;
    } catch (error) {
      console.error("Status check failed:", error);
      return null;
    }
  };

  // Step 3: Start polling for connection status changes
  const startStatusPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    
    setIsPolling(true);
    const interval = setInterval(async () => {
      const statusData = await checkConnectionStatus();
      
      if (statusData?.evolutionStatus?.instance) {
        const evolutionState = statusData.evolutionStatus.instance.state;
        const phoneNum = statusData.evolutionStatus.instance.phoneNumber;
        const profileNm = statusData.evolutionStatus.instance.profileName;
        
        if (evolutionState === "open") {
          // Connection successful!
          setStatus("connected");
          setPhoneNumber(phoneNum);
          setProfileName(profileNm);
          setIsPolling(false);
          clearInterval(interval);
          setPollInterval(null);
          setQrCode(null); // Clear QR code
          
          // Update database with connection success
          apiRequest("PATCH", `/api/whatsapp/instances/${instanceId}`, {
            status: "connected",
            phoneNumber: phoneNum,
            profileName: profileNm,
            qrCode: null,
            lastConnectedAt: new Date().toISOString()
          });
          
          onConnected();
          
          toast({
            title: "WhatsApp Connected!",
            description: `Successfully connected ${profileNm || phoneNum}`,
          });
        } else if (evolutionState === "close") {
          // Connection lost or QR expired
          setStatus("disconnected");
          setIsPolling(false);
          clearInterval(interval);
          setPollInterval(null);
          setQrCode(null);
          
          toast({
            title: "Connection Lost",
            description: "QR code expired or connection failed. Please try again.",
            variant: "destructive",
          });
        }
        // If state is still "qr" or "connecting", continue polling
      }
    }, 3000); // Poll every 3 seconds
    
    setPollInterval(interval);
  };

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setIsPolling(false);
  };

  const getStatusIcon = () => {
    switch (status) {
      case "connected":
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case "qr_pending":
        return <QrCode className="w-6 h-6 text-blue-600" />;
      case "connecting":
        return <Loader2 className="w-6 h-6 text-yellow-600 animate-spin" />;
      default:
        return <Smartphone className="w-6 h-6 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Connected Successfully";
      case "qr_pending":
        return "Scan QR Code";
      case "connecting":
        return "Preparing Connection...";
      default:
        return "Ready to Connect";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {getStatusIcon()}
            {getStatusText()}
          </CardTitle>
          <CardDescription>
            {status === "connected" && profileName && (
              <div className="space-y-1">
                <div>Profile: {profileName}</div>
                {phoneNumber && <div>Phone: {phoneNumber}</div>}
              </div>
            )}
            {status === "qr_pending" && (
              "Open WhatsApp mobile app → Settings → Linked Devices → Link a Device"
            )}
            {status === "connecting" && (
              "Setting up your WhatsApp instance..."
            )}
            {status === "disconnected" && (
              "Click the button below to start the connection process"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* QR Code Display */}
          {qrCode && status === "qr_pending" && (
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
                <img 
                  src={qrCode} 
                  alt="WhatsApp QR Code" 
                  className="w-64 h-64 object-contain"
                />
              </div>
            </div>
          )}

          {/* Status Indicators */}
          {isPolling && status === "qr_pending" && (
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for QR scan...
            </div>
          )}

          {status === "connected" && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600">
              <Wifi className="w-4 h-4" />
              Instance connected and ready
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-center">
            {status === "disconnected" && (
              <Button 
                onClick={() => generateQR.mutate()}
                disabled={generateQR.isPending}
                className="w-full"
              >
                {generateQR.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating QR...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Generate QR Code
                  </>
                )}
              </Button>
            )}

            {status === "qr_pending" && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => generateQR.mutate()}
                  disabled={generateQR.isPending}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh QR
                </Button>
                <Button 
                  variant="outline"
                  onClick={stopPolling}
                >
                  Cancel
                </Button>
              </>
            )}

            {status === "connecting" && (
              <Button 
                variant="outline"
                onClick={stopPolling}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}