import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Plus, Save, Play, Trash2, Copy, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

interface OrchestrationFlow {
  id: string;
  flow_name: string;
  flow_description: string;
  flow_category: string;
  trigger_type: string;
  execution_mode: string;
  is_active: boolean;
  flow_steps: any[];
  total_executions: number;
  success_rate: number;
  avg_execution_time_ms: number;
}

export function OrchestrationBuilder() {
  const { user } = useAuth();
  const [flows, setFlows] = useState<OrchestrationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState<OrchestrationFlow | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [flowCategory, setFlowCategory] = useState('notification');
  const [triggerType, setTriggerType] = useState('decision_approved');
  const [executionMode, setExecutionMode] = useState('sequential');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (user) {
      loadFlows();
    }
  }, [user]);

  const loadFlows = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('orchestration_flows')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFlows(data || []);
    } catch (error) {
      console.error('Failed to load orchestration flows:', error);
    } finally {
      setLoading(false);
    }
  };

  const createFlow = async () => {
    if (!user || !flowName) return;

    try {
      const { data, error } = await supabase
        .from('orchestration_flows')
        .insert({
          user_id: user.id,
          flow_name: flowName,
          flow_description: flowDescription,
          flow_category: flowCategory,
          trigger_type: triggerType,
          execution_mode: executionMode,
          is_active: isActive,
          flow_steps: [
            {
              id: 'step1',
              type: 'action',
              config: {
                action_type: 'send_notification',
                action_target: 'slack',
                action_payload: {
                  message: 'Notification from Core314',
                  channel: '#alerts',
                },
                priority: 5,
                urgency: 'medium',
              },
              position: { x: 100, y: 100 },
            },
          ],
        })
        .select()
        .single();

      if (error) throw error;

      setFlows([data, ...flows]);
      setIsCreating(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create flow:', error);
    }
  };

  const toggleFlowActive = async (flowId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('orchestration_flows')
        .update({ is_active: !currentState })
        .eq('id', flowId);

      if (error) throw error;

      setFlows(flows.map(f => f.id === flowId ? { ...f, is_active: !currentState } : f));
    } catch (error) {
      console.error('Failed to toggle flow:', error);
    }
  };

  const deleteFlow = async (flowId: string) => {
    if (!confirm('Are you sure you want to delete this flow?')) return;

    try {
      const { error } = await supabase
        .from('orchestration_flows')
        .delete()
        .eq('id', flowId);

      if (error) throw error;

      setFlows(flows.filter(f => f.id !== flowId));
    } catch (error) {
      console.error('Failed to delete flow:', error);
    }
  };

  const cloneFlow = async (flow: OrchestrationFlow) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('orchestration_flows')
        .insert({
          user_id: user.id,
          flow_name: `${flow.flow_name} (Copy)`,
          flow_description: flow.flow_description,
          flow_category: flow.flow_category,
          trigger_type: flow.trigger_type,
          execution_mode: flow.execution_mode,
          is_active: false,
          flow_steps: flow.flow_steps,
        })
        .select()
        .single();

      if (error) throw error;

      setFlows([data, ...flows]);
    } catch (error) {
      console.error('Failed to clone flow:', error);
    }
  };

  const resetForm = () => {
    setFlowName('');
    setFlowDescription('');
    setFlowCategory('notification');
    setTriggerType('decision_approved');
    setExecutionMode('sequential');
    setIsActive(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Orchestration Flow Builder</CardTitle>
              <CardDescription>
                Create and manage multi-step automation sequences
              </CardDescription>
            </div>
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Flow
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Orchestration Flow</DialogTitle>
                  <DialogDescription>
                    Define a new automation sequence with trigger conditions and actions
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="flow-name">Flow Name *</Label>
                    <Input
                      id="flow-name"
                      placeholder="e.g., Slack Notification on Decision Approval"
                      value={flowName}
                      onChange={(e) => setFlowName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="flow-description">Description</Label>
                    <Textarea
                      id="flow-description"
                      placeholder="Describe what this flow does..."
                      value={flowDescription}
                      onChange={(e) => setFlowDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="flow-category">Category</Label>
                      <Select value={flowCategory} onValueChange={setFlowCategory}>
                        <SelectTrigger id="flow-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="notification">Notification</SelectItem>
                          <SelectItem value="data_sync">Data Sync</SelectItem>
                          <SelectItem value="approval">Approval</SelectItem>
                          <SelectItem value="escalation">Escalation</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="trigger-type">Trigger Type</Label>
                      <Select value={triggerType} onValueChange={setTriggerType}>
                        <SelectTrigger id="trigger-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="decision_approved">Decision Approved</SelectItem>
                          <SelectItem value="recommendation_created">Recommendation Created</SelectItem>
                          <SelectItem value="threshold_exceeded">Threshold Exceeded</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="webhook">Webhook</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="execution-mode">Execution Mode</Label>
                      <Select value={executionMode} onValueChange={setExecutionMode}>
                        <SelectTrigger id="execution-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sequential">Sequential</SelectItem>
                          <SelectItem value="parallel">Parallel</SelectItem>
                          <SelectItem value="mixed">Mixed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2 pt-8">
                      <Switch
                        id="is-active"
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                      <Label htmlFor="is-active">Active</Label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsCreating(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createFlow} disabled={!flowName}>
                      <Save className="mr-2 h-4 w-4" />
                      Create Flow
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Flows List */}
          <div className="space-y-4">
            {flows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-4">No orchestration flows yet</p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Flow
                </Button>
              </div>
            ) : (
              flows.map((flow) => (
                <Card key={flow.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">{flow.flow_name}</CardTitle>
                          {flow.is_active ? (
                            <Badge variant="default" className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                          <Badge variant="outline">{flow.flow_category}</Badge>
                        </div>
                        <CardDescription>{flow.flow_description || 'No description'}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFlowActive(flow.id, flow.is_active)}
                        >
                          {flow.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cloneFlow(flow)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFlow(flow.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Trigger:</span>
                        <p className="font-medium">{flow.trigger_type}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Execution Mode:</span>
                        <p className="font-medium">{flow.execution_mode}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Steps:</span>
                        <p className="font-medium">{flow.flow_steps?.length || 0}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Executions:</span>
                        <p className="font-medium">{flow.total_executions || 0}</p>
                      </div>
                    </div>
                    {flow.total_executions > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Performance:</span>
                          <div className="flex items-center gap-4">
                            <span>
                              Success Rate: <span className="font-medium">{flow.success_rate?.toFixed(1) || 0}%</span>
                            </span>
                            <span>
                              Avg Duration: <span className="font-medium">{flow.avg_execution_time_ms?.toFixed(0) || 0}ms</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visual Flow Builder Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Visual Flow Editor</CardTitle>
          <CardDescription>
            Drag-and-drop flow builder (Coming Soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">Visual flow editor will be available in the next release</p>
            <p className="text-sm">For now, flows can be created with the form above</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
