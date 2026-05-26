import { supabase, getSupabaseFunctionUrl } from '../lib/supabase';

interface CustomIntegrationParams {
  name: string;
  type: string;
  logoUrl?: string;
  description?: string;
  apiUrl?: string;
  authType?: string;
  webhookUrl?: string;
}

export async function addCustomIntegration({
  name,
  type,
  logoUrl,
  description,
  apiUrl,
  authType,
  webhookUrl,
}: CustomIntegrationParams) {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('Not authenticated');
    }

    const functionUrl = await getSupabaseFunctionUrl('register-custom-integration');
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        name,
        category: type,
        logo_url: logoUrl,
        description,
        api_base_url: apiUrl,
        auth_type: authType || 'api_key',
        webhook_url: webhookUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to register integration: ${response.status}`);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    console.error('Error adding custom integration:', err);
    return { data: null, error: err };
  }
}
