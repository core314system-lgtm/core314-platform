import { supabase } from '../lib/supabase';

interface CustomIntegrationParams {
  name: string;
  type: string;
  logoUrl?: string;
  description?: string;
}

export async function addCustomIntegration({
  name,
  type,
  logoUrl,
  description,
}: CustomIntegrationParams) {
  try {
    const { data: existing } = await supabase
      .from('integrations_master')
      .select('id')
      .eq('integration_name', name)
      .single();

    if (existing) {
      return { data: existing, error: null };
    }

    const { data, error } = await supabase
      .from('integrations_master')
      .insert({
        integration_name: name,
        integration_type: type,
        logo_url: logoUrl,
        is_core_integration: false,
        description,
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (err) {
    console.error('Error adding custom integration:', err);
    return { data: null, error: err };
  }
}
