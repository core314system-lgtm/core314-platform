import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import type { EventAutomationRule } from '../../types';

interface EditRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: EventAutomationRule;
  onSuccess: () => void;
}

export function EditRuleModal({ open, onOpenChange, rule, onSuccess }: EditRuleModalProps) {
  const [name, setName] = useState(rule.name);
  const [description, setDescription] = useState(rule.description || '');
  const [triggerType, setTriggerType] = useState(rule.trigger_type);
  const [metric, setMetric] = useState(rule.condition.metric);
  const [operator, setOperator] = useState<'<' | '>' | '<=' | '>=' | '==' | '!='>(rule.condition.operator);
  const [value, setValue] = useState(rule.condition.value.toString());
  const [actionType, setActionType] = useState<'notify_slack' | 'notify_teams' | 'notify_email' | 'log_event' | 'trigger_recalibration'>(rule.action.type);
  const [actionMessage, setActionMessage] = useState(rule.action.message || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(rule.name);
    setDescription(rule.description || '');
    setTriggerType(rule.trigger_type);
    setMetric(rule.condition.metric);
    setOperator(rule.condition.operator);
    setValue(rule.condition.value.toString());
    setActionType(rule.action.type);
    setActionMessage(rule.action.message || '');
  }, [rule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automation-update`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rule_id: rule.id,
            name,
            description,
            trigger_type: triggerType,
            condition: {
              metric,
              operator,
              value: parseFloat(value),
            },
            action: {
              type: actionType,
              message: actionMessage || `Rule "${name}" triggered`,
            },
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Automation Rule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}
          
          <div>
            <Label htmlFor="name">Rule Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="trigger">Trigger Type</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fusion_score_drop">Fusion Score Drop</SelectItem>
                  <SelectItem value="metric_threshold">Metric Threshold</SelectItem>
                  <SelectItem value="system_event">System Event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="metric">Metric</Label>
              <Input
                id="metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="operator">Operator</Label>
              <Select value={operator} onValueChange={(val) => setOperator(val as typeof operator)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="<">Less than (&lt;)</SelectItem>
                  <SelectItem value=">">Greater than (&gt;)</SelectItem>
                  <SelectItem value="<=">Less than or equal (&lt;=)</SelectItem>
                  <SelectItem value=">=">Greater than or equal (&gt;=)</SelectItem>
                  <SelectItem value="==">Equal (==)</SelectItem>
                  <SelectItem value="!=">Not equal (!=)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="value">Threshold Value</Label>
              <Input
                id="value"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="action">Action Type</Label>
            <Select value={actionType} onValueChange={(val) => setActionType(val as typeof actionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="notify_slack">Notify Slack</SelectItem>
                <SelectItem value="notify_teams">Notify Teams</SelectItem>
                <SelectItem value="notify_email">Notify Email</SelectItem>
                <SelectItem value="log_event">Log Event</SelectItem>
                <SelectItem value="trigger_recalibration">Trigger Recalibration</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="message">Action Message (Optional)</Label>
            <Textarea
              id="message"
              value={actionMessage}
              onChange={(e) => setActionMessage(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Rule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
