import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExplainabilityRequest {
  event_id?: string;
  phase?: string;
  detail?: 'summary' | 'technical';
}

interface ExplainabilityResponse {
  success: boolean;
  timestamp: string;
  explanation: string;
  context: Record<string, unknown>;
  detail_level: string;
  error?: string;
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const eventId = url.searchParams.get('event_id');
    const phase = url.searchParams.get('phase');
    const detailLevel = (url.searchParams.get('detail') || 'summary') as 'summary' | 'technical';

    if (!eventId && !phase) {
      throw new Error('Either event_id or phase parameter is required');
    }

    console.log(`Generating explanation for event_id=${eventId}, phase=${phase}, detail=${detailLevel}`);

    let explanation = '';
    let context: Record<string, unknown> = {};

    if (eventId) {
      
      const { data: calibrationEvent, error: calibrationError } = await supabase
        .from('fusion_calibration_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (calibrationEvent && !calibrationError) {
        context = {
          event_type: 'Calibration',
          event_id: calibrationEvent.id,
          action: calibrationEvent.calibration_action,
          fusion_score: calibrationEvent.fusion_score,
          confidence_level: calibrationEvent.confidence_level,
          created_at: calibrationEvent.created_at,
        };

        if (detailLevel === 'summary') {
          explanation = `The Calibration Engine triggered a "${calibrationEvent.calibration_action}" action with a fusion score of ${calibrationEvent.fusion_score.toFixed(2)} and ${calibrationEvent.confidence_level.toFixed(1)}% confidence. `;
          
          if (calibrationEvent.calibration_action === 'Amplify') {
            explanation += 'This indicates the system detected strong positive signals and increased optimization intensity.';
          } else if (calibrationEvent.calibration_action === 'Tune-Down') {
            explanation += 'This indicates the system detected declining performance and reduced optimization intensity to stabilize.';
          } else if (calibrationEvent.calibration_action === 'Monitor') {
            explanation += 'The system is maintaining current settings while closely monitoring for changes.';
          } else if (calibrationEvent.calibration_action === 'Auto-Recalibration') {
            explanation += 'The system automatically adjusted parameters to optimize performance based on recent patterns.';
          }
          
          if (calibrationEvent.notes) {
            explanation += ` Additional context: ${calibrationEvent.notes}`;
          }
        } else {
          explanation = `**Calibration Event Analysis**\n\n`;
          explanation += `Event ID: ${calibrationEvent.id}\n`;
          explanation += `Action Type: ${calibrationEvent.calibration_action}\n`;
          explanation += `Fusion Score: ${calibrationEvent.fusion_score.toFixed(4)}\n`;
          explanation += `Confidence Level: ${calibrationEvent.confidence_level.toFixed(2)}%\n`;
          explanation += `Timestamp: ${new Date(calibrationEvent.created_at).toISOString()}\n\n`;
          
          explanation += `**Technical Context:**\n`;
          explanation += `- Optimization Event ID: ${calibrationEvent.optimization_event_id || 'N/A'}\n`;
          explanation += `- Behavioral Event ID: ${calibrationEvent.behavioral_event_id || 'N/A'}\n`;
          explanation += `- Prediction Event ID: ${calibrationEvent.prediction_event_id || 'N/A'}\n\n`;
          
          explanation += `**Decision Logic:**\n`;
          explanation += `The calibration action was determined by analyzing the fusion score (weighted combination of optimization efficiency, behavioral patterns, and prediction confidence). `;
          explanation += `A fusion score of ${calibrationEvent.fusion_score.toFixed(2)} with ${calibrationEvent.confidence_level.toFixed(1)}% confidence triggered the "${calibrationEvent.calibration_action}" response.\n\n`;
          
          if (calibrationEvent.notes) {
            explanation += `**Additional Notes:** ${calibrationEvent.notes}`;
          }
        }
      }

      const { data: auditEvent, error: auditError } = await supabase
        .from('fusion_audit_log')
        .select('*')
        .eq('id', eventId)
        .single();

      if (auditEvent && !auditError) {
        context = {
          event_type: 'Audit',
          event_id: auditEvent.id,
          action_type: auditEvent.action_type,
          confidence_level: auditEvent.confidence_level,
          decision_impact: auditEvent.decision_impact,
          anomaly_detected: auditEvent.anomaly_detected,
          created_at: auditEvent.created_at,
        };

        if (detailLevel === 'summary') {
          explanation = `The Oversight system logged a "${auditEvent.action_type}" decision with ${auditEvent.confidence_level.toFixed(1)}% confidence and ${auditEvent.decision_impact} impact. `;
          
          if (auditEvent.anomaly_detected) {
            explanation += 'An anomaly was detected during this decision, indicating the fusion score variance exceeded 20% from the previous cycle. ';
          }
          
          explanation += auditEvent.decision_summary;
        } else {
          explanation = `**Audit Log Entry Analysis**\n\n`;
          explanation += `Event ID: ${auditEvent.id}\n`;
          explanation += `Action Type: ${auditEvent.action_type}\n`;
          explanation += `Confidence Level: ${auditEvent.confidence_level.toFixed(2)}%\n`;
          explanation += `Decision Impact: ${auditEvent.decision_impact}\n`;
          explanation += `Anomaly Detected: ${auditEvent.anomaly_detected ? 'YES' : 'NO'}\n`;
          explanation += `Triggered By: ${auditEvent.triggered_by}\n`;
          explanation += `Timestamp: ${new Date(auditEvent.created_at).toISOString()}\n\n`;
          
          explanation += `**Decision Summary:**\n${auditEvent.decision_summary}\n\n`;
          
          if (auditEvent.system_context) {
            explanation += `**System Context:**\n`;
            explanation += `\`\`\`json\n${JSON.stringify(auditEvent.system_context, null, 2)}\n\`\`\`\n\n`;
          }
          
          if (auditEvent.anomaly_detected) {
            explanation += `**Anomaly Analysis:**\n`;
            explanation += `This decision was flagged as anomalous because the fusion score variance exceeded the 20% threshold from the previous calibration cycle. `;
            explanation += `This indicates a significant shift in system behavior that requires attention.\n`;
          }
        }
      }

      const { data: orchestratorEvent, error: orchestratorError } = await supabase
        .from('fusion_orchestrator_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (orchestratorEvent && !orchestratorError) {
        context = {
          event_type: 'Orchestrator',
          event_id: orchestratorEvent.id,
          trigger_source: orchestratorEvent.trigger_source,
          action_taken: orchestratorEvent.action_taken,
          priority_level: orchestratorEvent.priority_level,
          policy_profile: orchestratorEvent.policy_profile,
          status: orchestratorEvent.status,
          created_at: orchestratorEvent.created_at,
        };

        const priorityText = ['Critical', 'High', 'Normal', 'Low'][orchestratorEvent.priority_level - 1] || 'Unknown';

        if (detailLevel === 'summary') {
          explanation = `The Core Orchestrator detected a ${priorityText.toLowerCase()} priority task from the ${orchestratorEvent.trigger_source} subsystem. `;
          explanation += `Action: ${orchestratorEvent.action_taken}. `;
          explanation += `Policy profile: ${orchestratorEvent.policy_profile}. `;
          explanation += `Status: ${orchestratorEvent.status}.`;
        } else {
          explanation = `**Orchestrator Event Analysis**\n\n`;
          explanation += `Event ID: ${orchestratorEvent.id}\n`;
          explanation += `Trigger Source: ${orchestratorEvent.trigger_source}\n`;
          explanation += `Priority Level: ${orchestratorEvent.priority_level} (${priorityText})\n`;
          explanation += `Policy Profile: ${orchestratorEvent.policy_profile}\n`;
          explanation += `Status: ${orchestratorEvent.status}\n`;
          explanation += `Execution Time: ${orchestratorEvent.execution_time_ms || 'N/A'}ms\n`;
          explanation += `Timestamp: ${new Date(orchestratorEvent.created_at).toISOString()}\n\n`;
          
          explanation += `**Action Taken:**\n${orchestratorEvent.action_taken}\n\n`;
          
          if (orchestratorEvent.system_state) {
            explanation += `**System State:**\n`;
            explanation += `\`\`\`json\n${JSON.stringify(orchestratorEvent.system_state, null, 2)}\n\`\`\`\n\n`;
          }
          
          explanation += `**Policy Context:**\n`;
          explanation += `The orchestrator was operating under the "${orchestratorEvent.policy_profile}" policy profile, which `;
          if (orchestratorEvent.policy_profile === 'Conservative') {
            explanation += `prioritizes system stability and minimizes automatic changes.`;
          } else if (orchestratorEvent.policy_profile === 'Aggressive') {
            explanation += `favors proactive automation and rapid adjustments to optimize performance.`;
          } else {
            explanation += `balances stability with proactive optimization.`;
          }
        }
      }

      if (!explanation) {
        throw new Error(`Event ID ${eventId} not found in any subsystem`);
      }
    } else if (phase) {
      const phaseUpper = phase.charAt(0).toUpperCase() + phase.slice(1).toLowerCase();
      
      let recentEvents: unknown[] = [];
      let avgConfidence = 0;
      let totalEvents = 0;

      if (phaseUpper === 'Calibration') {
        const { data, error } = await supabase
          .from('fusion_calibration_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (data && !error) {
          recentEvents = data;
          totalEvents = data.length;
          avgConfidence = data.reduce((sum: number, e: { confidence_level: number }) => sum + e.confidence_level, 0) / totalEvents;
        }
      } else if (phaseUpper === 'Oversight') {
        const { data, error } = await supabase
          .from('fusion_audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (data && !error) {
          recentEvents = data;
          totalEvents = data.length;
          avgConfidence = data.reduce((sum: number, e: { confidence_level: number }) => sum + e.confidence_level, 0) / totalEvents;
        }
      } else if (phaseUpper === 'Orchestrator') {
        const { data, error } = await supabase
          .from('fusion_orchestrator_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (data && !error) {
          recentEvents = data;
          totalEvents = data.length;
        }
      }

      context = {
        phase: phaseUpper,
        recent_events_count: totalEvents,
        avg_confidence: avgConfidence,
      };

      if (detailLevel === 'summary') {
        explanation = `The ${phaseUpper} subsystem has processed ${totalEvents} events recently. `;
        
        if (avgConfidence > 0) {
          explanation += `Average confidence level: ${avgConfidence.toFixed(1)}%. `;
        }
        
        if (phaseUpper === 'Calibration') {
          explanation += `The calibration engine continuously adjusts system parameters based on optimization efficiency, behavioral patterns, and prediction confidence to maintain optimal performance.`;
        } else if (phaseUpper === 'Oversight') {
          explanation += `The oversight system monitors all AI decisions for anomalies and compliance, flagging any decisions that deviate significantly from expected patterns.`;
        } else if (phaseUpper === 'Orchestrator') {
          explanation += `The orchestrator coordinates all AI subsystems, prioritizing tasks and allocating resources based on the configured policy profile.`;
        } else {
          explanation += `This subsystem is actively contributing to the overall AI intelligence framework.`;
        }
      } else {
        explanation = `**${phaseUpper} Subsystem Analysis**\n\n`;
        explanation += `Recent Activity: ${totalEvents} events\n`;
        
        if (avgConfidence > 0) {
          explanation += `Average Confidence: ${avgConfidence.toFixed(2)}%\n`;
        }
        
        explanation += `\n**Subsystem Overview:**\n`;
        
        if (phaseUpper === 'Calibration') {
          explanation += `The Fusion Calibration Engine (Phase 37) is responsible for dynamically adjusting system parameters based on real-time intelligence from optimization, behavioral, and prediction subsystems. It calculates a weighted fusion score and triggers appropriate actions (Amplify, Tune-Down, Monitor, Auto-Recalibration) to maintain optimal system performance.\n\n`;
          explanation += `**Recent Activity Pattern:**\n`;
          explanation += `The calibration engine has executed ${totalEvents} adjustments with an average confidence of ${avgConfidence.toFixed(1)}%. `;
        } else if (phaseUpper === 'Oversight') {
          explanation += `The Autonomous Fusion Oversight (Phase 38) provides transparency and compliance auditing for all AI-driven decisions. It monitors calibration actions, detects anomalies (>20% variance from previous cycle), and classifies decision impact (HIGH/MODERATE/LOW).\n\n`;
          explanation += `**Recent Activity Pattern:**\n`;
          explanation += `The oversight system has logged ${totalEvents} audit entries with an average confidence of ${avgConfidence.toFixed(1)}%. `;
        } else if (phaseUpper === 'Orchestrator') {
          explanation += `The Core Intelligence Orchestrator (Phase 39) serves as the central coordination layer, monitoring all AI subsystems and prioritizing tasks based on policy profiles (Conservative/Standard/Aggressive). It ensures harmonious operation across all intelligence layers.\n\n`;
          explanation += `**Recent Activity Pattern:**\n`;
          explanation += `The orchestrator has coordinated ${totalEvents} tasks across all subsystems. `;
        }
        
        explanation += `\n**Recent Events:**\n`;
        recentEvents.slice(0, 5).forEach((event: { id?: string; created_at?: string; calibration_action?: string; action_type?: string; trigger_source?: string }, idx: number) => {
          explanation += `${idx + 1}. ${event.id} - ${event.calibration_action || event.action_type || event.trigger_source || 'Event'} (${new Date(event.created_at || '').toLocaleString()})\n`;
        });
      }
    }

    const response: ExplainabilityResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      explanation,
      context,
      detail_level: detailLevel,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Fusion Explainability Engine error:', error);

    const errorResponse: ExplainabilityResponse = {
      success: false,
      timestamp: new Date().toISOString(),
      explanation: '',
      context: {},
      detail_level: 'summary',
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}), { name: "fusion-explainability-engine" }));