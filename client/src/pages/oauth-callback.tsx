import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function OAuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your Google Calendar connection...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get the current URL to extract the authorization code
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`OAuth error: ${error}`);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('No authorization code received from Google');
          return;
        }

        // Send the code to our backend to complete the OAuth flow
        const response = await fetch('/api/auth/google/calendar/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            code,
            userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42' // Development user ID
          }),
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setStatus('success');
          setMessage('Google Calendar connected successfully!');
          
          // Redirect to integrations page after a short delay
          setTimeout(() => {
            setLocation('/');
          }, 2000);
        } else {
          const errorData = await response.json();
          setStatus('error');
          setMessage(errorData.error || 'Failed to connect Google Calendar');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred while connecting Google Calendar');
      }
    };

    handleOAuthCallback();
  }, [setLocation]);

  const getIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {getIcon()}
            <span>Google Calendar</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className={`text-sm ${getStatusColor()}`}>
            {message}
          </p>
          {status === 'success' && (
            <p className="text-xs text-gray-500 mt-2">
              Redirecting you back to the integrations page...
            </p>
          )}
          {status === 'error' && (
            <button
              onClick={() => setLocation('/')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}