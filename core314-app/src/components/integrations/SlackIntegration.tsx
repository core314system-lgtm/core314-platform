import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';

export function SlackIntegration() {
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const handleConnect = () => {
    setConnected(true);
  };

  return (
    <div className="space-y-4">
      {connected ? (
        <div className="space-y-2">
          <Badge className="bg-green-100 text-green-800">Connected</Badge>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Slack integration is active
          </p>
          <Button variant="outline" size="sm" onClick={() => setConnected(false)}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="slack-client-id">Client ID</Label>
            <Input
              id="slack-client-id"
              placeholder="Enter Slack Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="slack-client-secret">Client Secret</Label>
            <Input
              id="slack-client-secret"
              type="password"
              placeholder="Enter Slack Client Secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          <Button onClick={handleConnect} size="sm" className="w-full">
            Connect Slack
          </Button>
        </div>
      )}
    </div>
  );
}
