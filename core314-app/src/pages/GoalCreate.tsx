import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function GoalCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    goal_name: '',
    goal_type: 'kpi' as 'okr' | 'kpi' | 'milestone' | 'target',
    target_metric: '',
    target_value: '',
    target_date: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const { error } = await supabase.from('user_goals').insert({
        user_id: user.id,
        goal_name: formData.goal_name,
        goal_type: formData.goal_type,
        target_metric: formData.target_metric,
        target_value: parseFloat(formData.target_value),
        target_date: formData.target_date || null,
        current_value: 0,
        status: 'on_track',
      });

      if (error) throw error;

      navigate('/goals');
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Failed to create goal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Button variant="ghost" onClick={() => navigate('/goals')} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Goals
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create New Goal</CardTitle>
          <CardDescription>
            Define a new goal or KPI to track your progress with AI-powered insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="goal_name">Goal Name</Label>
              <Input
                id="goal_name"
                value={formData.goal_name}
                onChange={(e) => setFormData({ ...formData, goal_name: e.target.value })}
                placeholder="e.g., Increase Monthly Revenue"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal_type">Goal Type</Label>
              <Select
                value={formData.goal_type}
                onValueChange={(value: 'okr' | 'kpi' | 'milestone' | 'target') => setFormData({ ...formData, goal_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kpi">KPI</SelectItem>
                  <SelectItem value="okr">OKR</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="target">Target</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_metric">Target Metric</Label>
              <Input
                id="target_metric"
                value={formData.target_metric}
                onChange={(e) => setFormData({ ...formData, target_metric: e.target.value })}
                placeholder="e.g., Monthly Revenue (USD)"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_value">Target Value</Label>
              <Input
                id="target_value"
                type="number"
                step="0.01"
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                placeholder="e.g., 100000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_date">Target Date (Optional)</Label>
              <Input
                id="target_date"
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Goal'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/goals')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
