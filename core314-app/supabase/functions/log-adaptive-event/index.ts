import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/integration-utils.ts';
import { runAdaptiveLearning } from '../../utils/adaptive-learning.ts';


interface AdaptiveEventRequest {
  workflow_id: string;
  event_type: string;
  trigger_source: string;
  outcome: string;
  confidence_score: number;
  metadata?: Record<string, any>;
}

interface ValidationError {
  field: string;
  message: string;
}


function validateAdaptiveEvent(data: any): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data.workflow_id) {
    errors.push({ field: 'workflow_id', message: 'workflow_id is required' });
  } else if (typeof data.workflow_id !== 'string') {
    errors.push({ field: 'workflow_id', message: 'workflow_id must be a string (UUID)' });
  }

  if (!data.event_type) {
    errors.push({ field: 'event_type', message: 'event_type is required' });
  } else if (typeof data.event_type !== 'string') {
    errors.push({ field: 'event_type', message: 'event_type must be a string' });
  }

  if (!data.trigger_source) {
    errors.push({ field: 'trigger_source', message: 'trigger_source is required' });
  } else if (typeof data.trigger_source !== 'string') {
    errors.push({ field: 'trigger_source', message: 'trigger_source must be a string' });
  }

  if (!data.outcome) {
    errors.push({ field: 'outcome', message: 'outcome is required' });
  } else if (typeof data.outcome !== 'string') {
    errors.push({ field: 'outcome', message: 'outcome must be a string' });
  }

  if (data.confidence_score === undefined || data.confidence_score === null) {
    errors.push({ field: 'confidence_score', message: 'confidence_score is required' });
  } else if (typeof data.confidence_score !== 'number') {
    errors.push({ field: 'confidence_score', message: 'confidence_score must be a number' });
  } else if (data.confidence_score < 0 || data.confidence_score > 1) {
    errors.push({ field: 'confidence_score', message: 'confidence_score must be between 0 and 1' });
  }

  if (data.metadata !== undefined && typeof data.metadata !== 'object') {
    errors.push({ field: 'metadata', message: 'metadata must be an object' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateAuthentication(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (token === serviceRoleKey) {
      return true;
    }
  }

  const internalToken = req.headers.get('X-Internal-Token');
  if (internalToken) {
    const expectedToken = Deno.env.get('INTERNAL_WEBHOOK_TOKEN');
    if (internalToken === expectedToken) {
      return true;
    }
  }

  return false;
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!validateAuthentication(req)) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          details: 'Invalid authentication token. Provide either Bearer token (service_role) or X-Internal-Token header.'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let requestData: AdaptiveEventRequest;
    try {
      requestData = await req.json();
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON',
          details: 'Request body must be valid JSON'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const validation = validateAdaptiveEvent(requestData);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          details: validation.errors
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    await runAdaptiveLearning(requestData);

    const supabaseAdmin = createAdminClient();
    const { data: eventData, error: insertError } = await supabaseAdmin
      .from('adaptive_workflow_metrics')
      .insert({
        workflow_id: requestData.workflow_id,
        event_type: requestData.event_type,
        trigger_source: requestData.trigger_source,
        outcome: requestData.outcome,
        confidence_score: requestData.confidence_score,
        metadata: requestData.metadata || {}
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return new Response(
        JSON.stringify({
          error: 'Database error',
          details: insertError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: eventData.id,
        message: 'Adaptive workflow event logged successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
