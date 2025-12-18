import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, Plus, Bell, Mail, MessageSquare, Info, X, AlertCircle, TrendingUp, Clock, Activity, Eye, Lightbulb } from 'lucide-react';
import { AlertRule, NotificationChannel } from '../types';

// Storage key for first alert explanation dismissal
const ALERT_EXPLAINED_KEY = 'core314_alert_explained';

// Alert type display configuration
const ALERT_TYPE_CONFIG: Record<string, { label: string; description: string; icon: React.ReactNode; priority: 'informational' | 'attention' | 'review' }> = {
  threshold: {
    label: 'Operational Signal',
    description: 'This alert monitors when a metric crosses a defined threshold.',
    icon: <Activity className="h-4 w-4" />,
    priority: 'attention',
  },
  anomaly: {
    label: 'Anomaly Detected',
    description: 'This alert was triggered by an unusual pattern in your operational data.',
    icon: <AlertCircle className="h-4 w-4" />,
    priority: 'review',
  },
  forecast: {
    label: 'Trend Change',
    description: 'This alert indicates a predicted change based on historical patterns.',
    icon: <TrendingUp className="h-4 w-4" />,
    priority: 'informational',
  },
  schedule: {
    label: 'Scheduled Check',
    description: 'This alert runs on a regular schedule to monitor system health.',
    icon: <Clock className="h-4 w-4" />,
    priority: 'informational',
  },
};

// Priority display configuration
const PRIORITY_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  informational: {
    label: 'Informational',
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    icon: <Info className="h-3 w-3" />,
  },
  attention: {
    label: 'Attention Recommended',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    icon: <Eye className="h-3 w-3" />,
  },
  review: {
    label: 'Review Suggested',
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
    icon: <Lightbulb className="h-3 w-3" />,
  },
};

// First Alert Explainability Component
function FirstAlertExplainer({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-6 rounded-lg border border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center">
            <Bell className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Understanding Alerts in Core314
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Alerts are operational signals that help you stay aware of changes across your connected systems. They are generated when patterns shift, thresholds are crossed, or scheduled checks complete.
            </p>
            
            <div className="mb-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-md">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Alerts vs. AI Insights:</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span><strong>Alerts</strong> are signals — they tell you something changed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span><strong>AI Insights</strong> are interpretive — they suggest what it might mean</span>
                </li>
              </ul>
            </div>

            <div className="mb-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-md">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">How to use alerts:</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">→</span>
                  <span>Use alerts to stay aware of changes in your operations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">→</span>
                  <span>Use AI Insights to understand possible actions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">→</span>
                  <span>Not all alerts require action — many are informational</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-500 italic">
              Note: Alerts are signals, not errors. They help you stay informed without requiring immediate action.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4 mr-1" />
          Got it
        </Button>
      </div>
    </div>
  );
}

export default function Notifications() {
  const { user } = useAuth();
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for first alert explainer visibility
  const [showExplainer, setShowExplainer] = useState(() => {
    return !localStorage.getItem(ALERT_EXPLAINED_KEY);
  });

  useEffect(() => {
    if (user) {
      fetchAlertRules();
      fetchChannels();
    }
  }, [user]);

  const handleDismissExplainer = () => {
    localStorage.setItem(ALERT_EXPLAINED_KEY, 'true');
    setShowExplainer(false);
  };

  const fetchAlertRules = async () => {
    try {
      const { data, error } = await supabase
        .from('alert_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlertRules(data || []);
    } catch (error) {
      console.error('Error fetching alert rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_channels')
        .select('*');

      if (error) throw error;
      setChannels(data || []);
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'slack':
        return <MessageSquare className="h-4 w-4" />;
      case 'teams':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notifications & Alerts</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure alert rules and notification channels for important events
        </p>
      </div>

      {/* First Alert Explainer - shows only once per user */}
      {showExplainer && alertRules.length > 0 && (
        <FirstAlertExplainer onDismiss={handleDismissExplainer} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Alert Rules</h2>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </div>

          {alertRules.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No alert rules configured yet
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                    Alerts help you stay aware of changes in your operations. They are signals, not errors.
                  </p>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Rule
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {alertRules.map((rule) => {
                const typeConfig = ALERT_TYPE_CONFIG[rule.rule_type] || {
                  label: 'Alert',
                  description: 'This alert monitors your operational data.',
                  icon: <Bell className="h-4 w-4" />,
                  priority: 'informational' as const,
                };
                const priorityConfig = PRIORITY_CONFIG[typeConfig.priority];
                
                return (
                  <Card key={rule.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className="text-gray-500">{typeConfig.icon}</span>
                          {rule.rule_name}
                        </CardTitle>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      {/* Alert Type Label */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {typeConfig.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${priorityConfig.className}`}>
                          {priorityConfig.icon}
                          {priorityConfig.label}
                        </span>
                      </div>
                      
                      {/* Inline Explanation */}
                      <CardDescription className="text-sm">
                        {typeConfig.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Notification Channels</h2>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Channel
            </Button>
          </div>

          {channels.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No notification channels configured
                  </p>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Channel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {channels.map((channel) => (
                <Card key={channel.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getChannelIcon(channel.channel_type)}
                        {channel.channel_type.toUpperCase()}
                      </CardTitle>
                      <div className="flex gap-2">
                        {channel.is_default && <Badge variant="secondary">Default</Badge>}
                        <Badge variant={channel.is_verified ? 'default' : 'outline'}>
                          {channel.is_verified ? 'Verified' : 'Unverified'}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {channel.channel_config.address || channel.channel_config.webhook_url || 'Configured'}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
