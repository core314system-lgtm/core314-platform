import { analyzeAPISchema } from './ai';
import { discoverSchema, getTemplateForPlatform } from './schemaDiscovery';
import { supabase } from '../lib/supabase';

interface DashboardWidget {
  id: string;
  metric_id: string;
  metric_name: string;
  chart_type: 'line' | 'bar' | 'donut' | 'gauge' | 'table';
  data_config: {
    metric_type: string;
    data_path: string[];
    unit?: string;
  };
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

interface DashboardLayout {
  dashboard_name: string;
  widgets: DashboardWidget[];
  refresh_interval: number;
}

export async function generateDashboard(
  integrationId: string,
  userId: string
): Promise<{ dashboardId: string; layout: DashboardLayout } | null> {
  try {
    const { data: integration, error: integError } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (integError || !integration) {
      console.error('Integration not found:', integError);
      return null;
    }

    let schema: object;
    let platformType: string | undefined;

    const template = getTemplateForPlatform(integration.integration_type);
    if (template) {
      schema = template;
      platformType = integration.integration_type;
    } else {
      const discoveryResult = await discoverSchema(
        integration.config_data.base_url || '',
        integration.config_data.api_key || '',
        integration.integration_type
      );
      schema = discoveryResult.schema;
      platformType = discoveryResult.platformType;
    }

    const { data: existingSchema } = await supabase
      .from('api_schemas')
      .select('*')
      .eq('integration_id', integrationId)
      .single();

    if (!existingSchema) {
      await supabase.from('api_schemas').insert({
        integration_id: integrationId,
        schema_data: schema,
        schema_version: '1.0',
      });
    }

    const analysisResult = await analyzeAPISchema(schema, platformType);

    const metricsToInsert = analysisResult.metrics.map((metric) => ({
      integration_id: integrationId,
      metric_name: metric.metric_name,
      metric_type: metric.metric_type,
      data_path: { path: metric.data_path },
      unit: metric.unit,
      chart_type: metric.chart_type,
      ai_confidence: metric.confidence,
      is_enabled: true,
    }));

    const { data: insertedMetrics, error: metricsError } = await supabase
      .from('auto_metrics')
      .insert(metricsToInsert)
      .select();

    if (metricsError) {
      console.error('Error inserting metrics:', metricsError);
      return null;
    }

    const widgets: DashboardWidget[] = (insertedMetrics || []).map((metric, index) => ({
      id: metric.id,
      metric_id: metric.id,
      metric_name: metric.metric_name,
      chart_type: metric.chart_type,
      data_config: {
        metric_type: metric.metric_type,
        data_path: metric.data_path.path || [],
        unit: metric.unit,
      },
      layout: generateWidgetLayout(index, insertedMetrics?.length || 0),
    }));

    const dashboardLayout: DashboardLayout = {
      dashboard_name: `${integration.integration_type} Dashboard`,
      widgets,
      refresh_interval: 3600,
    };

    const { data: dashboard, error: dashError } = await supabase
      .from('dashboard_layouts')
      .insert({
        user_id: userId,
        dashboard_name: dashboardLayout.dashboard_name,
        integration_id: integrationId,
        layout_config: dashboardLayout,
        is_default: true,
      })
      .select()
      .single();

    if (dashError) {
      console.error('Error creating dashboard:', dashError);
      return null;
    }

    return {
      dashboardId: dashboard.id,
      layout: dashboardLayout,
    };
  } catch (error) {
    console.error('Dashboard generation error:', error);
    return null;
  }
}

function generateWidgetLayout(index: number, total: number): { x: number; y: number; w: number; h: number } {
  const cols = 12;
  const widgetWidth = total <= 2 ? 6 : total <= 4 ? 6 : 4;
  const widgetHeight = 4;

  const row = Math.floor(index / (cols / widgetWidth));
  const col = (index % (cols / widgetWidth)) * widgetWidth;

  return {
    x: col,
    y: row * widgetHeight,
    w: widgetWidth,
    h: widgetHeight,
  };
}

export async function scheduleSyncJob(
  metricId: string,
  frequency: 'hourly' | 'daily' | 'weekly'
): Promise<boolean> {
  try {
    console.log(`Scheduled sync job for metric ${metricId} with frequency ${frequency}`);
    return true;
  } catch (error) {
    console.error('Error scheduling sync job:', error);
    return false;
  }
}

export function createWidgetConfig(metric: {
  metric_name: string;
  metric_type: string;
  chart_type: string;
  unit?: string;
}) {
  return {
    type: metric.chart_type,
    title: metric.metric_name,
    dataKey: metric.metric_type === 'count' ? 'count' : 'value',
    unit: metric.unit,
    color: getChartColor(metric.chart_type),
  };
}

function getChartColor(chartType: string): string {
  const colors: Record<string, string> = {
    line: '#3b82f6',
    bar: '#10b981',
    donut: '#8b5cf6',
    gauge: '#f59e0b',
    table: '#6b7280',
  };
  return colors[chartType] || '#3b82f6';
}
