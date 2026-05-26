import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { initSupabaseClient, getSupabaseFunctionUrl } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Shield, CheckCircle, XCircle } from 'lucide-react';

export function Security() {
  const { profile } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setTwoFactorEnabled(profile.two_factor_enabled);
    }
  }, [profile]);

  const handleEnable2FA = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = await initSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('auth-2fa-enable');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const QRCode = (await import('qrcode')).default;
      const qrCodeDataURL = await QRCode.toDataURL(data.otpauth_url);

      setQrCode(qrCodeDataURL);
      setShowSetup(true);
      setSuccess('Scan the QR code with your authenticator app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = await initSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('auth-2fa-verify');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: verificationCode }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      if (data.verified) {
        setTwoFactorEnabled(true);
        setShowSetup(false);
        setSuccess('Two-factor authentication enabled successfully!');
        setQrCode('');
        setVerificationCode('');
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const supabase = await initSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const url = await getSupabaseFunctionUrl('auth-2fa-disable');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setTwoFactorEnabled(false);
      setSuccess('Two-factor authentication disabled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Security Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your account security and authentication</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="mr-2 h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Status</p>
              <p className="text-sm text-gray-500">
                {twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {twoFactorEnabled ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>

          {!twoFactorEnabled && !showSetup && (
            <Button onClick={handleEnable2FA} disabled={loading}>
              {loading ? 'Setting up...' : 'Enable 2FA'}
            </Button>
          )}

          {showSetup && (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="space-y-2">
                <Label>Step 1: Scan QR Code</Label>
                <p className="text-sm text-gray-600">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                {qrCode && (
                  <img src={qrCode} alt="2FA QR Code" className="mx-auto" />
                )}
              </div>

              <div className="space-y-2">
                <Label>Step 2: Enter Verification Code</Label>
                <Input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                />
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleVerify2FA} disabled={loading || verificationCode.length !== 6}>
                  {loading ? 'Verifying...' : 'Verify & Enable'}
                </Button>
                <Button variant="outline" onClick={() => setShowSetup(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {twoFactorEnabled && (
            <Button variant="destructive" onClick={handleDisable2FA} disabled={loading}>
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
