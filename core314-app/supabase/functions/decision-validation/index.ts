
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ValidationRequest {
  user_id?: string;
  decision_event_id: string;
  validation_rules?: {
    min_confidence?: number;
    max_risk_level?: 'low' | 'medium' | 'high' | 'critical';
    required_factors?: string[];
    approval_threshold?: number;
  };
}

interface ValidationResult {
  success: boolean;
  decision_event_id: string;
  is_valid: boolean;
  validation_status: 'passed' | 'failed' | 'requires_review';
  violations: Array<{
    rule: string;
    severity: 'warning' | 'error' | 'critical';
    message: string;
  }>;
  recommendations: string[];
  error?: string;
}

async function authenticateRequest(req: Request): Promise<{ userId: string; supabase: any }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  
  const userSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
  
  const { data: { user }, error: userError } = await userSupabase.auth.getUser(token);
  
  if (user && !userError) {
    return { userId: user.id, supabase: userSupabase };
  }
  
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    const body = await req.json();
    if (!body.user_id) {
      throw new Error('user_id required when using service role key');
    }
    
    const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    return { userId: body.user_id, supabase: serviceSupabase };
  }
  
  throw new Error('Invalid authentication token');
}

const DEFAULT_RULES = {
  min_confidence: 0.6,
  max_risk_level: 'high',
  required_factors: [],
  approval_threshold: 0.7,
};

const RISK_LEVELS = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { userId, supabase } = await authenticateRequest(req);
    const body: ValidationRequest = await req.json();
    const { decision_event_id, validation_rules = {} } = body;
    
    if (!decision_event_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: decision_event_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const rules = { ...DEFAULT_RULES, ...validation_rules };
    
    const { data: decisionEvent, error: fetchError } = await supabase
      .from('decision_events')
      .select('*')
      .eq('id', decision_event_id)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !decisionEvent) {
      throw new Error('Decision event not found or access denied');
    }
    
    const { data: factors, error: factorsError } = await supabase
      .from('decision_factors')
      .select('*')
      .eq('decision_event_id', decision_event_id)
      .eq('user_id', userId);
    
    if (factorsError) {
      console.error('Failed to fetch decision factors:', factorsError);
    }
    
    const violations: Array<{ rule: string; severity: 'warning' | 'error' | 'critical'; message: string }> = [];
    const recommendations: string[] = [];
    
    if (decisionEvent.total_confidence_score < rules.min_confidence) {
      violations.push({
        rule: 'min_confidence',
        severity: 'error',
        message: `Confidence score ${decisionEvent.total_confidence_score.toFixed(2)} is below minimum threshold ${rules.min_confidence}`,
      });
      recommendations.push('Consider gathering more data or escalating for human review');
    }
    
    const currentRiskLevel = RISK_LEVELS[decisionEvent.risk_level as keyof typeof RISK_LEVELS];
    const maxRiskLevel = RISK_LEVELS[rules.max_risk_level as keyof typeof RISK_LEVELS];
    
    if (currentRiskLevel > maxRiskLevel) {
      violations.push({
        rule: 'max_risk_level',
        severity: 'critical',
        message: `Risk level ${decisionEvent.risk_level} exceeds maximum allowed ${rules.max_risk_level}`,
      });
      recommendations.push('Escalate to senior decision maker or implement additional safeguards');
    }
    
    if (rules.required_factors.length > 0 && factors) {
      const factorNames = factors.map((f: any) => f.factor_name);
      const missingFactors = rules.required_factors.filter(rf => !factorNames.includes(rf));
      
      if (missingFactors.length > 0) {
        violations.push({
          rule: 'required_factors',
          severity: 'warning',
          message: `Missing required factors: ${missingFactors.join(', ')}`,
        });
        recommendations.push(`Collect data for missing factors: ${missingFactors.join(', ')}`);
      }
    }
    
    if (decisionEvent.requires_approval && decisionEvent.total_confidence_score < rules.approval_threshold) {
      violations.push({
        rule: 'approval_threshold',
        severity: 'warning',
        message: `Confidence ${decisionEvent.total_confidence_score.toFixed(2)} below approval threshold ${rules.approval_threshold}`,
      });
      recommendations.push('Require explicit human approval before execution');
    }
    
    if (factors && factors.length > 0) {
      const totalWeight = factors.reduce((sum: number, f: any) => sum + f.weight, 0);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        violations.push({
          rule: 'factor_weights',
          severity: 'warning',
          message: `Factor weights sum to ${totalWeight.toFixed(2)}, expected 1.0`,
        });
        recommendations.push('Normalize factor weights to sum to 1.0');
      }
    }
    
    if (decisionEvent.expires_at && new Date(decisionEvent.expires_at) < new Date()) {
      violations.push({
        rule: 'expiration',
        severity: 'error',
        message: 'Decision has expired and should not be executed',
      });
      recommendations.push('Create a new decision with updated data');
    }
    
    if (decisionEvent.status === 'executed') {
      violations.push({
        rule: 'already_executed',
        severity: 'error',
        message: 'Decision has already been executed',
      });
      recommendations.push('Review execution results before creating a new decision');
    }
    
    const hasCriticalViolations = violations.some(v => v.severity === 'critical');
    const hasErrors = violations.some(v => v.severity === 'error');
    const hasWarnings = violations.some(v => v.severity === 'warning');
    
    let validationStatus: 'passed' | 'failed' | 'requires_review';
    if (hasCriticalViolations || hasErrors) {
      validationStatus = 'failed';
    } else if (hasWarnings) {
      validationStatus = 'requires_review';
    } else {
      validationStatus = 'passed';
    }
    
    const isValid = validationStatus === 'passed';
    
    await supabase
      .from('decision_events')
      .update({
        status: isValid ? 'approved' : 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', decision_event_id)
      .eq('user_id', userId);
    
    await supabase.rpc('log_decision_event', {
      p_user_id: userId,
      p_decision_event_id: decision_event_id,
      p_event_type: isValid ? 'decision_approved' : 'decision_rejected',
      p_event_category: 'validation',
      p_event_description: `Validation ${validationStatus}: ${violations.length} violations found`,
      p_actor_id: userId,
      p_actor_type: 'system',
      p_previous_state: { status: decisionEvent.status },
      p_new_state: { status: isValid ? 'approved' : 'rejected', validation_status: validationStatus },
      p_metadata: { violations_count: violations.length, rules_applied: Object.keys(rules) },
    });
    
    const response: ValidationResult = {
      success: true,
      decision_event_id,
      is_valid: isValid,
      validation_status: validationStatus,
      violations,
      recommendations,
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('Decision Validation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
