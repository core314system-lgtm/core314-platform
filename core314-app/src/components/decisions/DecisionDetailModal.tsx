import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  FileText
} from 'lucide-react';

interface DecisionFactor {
  id: string;
  factor_name: string;
  factor_category: string;
  current_value: number;
  baseline_value: number;
  threshold_value: number;
  deviation_percent: number;
  weight: number;
  raw_score: number;
  weighted_score: number;
  confidence: number;
  context_tags: string[];
}

interface AuditLogEntry {
  id: string;
  event_type: string;
  event_description: string;
  actor_type: string;
  created_at: string;
  is_override: boolean;
}

interface DecisionDetailModalProps {
  decision: any;
  open: boolean;
  onClose: () => void;
}

export function DecisionDetailModal({ decision, open, onClose }: DecisionDetailModalProps) {
  const [factors, setFactors] = useState<DecisionFactor[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && decision) {
      loadDecisionDetails();
    }
  }, [open, decision]);

  async function loadDecisionDetails() {
    try {
      const { data: factorsData, error: factorsError } = await supabase
        .from('decision_factors')
        .select('*')
        .eq('decision_event_id', decision.id)
        .order('weighted_score', { ascending: false });

      if (factorsError) throw factorsError;
      setFactors(factorsData || []);

      const { data: auditData, error: auditError } = await supabase
        .from('decision_audit_log')
        .select('*')
        .eq('decision_event_id', decision.id)
        .order('created_at', { ascending: true });

      if (auditError) throw auditError;
      setAuditLog(auditData || []);

      if (decision.status === 'pending') {
        await runValidation();
      }
    } catch (error) {
      console.error('Failed to load decision details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function runValidation() {
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/decision-validation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            decision_event_id: decision.id,
            validation_rules: {
              min_confidence: 0.6,
              max_risk_level: 'high',
              approval_threshold: 0.7,
            },
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setValidationResult(result);
      }
    } catch (error) {
      console.error('Failed to run validation:', error);
    }
  }

  function getRiskColor(riskLevel: string) {
    switch (riskLevel) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-orange-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  }

  function getConfidenceColor(confidence: number) {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Decision Details
          </DialogTitle>
          <DialogDescription>
            Comprehensive analysis and reasoning for this AI decision
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="factors">Factors</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="audit">Audit Trail</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Decision Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Type</div>
                      <div className="text-lg capitalize">{decision.decision_type}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Trigger</div>
                      <div className="text-lg capitalize">{decision.trigger_source}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Status</div>
                      <Badge className="capitalize">{decision.status}</Badge>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Priority</div>
                      <div className="text-lg">{decision.priority}/10</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Confidence Score</div>
                      <div className={`text-2xl font-bold ${getConfidenceColor(decision.total_confidence_score)}`}>
                        {(decision.total_confidence_score * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${decision.total_confidence_score * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className={`h-4 w-4 ${getRiskColor(decision.risk_level)}`} />
                      <div className="text-sm font-medium">Risk Level</div>
                      <Badge className={getRiskColor(decision.risk_level)}>
                        {decision.risk_level}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    AI Reasoning ({decision.reasoning_model})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">
                    {decision.reasoning_response || 'No reasoning provided'}
                  </p>
                  {decision.reasoning_tokens && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      Tokens used: {decision.reasoning_tokens}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recommended Action</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">Action:</div>
                    <Badge variant="secondary" className="capitalize">
                      {decision.recommended_action}
                    </Badge>
                  </div>
                  {decision.expected_impact && (
                    <div>
                      <div className="text-sm font-medium mb-1">Expected Impact:</div>
                      <p className="text-sm text-muted-foreground">
                        {decision.expected_impact}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Factors Tab */}
            <TabsContent value="factors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Weighted Factors Analysis</CardTitle>
                  <DialogDescription>
                    {factors.length} factors analyzed with total weight of{' '}
                    {factors.reduce((sum, f) => sum + f.weight, 0).toFixed(2)}
                  </DialogDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {factors.map((factor) => (
                      <div key={factor.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{factor.factor_name}</div>
                            <div className="text-sm text-muted-foreground capitalize">
                              {factor.factor_category}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Weight</div>
                            <div className="text-lg font-bold">
                              {(factor.weight * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Current</div>
                            <div className="font-medium">{factor.current_value?.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Baseline</div>
                            <div className="font-medium">{factor.baseline_value?.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Threshold</div>
                            <div className="font-medium">{factor.threshold_value?.toFixed(2)}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="text-xs text-muted-foreground">Deviation</div>
                              <div className={`text-sm font-medium ${
                                factor.deviation_percent > 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {factor.deviation_percent > 0 ? '+' : ''}
                                {factor.deviation_percent?.toFixed(1)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Raw Score</div>
                              <div className="text-sm font-medium">
                                {factor.raw_score?.toFixed(3)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Weighted Score</div>
                              <div className="text-sm font-bold text-blue-500">
                                {factor.weighted_score?.toFixed(3)}
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Confidence</div>
                            <div className={`text-sm font-medium ${getConfidenceColor(factor.confidence)}`}>
                              {(factor.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Validation Tab */}
            <TabsContent value="validation" className="space-y-4">
              {validationResult ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className={`h-5 w-5 ${
                          validationResult.is_valid ? 'text-green-500' : 'text-red-500'
                        }`} />
                        Validation Status: {validationResult.validation_status}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {validationResult.violations && validationResult.violations.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-2">
                              Violations ({validationResult.violations.length})
                            </div>
                            <div className="space-y-2">
                              {validationResult.violations.map((violation: any, index: number) => (
                                <div
                                  key={index}
                                  className={`border-l-4 pl-3 py-2 ${
                                    violation.severity === 'critical'
                                      ? 'border-red-500'
                                      : violation.severity === 'error'
                                      ? 'border-orange-500'
                                      : 'border-yellow-500'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="capitalize">
                                      {violation.severity}
                                    </Badge>
                                    <span className="text-sm font-medium">{violation.rule}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {violation.message}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {validationResult.recommendations && validationResult.recommendations.length > 0 && (
                          <div>
                            <div className="text-sm font-medium mb-2">
                              Recommendations ({validationResult.recommendations.length})
                            </div>
                            <ul className="space-y-1">
                              {validationResult.recommendations.map((rec: string, index: number) => (
                                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center h-64">
                    <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {decision.status === 'pending'
                        ? 'Running validation...'
                        : 'Validation not available for this decision'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Audit Trail Tab */}
            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Audit Trail ({auditLog.length} events)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditLog.length > 0 ? (
                    <div className="space-y-3">
                      {auditLog.map((entry, index) => (
                        <div key={entry.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-2 h-2 rounded-full ${
                              entry.is_override ? 'bg-orange-500' : 'bg-blue-500'
                            }`} />
                            {index < auditLog.length - 1 && (
                              <div className="w-0.5 h-full bg-gray-200 my-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{entry.event_type}</span>
                              <Badge variant="outline" className="text-xs capitalize">
                                {entry.actor_type}
                              </Badge>
                              {entry.is_override && (
                                <Badge variant="outline" className="text-xs text-orange-500">
                                  Override
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {entry.event_description}
                            </p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(entry.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32">
                      <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No audit trail available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
