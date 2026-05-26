import { useState } from 'react';
import { useSupabaseClient } from '../../contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '../../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  onSuccess: () => void;
  currentMemberCount?: number;
  organizationPlan?: string;
}

const PLAN_SEAT_LIMITS: Record<string, number> = {
  intelligence: 1,
  Intelligence: 1,
  commandCenter: 5,
  command_center: 5,
  'Command Center': 5,
  enterprise: 20,
  Enterprise: 20,
};

export function InviteUserModal({ open, onOpenChange, organizationId, onSuccess, currentMemberCount = 0, organizationPlan = 'intelligence' }: InviteUserModalProps) {
  const supabase = useSupabaseClient();
  const [email, setEmail] = useState('');
  const role = 'member';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const seatLimit = PLAN_SEAT_LIMITS[organizationPlan] ?? 5;
  const isAtSeatLimit = seatLimit !== -1 && currentMemberCount >= seatLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInviteLink(null);

    // Frontend seat limit enforcement
    if (isAtSeatLimit) {
      setError('Upgrade to Command Center to add more team members.');
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('organizations-invite');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organization_id: organizationId,
            email,
            role,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setInviteLink(data.invite_link);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setInviteLink(null);
    setError(null);
    onOpenChange(false);
    if (inviteLink) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User to Organization</DialogTitle>
        </DialogHeader>
        
        {inviteLink ? (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Invitation sent successfully!
              </AlertDescription>
            </Alert>
            <div>
              <Label>Invitation Link</Label>
              <div className="flex gap-2 mt-2">
                <Input value={inviteLink} readOnly />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    alert('Link copied to clipboard');
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Share this link with the user to invite them to the organization.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <p className="text-xs text-gray-500">
              Members have full access to briefs, signals, and dashboard.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
