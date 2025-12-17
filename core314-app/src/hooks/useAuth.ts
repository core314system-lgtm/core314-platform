import { useEffect, useState, useRef } from 'react';
import { User as SupabaseUser, SupabaseClient, AuthError } from '@supabase/supabase-js';
import { initSupabaseClient, getSupabaseFunctionUrl } from '../lib/supabase';
import { User } from '../types';

/**
 * Helper to get the Supabase client, throwing a user-friendly error if unavailable.
 */
async function getClientOrThrow(ref: React.MutableRefObject<SupabaseClient | null>): Promise<SupabaseClient> {
  const client = ref.current || await initSupabaseClient();
  if (!client) {
    throw new Error('Authentication service unavailable. Please try again later.');
  }
  return client;
}

export function useAuth() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      try {
        const supabase = await initSupabaseClient();
        supabaseRef.current = supabase;

        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }

        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
          if (session?.user) {
            fetchProfile(session.user.id);
          } else {
            setProfile(null);
            setLoading(false);
          }
        });
        subscription = sub;
      } catch (err) {
        console.error('Auth initialization failed:', err);
        setInitError('Authentication service unavailable. Please refresh the page.');
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const supabase = supabaseRef.current || await initSupabaseClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const supabase = await getClientOrThrow(supabaseRef);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error && data.session) {
      try {
        const url = await getSupabaseFunctionUrl('auth-log-session');
        await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'login' }),
        });
      } catch (e) {
        console.error('Failed to log session:', e);
      }
    }
    
    return { data, error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const supabase = await getClientOrThrow(supabaseRef);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    const supabase = await getClientOrThrow(supabaseRef);
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setProfile(null);
    }
    return { error };
  };

  const isAdmin = () => profile?.role === 'admin';
  const isManager = () => profile?.role === 'manager' || isAdmin();

  return {
    user,
    profile,
    loading,
    initError,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isManager,
  };
}
