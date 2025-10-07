import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';

export function TrelloIntegration() {
  const [connected, setConnected] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const handleConnect = () => {
    setConnected(true);
  };

  return (
    <div className="space-y-4">
      {connected ? (
        <div className="space-y-2">
          <Badge className="bg-green-100 text-green-800">Connected</Badge>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Trello integration is active
          </p>
          <Button variant="outline" size="sm" onClick={() => setConnected(false)}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="trello-api-key">API Key</Label>
            <Input
              id="trello-api-key"
              placeholder="Enter Trello API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="trello-api-secret">API Secret</Label>
            <Input
              id="trello-api-secret"
              type="password"
              placeholder="Enter Trello API Secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
            />
          </div>
          <Button onClick={handleConnect} size="sm" className="w-full">
            Connect Trello
          </Button>
        </div>
      )}
    </div>
  );
}
