import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';

export function M365Integration() {
  const [connected, setConnected] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');

  const handleConnect = () => {
    setConnected(true);
  };

  return (
    <div className="space-y-4">
      {connected ? (
        <div className="space-y-2">
          <Badge className="bg-green-100 text-green-800">Connected</Badge>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Microsoft 365 integration is active
          </p>
          <Button variant="outline" size="sm" onClick={() => setConnected(false)}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="m365-tenant-id">Tenant ID</Label>
            <Input
              id="m365-tenant-id"
              placeholder="Enter Tenant ID"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="m365-client-id">Client ID</Label>
            <Input
              id="m365-client-id"
              placeholder="Enter Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <Button onClick={handleConnect} size="sm" className="w-full">
            Connect M365
          </Button>
        </div>
      )}
    </div>
  );
}
