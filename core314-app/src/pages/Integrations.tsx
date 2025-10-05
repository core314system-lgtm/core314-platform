import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { SlackIntegration } from '../components/integrations/SlackIntegration';
import { TeamsIntegration } from '../components/integrations/TeamsIntegration';
import { M365Integration } from '../components/integrations/M365Integration';
import { OutlookIntegration } from '../components/integrations/OutlookIntegration';
import { GmailIntegration } from '../components/integrations/GmailIntegration';
import { TrelloIntegration } from '../components/integrations/TrelloIntegration';
import { SendGridIntegration } from '../components/integrations/SendGridIntegration';

export function Integrations() {
  const { user } = useAuth();
  const { subscription, canAddIntegration } = useSubscription(user?.id);

  const integrations = [
    { id: 'slack', component: SlackIntegration, name: 'Slack' },
    { id: 'teams', component: TeamsIntegration, name: 'Microsoft Teams' },
    { id: 'm365', component: M365Integration, name: 'Microsoft 365' },
    { id: 'outlook', component: OutlookIntegration, name: 'Outlook' },
    { id: 'gmail', component: GmailIntegration, name: 'Gmail' },
    { id: 'trello', component: TrelloIntegration, name: 'Trello' },
    { id: 'sendgrid', component: SendGridIntegration, name: 'SendGrid' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integrations</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your tools and services to Core314
        </p>
        <div className="mt-2">
          <Badge variant="outline">
            {subscription.tier === 'none' ? 'No active subscription' : `${subscription.tier} Plan`}
          </Badge>
          {subscription.maxIntegrations !== -1 && (
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              Limit: {subscription.maxIntegrations} integration
              {subscription.maxIntegrations !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {!canAddIntegration(0) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You've reached your integration limit for the {subscription.tier} plan. Upgrade to add
            more integrations.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map(({ id, component: Component, name }) => (
          <Card key={id}>
            <CardHeader>
              <CardTitle>{name}</CardTitle>
              <CardDescription>Configure {name} integration</CardDescription>
            </CardHeader>
            <CardContent>
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
