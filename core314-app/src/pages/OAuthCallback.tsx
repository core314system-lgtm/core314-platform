import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing OAuth callback...');

  useEffect(() => {
    const handleCallback = async () => {
      const success = searchParams.get('oauth_success');
      const service = searchParams.get('service');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(`OAuth error: ${error}`);
        return;
      }

      if (success === 'true' && service) {
        setStatus('success');
        setMessage(`Successfully connected to ${service}!`);
        
        setTimeout(() => {
          navigate('/integrations');
        }, 2000);
      } else {
        setStatus('error');
        setMessage('OAuth callback failed or incomplete');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'loading' && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
            {status === 'loading' ? 'Connecting...' : status === 'success' ? 'Success!' : 'Error'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        {status === 'error' && (
          <CardContent>
            <Button onClick={() => navigate('/integrations')} className="w-full">
              Return to Integrations
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
