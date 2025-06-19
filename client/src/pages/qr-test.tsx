import React from 'react';
import { QRCodeDisplay } from '@/components/integrations/qr-code-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function QRTestPage() {
  // Test with the connected instance
  const testInstanceId = "live-test-1750199771";
  const testInstanceName = "Cel USA";

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp QR Code Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Testing HTTP polling QR generation system with instance: {testInstanceName}
          </p>
          <QRCodeDisplay 
            instanceId={testInstanceId}
            instanceName={testInstanceName}
            onConnectionSuccess={() => {
              console.log('Connection successful!');
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}