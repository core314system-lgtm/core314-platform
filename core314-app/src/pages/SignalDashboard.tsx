import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  DollarSign,
  Briefcase,
  Clock,
  Filter,
} from 'lucide-react';
import { Button } from '../components/ui/button';

interface OperationalSignal {
  id: string;
  signal_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  source_integration: string;
  signal_data: Record<string, unknown>;
  detected_at: string;
  is_active: boolean;
}

const SEVERITY_CONFIG = {
  low: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  medium: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  high: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  critical: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
};

const SOURCE_ICONS: Record<string, typeof Activity> = {
  hubspot: Briefcase,
  slack: MessageSquare,
  quickbooks: DollarSign,
};

export function SignalDashboard() {
  const { profile } = useAuth();
  const [signals, setSignals] = useState<OperationalSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchSignals();
    }
  }, [profile?.id]);

  const fetchSignals = async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('operational_signals')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_active', true)
      .order('detected_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setSignals(data as OperationalSignal[]);
    }
    setLoading(false);
  };

  const filteredSignals = signals.filter(s => {
    if (filterSource && s.source_integration !== filterSource) return false;
    if (filterSeverity && s.severity !== filterSeverity) return false;
    return true;
  });

  const signalsBySource = signals.reduce<Record<string, number>>((acc, s) => {
    acc[s.source_integration] = (acc[s.source_integration] || 0) + 1;
    return acc;
  }, {});

  const signalsBySeverity = signals.reduce<Record<string, number>>((acc, s) => {
    acc[s.severity] = (acc[s.severity] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="h-6 w-6 text-amber-500" />
          Signal Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Real-time operational signals detected across your connected systems
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Active Signals</div>
            <div className="text-3xl font-bold mt-1">{signals.length}</div>
          </CardContent>
        </Card>
        {['hubspot', 'slack', 'quickbooks'].map(source => {
          const Icon = SOURCE_ICONS[source] || Activity;
          const count = signalsBySource[source] || 0;
          return (
            <Card key={source} className={filterSource === source ? 'ring-2 ring-blue-500' : ''}>
              <CardContent className="p-4">
                <button
                  className="w-full text-left"
                  onClick={() => setFilterSource(filterSource === source ? null : source)}
                >
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Icon className="h-4 w-4" />
                    {source.charAt(0).toUpperCase() + source.slice(1)}
                  </div>
                  <div className="text-3xl font-bold mt-1">{count}</div>
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Severity Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">Filter by severity:</span>
        {['critical', 'high', 'medium', 'low'].map(sev => (
          <Button
            key={sev}
            variant={filterSeverity === sev ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSeverity(filterSeverity === sev ? null : sev)}
          >
            {sev.charAt(0).toUpperCase() + sev.slice(1)}
            {signalsBySeverity[sev] ? ` (${signalsBySeverity[sev]})` : ''}
          </Button>
        ))}
        {(filterSource || filterSeverity) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterSource(null); setFilterSeverity(null); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Signals List */}
      {filteredSignals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">
              {signals.length === 0 ? 'No Active Signals' : 'No Signals Match Filters'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {signals.length === 0
                ? 'Connect your integrations and let Core314 detect operational patterns.'
                : 'Try adjusting your filters to see more signals.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSignals.map(signal => {
            const sevConfig = SEVERITY_CONFIG[signal.severity];
            const SourceIcon = SOURCE_ICONS[signal.source_integration] || Activity;
            const isNegative = signal.signal_type.includes('decline') || signal.signal_type.includes('overdue') || signal.signal_type.includes('stalled') || signal.signal_type.includes('low_') || signal.signal_type.includes('slow');
            const TrendIcon = isNegative ? TrendingDown : TrendingUp;

            return (
              <Card key={signal.id} className={sevConfig.border}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <TrendIcon className={`h-5 w-5 ${isNegative ? 'text-red-500' : 'text-green-500'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {signal.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge className={sevConfig.color}>
                            {signal.severity}
                          </Badge>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <SourceIcon className="h-3 w-3" />
                            {signal.source_integration}
                          </span>
                          <span className="text-xs text-gray-400">
                            {signal.confidence}% confidence
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(signal.detected_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
