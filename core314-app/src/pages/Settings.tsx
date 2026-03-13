import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSupabaseClient } from '../contexts/SupabaseClientContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  User, 
  Loader2,
  Check,
  Camera,
  Key
} from 'lucide-react';

export function Settings() {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  
  // Profile state
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [emailUpdateMessage, setEmailUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setFullName(data.full_name || '');
      setAvatarUrl(data.avatar_url || null);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    
    setAvatarUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    setPasswordResetLoading(true);
    setPasswordResetMessage(null);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      });
      
      if (error) throw error;
      
      setPasswordResetMessage({
        type: 'success',
        text: 'Password reset email sent! Check your inbox for instructions to reset your password.',
      });
    } catch (err) {
      console.error('Error sending password reset:', err);
      setPasswordResetMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to send password reset email. Please try again.',
      });
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    
    setProfileLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      
      if (error) throw error;
      
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleEmailUpdate = async () => {
    if (!user || !newEmail || newEmail === user.email) return;
    
    setProfileLoading(true);
    setEmailUpdateMessage(null);
    
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      
      if (error) throw error;
      
      setEmailUpdateMessage({
        type: 'success',
        text: 'Verification email sent to your new address. Please check your inbox and click the confirmation link to complete the change.',
      });
      setIsEditingEmail(false);
    } catch (err) {
      console.error('Error updating email:', err);
      setEmailUpdateMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update email. Please try again.',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your profile settings</p>
      </div>

      <div className="space-y-6">
        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Photo</CardTitle>
            <CardDescription>Upload a profile picture</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-12 w-12 text-gray-400" />
                  )}
                </div>
                {avatarUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={avatarUploading}>
                    <span>
                      <Camera className="mr-2 h-4 w-4" />
                      {avatarUploading ? 'Uploading...' : 'Upload Photo'}
                    </span>
                  </Button>
                </Label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
                <p className="text-xs text-gray-500">JPG, PNG, GIF or WebP. Max 5MB.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input 
                id="fullName" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            
            <Button onClick={saveProfile} disabled={profileLoading}>
              {profileLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : profileSaved ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              {profileSaved ? 'Saved!' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        {/* Email & Password Section */}
        <Card>
          <CardHeader>
            <CardTitle>Email & Password</CardTitle>
            <CardDescription>Manage your account credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              {isEditingEmail ? (
                <div className="space-y-2">
                  <Input 
                    id="newEmail" 
                    type="email"
                    value={newEmail} 
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter new email address"
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleEmailUpdate}
                      disabled={profileLoading || !newEmail || newEmail === user?.email}
                    >
                      {profileLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Send Verification
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setIsEditingEmail(false);
                        setNewEmail('');
                        setEmailUpdateMessage(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input 
                    id="email" 
                    value={user?.email || ''} 
                    disabled 
                    className="bg-gray-50 dark:bg-gray-800 flex-1"
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setIsEditingEmail(true);
                      setNewEmail(user?.email || '');
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}
              {emailUpdateMessage && (
                <p className={`text-xs ${emailUpdateMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {emailUpdateMessage.text}
                </p>
              )}
            </div>
          
            {/* Password Reset Section */}
            <div className="pt-4 border-t space-y-2">
              <Label>Password</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Send a password reset link to your email address
              </p>
              <Button 
                variant="outline" 
                onClick={handlePasswordReset}
                disabled={passwordResetLoading}
              >
                {passwordResetLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Key className="mr-2 h-4 w-4" />
                )}
                {passwordResetLoading ? 'Sending...' : 'Reset Password'}
              </Button>
              {passwordResetMessage && (
                <div className="space-y-1">
                  <p className={`text-xs ${passwordResetMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordResetMessage.text}
                  </p>
                  {passwordResetMessage.type === 'success' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      If you don't see the email within 1-3 minutes, please check your spam folder.
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
