import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Bot } from 'lucide-react';

interface AIInsightsPanelProps {
  insights: Array<{
    integrationName: string;
    summary: string;
    cachedAt?: string;
  }>;
  hasAccess: boolean;
}

export function AIInsightsPanel({ insights, hasAccess }: AIInsightsPanelProps) {
  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Insights
            <Badge variant="outline">Pro Feature</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-center py-4">
            Upgrade to Professional or Enterprise to unlock AI-powered insights
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.length === 0 ? (
            <p className="text-gray-600 text-center py-4">
              No insights available yet. Sync your integrations to generate insights.
            </p>
          ) : (
            insights.map((insight, idx) => (
              <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="font-semibold text-sm text-gray-700">{insight.integrationName}</div>
                <p className="text-gray-600 mt-1">{insight.summary}</p>
                {insight.cachedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Updated {new Date(insight.cachedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
