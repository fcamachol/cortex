import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneNumberDisplay } from '@/components/ui/phone-number-display';
import { Loader2, RefreshCw, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeDisplayProps {
  instanceId: string;
  instanceName: string;
  onConnectionSuccess?: () => void;
  onConnected?: () => void;
}

interface QRCodeData {
  base64: string;
  code: string;
  pairingCode?: string;
}

interface InstanceStatus {
  instance: {
    id: string;
    name: string;
    status: string;
  };
  bridge: {
    connected: boolean;
    bridgeExists: boolean;
  };
  qrCode?: QRCodeData;
  evolutionStatus?: {
    status: string;
    qrcode?: QRCodeData;
  };
}

export function QRCodeDisplay({ instanceId, instanceName, onConnectionSuccess, onConnected }: QRCodeDisplayProps) {
  const [qrCodeData, setQrCodeData] = useState<QRCodeData | null>(null);
  const [status, setStatus] = useState<string>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const { toast } = useToast();

  const fetchProfileData = async () => {
    try {
      const response = await fetch(`/api/whatsapp/instances/${instanceId}/profile`);
      if (response.ok) {
        const profile = await response.json();
        setProfileData(profile);
        console.log('Profile data fetched:', profile);
      }
    } catch (err) {
      console.log('Profile fetch failed:', err);
    }
  };

  const fetchInstanceStatus = async () => {
    try {
      const response = await fetch(`/api/whatsapp/instances/${instanceId}/status`);
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`);
      }
      
      const data: InstanceStatus = await response.json();
      console.log('Fetched instance status:', data);
      
      setStatus(data.instance.status);
      
      // Check for QR code from multiple sources
      const qrCode = data.qrCode || data.evolutionStatus?.qrcode;
      console.log('QR Code data found:', qrCode);
      
      if (qrCode) {
        setQrCodeData(qrCode);
        setError(null);
        console.log('QR Code set:', qrCode);
      } else if (data.instance.status === 'connected' || data.evolutionStatus?.status === 'open') {
        // Instance is connected, no QR needed
        setQrCodeData(null);
        setError(null);
        setStatus('connected');
        
        // Fetch profile data when connected
        fetchProfileData();
        
        if (onConnectionSuccess) {
          onConnectionSuccess();
        }
        toast({
          title: "WhatsApp Connected",
          description: `Instance ${instanceName} is now connected!`,
        });
      } else if (data.instance.status === 'disconnected' && !qrCode) {
        setError('No QR Code Available - Instance may need to be restarted');
      }
      
    } catch (err) {
      console.error('Error fetching instance status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch instance status');
    }
  };

  const initiateConnection = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First try regular connection
      const connectResponse = await fetch(`/api/whatsapp/instances/${instanceId}/connect`, {
        method: 'POST',
      });
      
      if (connectResponse.ok) {
        const result = await connectResponse.json();
        if (result.success) {
          toast({
            title: "Connection Initiated",
            description: "WhatsApp connection process started. Generating QR code...",
          });
          
          // Start polling for QR code and status updates
          startPolling();
          return;
        }
      }
      
      // If regular connection fails, try force QR generation
      const qrResponse = await fetch(`/api/whatsapp/instances/${instanceId}/generate-qr`, {
        method: 'POST',
      });
      
      if (!qrResponse.ok) {
        throw new Error(`QR generation failed: ${qrResponse.statusText}`);
      }
      
      const qrResult = await qrResponse.json();
      
      if (qrResult.success && qrResult.qrCode) {
        setQrCodeData(qrResult.qrCode);
        toast({
          title: "QR Code Generated",
          description: "QR code is ready for scanning",
        });
        
        // Start polling for status updates
        startPolling();
      } else {
        throw new Error(qrResult.error || 'QR code generation failed');
      }
      
    } catch (err) {
      console.error('Error initiating connection:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      toast({
        title: "Connection Failed",
        description: err instanceof Error ? err.message : 'Failed to initiate connection',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = () => {
    // Clear existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Poll every 3 seconds for updates
    const interval = setInterval(fetchInstanceStatus, 3000);
    setPollingInterval(interval);
    
    // Initial fetch
    fetchInstanceStatus();
  };

  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const handleRefresh = () => {
    fetchInstanceStatus();
  };

  const syncInstanceStatus = async () => {
    try {
      const response = await fetch(`/api/whatsapp/instances/${instanceId}/sync-status`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Status synced with backend:', result);
        // Refresh instance status after sync
        setTimeout(() => fetchInstanceStatus(), 1000);
      }
    } catch (error) {
      console.error('Error syncing instance status:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Auto-start polling if instance is connecting
  useEffect(() => {
    if (status === 'connecting' && !pollingInterval) {
      startPolling();
    } else if (status === 'connected' && pollingInterval) {
      stopPolling();
      // Show success toast when connection is detected
      toast({
        title: "WhatsApp Connected Successfully!",
        description: `Instance ${instanceName} is now connected and ready to send and receive messages.`,
      });
      // Call both callback functions
      onConnectionSuccess?.();
      onConnected?.();
    }
  }, [status]);

  // Initial fetch on component mount
  useEffect(() => {
    console.log('QRCodeDisplay mounted for instance:', instanceId, instanceName);
    fetchInstanceStatus();
  }, [instanceId]);

  // Fetch profile data when status becomes connected
  useEffect(() => {
    if (status === 'connected') {
      fetchProfileData();
    }
  }, [status]);

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'connecting':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Connecting</Badge>;
      case 'disconnected':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Not connected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Smartphone className="w-5 h-5 mr-2" />
            {instanceName}
          </span>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button
              onClick={handleRefresh}
              variant="ghost"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'connected' ? (
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-3">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-green-700 dark:text-green-300 font-medium">
              WhatsApp Connected Successfully!
            </p>
            {profileData && (
              <div className="space-y-2">
                {profileData.phoneNumber && (
                  <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                    <span>Phone:</span>
                    <PhoneNumberDisplay phoneNumber={profileData.phoneNumber} />
                  </div>
                )}
                {profileData.profileName && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Name: {profileData.profileName}
                  </p>
                )}
              </div>
            )}
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Your instance is ready to send and receive messages.
            </p>
          </div>
        ) : qrCodeData ? (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Scan this QR code with WhatsApp on your phone
              </p>
              <div className="bg-white p-4 rounded-lg inline-block">
                <img 
                  src={qrCodeData.base64.startsWith('data:') ? qrCodeData.base64 : `data:image/png;base64,${qrCodeData.base64}`}
                  alt="WhatsApp QR Code"
                  className="w-48 h-48 mx-auto"
                />
              </div>
              {qrCodeData.pairingCode && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Pairing Code: <span className="font-mono font-bold">{qrCodeData.pairingCode}</span>
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-2">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh QR Code
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}
            <div className="text-center">
              <Button
                onClick={initiateConnection}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 mr-2" />
                    Connect WhatsApp
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        
        {status === 'connecting' && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
            Waiting for QR code...
          </div>
        )}
      </CardContent>
    </Card>
  );
}