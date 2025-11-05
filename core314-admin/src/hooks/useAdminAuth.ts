import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AdminSession {
  adminUser: User | null;
  isAuthenticated: boolean;
}

export function useAdminAuth() {
  const [session, setSession] = useState<AdminSession>({
    adminUser: null,
    isAuthenticated: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedAdmin = localStorage.getItem('admin_session');
    if (storedAdmin) {
      try {
        const adminUser = JSON.parse(storedAdmin);
        setSession({ adminUser, isAuthenticated: true });
      } catch {
        localStorage.removeItem('admin_session');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return { error: { message: 'Invalid credentials' } };
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        return { error: { message: 'Access denied. Profile not found.' } };
      }

      if (!profile.is_platform_admin) {
        await supabase.auth.signOut();
        return { error: { message: 'Access denied. Platform administrator access required.' } };
      }

      localStorage.setItem('admin_session', JSON.stringify(profile));
      setSession({ adminUser: profile, isAuthenticated: true });
      
      return { data: profile, error: null };
    } catch {
      return { error: { message: 'Authentication failed' } };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('admin_session');
    setSession({ adminUser: null, isAuthenticated: false });
    return { error: null };
  };

  return {
    adminUser: session.adminUser,
    isAuthenticated: session.isAuthenticated,
    loading,
    signIn,
    signOut,
  };
}
