import { useState } from 'react';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/use-toast';

interface OAuthConnectProps {
  serviceName: string;
  displayName: string;
  logoUrl?: string;
  onSuccess?: () => void;
}

export function OAuthConnect({ serviceName, displayName, logoUrl, onSuccess }: OAuthConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to connect integrations',
          variant: 'destructive'
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-initiate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            service_name: serviceName,
            redirect_uri: `${window.location.origin}/oauth-callback`
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate OAuth');
      }

      window.location.href = data.authorization_url;
    } catch (error) {
      console.error('OAuth connect error:', error);
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: 'destructive'
      });
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {logoUrl && (
        <img src={logoUrl} alt={displayName} className="w-8 h-8" />
      )}
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className="w-full"
      >
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          `Connect ${displayName}`
        )}
      </Button>
    </div>
  );
}
