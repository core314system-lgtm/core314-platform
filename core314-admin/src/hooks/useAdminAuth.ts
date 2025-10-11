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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const signIn = async (email: string, _password: string) => {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('role', 'admin')
        .single();

      if (error || !user) {
        return { error: { message: 'Invalid admin credentials' } };
      }

      localStorage.setItem('admin_session', JSON.stringify(user));
      setSession({ adminUser: user, isAuthenticated: true });
      
      return { data: user, error: null };
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
