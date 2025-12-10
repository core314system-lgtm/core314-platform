import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useToast } from '../../hooks/use-toast';
import { Plus, Edit, Trash2, Play } from 'lucide-react';
import { format } from 'date-fns';
import { AutomationRule } from '../../types';
import { FeatureGuard } from '../../components/FeatureGuard';

export function AutomationRules() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const supabase = useSupabaseClient();
  
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [integrations, setIntegrations] = useState<string[]>([]);
  
  const [ruleName, setRuleName] = useState('');
  const [integrationName, setIntegrationName] = useState('');
  const [conditionType, setConditionType] = useState<'trend' | 'prediction' | 'anomaly' | 'summary'>('anomaly');
  const [conditionOperator, setConditionOperator] = useState<'>' | '<' | '=' | 'contains'>('contains');
  const [conditionValue, setConditionValue] = useState('');
  const [actionType, setActionType] = useState<'notify_slack' | 'notify_email' | 'adjust_weight' | 'trigger_function'>('notify_slack');
  const [actionTarget, setActionTarget] = useState('');

  useEffect(() => {
    if (profile && !isAdmin()) {
      navigate('/dashboard');
    }
  }, [profile, navigate, isAdmin]);

  useEffect(() => {
    if (profile?.id && isAdmin()) {
      fetchRules();
      fetchIntegrations();
    }
  }, [profile?.id, isAdmin]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fusion_automation_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch automation rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegrations = async () => {
    try {
      const { data } = await supabase
        .from('integrations_master')
        .select('integration_name')
        .order('integration_name');

      setIntegrations(data?.map(i => i.integration_name) || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    }
  };

  const handleOpenModal = (rule?: AutomationRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleName(rule.rule_name);
      setIntegrationName(rule.integration_name);
      setConditionType(rule.condition_type);
      setConditionOperator(rule.condition_operator);
      setConditionValue(rule.condition_value);
      setActionType(rule.action_type);
      setActionTarget(rule.action_target);
    } else {
      setEditingRule(null);
      setRuleName('');
      setIntegrationName('');
      setConditionType('anomaly');
      setConditionOperator('contains');
      setConditionValue('');
      setActionType('notify_slack');
      setActionTarget('');
    }
    setModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!ruleName || !integrationName || !conditionValue || !actionTarget) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const ruleData = {
        rule_name: ruleName,
        integration_name: integrationName,
        condition_type: conditionType,
        condition_operator: conditionOperator,
        condition_value: conditionValue,
        action_type: actionType,
        action_target: actionTarget,
        enabled: true
      };

      if (editingRule) {
        const { error } = await supabase
          .from('fusion_automation_rules')
          .update(ruleData)
          .eq('id', editingRule.id);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Rule updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('fusion_automation_rules')
          .insert(ruleData);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Rule created successfully',
        });
      }

      setModalOpen(false);
      fetchRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to save rule',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const { error } = await supabase
        .from('fusion_automation_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Rule deleted successfully',
      });
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  };

  const handleToggleRule = async (rule: AutomationRule) => {
    try {
      const { error } = await supabase
        .from('fusion_automation_rules')
        .update({ enabled: !rule.enabled })
        .eq('id', rule.id);

      if (error) throw error;
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const handleRunTest = async () => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'No active session',
          variant: 'destructive',
        });
        return;
      }

            const url = await getSupabaseFunctionUrl('fusion-auto-decide');
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ manual: true }),
            });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '✅ Test completed successfully',
          description: `Executed ${result.actionsExecuted} actions (${result.actionsSucceeded} succeeded, ${result.actionsFailed} failed)`,
        });
      } else {
        throw new Error(result.error || 'Test failed');
      }
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: '❌ Test failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  if (!profile || !isAdmin()) {
    return null;
  }

  return (
    <FeatureGuard feature="automation">
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Automation Rules
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure automated actions based on Fusion Intelligence insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRunTest} disabled={running} variant="outline">
            <Play className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
            Run Test Now
          </Button>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8">Loading rules...</p>
          ) : rules.length === 0 ? (
            <p className="text-center py-8 text-gray-600">
              No automation rules configured. Click "Add Rule" to create one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Integration</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.rule_name}</TableCell>
                    <TableCell>{rule.integration_name}</TableCell>
                    <TableCell>
                      <code className="text-xs">
                        {rule.condition_type} {rule.condition_operator} "{rule.condition_value}"
                      </code>
                    </TableCell>
                    <TableCell>
                      {rule.action_type === 'notify_slack' && '📢 Slack'}
                      {rule.action_type === 'notify_email' && '📧 Email'}
                      {rule.action_type === 'adjust_weight' && '⚖️ Adjust Weight'}
                      {rule.action_type === 'trigger_function' && '⚡ Function'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => handleToggleRule(rule)}
                      />
                    </TableCell>
                    <TableCell>{format(new Date(rule.created_at), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenModal(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
            <DialogDescription>
              Configure when and how the automation should trigger
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g., Notify on high variance"
              />
            </div>

            <div>
              <Label htmlFor="integration">Integration</Label>
              <Select value={integrationName} onValueChange={setIntegrationName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select integration" />
                </SelectTrigger>
                <SelectContent>
                  {integrations.map((int) => (
                    <SelectItem key={int} value={int}>
                      {int}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="condition-type">Condition Type</Label>
                <Select value={conditionType} onValueChange={(v) => setConditionType(v as 'trend' | 'prediction' | 'anomaly' | 'summary')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trend">Trend</SelectItem>
                    <SelectItem value="prediction">Prediction</SelectItem>
                    <SelectItem value="anomaly">Anomaly</SelectItem>
                    <SelectItem value="summary">Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="operator">Operator</Label>
                <Select value={conditionOperator} onValueChange={(v) => setConditionOperator(v as '>' | '<' | '=' | 'contains')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">">Greater than (&gt;)</SelectItem>
                    <SelectItem value="<">Less than (&lt;)</SelectItem>
                    <SelectItem value="=">Equals (=)</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  placeholder="e.g., variance or 0.45"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="action-type">Action Type</Label>
              <Select value={actionType} onValueChange={(v) => setActionType(v as 'notify_slack' | 'notify_email' | 'adjust_weight' | 'trigger_function')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notify_slack">📢 Notify Slack</SelectItem>
                  <SelectItem value="notify_email">📧 Notify Email</SelectItem>
                  <SelectItem value="adjust_weight">⚖️ Adjust Weight</SelectItem>
                  <SelectItem value="trigger_function">⚡ Trigger Function</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="action-target">Action Target</Label>
              {actionType === 'notify_slack' && (
                <Input
                  id="action-target"
                  value={actionTarget}
                  onChange={(e) => setActionTarget(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                />
              )}
              {actionType === 'notify_email' && (
                <Input
                  id="action-target"
                  value={actionTarget}
                  onChange={(e) => setActionTarget(e.target.value)}
                  placeholder='{"to":"admin@example.com","apiKey":"SG.xxx"}'
                />
              )}
              {actionType === 'adjust_weight' && (
                <Input
                  id="action-target"
                  value={actionTarget}
                  onChange={(e) => setActionTarget(e.target.value)}
                  placeholder="0.1 (10% increase) or -0.1 (10% decrease)"
                />
              )}
              {actionType === 'trigger_function' && (
                <Input
                  id="action-target"
                  value={actionTarget}
                  onChange={(e) => setActionTarget(e.target.value)}
                  placeholder="https://example.com/api/function"
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule}>
              {editingRule ? 'Update' : 'Create'} Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </FeatureGuard>
  );
}
