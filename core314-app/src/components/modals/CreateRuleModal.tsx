import { useState } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

interface CreateRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateRuleModal({ open, onOpenChange, onSuccess }: CreateRuleModalProps) {
  const { currentOrganization } = useOrganization();
  const supabase = useSupabaseClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('fusion_score_drop');
  const [metric, setMetric] = useState('FusionConfidence');
  const [operator, setOperator] = useState('<');
  const [value, setValue] = useState('75');
  const [actionType, setActionType] = useState('notify_slack');
  const [actionMessage, setActionMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('automation-create');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organization_id: currentOrganization?.id,
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

      setName('');
      setDescription('');
      setActionMessage('');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Automation Rule</DialogTitle>
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
              placeholder="Low Fusion Score Alert"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Send alert when fusion score drops below threshold"
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
                placeholder="FusionConfidence"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="operator">Operator</Label>
              <Select value={operator} onValueChange={setOperator}>
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
                placeholder="75"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="action">Action Type</Label>
            <Select value={actionType} onValueChange={setActionType}>
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
              placeholder="Fusion score dropped below 75%"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-sm">
            <strong>Preview:</strong> IF {metric} {operator} {value} THEN {actionType}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
