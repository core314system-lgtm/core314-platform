import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';

export function SendGridIntegration() {
  const [connected, setConnected] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');

  const handleConnect = () => {
    setConnected(true);
  };

  return (
    <div className="space-y-4">
      {connected ? (
        <div className="space-y-2">
          <Badge className="bg-green-100 text-green-800">Connected</Badge>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            SendGrid integration is active
          </p>
          <Button variant="outline" size="sm" onClick={() => setConnected(false)}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="sendgrid-api-key">API Key</Label>
            <Input
              id="sendgrid-api-key"
              type="password"
              placeholder="Enter SendGrid API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sendgrid-from-email">From Email</Label>
            <Input
              id="sendgrid-from-email"
              type="email"
              placeholder="noreply@example.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </div>
          <Button onClick={handleConnect} size="sm" className="w-full">
            Connect SendGrid
          </Button>
        </div>
      )}
    </div>
  );
}
