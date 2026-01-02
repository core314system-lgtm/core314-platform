import { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Plus, Play, Pause, Trash2, Edit } from 'lucide-react';
import { CreateRuleModal } from '../../components/modals/CreateRuleModal';
import { EditRuleModal } from '../../components/modals/EditRuleModal';
import type { EventAutomationRule } from '../../types';

export function AutomationRulesManager() {
  const { currentOrganization } = useOrganization();
  const supabase = useSupabaseClient();
  const [rules, setRules] = useState<EventAutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<EventAutomationRule | null>(null);

  useEffect(() => {
    if (currentOrganization) {
      fetchRules();
    } else {
      // No organization - stop loading and show empty state
      setLoading(false);
      setRules([]);
    }
  }, [currentOrganization?.id]);

  const fetchRules = async () => {
    if (!currentOrganization) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const baseUrl = await getSupabaseFunctionUrl('automation-list');
      const response = await fetch(
        `${baseUrl}?organization_id=${currentOrganization.id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        setRules(data.rules || []);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    await fetchRules();
    setShowCreateModal(false);
  };

  const handleEditRule = async () => {
    await fetchRules();
    setEditingRule(null);
  };

  const handleToggleStatus = async (rule: EventAutomationRule) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const newStatus = rule.status === 'active' ? 'paused' : 'active';

      const url = await getSupabaseFunctionUrl('automation-update');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rule_id: rule.id,
            status: newStatus,
          }),
        }
      );

      if (response.ok) {
        await fetchRules();
      }
    } catch (error) {
      console.error('Error toggling rule status:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string, ruleName: string) => {
    if (!confirm(`Are you sure you want to delete "${ruleName}"?`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = await getSupabaseFunctionUrl('automation-delete');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rule_id: ruleId }),
        }
      );

      if (response.ok) {
        await fetchRules();
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  if (loading) {
    return <div className="p-6">Loading rules...</div>;
  }

  // Show organization required message if no organization is selected
  if (!currentOrganization) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Automation Rules</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure automated actions triggered by system events
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Automation rules require an organization context.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Create or select an organization to configure automation rules.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeRules = rules.filter(r => r.status !== 'archived');

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Automation Rules</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure automated actions triggered by system events
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Rule
        </Button>
      </div>

      {activeRules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No automation rules configured yet.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeRules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {rule.name}
                      <Badge variant={rule.status === 'active' ? 'default' : 'secondary'}>
                        {rule.status}
                      </Badge>
                    </CardTitle>
                    {rule.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {rule.description}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Trigger:</span>
                    <p className="text-gray-600 dark:text-gray-400">{rule.trigger_type}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Condition:</span>
                    <p className="text-gray-600 dark:text-gray-400">
                      {rule.condition.metric} {rule.condition.operator} {rule.condition.value}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Action:</span>
                    <p className="text-gray-600 dark:text-gray-400">{rule.action.type}</p>
                  </div>
                </div>

                {rule.last_triggered_at && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Last triggered: {new Date(rule.last_triggered_at).toLocaleString()}
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleStatus(rule)}
                  >
                    {rule.status === 'active' ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingRule(rule)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteRule(rule.id, rule.name)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateRuleModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateRule}
      />

      {editingRule && (
        <EditRuleModal
          open={!!editingRule}
          onOpenChange={(open) => !open && setEditingRule(null)}
          rule={editingRule}
          onSuccess={handleEditRule}
        />
      )}
    </div>
  );
}
