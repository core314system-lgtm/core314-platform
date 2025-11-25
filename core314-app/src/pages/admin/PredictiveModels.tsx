import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Brain, RefreshCw, Play, TrendingUp, Calendar, Target, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../../hooks/use-toast';

interface PredictiveModel {
  id: string;
  user_id: string;
  model_name: string;
  model_type: string;
  target_metric: string;
  training_window_days: number;
  accuracy_score: number;
  mae: number;
  rmse: number;
  r_squared: number;
  is_active: boolean;
  last_trained_at: string;
  next_retrain_at: string;
  retrain_frequency_hours: number;
  created_at: string;
}

interface TrainingLog {
  id: string;
  model_id: string;
  training_duration_ms: number;
  samples_used: number;
  accuracy_score: number;
  status: string;
  created_at: string;
}

export function PredictiveModels() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [models, setModels] = useState<PredictiveModel[]>([]);
  const [trainingLogs, setTrainingLogs] = useState<Map<string, TrainingLog[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [retrainingModel, setRetrainingModel] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchModels();
    }
  }, [profile?.id]);

  const fetchModels = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data: modelData, error: modelError } = await supabase
        .from('predictive_models')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (modelError) throw modelError;

      setModels(modelData || []);

      const logsMap = new Map<string, TrainingLog[]>();
      for (const model of modelData || []) {
        const { data: logs } = await supabase
          .from('training_logs')
          .select('*')
          .eq('model_id', model.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (logs) {
          logsMap.set(model.id, logs);
        }
      }
      setTrainingLogs(logsMap);
    } catch (error) {
      console.error('Error fetching models:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch predictive models',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModel = async (modelId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('predictive_models')
        .update({ is_active: !currentStatus })
        .eq('id', modelId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Model ${!currentStatus ? 'enabled' : 'disabled'} successfully`,
      });

      fetchModels();
    } catch (error) {
      console.error('Error toggling model:', error);
      toast({
        title: 'Error',
        description: 'Failed to update model status',
        variant: 'destructive',
      });
    }
  };

  const handleManualRetrain = async (modelId: string) => {
    setRetrainingModel(modelId);
    try {
      const { data, error } = await supabase.functions.invoke('adaptive-retraining-scheduler', {
        body: { force_retrain_model_id: modelId },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: data?.message || 'Model retraining initiated successfully',
      });

      setTimeout(() => {
        fetchModels();
      }, 2000);
    } catch (error) {
      console.error('Error retraining model:', error);
      toast({
        title: 'Error',
        description: 'Failed to initiate model retraining',
        variant: 'destructive',
      });
    } finally {
      setRetrainingModel(null);
    }
  };

  const getAccuracyBadge = (score: number) => {
    if (score >= 0.9) return <Badge className="bg-green-500">Excellent ({(score * 100).toFixed(1)}%)</Badge>;
    if (score >= 0.8) return <Badge className="bg-blue-500">Good ({(score * 100).toFixed(1)}%)</Badge>;
    if (score >= 0.7) return <Badge className="bg-yellow-500">Fair ({(score * 100).toFixed(1)}%)</Badge>;
    return <Badge className="bg-red-500">Poor ({(score * 100).toFixed(1)}%)</Badge>;
  };

  const getModelTypeIcon = (type: string) => {
    switch (type) {
      case 'time_series_forecast':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'threshold_prediction':
        return <Target className="h-4 w-4 text-purple-500" />;
      default:
        return <Brain className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-600" />
            Predictive Models Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and manage AI predictive models for operational forecasting
          </p>
        </div>
        <Button onClick={fetchModels} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Models</CardTitle>
            <Brain className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{models.length}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {models.filter(m => m.is_active).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Accuracy</CardTitle>
            <Target className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {models.length > 0
                ? (models.reduce((sum, m) => sum + (m.accuracy_score || 0), 0) / models.length * 100).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              R² score across all models
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Training Status</CardTitle>
            <Zap className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              All models operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Next Retrain</CardTitle>
            <Calendar className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {models.length > 0 && models[0].next_retrain_at
                ? format(new Date(models[0].next_retrain_at), 'h:mm a')
                : 'N/A'}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Automatic retraining scheduled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Models List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </CardContent>
          </Card>
        ) : models.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-gray-500">
              No predictive models found. Train your first model to start generating forecasts.
            </CardContent>
          </Card>
        ) : (
          models.map(model => (
            <Card key={model.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getModelTypeIcon(model.model_type)}
                    <div>
                      <CardTitle className="text-lg">{model.model_name}</CardTitle>
                      <p className="text-sm text-gray-500">
                        Target: <span className="font-medium">{model.target_metric}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={model.is_active}
                      onCheckedChange={() => handleToggleModel(model.id, model.is_active)}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleManualRetrain(model.id)}
                      disabled={retrainingModel === model.id}
                    >
                      <Play className={`h-4 w-4 mr-2 ${retrainingModel === model.id ? 'animate-spin' : ''}`} />
                      Retrain Now
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Accuracy (R²)</p>
                    {getAccuracyBadge(model.accuracy_score || 0)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">MAE</p>
                    <p className="font-semibold">{model.mae?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">RMSE</p>
                    <p className="font-semibold">{model.rmse?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Training Window</p>
                    <p className="font-semibold">{model.training_window_days} days</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Last Trained</p>
                    <p className="text-sm font-medium">
                      {model.last_trained_at
                        ? format(new Date(model.last_trained_at), 'MMM d, yyyy h:mm a')
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Next Retrain</p>
                    <p className="text-sm font-medium">
                      {model.next_retrain_at
                        ? format(new Date(model.next_retrain_at), 'MMM d, yyyy h:mm a')
                        : 'Not scheduled'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Retrain Frequency</p>
                    <p className="text-sm font-medium">Every {model.retrain_frequency_hours}h</p>
                  </div>
                </div>

                {/* Training History */}
                {trainingLogs.get(model.id) && trainingLogs.get(model.id)!.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Recent Training History</p>
                    <div className="space-y-2">
                      {trainingLogs.get(model.id)!.slice(0, 3).map(log => (
                        <div key={log.id} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2">
                            {log.status === 'success' ? '✅' : '❌'}
                            <span className="text-gray-500">
                              {format(new Date(log.created_at), 'MMM d, h:mm a')}
                            </span>
                            <span className="font-medium">
                              Accuracy: {(log.accuracy_score * 100).toFixed(1)}%
                            </span>
                          </span>
                          <span className="text-gray-500">
                            {log.samples_used} samples | {(log.training_duration_ms / 1000).toFixed(1)}s
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
