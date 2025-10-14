import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { 
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../../components/ui/hover-card';
import { RefreshCw, Info } from 'lucide-react';
import { format } from 'date-fns';

interface WeightData {
  metric_name: string;
  weight: number;
  ai_confidence: number;
  variance: number;
  last_adjusted: string;
  integration_name: string;
}

export function FusionWeights() {
  const { profile } = useAuth();
  const [weights, setWeights] = useState<WeightData[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoOptimize, setAutoOptimize] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchWeights();
    }
  }, [profile?.id]);

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

  const handleRecalculate = async () => {
    if (!profile?.id) return;

    setRecalculating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: integrations } = await supabase
        .from('user_integrations')
        .select('integration_id')
        .eq('user_id', profile.id)
        .eq('status', 'active');

      if (!integrations) return;

      for (const int of integrations) {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-weights`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            userId: profile.id, 
            integrationId: int.integration_id 
          }),
        });
      }

      await fetchWeights();
    } catch (error) {
      console.error('Recalculation error:', error);
    } finally {
      setRecalculating(false);
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance < 0.2) return 'text-green-600';
    if (variance < 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getVarianceLabel = (variance: number) => {
    if (variance < 0.2) return '🟢 Stable';
    if (variance < 0.4) return '🟡 Moderate';
    return '🔴 Volatile';
  };

  return (
    <div className="p-6 space-y-6">
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
          <Button 
            onClick={handleRecalculate} 
            disabled={recalculating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
            Recalculate Now
          </Button>
        </div>
      </div>

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
                    <th className="text-left p-3">Metric</th>
                    <th className="text-center p-3">
                      <HoverCard>
                        <HoverCardTrigger>
                          <span className="flex items-center gap-1 cursor-help">
                            Variance
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
                            AI Confidence
                            <Info className="h-3 w-3" />
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent>
                          Model certainty for this metric
                        </HoverCardContent>
                      </HoverCard>
                    </th>
                    <th className="text-center p-3">Weight</th>
                    <th className="text-left p-3">Last Adjusted</th>
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
                        {(w.ai_confidence * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-center font-semibold">
                        {(w.weight * 100).toFixed(1)}%
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
    </div>
  );
}
