import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface EditUserModalProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: (user: User) => void;
  onUserDeleted?: (userId: string) => void;
  currentUserId?: string;
  isPlatformAdmin?: boolean;
}

export function EditUserModal({ 
  user, 
  open, 
  onOpenChange, 
  onUserUpdated,
  onUserDeleted,
  currentUserId,
  isPlatformAdmin = false,
}: EditUserModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [role, setRole] = useState<'admin' | 'manager' | 'user'>(user.role);
  const [subscriptionTier, setSubscriptionTier] = useState<'none' | 'starter' | 'professional' | 'enterprise'>(user.subscription_tier);
  const [status, setStatus] = useState<boolean>(user.subscription_status === 'active');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(user.two_factor_enabled);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [hardDeleteEmailConfirm, setHardDeleteEmailConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDelete = isPlatformAdmin && currentUserId !== user.id;
  const isLastAdmin = user.is_platform_admin;

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

    const handleDelete = async () => {
      if (deleteMode === 'hard' && hardDeleteEmailConfirm !== user.email) {
        setDeleteError('Email does not match. Please type the exact email to confirm.');
        return;
      }

      setDeleting(true);
      setDeleteError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        const response = await fetch('/.netlify/functions/admin-delete-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            mode: deleteMode,
            reason: `Admin deletion via dashboard`,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Failed to ${deleteMode} delete user`);
        }

        onUserDeleted?.(user.id);
        onOpenChange(false);
        setShowDeleteConfirm(false);
      } catch (err) {
        console.error('Error deleting user:', err);
        setDeleteError(err instanceof Error ? err.message : 'Failed to delete user');
      } finally {
        setDeleting(false);
      }
    };

    const resetDeleteState = () => {
      setShowDeleteConfirm(false);
      setDeleteMode('soft');
      setHardDeleteEmailConfirm('');
      setDeleteError(null);
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

          {canDelete && !showDeleteConfirm && (
            <div className="border-t border-red-200 dark:border-red-800 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <Label className="text-red-600 dark:text-red-400 font-semibold">Danger Zone</Label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Permanently remove this user from the platform. This action may cancel their subscriptions.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLastAdmin}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </Button>
              {isLastAdmin && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Cannot delete the last platform administrator
                </p>
              )}
            </div>
          )}

          {showDeleteConfirm && (
            <div className="border-t border-red-200 dark:border-red-800 pt-4 mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <Label className="text-red-600 dark:text-red-400 font-semibold text-lg">Confirm Deletion</Label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="soft-delete"
                    name="delete-mode"
                    checked={deleteMode === 'soft'}
                    onChange={() => setDeleteMode('soft')}
                    className="h-4 w-4 text-red-600"
                  />
                  <label htmlFor="soft-delete" className="text-sm">
                    <span className="font-medium">Soft Delete</span>
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">
                      Deactivate account, cancel subscriptions, revoke sessions. Data is preserved.
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    id="hard-delete"
                    name="delete-mode"
                    checked={deleteMode === 'hard'}
                    onChange={() => setDeleteMode('hard')}
                    className="h-4 w-4 text-red-600"
                  />
                  <label htmlFor="hard-delete" className="text-sm">
                    <span className="font-medium">Hard Delete</span>
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">
                      Permanently delete user, all data, and organization memberships. Cannot be undone.
                    </span>
                  </label>
                </div>
              </div>

              {deleteMode === 'hard' && (
                <div className="space-y-2 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  <Label htmlFor="confirm-email" className="text-sm text-red-700 dark:text-red-300">
                    Type the user's email to confirm: <span className="font-mono">{user.email}</span>
                  </Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    placeholder="Enter email to confirm"
                    value={hardDeleteEmailConfirm}
                    onChange={(e) => setHardDeleteEmailConfirm(e.target.value)}
                    className="border-red-300 dark:border-red-700"
                  />
                </div>
              )}

              {deleteError && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetDeleteState}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting || (deleteMode === 'hard' && hardDeleteEmailConfirm !== user.email)}
                >
                  {deleting ? 'Deleting...' : `Confirm ${deleteMode === 'hard' ? 'Hard' : 'Soft'} Delete`}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || deleting}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || deleting || showDeleteConfirm}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
