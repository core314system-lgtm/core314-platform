import { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { EventAutomationLog } from '../../types';

export function AutomationLogsViewer() {
  const { currentOrganization } = useOrganization();
  const [logs, setLogs] = useState<EventAutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization) {
      fetchLogs();
    }
  }, [currentOrganization?.id]);

  const fetchLogs = async () => {
    if (!currentOrganization) return;

    try {
      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading logs...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Automation Logs</h1>
          <p className="text-gray-600 dark:text-gray-400">
            View execution history of automation rules
          </p>
        </div>
        <Button onClick={fetchLogs}>
          Refresh
        </Button>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No automation logs yet. Rules will appear here when they are triggered.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-6 w-6"
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      >
                        {expandedLog === log.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {log.event_type}
                          </span>
                          <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                            {log.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {expandedLog === log.id && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <h4 className="font-medium mb-2">Details:</h4>
                        <pre className="text-xs overflow-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                        {log.error_message && (
                          <div className="mt-2 text-sm text-red-600">
                            <strong>Error:</strong> {log.error_message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
