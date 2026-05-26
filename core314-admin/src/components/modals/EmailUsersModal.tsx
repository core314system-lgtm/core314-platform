import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { supabase } from '../../lib/supabase';
import { User, ReplyToAddress } from '../../types';
import { Mail, Users, UserCheck } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface EmailUsersModalProps {
  users: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailUsersModal({ users, open, onOpenChange }: EmailUsersModalProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [recipientMode, setRecipientMode] = useState<'all' | 'selected'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [replyToAddresses, setReplyToAddresses] = useState<ReplyToAddress[]>([]);
  const [selectedReplyTo, setSelectedReplyTo] = useState<string>('');
  
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (open) {
      fetchReplyToAddresses();
      setSuccess(false);
      setError(null);
    }
  }, [open]);

  const fetchReplyToAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from('reply_to_addresses')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      
      const addresses = data || [];
      setReplyToAddresses(addresses);
      
      const defaultAddress = addresses.find(addr => addr.is_default);
      if (defaultAddress) {
        setSelectedReplyTo(defaultAddress.id);
      } else if (addresses.length > 0) {
        setSelectedReplyTo(addresses[0].id);
      }
    } catch (err) {
      console.error('Error fetching reply-to addresses:', err);
    }
  };

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map(u => u.id)));
    }
  };

  const getRecipients = () => {
    if (recipientMode === 'all') {
      return users;
    }
    return users.filter(u => selectedUserIds.has(u.id));
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    if (!body.trim()) {
      setError('Message body is required');
      return;
    }

    if (!selectedReplyTo) {
      setError('Please select a reply-to address');
      return;
    }

    const recipients = getRecipients();
    if (recipients.length === 0) {
      setError('Please select at least one recipient');
      return;
    }

    try {
      setSending(true);
      setError(null);

      const replyToAddress = replyToAddresses.find(addr => addr.id === selectedReplyTo);
      if (!replyToAddress) {
        throw new Error('Selected reply-to address not found');
      }

      const { error } = await supabase.functions.invoke('send-bulk-email', {
        body: {
          recipients: recipients.map(u => ({
            email: u.email,
            name: u.full_name || 'User',
          })),
          subject: subject.trim(),
          body: body.trim(),
          replyTo: {
            email: replyToAddress.email_address,
            name: replyToAddress.department_name,
          },
        },
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setSubject('');
        setBody('');
        setSelectedUserIds(new Set());
        setRecipientMode('all');
      }, 2000);
    } catch (err) {
      console.error('Error sending emails:', err);
      setError(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  const recipientCount = getRecipients().length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Send Email to Users</DialogTitle>
          <DialogDescription>
            Compose and send an email to selected users
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Recipient Selection */}
            <div className="space-y-4">
              <Label>Recipients</Label>
              <div className="flex gap-4">
                <Button
                  variant={recipientMode === 'all' ? 'default' : 'outline'}
                  onClick={() => setRecipientMode('all')}
                  className="flex-1"
                >
                  <Users className="mr-2 h-4 w-4" />
                  All Users ({users.length})
                </Button>
                <Button
                  variant={recipientMode === 'selected' ? 'default' : 'outline'}
                  onClick={() => setRecipientMode('selected')}
                  className="flex-1"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Select Users
                </Button>
              </div>

              {recipientMode === 'selected' && (
                <div className="space-y-2 border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      Selected: {selectedUserIds.size} / {users.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      {selectedUserIds.size === users.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`user-${user.id}`}
                            checked={selectedUserIds.has(user.id)}
                            onCheckedChange={() => handleToggleUser(user.id)}
                          />
                          <label
                            htmlFor={`user-${user.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {user.full_name || 'N/A'} ({user.email})
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            {/* Reply-To Address */}
            <div className="space-y-2">
              <Label htmlFor="replyTo">Reply-To Address</Label>
              <Select value={selectedReplyTo} onValueChange={setSelectedReplyTo}>
                <SelectTrigger id="replyTo">
                  <SelectValue placeholder="Select reply-to address" />
                </SelectTrigger>
                <SelectContent>
                  {replyToAddresses.map((address) => (
                    <SelectItem key={address.id} value={address.id}>
                      {address.department_name} ({address.email_address})
                      {address.is_default && ' - Default'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {replyToAddresses.length === 0 && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  No reply-to addresses configured. Please add one in settings.
                </p>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Email message body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={sending}
                rows={8}
                className="resize-none"
              />
            </div>

            {/* Success Message */}
            {success && (
              <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                ✓ Email sent successfully to {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}!
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <div className="flex justify-between items-center w-full">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending || recipientCount === 0}>
                <Mail className="mr-2 h-4 w-4" />
                {sending ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
