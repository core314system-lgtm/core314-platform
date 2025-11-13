import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Zap, TrendingUp, AlertTriangle, CheckCircle, Clock, Play, Pause } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { FeatureGuard } from '../components/FeatureGuard';
import { format } from 'date-fns';

interface OptimizationEvent {
  id: string;
  created_at: string;
  integration_name: string;
  optimization_type: string;
  efficiency_index: number;
  status: string;
  description: string;
  impact: string;
}

interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimated_impact: number;
  integration: string;
}

export function OptimizationEngine() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [optimizationEvents, setOptimizationEvents] = useState<OptimizationEvent[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [stats, setStats] = useState({
    total_optimizations: 0,
    avg_efficiency: 0,
    active_recommendations: 0,
    time_saved_hours: 0,
  });

  useEffect(() => {
    if (profile?.id) {
      fetchOptimizationData();
      fetchRecommendations();
    }
  }, [profile?.id]);

  const fetchOptimizationData = async () => {
    setLoading(true);
    try {
      const { data: events } = await supabase
        .from('fusion_optimization_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (events) {
        setOptimizationEvents(events);
        
        const totalOptimizations = events.length;
        const avgEfficiency = events.reduce((sum, e) => sum + (e.efficiency_index || 0), 0) / totalOptimizations;
        const timeSaved = totalOptimizations * 2.5;

        setStats({
          total_optimizations: totalOptimizations,
          avg_efficiency: Math.round(avgEfficiency),
          active_recommendations: recommendations.length,
          time_saved_hours: Math.round(timeSaved),
        });
      }
    } catch (error) {
      console.error('Error fetching optimization data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch optimization data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-recommendations`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.recommendations) {
          setRecommendations(result.recommendations);
        }
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const handleToggleEngine = async () => {
    setEngineEnabled(!engineEnabled);
    toast({
      title: engineEnabled ? '⏸️ Engine paused' : '▶️ Engine activated',
      description: engineEnabled 
        ? 'Proactive optimization has been paused' 
        : 'Proactive optimization is now active',
    });
  };

  const handleApplyRecommendation = async (recommendationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-analyze`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recommendationId }),
        }
      );

      if (response.ok) {
        toast({
          title: '✅ Optimization applied',
          description: 'The recommendation has been implemented',
        });
        await fetchOptimizationData();
        await fetchRecommendations();
      }
    } catch (error) {
      console.error('Error applying recommendation:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply optimization',
        variant: 'destructive',
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <FeatureGuard feature="ai_insights">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="h-8 w-8 text-yellow-500" />
              Proactive Optimization Engine™
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              AI-powered continuous optimization and performance enhancement
            </p>
          </div>
          <Button
            onClick={handleToggleEngine}
            variant={engineEnabled ? 'default' : 'outline'}
            className={engineEnabled ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {engineEnabled ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause Engine
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Activate Engine
              </>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Total Optimizations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.total_optimizations}</div>
                  <p className="text-xs text-gray-500 mt-1">Automated improvements</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Avg Efficiency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.avg_efficiency}%</div>
                  <p className="text-xs text-gray-500 mt-1">Performance improvement</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Active Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.active_recommendations}</div>
                  <p className="text-xs text-gray-500 mt-1">Pending actions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time Saved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.time_saved_hours}h</div>
                  <p className="text-xs text-gray-500 mt-1">Estimated total</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Active Recommendations
                </CardTitle>
                <CardDescription>AI-identified opportunities for optimization</CardDescription>
              </CardHeader>
              <CardContent>
                {recommendations.length > 0 ? (
                  <div className="space-y-4">
                    {recommendations.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getPriorityColor(rec.priority)}>
                              {rec.priority.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-gray-500">{rec.integration}</span>
                          </div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {rec.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {rec.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <TrendingUp className="h-3 w-3" />
                            <span>Estimated impact: +{rec.estimated_impact}% efficiency</span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleApplyRecommendation(rec.id)}
                          size="sm"
                          className="ml-4"
                        >
                          Apply
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No active recommendations. Your system is running optimally!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Recent Optimization Events
                </CardTitle>
                <CardDescription>Automated improvements applied by the engine</CardDescription>
              </CardHeader>
              <CardContent>
                {optimizationEvents.length > 0 ? (
                  <div className="space-y-3">
                    {optimizationEvents.slice(0, 20).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 border-b last:border-b-0"
                      >
                        <div className="flex items-start gap-3 flex-1">
                          {getStatusIcon(event.status)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm text-gray-900 dark:text-white">
                                {event.integration_name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {event.optimization_type}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {event.description}
                            </p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs text-gray-500">
                                {format(new Date(event.created_at), 'MMM dd, h:mm a')}
                              </span>
                              <span className="text-xs text-green-600 font-medium">
                                +{event.efficiency_index}% efficiency
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-600 py-8">No optimization events yet</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </FeatureGuard>
  );
}
