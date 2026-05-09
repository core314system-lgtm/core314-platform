import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { UserPlus } from 'lucide-react';

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: (user: User) => void;
}

export function CreateUserModal({ open, onOpenChange, onUserCreated }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'user'>('user');
  const [subscriptionTier, setSubscriptionTier] = useState<'none' | 'intelligence' | 'command_center' | 'enterprise'>('none');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setPassword('');
    setRole('user');
    setSubscriptionTier('none');
    setError(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    try {
      if (!email || !fullName || !password) {
        throw new Error('Email, full name, and password are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch('/.netlify/functions/admin-create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email,
          fullName,
          password,
          role,
          subscriptionTier: role === 'admin' ? 'none' : subscriptionTier,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      onUserCreated(data.user);
      handleOpenChange(false);
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create User
          </DialogTitle>
          <DialogDescription>
            Create a new user account. Admin-created accounts are free of charge.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="create-fullname">Full Name</Label>
            <Input
              id="create-fullname"
              placeholder="John Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-password">Temporary Password</Label>
            <Input
              id="create-password"
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              The user can change this after their first login.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
              <SelectTrigger id="create-role">
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
            <Label htmlFor="create-tier">Subscription Plan</Label>
            <Select
              value={role === 'admin' ? 'none' : subscriptionTier}
              onValueChange={(value) => setSubscriptionTier(value as typeof subscriptionTier)}
              disabled={role === 'admin'}
            >
              <SelectTrigger id="create-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Free)</SelectItem>
                <SelectItem value="intelligence">Intelligence</SelectItem>
                <SelectItem value="command_center">Command Center</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            {role === 'admin' ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Admin accounts have global access and don't require subscriptions
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You can assign any plan at no charge. The user will not be billed.
              </p>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !email || !fullName || !password}>
            {creating ? 'Creating...' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
