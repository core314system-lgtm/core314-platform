import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateRequest {
  integration_registry_id: string;
  test_credentials?: boolean;
}

interface ValidationResult {
  is_safe: boolean;
  risk_score: number;
  risk_factors: string[];
  url_validation: {
    is_https: boolean;
    is_private_ip: boolean;
    is_metadata_endpoint: boolean;
    host: string;
  };
  credential_test?: {
    success: boolean;
    status_code?: number;
    error?: string;
  };
  inferred_schema?: Record<string, string>;
}

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

const METADATA_HOSTS = [
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data',
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(regex => regex.test(ip));
}

function isMetadataEndpoint(host: string): boolean {
  const lowerHost = host.toLowerCase();
  return METADATA_HOSTS.some(meta => lowerHost === meta || lowerHost.endsWith('.' + meta));
}

async function resolveHost(hostname: string): Promise<string | null> {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`);
    const data = await response.json();
    if (data.Answer && data.Answer.length > 0) {
      return data.Answer[0].data;
    }
    return null;
  } catch {
    return null;
  }
}

function inferJsonSchema(obj: unknown, depth = 0): Record<string, string> {
  if (depth > 3) return { type: 'object (max depth reached)' };
  
  if (obj === null) return { type: 'null' };
  if (Array.isArray(obj)) {
    if (obj.length === 0) return { type: 'array (empty)' };
    return { type: 'array', items: JSON.stringify(inferJsonSchema(obj[0], depth + 1)) };
  }
  if (typeof obj === 'object') {
    const schema: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === 'string') schema[key] = 'string';
      else if (typeof value === 'number') schema[key] = 'number';
      else if (typeof value === 'boolean') schema[key] = 'boolean';
      else if (value === null) schema[key] = 'null';
      else if (Array.isArray(value)) schema[key] = 'array';
      else if (typeof value === 'object') schema[key] = 'object';
    }
    return schema;
  }
  return { type: typeof obj };
}

function calculateRiskScore(factors: string[]): number {
  const riskWeights: Record<string, number> = {
    'non_https': 30,
    'private_ip': 50,
    'metadata_endpoint': 50,
    'dns_resolution_failed': 15,
    'connection_failed': 20,
    'ssl_error': 25,
    'redirect_detected': 10,
    'auth_failed': 15,
    'timeout': 10,
    'invalid_response': 10,
    'custom_integration': 5,
  };

  let score = 0;
  for (const factor of factors) {
    score += riskWeights[factor] || 5;
  }
  return Math.min(score, 100);
}

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonError(401, 'unauthorized', 'Missing authorization header', corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonError(401, 'unauthorized', 'Invalid authentication', corsHeaders);
    }

    const body: ValidateRequest = await req.json();
    const { integration_registry_id, test_credentials = false } = body;

    if (!integration_registry_id) {
      return jsonError(400, 'missing_integration_id', 'integration_registry_id is required', corsHeaders);
    }

    breadcrumb.custom('validation', 'Starting integration validation', { integration_registry_id });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integration_registry')
      .select('*')
      .eq('id', integration_registry_id)
      .single();

    if (integrationError || !integration) {
      return jsonError(404, 'integration_not_found', 'Integration not found', corsHeaders);
    }

    const riskFactors: string[] = [];
    const validationResult: ValidationResult = {
      is_safe: true,
      risk_score: 0,
      risk_factors: [],
      url_validation: {
        is_https: true,
        is_private_ip: false,
        is_metadata_endpoint: false,
        host: '',
      },
    };

    if (integration.is_custom) {
      riskFactors.push('custom_integration');
    }

    const urlToValidate = integration.validation_endpoint || integration.base_url;
    
    if (urlToValidate) {
      try {
        const url = new URL(urlToValidate);
        validationResult.url_validation.host = url.hostname;

        if (url.protocol !== 'https:') {
          validationResult.url_validation.is_https = false;
          riskFactors.push('non_https');
          breadcrumb.custom('validation', 'Non-HTTPS URL detected', { url: urlToValidate });
        }

        if (isMetadataEndpoint(url.hostname)) {
          validationResult.url_validation.is_metadata_endpoint = true;
          riskFactors.push('metadata_endpoint');
          validationResult.is_safe = false;
          breadcrumb.custom('validation', 'Metadata endpoint detected', { host: url.hostname });
        }

        const resolvedIP = await resolveHost(url.hostname);
        if (resolvedIP) {
          if (isPrivateIP(resolvedIP)) {
            validationResult.url_validation.is_private_ip = true;
            riskFactors.push('private_ip');
            validationResult.is_safe = false;
            breadcrumb.custom('validation', 'Private IP detected', { ip: resolvedIP });
          }
        } else {
          riskFactors.push('dns_resolution_failed');
        }

        if (test_credentials && integration.validation_endpoint) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const testResponse = await fetch(integration.validation_endpoint, {
              method: integration.validation_method || 'GET',
              headers: {
                'User-Agent': 'Core314-Integration-Validator/1.0',
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            validationResult.credential_test = {
              success: testResponse.ok,
              status_code: testResponse.status,
            };

            if (testResponse.redirected) {
              riskFactors.push('redirect_detected');
            }

            if (testResponse.ok) {
              try {
                const responseData = await testResponse.json();
                validationResult.inferred_schema = inferJsonSchema(responseData);
              } catch {
                validationResult.inferred_schema = { type: 'non-json response' };
              }
            } else if (testResponse.status === 401 || testResponse.status === 403) {
              riskFactors.push('auth_failed');
            } else {
              riskFactors.push('invalid_response');
            }
          } catch (fetchError) {
            const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
            validationResult.credential_test = {
              success: false,
              error: errorMessage,
            };

            if (errorMessage.includes('abort')) {
              riskFactors.push('timeout');
            } else if (errorMessage.includes('SSL') || errorMessage.includes('certificate')) {
              riskFactors.push('ssl_error');
            } else {
              riskFactors.push('connection_failed');
            }
          }
        }
      } catch (urlError) {
        riskFactors.push('invalid_url');
        validationResult.is_safe = false;
      }
    }

    validationResult.risk_factors = riskFactors;
    validationResult.risk_score = calculateRiskScore(riskFactors);

    if (validationResult.risk_score >= 70) {
      validationResult.is_safe = false;
    }

    const status = validationResult.risk_score < 70 ? 'approved' : 'requires_review';

    const { data: existingReview } = await supabaseAdmin
      .from('integration_review_queue')
      .select('id')
      .eq('integration_registry_id', integration_registry_id)
      .eq('user_id', user.id)
      .single();

    if (existingReview) {
      await supabaseAdmin
        .from('integration_review_queue')
        .update({
          risk_score: validationResult.risk_score,
          status,
          validation_results: validationResult,
          inferred_schema: validationResult.inferred_schema || {},
          risk_factors: riskFactors,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingReview.id);
    } else {
      await supabaseAdmin
        .from('integration_review_queue')
        .insert({
          integration_registry_id,
          user_id: user.id,
          risk_score: validationResult.risk_score,
          status,
          validation_results: validationResult,
          inferred_schema: validationResult.inferred_schema || {},
          risk_factors: riskFactors,
        });
    }

    if (status === 'approved' && integration.is_custom) {
      await supabaseAdmin
        .from('integration_registry')
        .update({ is_enabled: true, updated_at: new Date().toISOString() })
        .eq('id', integration_registry_id);
    }

    breadcrumb.custom('validation', 'Validation complete', { 
      risk_score: validationResult.risk_score, 
      status,
      factors_count: riskFactors.length 
    });

    return new Response(
      JSON.stringify({
        success: true,
        validation: validationResult,
        status,
        message: status === 'approved' 
          ? 'Integration validated and approved' 
          : 'Integration requires manual review due to elevated risk score',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Validate integration error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}, { name: "validate-integration" }));
