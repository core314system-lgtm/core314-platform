import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Play, Pause, Trash2, Edit, Activity, AlertCircle, CheckCircle } from 'lucide-react';

interface AutomationRule {
  id: string;
  rule_name: string;
  description?: string;
  metric_type: string;
  condition_operator: string;
  threshold_value: number;
  action_type: string;
  action_config: Record<string, any>;
  target_integration?: string;
  status: 'active' | 'paused' | 'disabled';
  last_triggered_at?: string;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

interface RuleTemplate {
  name: string;
  description: string;
  metric_type: string;
  condition_operator: string;
  threshold_value: number;
  action_type: string;
}

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: 'Alert if Fusion Score < 70',
    description: 'Send notification when Fusion Score drops below 70',
    metric_type: 'fusion_score',
    condition_operator: '<',
    threshold_value: 70,
    action_type: 'notify'
  },
  {
    name: 'Notify if Integration Error > 3 in 24h',
    description: 'Alert when integration errors exceed 3 in 24 hours',
    metric_type: 'anomaly_count',
    condition_operator: '>',
    threshold_value: 3,
    action_type: 'alert'
  },
  {
    name: 'Trigger Optimization if Efficiency Index < 80',
    description: 'Automatically optimize when efficiency drops below 80',
    metric_type: 'efficiency_index',
    condition_operator: '<',
    threshold_value: 80,
    action_type: 'optimize'
  },
  {
    name: 'Alert on Integration Health Degradation',
    description: 'Notify when integration health is not healthy',
    metric_type: 'integration_health',
    condition_operator: '<',
    threshold_value: 100,
    action_type: 'alert'
  }
];

export function AutomationCenter() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching automation rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRuleStatus = async (rule: AutomationRule) => {
    const newStatus = rule.status === 'active' ? 'paused' : 'active';
    
    try {
      const { error } = await supabase
        .from('automation_rules')
        .update({ status: newStatus })
        .eq('id', rule.id);

      if (error) throw error;
      await fetchRules();
    } catch (error) {
      console.error('Error updating rule status:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;

    try {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      await fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const createRuleFromTemplate = (template: RuleTemplate) => {
    setSelectedTemplate(template);
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation Center</h1>
          <p className="text-gray-600 mt-1">
            Manage Smart Agent automation rules and triggers
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Rule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Rules</p>
              <p className="text-2xl font-bold text-gray-900">{rules.length}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Rules</p>
              <p className="text-2xl font-bold text-green-600">
                {rules.filter(r => r.status === 'active').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paused Rules</p>
              <p className="text-2xl font-bold text-yellow-600">
                {rules.filter(r => r.status === 'paused').length}
              </p>
            </div>
            <Pause className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Triggers</p>
              <p className="text-2xl font-bold text-purple-600">
                {rules.reduce((sum, r) => sum + r.trigger_count, 0)}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RULE_TEMPLATES.map((template, index) => (
            <div
              key={index}
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
              onClick={() => createRuleFromTemplate(template)}
            >
              <h3 className="font-medium text-gray-900">{template.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{template.description}</p>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  {template.metric_type}
                </span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                  {template.action_type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rules List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Automation Rules</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {rules.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No automation rules created yet. Use the templates above to get started.
            </div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{rule.rule_name}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          rule.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : rule.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {rule.status}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span>
                        Metric: <strong>{rule.metric_type}</strong>
                      </span>
                      <span>
                        Condition: <strong>{rule.condition_operator} {rule.threshold_value}</strong>
                      </span>
                      <span>
                        Action: <strong>{rule.action_type}</strong>
                      </span>
                      <span>
                        Triggers: <strong>{rule.trigger_count}</strong>
                      </span>
                    </div>
                    {rule.last_triggered_at && (
                      <p className="text-xs text-gray-400 mt-2">
                        Last triggered: {new Date(rule.last_triggered_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => toggleRuleStatus(rule)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title={rule.status === 'active' ? 'Pause' : 'Activate'}
                    >
                      {rule.status === 'active' ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal would go here - simplified for now */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {selectedTemplate ? `Create Rule: ${selectedTemplate.name}` : 'Create Automation Rule'}
            </h2>
            <p className="text-gray-600 mb-4">
              Rule creation form would go here. For now, this is a placeholder.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedTemplate(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedTemplate(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
