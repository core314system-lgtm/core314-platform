interface SchemaTemplate {
  platform: string;
  endpoints: string[];
  metrics: Array<{
    name: string;
    type: 'count' | 'sum' | 'average' | 'percentage' | 'trend';
    path: string[];
    unit?: string;
    chartType: 'line' | 'bar' | 'donut' | 'gauge' | 'table';
  }>;
}

const PLATFORM_TEMPLATES: Record<string, SchemaTemplate> = {
  stripe: {
    platform: 'stripe',
    endpoints: ['/v1/charges', '/v1/customers', '/v1/subscriptions'],
    metrics: [
      {
        name: 'Total Revenue',
        type: 'sum',
        path: ['data', 'amount'],
        unit: 'USD',
        chartType: 'line',
      },
      {
        name: 'Customer Count',
        type: 'count',
        path: ['data'],
        chartType: 'gauge',
      },
      {
        name: 'Active Subscriptions',
        type: 'count',
        path: ['data'],
        chartType: 'bar',
      },
      {
        name: 'Monthly Recurring Revenue',
        type: 'sum',
        path: ['data', 'plan', 'amount'],
        unit: 'USD',
        chartType: 'line',
      },
    ],
  },
  asana: {
    platform: 'asana',
    endpoints: ['/api/1.0/tasks', '/api/1.0/projects'],
    metrics: [
      {
        name: 'Tasks Completed',
        type: 'count',
        path: ['data'],
        chartType: 'bar',
      },
      {
        name: 'Tasks In Progress',
        type: 'count',
        path: ['data'],
        chartType: 'gauge',
      },
      {
        name: 'Project Progress',
        type: 'percentage',
        path: ['data', 'completed_count'],
        unit: '%',
        chartType: 'donut',
      },
    ],
  },
  quickbooks: {
    platform: 'quickbooks',
    endpoints: ['/v3/invoice', '/v3/payment', '/v3/customer'],
    metrics: [
      {
        name: 'Total Invoices',
        type: 'count',
        path: ['QueryResponse', 'Invoice'],
        chartType: 'gauge',
      },
      {
        name: 'Revenue',
        type: 'sum',
        path: ['QueryResponse', 'Invoice', 'TotalAmt'],
        unit: 'USD',
        chartType: 'line',
      },
      {
        name: 'Outstanding Balance',
        type: 'sum',
        path: ['QueryResponse', 'Invoice', 'Balance'],
        unit: 'USD',
        chartType: 'bar',
      },
    ],
  },
  salesforce: {
    platform: 'salesforce',
    endpoints: ['/services/data/v54.0/sobjects/Opportunity', '/services/data/v54.0/sobjects/Lead'],
    metrics: [
      {
        name: 'Open Opportunities',
        type: 'count',
        path: ['records'],
        chartType: 'gauge',
      },
      {
        name: 'Pipeline Value',
        type: 'sum',
        path: ['records', 'Amount'],
        unit: 'USD',
        chartType: 'line',
      },
      {
        name: 'Lead Conversion Rate',
        type: 'percentage',
        path: ['records'],
        unit: '%',
        chartType: 'donut',
      },
    ],
  },
  hubspot: {
    platform: 'hubspot',
    endpoints: ['/crm/v3/objects/contacts', '/crm/v3/objects/deals'],
    metrics: [
      {
        name: 'Total Contacts',
        type: 'count',
        path: ['results'],
        chartType: 'gauge',
      },
      {
        name: 'Deal Value',
        type: 'sum',
        path: ['results', 'properties', 'amount'],
        unit: 'USD',
        chartType: 'line',
      },
      {
        name: 'Deal Stage Distribution',
        type: 'count',
        path: ['results', 'properties', 'dealstage'],
        chartType: 'donut',
      },
    ],
  },
};

export async function discoverSchema(
  baseUrl: string,
  apiKey: string,
  platformHint?: string
): Promise<{ schema: object; platformType?: string }> {
  const detectedPlatform = platformHint || detectPlatform(baseUrl);
  
  if (detectedPlatform && PLATFORM_TEMPLATES[detectedPlatform]) {
    return {
      schema: PLATFORM_TEMPLATES[detectedPlatform],
      platformType: detectedPlatform,
    };
  }

  try {
    const metaEndpoints = [
      '/.well-known/openapi.json',
      '/swagger.json',
      '/api-docs',
      '/meta',
      '/schema',
    ];

    for (const endpoint of metaEndpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (response.ok) {
          const schema = await response.json();
          return { schema, platformType: 'custom' };
        }
      } catch {
        continue;
      }
    }

    return {
      schema: { error: 'Schema discovery failed' },
      platformType: 'unknown',
    };
  } catch (error) {
    console.error('Schema discovery error:', error);
    return {
      schema: { error: 'Schema discovery failed' },
      platformType: 'unknown',
    };
  }
}

export function detectPlatform(url: string): string | undefined {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('stripe.com')) return 'stripe';
  if (urlLower.includes('asana.com')) return 'asana';
  if (urlLower.includes('quickbooks')) return 'quickbooks';
  if (urlLower.includes('salesforce')) return 'salesforce';
  if (urlLower.includes('hubspot')) return 'hubspot';
  
  return undefined;
}

export function getTemplateForPlatform(platform: string): SchemaTemplate | undefined {
  return PLATFORM_TEMPLATES[platform];
}

export function parseOpenAPISchema(openApiSpec: object): {
  endpoints: string[];
  dataModels: Array<{ name: string; fields: string[] }>;
} {
  try {
    const spec = openApiSpec as Record<string, unknown>;
    const endpoints: string[] = [];
    const dataModels: Array<{ name: string; fields: string[] }> = [];

    if (spec.paths && typeof spec.paths === 'object') {
      endpoints.push(...Object.keys(spec.paths));
    }

    if (spec.components && typeof spec.components === 'object') {
      const components = spec.components as Record<string, unknown>;
      if (components.schemas && typeof components.schemas === 'object') {
        for (const [modelName, modelSchema] of Object.entries(components.schemas)) {
          const schema = modelSchema as Record<string, unknown>;
          if (schema.properties && typeof schema.properties === 'object') {
            const fields = Object.keys(schema.properties);
            dataModels.push({ name: modelName, fields });
          } else {
            dataModels.push({ name: modelName, fields: [] });
          }
        }
      }
    }

    return { endpoints, dataModels };
  } catch (error) {
    console.error('OpenAPI parsing error:', error);
    return { endpoints: [], dataModels: [] };
  }
}
