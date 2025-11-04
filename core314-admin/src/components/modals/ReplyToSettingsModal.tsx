import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { supabase } from '../../lib/supabase';
import { ReplyToAddress } from '../../types';
import { Plus, Trash2, Check } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface ReplyToSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReplyToSettingsModal({ open, onOpenChange }: ReplyToSettingsModalProps) {
  const [addresses, setAddresses] = useState<ReplyToAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newDepartment, setNewDepartment] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (open) {
      fetchAddresses();
    }
  }, [open]);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reply_to_addresses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (err) {
      console.error('Error fetching reply-to addresses:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newDepartment.trim() || !newEmail.trim()) {
      setError('Department name and email are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { data, error } = await supabase
        .from('reply_to_addresses')
        .insert({
          department_name: newDepartment.trim(),
          email_address: newEmail.trim(),
          is_default: addresses.length === 0, // First one is default
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setAddresses([data, ...addresses]);
      setNewDepartment('');
      setNewEmail('');
    } catch (err) {
      console.error('Error adding reply-to address:', err);
      setError(err instanceof Error ? err.message : 'Failed to add address');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      setSaving(true);
      setError(null);

      const { error } = await supabase
        .from('reply_to_addresses')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;

      setAddresses(addresses.map(addr => ({
        ...addr,
        is_default: addr.id === id,
      })));
    } catch (err) {
      console.error('Error setting default:', err);
      setError(err instanceof Error ? err.message : 'Failed to set default');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      setSaving(true);
      setError(null);

      const { error } = await supabase
        .from('reply_to_addresses')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;

      setAddresses(addresses.map(addr =>
        addr.id === id ? { ...addr, is_active: !currentActive } : addr
      ));
    } catch (err) {
      console.error('Error toggling active status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reply-to address?')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { error } = await supabase
        .from('reply_to_addresses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAddresses(addresses.filter(addr => addr.id !== id));
    } catch (err) {
      console.error('Error deleting reply-to address:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete address');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Manage Reply-To Addresses</DialogTitle>
          <DialogDescription>
            Add and manage department email addresses for email replies
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add New Address Form */}
          <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="font-medium text-sm">Add New Reply-To Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department Name</Label>
                <Input
                  id="department"
                  placeholder="e.g., Support, Sales, HR"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g., support@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={saving || !newDepartment.trim() || !newEmail.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Address
            </Button>
          </div>

          {/* Existing Addresses Table */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm">Existing Reply-To Addresses</h3>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No reply-to addresses configured yet
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addresses.map((address) => (
                      <TableRow key={address.id}>
                        <TableCell className="font-medium">{address.department_name}</TableCell>
                        <TableCell>{address.email_address}</TableCell>
                        <TableCell>
                          {address.is_default ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefault(address.id)}
                              disabled={saving}
                            >
                              Set Default
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={address.is_active}
                            onCheckedChange={() => handleToggleActive(address.id, address.is_active)}
                            disabled={saving}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(address.id)}
                            disabled={saving || address.is_default}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
