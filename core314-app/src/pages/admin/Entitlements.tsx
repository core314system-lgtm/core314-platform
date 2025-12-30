import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useAuth } from '../../hooks/useAuth';
import { useEntitlements, PLAN_ENTITLEMENTS, TenantEntitlements } from '../../hooks/useEntitlements';
import { supabase } from '../../lib/supabase';
import { Search, Users, Zap, Clock, Calendar, Layers, Eye, RefreshCw } from 'lucide-react';

/**
 * ============================================================================
 * PHASE 12.4: ADMIN ENTITLEMENTS VIEW
 * ============================================================================
 * 
 * Admin Controls for Entitlements:
 * - View current entitlements for any user
 * - View active usage vs limits
 * - No admin ability to break entitlement guarantees
 * 
 * NON-NEGOTIABLE RULES:
 * 1. All integrations MUST remain visible and fully functional on all plans
 * 2. Plans may ONLY gate scale, depth, and intelligence richness — never availability
 * 3. Admins can VIEW but not BREAK entitlement guarantees
 * ============================================================================
 */

interface UserEntitlementData {
  user_id: string;
  email: string;
  full_name: string;
  subscription_tier: string;
  entitlements: TenantEntitlements;
  usage: {
    connected_integrations: number;
    fusion_contributors: number;
  };
}

export default function AdminEntitlements() {
  useAuth();
  const { entitlements: currentUserEntitlements } = useEntitlements();
  const [users, setUsers] = useState<UserEntitlementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserEntitlementData | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, subscription_tier, role')
        .order('created_at', { ascending: false })
        .limit(100);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      const { data: customEntitlements } = await supabase
        .from('tenant_entitlements')
        .select('*');

      const { data: integrations } = await supabase
        .from('user_integrations')
        .select('user_id, id');

      const { data: intelligence } = await supabase
        .from('integration_intelligence')
        .select('user_id, integration_id');

      const customEntitlementsMap = new Map(
        (customEntitlements || []).map(e => [e.user_id, e])
      );

      const integrationCountMap = new Map<string, number>();
      (integrations || []).forEach(i => {
        integrationCountMap.set(i.user_id, (integrationCountMap.get(i.user_id) || 0) + 1);
      });

      const fusionCountMap = new Map<string, number>();
      (intelligence || []).forEach(i => {
        fusionCountMap.set(i.user_id, (fusionCountMap.get(i.user_id) || 0) + 1);
      });

      const usersWithEntitlements: UserEntitlementData[] = (profiles || []).map(p => {
        const customEnt = customEntitlementsMap.get(p.id);
        const tier = p.subscription_tier || 'none';
        const isBeta = p.role === 'admin' || tier === 'enterprise';

        let entitlements: TenantEntitlements;
        if (customEnt) {
          entitlements = {
            max_connected_integrations: customEnt.max_connected_integrations ?? -1,
            max_fusion_contributors: customEnt.max_fusion_contributors ?? -1,
            intelligence_refresh_frequency: customEnt.intelligence_refresh_frequency ?? 5,
            historical_depth_days: customEnt.historical_depth_days ?? -1,
            cross_integration_depth: customEnt.cross_integration_depth ?? 'full',
            admin_visibility_scope: customEnt.admin_visibility_scope ?? 'full',
            plan_tier: customEnt.plan_tier ?? 'internal',
            is_beta_tenant: customEnt.is_beta_tenant ?? true,
          };
        } else if (isBeta) {
          entitlements = PLAN_ENTITLEMENTS.internal;
        } else {
          entitlements = PLAN_ENTITLEMENTS[tier] || PLAN_ENTITLEMENTS.none;
        }

        return {
          user_id: p.id,
          email: p.email || 'Unknown',
          full_name: p.full_name || 'Unknown User',
          subscription_tier: tier,
          entitlements,
          usage: {
            connected_integrations: integrationCountMap.get(p.id) || 0,
            fusion_contributors: fusionCountMap.get(p.id) || 0,
          },
        };
      });

      setUsers(usersWithEntitlements);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'professional': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'starter': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'internal': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatLimit = (value: number) => value === -1 ? 'Unlimited' : value.toString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entitlements</h1>
          <p className="text-muted-foreground">
            View user entitlements and usage across the platform
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Entitlements</TabsTrigger>
          <TabsTrigger value="plans">Plan Defaults</TabsTrigger>
          <TabsTrigger value="my-entitlements">My Entitlements</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Entitlements
              </CardTitle>
              <CardDescription>
                View entitlements and usage for all users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading users...
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Integrations</TableHead>
                        <TableHead>Fusion Contributors</TableHead>
                        <TableHead>Refresh Freq</TableHead>
                        <TableHead>History</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow 
                          key={user.user_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedUser(user)}
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium">{user.full_name}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getTierBadgeColor(user.entitlements.plan_tier)}>
                              {user.entitlements.plan_tier}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={
                              user.entitlements.max_connected_integrations !== -1 &&
                              user.usage.connected_integrations >= user.entitlements.max_connected_integrations
                                ? 'text-amber-600 font-medium'
                                : ''
                            }>
                              {user.usage.connected_integrations} / {formatLimit(user.entitlements.max_connected_integrations)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={
                              user.entitlements.max_fusion_contributors !== -1 &&
                              user.usage.fusion_contributors >= user.entitlements.max_fusion_contributors
                                ? 'text-amber-600 font-medium'
                                : ''
                            }>
                              {user.usage.fusion_contributors} / {formatLimit(user.entitlements.max_fusion_contributors)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {user.entitlements.intelligence_refresh_frequency} min
                          </TableCell>
                          <TableCell>
                            {formatLimit(user.entitlements.historical_depth_days)} days
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedUser && (
            <Card>
              <CardHeader>
                <CardTitle>User Details: {selectedUser.full_name}</CardTitle>
                <CardDescription>{selectedUser.email}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      Max Integrations
                    </div>
                    <div className="font-medium">
                      {formatLimit(selectedUser.entitlements.max_connected_integrations)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Using: {selectedUser.usage.connected_integrations}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Layers className="h-4 w-4" />
                      Max Fusion Contributors
                    </div>
                    <div className="font-medium">
                      {formatLimit(selectedUser.entitlements.max_fusion_contributors)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Using: {selectedUser.usage.fusion_contributors}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Refresh Frequency
                    </div>
                    <div className="font-medium">
                      {selectedUser.entitlements.intelligence_refresh_frequency} minutes
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Historical Depth
                    </div>
                    <div className="font-medium">
                      {formatLimit(selectedUser.entitlements.historical_depth_days)} days
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Layers className="h-4 w-4" />
                      Cross-Integration Depth
                    </div>
                    <div className="font-medium capitalize">
                      {selectedUser.entitlements.cross_integration_depth}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      Admin Visibility
                    </div>
                    <div className="font-medium capitalize">
                      {selectedUser.entitlements.admin_visibility_scope}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan Entitlement Defaults</CardTitle>
              <CardDescription>
                Default entitlements for each subscription tier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Max Integrations</TableHead>
                      <TableHead>Max Fusion</TableHead>
                      <TableHead>Refresh</TableHead>
                      <TableHead>History</TableHead>
                      <TableHead>Cross-Int Depth</TableHead>
                      <TableHead>Admin Scope</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(PLAN_ENTITLEMENTS).map(([tier, ent]) => (
                      <TableRow key={tier}>
                        <TableCell>
                          <Badge className={getTierBadgeColor(tier)}>
                            {tier}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatLimit(ent.max_connected_integrations)}</TableCell>
                        <TableCell>{formatLimit(ent.max_fusion_contributors)}</TableCell>
                        <TableCell>{ent.intelligence_refresh_frequency} min</TableCell>
                        <TableCell>{formatLimit(ent.historical_depth_days)} days</TableCell>
                        <TableCell className="capitalize">{ent.cross_integration_depth}</TableCell>
                        <TableCell className="capitalize">{ent.admin_visibility_scope}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-entitlements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Entitlements</CardTitle>
              <CardDescription>
                Your current plan entitlements and usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Zap className="h-4 w-4" />
                    Plan Tier
                  </div>
                  <Badge className={getTierBadgeColor(currentUserEntitlements.plan_tier)}>
                    {currentUserEntitlements.plan_tier}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Zap className="h-4 w-4" />
                    Max Integrations
                  </div>
                  <div className="font-medium">
                    {formatLimit(currentUserEntitlements.max_connected_integrations)}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Layers className="h-4 w-4" />
                    Max Fusion Contributors
                  </div>
                  <div className="font-medium">
                    {formatLimit(currentUserEntitlements.max_fusion_contributors)}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Refresh Frequency
                  </div>
                  <div className="font-medium">
                    {currentUserEntitlements.intelligence_refresh_frequency} minutes
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Historical Depth
                  </div>
                  <div className="font-medium">
                    {formatLimit(currentUserEntitlements.historical_depth_days)} days
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Layers className="h-4 w-4" />
                    Cross-Integration Depth
                  </div>
                  <div className="font-medium capitalize">
                    {currentUserEntitlements.cross_integration_depth}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    Admin Visibility
                  </div>
                  <div className="font-medium capitalize">
                    {currentUserEntitlements.admin_visibility_scope}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Beta Tenant</div>
                  <div className="font-medium">
                    {currentUserEntitlements.is_beta_tenant ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
