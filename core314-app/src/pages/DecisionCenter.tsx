import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { DecisionFeed } from '../components/decisions/DecisionFeed';
import { DecisionChart } from '../components/decisions/DecisionChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Brain, TrendingUp, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface DecisionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  executed: number;
  avgConfidence: number;
  highRisk: number;
}

export function DecisionCenter() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DecisionStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    executed: 0,
    avgConfidence: 0,
    highRisk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    loadStats();
    
    const channel = supabase
      .channel('decision-center-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decision_events',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadStats();
          setRefreshKey(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function loadStats() {
    if (!user) return;

    try {
      const { data: decisions, error } = await supabase
        .from('decision_events')
        .select('status, total_confidence_score, risk_level')
        .eq('user_id', user.id);

      if (error) throw error;

      const stats: DecisionStats = {
        total: decisions?.length || 0,
        pending: decisions?.filter(d => d.status === 'pending').length || 0,
        approved: decisions?.filter(d => d.status === 'approved').length || 0,
        rejected: decisions?.filter(d => d.status === 'rejected').length || 0,
        executed: decisions?.filter(d => d.status === 'executed').length || 0,
        avgConfidence: decisions?.length
          ? decisions.reduce((sum, d) => sum + (d.total_confidence_score || 0), 0) / decisions.length
          : 0,
        highRisk: decisions?.filter(d => ['high', 'critical'].includes(d.risk_level)).length || 0,
      };

      setStats(stats);
    } catch (error) {
      console.error('Failed to load decision stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createTestDecision() {
    if (!user) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cognitive-decision-engine`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision_type: 'optimization',
          trigger_source: 'manual',
          context_data: {
            scenario: 'test_decision',
            timestamp: new Date().toISOString(),
          },
          factors: [
            {
              factor_name: 'performance_score',
              factor_category: 'technical',
              current_value: 85,
              baseline_value: 75,
              threshold_value: 90,
              weight: 0.6,
            },
            {
              factor_name: 'cost_efficiency',
              factor_category: 'financial',
              current_value: 0.78,
              baseline_value: 0.70,
              threshold_value: 0.85,
              weight: 0.4,
            },
          ],
          requires_approval: true,
          priority: 7,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create decision');
      }

      const result = await response.json();
      console.log('Decision created:', result);
      
      loadStats();
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to create test decision:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-blue-500" />
            Decision Center
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered decision intelligence and recommendation management
          </p>
        </div>
        <Button onClick={createTestDecision}>
          Create Test Decision
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Decisions</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pending} pending review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.avgConfidence * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Across all decisions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.executed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.approved} approved, {stats.rejected} rejected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.highRisk}</div>
            <p className="text-xs text-muted-foreground">
              Require careful review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="feed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="feed">Decision Feed</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-4">
          <DecisionFeed key={refreshKey} userId={user?.id || ''} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Decision Performance</CardTitle>
              <CardDescription>
                Confidence scores and outcomes over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DecisionChart userId={user?.id || ''} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
