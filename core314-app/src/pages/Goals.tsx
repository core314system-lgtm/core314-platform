import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Loader2, Plus, Target, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { UserGoal } from '../types';

export default function Goals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user]);

  const fetchGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('user_goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track':
        return 'bg-green-100 text-green-800';
      case 'at_risk':
        return 'bg-yellow-100 text-yellow-800';
      case 'off_track':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on_track':
        return <TrendingUp className="h-4 w-4" />;
      case 'at_risk':
        return <AlertCircle className="h-4 w-4" />;
      case 'off_track':
        return <AlertCircle className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Goals & KPIs</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your objectives and key performance indicators with AI-powered insights
          </p>
        </div>
        <Button onClick={() => navigate('/goals/create')}>
          <Plus className="h-4 w-4 mr-2" />
          New Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Target className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No goals yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first goal to start tracking your progress
              </p>
              <Button onClick={() => navigate('/goals/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((goal) => (
            <Card
              key={goal.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/goals/${goal.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5" />
                      {goal.goal_name}
                    </CardTitle>
                    <CardDescription className="uppercase text-xs font-semibold">
                      {goal.goal_type}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(goal.status)}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(goal.status)}
                      {goal.status.replace('_', ' ')}
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm font-bold">
                        {Math.round(goal.progress_percentage)}%
                      </span>
                    </div>
                    <Progress value={goal.progress_percentage} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Current</p>
                      <p className="font-semibold">{goal.current_value}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Target</p>
                      <p className="font-semibold">{goal.target_value}</p>
                    </div>
                  </div>

                  {goal.target_date && (
                    <div className="text-sm">
                      <p className="text-gray-500">Target Date</p>
                      <p className="font-semibold">
                        {new Date(goal.target_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
