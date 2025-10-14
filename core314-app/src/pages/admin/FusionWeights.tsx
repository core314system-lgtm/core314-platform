import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../../components/ui/hover-card';
import { useToast } from '../../hooks/use-toast';
import { RefreshCw, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface WeightData {
  metric_name: string;
  weight: number;
  ai_confidence: number;
  variance: number;
  correlation_penalty: number;
  last_adjusted: string;
  integration_name: string;
}

interface AuditLogData {
  id: string;
  event_type: string;
  triggered_by: string;
  metrics_count: number;
  execution_time_ms: number;
  status: string;
  created_at: string;
}

const RECORDS_PER_PAGE = 25;

export function FusionWeights() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [weights, setWeights] = useState<WeightData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogData[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [autoOptimize, setAutoOptimize] = useState(() => {
    const stored = localStorage.getItem('fusion-auto-adjust');
    return stored !== null ? stored === 'true' : true;
  });
  const [recalculating, setRecalculating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastScheduledRecalibration, setLastScheduledRecalibration] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !isAdmin()) {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (profile?.id && isAdmin()) {
      fetchWeights();
      fetchAuditLogs(1);
      fetchLastScheduledRecalibration();
    }
  }, [profile?.id]);

  useEffect(() => {
    localStorage.setItem('fusion-auto-adjust', autoOptimize.toString());
  }, [autoOptimize]);

  const fetchWeights = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data: weightings } = await supabase
        .from('fusion_weightings')
        .select(`
          metric_name,
          final_weight,
          variance,
          ai_confidence,
          correlation_penalty,
          last_updated,
          integration_id,
          integrations_master!fusion_weightings_integration_id_fkey (
            integration_name
          )
        `)
        .eq('user_id', profile.id)
        .order('last_updated', { ascending: false });

      if (!weightings) return;

      const formattedWeights: WeightData[] = weightings.map(w => {
        const integration = w.integrations_master as unknown as { integration_name: string } | null;
        
        return {
          metric_name: w.metric_name || 'Unknown',
          weight: w.final_weight,
          ai_confidence: w.ai_confidence,
          variance: w.variance || (1 - w.ai_confidence),
          correlation_penalty: w.correlation_penalty || 0,
          last_adjusted: w.last_updated,
          integration_name: integration?.integration_name || 'Unknown'
        };
      });

      setWeights(formattedWeights);
    } catch (error) {
      console.error('Error fetching weights:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async (page: number = 1) => {
    if (!profile?.id) return;

    setAuditLoading(true);
    try {
      const from = (page - 1) * RECORDS_PER_PAGE;
      const to = from + RECORDS_PER_PAGE - 1;

      const { data: logs, error, count } = await supabase
        .from('fusion_audit_log')
        .select('*', { count: 'exact' })
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setAuditLogs(logs || []);
      setTotalPages(Math.ceil((count || 0) / RECORDS_PER_PAGE));
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchLastScheduledRecalibration = async () => {
    if (!profile?.id) return;

    try {
      const { data } = await supabase
        .from('fusion_audit_log')
        .select('created_at')
        .eq('user_id', profile.id)
        .eq('event_type', 'scheduled_recalibration')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setLastScheduledRecalibration(data.created_at);
      }
    } catch (error) {
      console.error('Error fetching last scheduled recalibration:', error);
    }
  };

  const handleRecalculate = async () => {
    if (!profile?.id) return;

    setRecalculating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'No active session. Please log in again.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fusion-recalibrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          userId: profile.id
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '✅ Recalibration completed successfully',
          description: `Updated ${result.totalMetrics} metrics across ${result.totalIntegrations} integrations in ${result.executionTimeMs}ms`,
        });
        await fetchWeights();
        await fetchAuditLogs(currentPage);
        await fetchLastScheduledRecalibration();
      } else {
        throw new Error(result.error || 'Recalibration failed');
      }
    } catch (error) {
      console.error('Recalibration error:', error);
      toast({
        title: '❌ Recalibration failed',
        description: error instanceof Error ? error.message : 'Check audit log for details.',
        variant: 'destructive',
      });
    } finally {
      setRecalculating(false);
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance < 0.25) return 'text-green-600';
    if (variance < 0.45) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getVarianceLabel = (variance: number) => {
    if (variance < 0.25) return '🟢 Stable';
    if (variance < 0.45) return '🟡 Moderate';
    return '🔴 Volatile';
  };

  return (
    <div className="p-6 space-y-6">
      {profile && !isAdmin() ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Access Restricted
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            This page is only accessible to administrators.
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Fusion Weights
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Adaptive weight management for fusion scoring metrics
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-optimize"
                    checked={autoOptimize}
                    onCheckedChange={setAutoOptimize}
                  />
                  <Label htmlFor="auto-optimize" className="text-sm font-medium">
                    Auto-Adjust (24hr)
                  </Label>
                </div>
                {lastScheduledRecalibration && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Last auto-adjust: {format(new Date(lastScheduledRecalibration), 'MMM dd, h:mm a')}
                  </p>
                )}
              </div>
              <Button 
                onClick={handleRecalculate} 
                disabled={recalculating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                Recalculate Now
              </Button>
            </div>
          </div>

          <Tabs defaultValue="weights" className="w-full">
            <TabsList>
              <TabsTrigger value="weights">Current Weights</TabsTrigger>
              <TabsTrigger value="audit">Audit Log</TabsTrigger>
            </TabsList>

            <TabsContent value="weights">
              <Card>
                <CardHeader>
                  <CardTitle>Active Weights</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-center py-8 text-gray-600">Loading weights...</p>
                  ) : weights.length === 0 ? (
                    <p className="text-center py-8 text-gray-600">
                      No weights configured. Sync your integrations to generate weights.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3">Integration</th>
                            <th className="text-left p-3">Metric Name</th>
                            <th className="text-center p-3">
                              <HoverCard>
                                <HoverCardTrigger>
                                  <span className="flex items-center gap-1 cursor-help">
                                    Variance (%)
                                    <Info className="h-3 w-3" />
                                  </span>
                                </HoverCardTrigger>
                                <HoverCardContent>
                                  Historical fluctuation rate of the metric
                                </HoverCardContent>
                              </HoverCard>
                            </th>
                            <th className="text-center p-3">
                              <HoverCard>
                                <HoverCardTrigger>
                                  <span className="flex items-center gap-1 cursor-help">
                                    AI Confidence (%)
                                    <Info className="h-3 w-3" />
                                  </span>
                                </HoverCardTrigger>
                                <HoverCardContent>
                                  Model certainty for this metric
                                </HoverCardContent>
                              </HoverCard>
                            </th>
                            <th className="text-center p-3">
                              <HoverCard>
                                <HoverCardTrigger>
                                  <span className="flex items-center gap-1 cursor-help">
                                    Correlation Penalty (%)
                                    <Info className="h-3 w-3" />
                                  </span>
                                </HoverCardTrigger>
                                <HoverCardContent>
                                  Penalty for highly correlated metrics
                                </HoverCardContent>
                              </HoverCard>
                            </th>
                            <th className="text-center p-3">Final Weight (%)</th>
                            <th className="text-left p-3">Last Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weights.map((w, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="p-3">{w.integration_name}</td>
                              <td className="p-3">{w.metric_name}</td>
                              <td className="p-3 text-center">
                                <span className={getVarianceColor(w.variance)}>
                                  {getVarianceLabel(w.variance)}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {(w.ai_confidence * 100).toFixed(2)}%
                              </td>
                              <td className="p-3 text-center">
                                {(w.correlation_penalty * 100).toFixed(2)}%
                              </td>
                              <td className="p-3 text-center font-semibold">
                                {(w.weight * 100).toFixed(2)}%
                              </td>
                              <td className="p-3">
                                {format(new Date(w.last_adjusted), 'MMM dd, yyyy h:mm a')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle>Recalibration Audit Log</CardTitle>
                </CardHeader>
                <CardContent>
                  {auditLoading ? (
                    <p className="text-center py-8 text-gray-600">Loading audit logs...</p>
                  ) : auditLogs.length === 0 ? (
                    <p className="text-center py-8 text-gray-600">
                      No audit logs found. Trigger a recalibration to see logs.
                    </p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3">Event Type</th>
                              <th className="text-left p-3">Trigger Source</th>
                              <th className="text-center p-3">Metrics Count</th>
                              <th className="text-center p-3">Execution Time (ms)</th>
                              <th className="text-center p-3">Status</th>
                              <th className="text-left p-3">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLogs.map((log) => (
                              <tr key={log.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="p-3">
                                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    {log.event_type.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="p-3">{log.triggered_by}</td>
                                <td className="p-3 text-center">{log.metrics_count}</td>
                                <td className="p-3 text-center">{log.execution_time_ms}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    log.status === 'success' 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  }`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {format(new Date(log.created_at), 'MMM dd, yyyy h:mm a')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Page {currentPage} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchAuditLogs(currentPage - 1)}
                            disabled={currentPage === 1 || auditLoading}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchAuditLogs(currentPage + 1)}
                            disabled={currentPage === totalPages || auditLoading}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
