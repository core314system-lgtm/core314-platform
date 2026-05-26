import { supabase } from '../lib/supabase';
import { getTemplateForPlatform } from './schemaDiscovery';
import { normalizeMetric } from './fusionEngine';

export async function syncIntegrationMetrics(
  userId: string,
  integrationId: string,
  integrationName: string
): Promise<void> {
  const template = getTemplateForPlatform(integrationName.toLowerCase());
  
  if (!template) {
    console.warn(`No template found for ${integrationName}`);
    return;
  }

  for (const metricDef of template.metrics) {
    const rawValue = generateSampleMetricValue(metricDef.type);
    
    const { data: historical } = await supabase
      .from('fusion_metrics')
      .select('raw_value')
      .eq('user_id', userId)
      .eq('integration_id', integrationId)
      .eq('metric_name', metricDef.name)
      .order('synced_at', { ascending: false })
      .limit(10);

    const historicalValues = historical?.map(h => h.raw_value) || [];
    const normalizedValue = await normalizeMetric(metricDef.type, rawValue, historicalValues);

    await supabase
      .from('fusion_metrics')
      .upsert({
        user_id: userId,
        integration_id: integrationId,
        metric_name: metricDef.name,
        metric_type: metricDef.type,
        raw_value: rawValue,
        normalized_value: normalizedValue,
        weight: getMetricWeight(metricDef.type),
        data_source: { template: integrationName },
        synced_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,integration_id,metric_name'
      });
  }
}

function generateSampleMetricValue(type: string): number {
  switch (type) {
    case 'count':
      return Math.floor(Math.random() * 1000);
    case 'sum':
      return Math.floor(Math.random() * 100000);
    case 'average':
      return Math.random() * 100;
    case 'percentage':
      return Math.random() * 100;
    case 'trend':
      return Math.random() * 10 - 5;
    default:
      return Math.random() * 100;
  }
}

function getMetricWeight(type: string): number {
  const weights: Record<string, number> = {
    count: 0.2,
    sum: 0.3,
    average: 0.25,
    percentage: 0.15,
    trend: 0.1,
  };
  return weights[type] || 0.2;
}
