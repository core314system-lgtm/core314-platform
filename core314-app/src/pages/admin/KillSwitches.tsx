import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { 
  AlertTriangle, 
  CreditCard, 
  Brain, 
  Shield, 
  UserPlus, 
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

/**
 * ============================================================================
 * PHASE 15.2: ADMIN KILL SWITCHES
 * ============================================================================
 * 
 * Emergency operational controls for admin use only:
 * - Disable Stripe billing/webhooks
 * - Pause intelligence aggregator scheduling
 * - Freeze entitlement mutations
 * - Disable new trial creation
 * 
 * NON-NEGOTIABLE RULES:
 * 1. These controls are ADMIN-ONLY
 * 2. No user-facing UI for these controls
 * 3. Changes take effect immediately
 * 4. All changes are logged for audit
 * ============================================================================
 */

interface ControlFlag {
  key: string;
  enabled: boolean;
  description: string;
  category: string;
  updated_at: string;
  updated_by: string | null;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  billing: <CreditCard className="h-5 w-5" />,
  intelligence: <Brain className="h-5 w-5" />,
  entitlements: <Shield className="h-5 w-5" />,
  trials: <UserPlus className="h-5 w-5" />,
  general: <AlertTriangle className="h-5 w-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  billing: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  intelligence: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  entitlements: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  trials: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  general: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default function AdminKillSwitches() {
  useAuth();
  const [flags, setFlags] = useState<ControlFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('system_control_flags')
        .select('*')
        .order('category', { ascending: true });

      if (fetchError) {
        console.error('Error fetching control flags:', fetchError);
        setError('Failed to load control flags. This feature requires admin access.');
        return;
      }

      setFlags(data || []);
    } catch (err) {
      console.error('Error fetching flags:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFlag = async (key: string, currentValue: boolean) => {
    try {
      setUpdating(key);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { error: updateError } = await supabase
        .from('system_control_flags')
        .update({ 
          enabled: !currentValue,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('key', key);

      if (updateError) {
        console.error('Error updating flag:', updateError);
        setError(`Failed to update ${key}. Please try again.`);
        return;
      }

      // Refresh the flags
      await fetchFlags();
    } catch (err) {
      console.error('Error toggling flag:', err);
      setError('An unexpected error occurred while updating the flag.');
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusIndicator = (enabled: boolean) => {
    if (enabled) {
      return (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          <span>Active</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <XCircle className="h-4 w-4" />
        <span>Disabled</span>
      </div>
    );
  };

  const disabledCount = flags.filter(f => !f.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Kill Switches
          </h1>
          <p className="text-muted-foreground">
            Emergency operational controls for system-wide features
          </p>
        </div>
        <Button onClick={fetchFlags} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {disabledCount > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {disabledCount} kill switch{disabledCount > 1 ? 'es' : ''} currently active
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Some system features are currently disabled. Review the status below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950">
          <CardContent className="pt-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>System Control Flags</CardTitle>
          <CardDescription>
            Toggle these switches to enable or disable system-wide features.
            Changes take effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading control flags...
            </div>
          ) : flags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No control flags found. The system_control_flags table may not be initialized.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Control</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Toggle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flags.map((flag) => (
                    <TableRow key={flag.key} className={!flag.enabled ? 'bg-red-50 dark:bg-red-950/30' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {CATEGORY_ICONS[flag.category] || CATEGORY_ICONS.general}
                          <Badge className={CATEGORY_COLORS[flag.category] || CATEGORY_COLORS.general}>
                            {flag.category}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{flag.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                          <div className="text-sm text-muted-foreground">{flag.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusIndicator(flag.enabled)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(flag.updated_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={() => toggleFlag(flag.key, flag.enabled)}
                          disabled={updating === flag.key}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kill Switch Reference</CardTitle>
          <CardDescription>
            Understanding what each kill switch controls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CreditCard className="h-5 w-5 mt-0.5 text-green-600" />
              <div>
                <p className="font-medium">Stripe Billing Enabled</p>
                <p className="text-sm text-muted-foreground">
                  When disabled, Stripe webhooks will be acknowledged but not processed.
                  No subscription changes, payment processing, or billing events will be handled.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Brain className="h-5 w-5 mt-0.5 text-blue-600" />
              <div>
                <p className="font-medium">Intelligence Aggregator Enabled</p>
                <p className="text-sm text-muted-foreground">
                  When disabled, the universal intelligence aggregator will skip scheduled runs.
                  Existing intelligence data remains intact but will not be refreshed.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 mt-0.5 text-purple-600" />
              <div>
                <p className="font-medium">Entitlement Mutations Enabled</p>
                <p className="text-sm text-muted-foreground">
                  When disabled, all entitlement changes (upgrades, downgrades, cancellations) will be blocked.
                  Users retain their current entitlements until re-enabled.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <UserPlus className="h-5 w-5 mt-0.5 text-amber-600" />
              <div>
                <p className="font-medium">Trial Creation Enabled</p>
                <p className="text-sm text-muted-foreground">
                  When disabled, new trial subscriptions cannot be created.
                  Existing trials continue to function normally.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
