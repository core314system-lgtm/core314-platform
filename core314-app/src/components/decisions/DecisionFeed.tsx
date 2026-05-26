import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { DecisionDetailModal } from './DecisionDetailModal';
import { 
  Brain, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DecisionEvent {
  id: string;
  decision_type: string;
  trigger_source: string;
  context_data: any;
  reasoning_model: string;
  reasoning_response: string;
  total_confidence_score: number;
  recommended_action: string;
  action_details: any;
  expected_impact: string;
  risk_level: string;
  status: string;
  requires_approval: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}

interface DecisionFeedProps {
  userId: string;
}

export function DecisionFeed({ userId }: DecisionFeedProps) {
  const [decisions, setDecisions] = useState<DecisionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDecision, setSelectedDecision] = useState<DecisionEvent | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadDecisions();

    const channel = supabase
      .channel('decision-feed-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decision_events',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Decision event update:', payload);
          loadDecisions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function loadDecisions() {
    try {
      const { data, error } = await supabase
        .from('decision_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDecisions(data || []);
    } catch (error) {
      console.error('Failed to load decisions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(decisionId: string) {
    setActionLoading(decisionId);
    try {
      const { error } = await supabase
        .from('decision_events')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', decisionId)
        .eq('user_id', userId);

      if (error) throw error;

      const decision = decisions.find(d => d.id === decisionId);
      if (decision) {
        const { error: recError } = await supabase
          .from('recommendation_queue')
          .insert({
            user_id: userId,
            decision_event_id: decisionId,
            recommendation_type: 'action',
            recommendation_title: `Execute ${decision.decision_type} decision`,
            recommendation_description: decision.reasoning_response || 'AI-recommended action',
            recommendation_rationale: decision.expected_impact,
            action_type: 'create_task',
            action_target: 'internal',
            action_payload: decision.action_details,
            priority: decision.priority,
            urgency: decision.risk_level === 'critical' ? 'critical' : 'medium',
            requires_approval: false,
            approval_status: 'auto_approved',
          });

        if (recError) throw recError;
      }

      loadDecisions();
    } catch (error) {
      console.error('Failed to approve decision:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(decisionId: string) {
    setActionLoading(decisionId);
    try {
      const { error } = await supabase
        .from('decision_events')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', decisionId)
        .eq('user_id', userId);

      if (error) throw error;
      loadDecisions();
    } catch (error) {
      console.error('Failed to reject decision:', error);
    } finally {
      setActionLoading(null);
    }
  }

  function getRiskColor(riskLevel: string) {
    switch (riskLevel) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'executed': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return <Brain className="h-4 w-4" />;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <Brain className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No decisions yet</p>
          <p className="text-sm text-muted-foreground">
            AI decisions will appear here as they are generated
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {decisions.map((decision) => (
          <Card key={decision.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(decision.status)}
                    <CardTitle className="text-lg">
                      {decision.decision_type.charAt(0).toUpperCase() + decision.decision_type.slice(1)} Decision
                    </CardTitle>
                    <Badge variant="outline" className="capitalize">
                      {decision.trigger_source}
                    </Badge>
                    <Badge className={getRiskColor(decision.risk_level)}>
                      {decision.risk_level}
                    </Badge>
                  </div>
                  <CardDescription>
                    {formatDistanceToNow(new Date(decision.created_at), { addSuffix: true })}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm font-medium">Confidence</div>
                    <div className="text-2xl font-bold text-blue-500">
                      {(decision.total_confidence_score * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Reasoning */}
                <div>
                  <div className="text-sm font-medium mb-1">AI Reasoning</div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {decision.reasoning_response || 'No reasoning provided'}
                  </p>
                </div>

                {/* Recommended Action */}
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">Recommended:</div>
                  <Badge variant="secondary" className="capitalize">
                    {decision.recommended_action}
                  </Badge>
                  {decision.expected_impact && (
                    <span className="text-sm text-muted-foreground">
                      — {decision.expected_impact}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDecision(decision)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>

                  {decision.status === 'pending' && decision.requires_approval && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(decision.id)}
                        disabled={actionLoading === decision.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(decision.id)}
                        disabled={actionLoading === decision.id}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}

                  {decision.status === 'approved' && (
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Approved
                    </Badge>
                  )}

                  {decision.status === 'rejected' && (
                    <Badge variant="outline" className="text-red-600">
                      <XCircle className="h-3 w-3 mr-1" />
                      Rejected
                    </Badge>
                  )}

                  {decision.status === 'executed' && (
                    <Badge variant="outline" className="text-blue-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Executed
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedDecision && (
        <DecisionDetailModal
          decision={selectedDecision}
          open={!!selectedDecision}
          onClose={() => setSelectedDecision(null)}
        />
      )}
    </>
  );
}
