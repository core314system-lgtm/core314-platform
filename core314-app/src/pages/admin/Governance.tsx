import { useState, useEffect } from 'react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { GovernancePolicy, GovernanceAudit } from '../../types';

interface GovernanceSummary {
  total_decisions: number;
  approved: number;
  flagged: number;
  halted: number;
  auto_adjusted: number;
  approval_rate: number;
  flag_rate: number;
  halt_rate: number;
  avg_ethical_risk: number;
}

interface TopPolicy {
  policy: string;
  count: number;
}

interface TimeSeriesData {
  date: string;
  flagged: number;
  halted: number;
  approved: number;
}

export function Governance() {
  const { currentOrganization } = useOrganization();
  const supabase = useSupabaseClient();
  const [policies, setPolicies] = useState<GovernancePolicy[]>([]);
  const [audits, setAudits] = useState<GovernanceAudit[]>([]);
  const [summary, setSummary] = useState<GovernanceSummary | null>(null);
  const [topPolicies, setTopPolicies] = useState<TopPolicy[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization) {
      fetchGovernanceData();
    }
  }, [currentOrganization?.id]);

  const fetchGovernanceData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

            const policiesUrl = await getSupabaseFunctionUrl('governance-policies');
            const summaryBaseUrl = await getSupabaseFunctionUrl('governance-summary');
            const [policiesRes, auditsRes, summaryRes] = await Promise.all([
              fetch(policiesUrl, {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
              }),
              supabase
                .from('fusion_governance_audit')
                .select('*')
                .eq('organization_id', currentOrganization!.id)
                .order('created_at', { ascending: false })
                .limit(50),
              fetch(
                `${summaryBaseUrl}?organization_id=${currentOrganization!.id}&days=30`,
                { headers: { 'Authorization': `Bearer ${session.access_token}` } }
              ),
            ]);

      const policiesData = await policiesRes.json();
      if (policiesRes.ok) {
        setPolicies(policiesData.policies || []);
      }

      if (!auditsRes.error) {
        setAudits(auditsRes.data || []);
      }

      const summaryData = await summaryRes.json();
      if (summaryRes.ok) {
        setSummary(summaryData.summary);
        setTopPolicies(summaryData.top_policies || []);
        setTimeSeries(summaryData.time_series || []);
        setAiSummary(summaryData.ai_summary || '');
      }
    } catch (error) {
      console.error('Error fetching governance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGovernanceData();
    setRefreshing(false);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'flagged':
        return <Badge variant="secondary" className="bg-yellow-600"><AlertTriangle className="h-3 w-3 mr-1" />Flagged</Badge>;
      case 'halted':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Halted</Badge>;
      case 'auto_adjusted':
        return <Badge variant="default" className="bg-blue-600"><RefreshCw className="h-3 w-3 mr-1" />Auto-Adjusted</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  const getPolicyTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      confidence: 'bg-blue-600',
      fairness: 'bg-purple-600',
      audit: 'bg-gray-600',
      risk: 'bg-orange-600',
      ethics: 'bg-pink-600',
    };
    return <Badge className={colors[type] || 'bg-gray-600'}>{type}</Badge>;
  };

  if (loading) {
    return <div className="p-6">Loading governance data...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="h-8 w-8" />
            AI Governance & Ethics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Autonomous governance oversight and explainability
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Data
            </>
          )}
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Decisions Reviewed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_decisions}</div>
              <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Approval Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {summary.approval_rate.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {summary.approved} approved
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Flagged for Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {summary.flag_rate.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {summary.flagged} flagged
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Avg Ethical Risk Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.avg_ethical_risk.toFixed(3)}
              </div>
              <p className="text-xs text-gray-500 mt-1">0-1 scale</p>
            </CardContent>
          </Card>
        </div>
      )}

      {aiSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Governance Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {aiSummary}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Flagged Decisions Over Time (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip labelFormatter={(date) => new Date(date).toLocaleDateString()} />
                  <Line type="monotone" dataKey="flagged" stroke="#f59e0b" strokeWidth={2} name="Flagged" />
                  <Line type="monotone" dataKey="halted" stroke="#ef4444" strokeWidth={2} name="Halted" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Triggered Policies</CardTitle>
          </CardHeader>
          <CardContent>
            {topPolicies.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topPolicies}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="policy" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No policy data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Governance Policies</CardTitle>
        </CardHeader>
        <CardContent>
          {policies.filter(p => p.active).length === 0 ? (
            <p className="text-gray-500 text-center py-8">No active policies</p>
          ) : (
            <div className="space-y-2">
              {policies.filter(p => p.active).map((policy) => (
                <div 
                  key={policy.id}
                  className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {policy.policy_name}
                      </span>
                      {getPolicyTypeBadge(policy.policy_type)}
                    </div>
                    {policy.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {policy.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Condition: {policy.condition.metric} {policy.condition.operator} {policy.condition.value}
                      {' → '}
                      Action: {policy.action.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Decision Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No governance decisions yet</p>
          ) : (
            <div className="space-y-3">
              {audits.map((audit) => (
                <div 
                  key={audit.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-gray-900 dark:text-white capitalize">
                            {audit.event_type.replace('_', ' ')}
                          </span>
                          {getActionBadge(audit.governance_action)}
                          {audit.ethical_risk_score !== null && (
                            <Badge variant="outline">
                              Risk: {audit.ethical_risk_score.toFixed(3)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(audit.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedAudit(
                          expandedAudit === audit.id ? null : audit.id
                        )}
                      >
                        {expandedAudit === audit.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {expandedAudit === audit.id && (
                      <div className="mt-4 space-y-3 pt-4 border-t">
                        {audit.explanation && (
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                              AI Explanation
                            </h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {audit.explanation}
                            </p>
                          </div>
                        )}

                        {audit.policy_triggered.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                              Triggered Policies
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {audit.policy_triggered.map((policy, idx) => (
                                <Badge key={idx} variant="secondary">
                                  {policy}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                            Decision Context
                          </h4>
                          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto">
                            {JSON.stringify(audit.decision_context, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
