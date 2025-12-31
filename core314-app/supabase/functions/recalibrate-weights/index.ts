import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: users } = await supabase
      .from('user_integrations')
      .select('user_id, integration_id')
      .eq('status', 'active');

    if (!users) {
      return new Response(JSON.stringify({ error: 'No users found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const uniqueUsers = new Set(users.map(u => u.user_id));
    let recalibrated = 0;
    let totalMetrics = 0;

    for (const userId of uniqueUsers) {
      const userIntegrations = users.filter(u => u.user_id === userId);
      
      for (const { integration_id } of userIntegrations) {
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calculate-weights`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({ 
            userId, 
            integrationId: integration_id,
            eventType: 'scheduled_recalibration'
          }),
        });

        if (response.ok) {
          const data = await response.json();
          recalibrated++;
          totalMetrics += data.metricsCount || 0;
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      recalibrated,
      totalMetrics,
      message: `Scheduled recalibration completed for ${recalibrated} integrations (${totalMetrics} metrics)` 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}, { name: "recalibrate-weights" }));