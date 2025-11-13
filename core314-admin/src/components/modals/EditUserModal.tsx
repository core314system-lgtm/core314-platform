import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';

interface EditUserModalProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: (user: User) => void;
}

export function EditUserModal({ user, open, onOpenChange, onUserUpdated }: EditUserModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [role, setRole] = useState<'admin' | 'manager' | 'user'>(user.role);
  const [subscriptionTier, setSubscriptionTier] = useState<'none' | 'starter' | 'professional' | 'enterprise'>(user.subscription_tier);
  const [status, setStatus] = useState<boolean>(user.subscription_status === 'active');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(user.two_factor_enabled);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch('/.netlify/functions/admin-update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          role,
          subscriptionTier,
          subscriptionStatus: status ? 'active' : 'inactive',
          twoFactorEnabled,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      onUserUpdated(data.user);
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user permissions, subscription, and settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md text-sm text-gray-700 dark:text-gray-300">
              {user.full_name || 'N/A'}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md text-sm text-gray-700 dark:text-gray-300">
              {user.email}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscription">Subscription Tier</Label>
            <Select 
              value={subscriptionTier} 
              onValueChange={(value) => setSubscriptionTier(value as typeof subscriptionTier)}
              disabled={role === 'admin'}
            >
              <SelectTrigger id="subscription">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            {role === 'admin' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Admin accounts have global access and don't require subscriptions
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="status">Account Status</Label>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {status ? 'Active' : 'Inactive'}
              </div>
            </div>
            <Switch
              id="status"
              checked={status}
              onCheckedChange={setStatus}
              disabled={role === 'admin'}
            />
          </div>
          {role === 'admin' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Admin accounts are always active
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="2fa">Two-Factor Authentication</Label>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            <Switch
              id="2fa"
              checked={twoFactorEnabled}
              onCheckedChange={setTwoFactorEnabled}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
