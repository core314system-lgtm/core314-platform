import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Code, Key, Copy, Eye, EyeOff, Book, Terminal } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { FeatureGuard } from '../components/FeatureGuard';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used: string | null;
  status: 'active' | 'revoked';
}

export function ApiAccess() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchApiKeys();
    }
  }, [profile?.id]);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false });

      if (data) {
        setApiKeys(data);
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    setCreatingKey(true);
    try {
      const newKey = `core314_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      
      const { error } = await supabase
        .from('api_keys')
        .insert({
          user_id: profile?.id,
          name: `API Key ${apiKeys.length + 1}`,
          key: newKey,
          status: 'active',
        });

      if (!error) {
        toast({
          title: '✅ API Key created',
          description: 'Your new API key has been generated',
        });
        await fetchApiKeys();
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      });
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ status: 'revoked' })
        .eq('id', keyId);

      if (!error) {
        toast({
          title: '✅ API Key revoked',
          description: 'The API key has been deactivated',
        });
        await fetchApiKeys();
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke API key',
        variant: 'destructive',
      });
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: '✅ Copied to clipboard',
      description: 'API key has been copied',
    });
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const maskKey = (key: string) => {
    return `${key.substring(0, 12)}${'•'.repeat(20)}${key.substring(key.length - 4)}`;
  };

  return (
    <FeatureGuard feature="api_access">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Code className="h-8 w-8" />
              API Access & Documentation
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Programmatic access to Core314 platform capabilities
            </p>
          </div>
          <Button onClick={handleCreateKey} disabled={creatingKey}>
            <Key className="h-4 w-4 mr-2" />
            Create New API Key
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Your API Keys
                </CardTitle>
                <CardDescription>Manage your API authentication credentials</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : apiKeys.length > 0 ? (
                  <div className="space-y-4">
                    {apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-sm">{key.name}</span>
                            <Badge variant={key.status === 'active' ? 'default' : 'secondary'}>
                              {key.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
                              {showKeys[key.id] ? key.key : maskKey(key.key)}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleKeyVisibility(key.id)}
                            >
                              {showKeys[key.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyKey(key.key)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-xs text-gray-500">
                            Created: {new Date(key.created_at).toLocaleDateString()}
                            {key.last_used && ` • Last used: ${new Date(key.last_used).toLocaleDateString()}`}
                          </div>
                        </div>
                        {key.status === 'active' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRevokeKey(key.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Key className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      No API keys yet. Create one to get started.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Quick Start Example
                </CardTitle>
                <CardDescription>Get started with the Core314 API</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Authentication</h4>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`curl -X GET https://api.core314.com/v1/integrations \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Fetch Fusion Score</h4>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`curl -X GET https://api.core314.com/v1/fusion/score \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Trigger Optimization</h4>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`curl -X POST https://api.core314.com/v1/optimize \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"integration": "slack", "type": "performance"}'`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5" />
                  API Documentation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a
                  href="https://docs.core314.com/api/reference"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <h4 className="font-medium text-sm mb-1">API Reference</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Complete endpoint documentation
                  </p>
                </a>

                <a
                  href="https://docs.core314.com/api/guides"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <h4 className="font-medium text-sm mb-1">Integration Guides</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Step-by-step tutorials
                  </p>
                </a>

                <a
                  href="https://docs.core314.com/api/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <h4 className="font-medium text-sm mb-1">Webhooks</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Real-time event notifications
                  </p>
                </a>

                <a
                  href="https://docs.core314.com/api/sdks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <h4 className="font-medium text-sm mb-1">SDKs & Libraries</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Python, Node.js, Go, Ruby
                  </p>
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Rate Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Requests per minute:</span>
                  <span className="font-medium">1,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Requests per hour:</span>
                  <span className="font-medium">50,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Concurrent connections:</span>
                  <span className="font-medium">100</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">API Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">All Systems Operational</span>
                </div>
                <a
                  href="https://status.core314.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                >
                  View status page →
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}
