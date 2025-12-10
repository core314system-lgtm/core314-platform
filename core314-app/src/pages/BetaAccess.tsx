import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { initSupabaseClient, getSupabaseFunctionUrl } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Lock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function BetaAccess() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleValidate = async () => {
    if (!code.trim()) {
      toast.error('Please enter an access code');
      return;
    }

    try {
      setLoading(true);

      const supabase = await initSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const url = await getSupabaseFunctionUrl('validate-access-code');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: code.trim() }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to validate code');
        return;
      }

      if (!result.valid) {
        if (result.reason === 'expired') {
          toast.error('This access code has expired');
        } else if (result.reason === 'maxed_out') {
          toast.error('This access code has reached its maximum uses');
        } else {
          toast.error('Invalid access code');
        }
        return;
      }

      localStorage.setItem('beta_access_verified', 'true');
      localStorage.setItem('beta_access_code', code.trim());
      toast.success('Access code verified! Redirecting to signup...');
      setVerified(true);
    } catch (error) {
      console.error('Error validating code:', error);
      toast.error('Failed to validate access code');
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return <Navigate to="/signup" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Beta Access Required</CardTitle>
          <CardDescription>
            Core314 is currently in closed beta. Please enter your access code to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Access Code</Label>
            <Input
              id="code"
              type="text"
              placeholder="Enter your access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleValidate}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              'Validating...'
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Validate Code
              </>
            )}
          </Button>

          <div className="text-center text-sm text-gray-600">
            <p>Don't have an access code?</p>
            <a href="/contact" className="text-blue-600 hover:underline">
              Request access
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
