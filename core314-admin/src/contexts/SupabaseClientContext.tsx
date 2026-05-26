/**
 * Supabase Client Context Provider
 * 
 * This context provides the Supabase client to the entire application,
 * ensuring that the client is initialized before any components try to use it.
 * The configuration is fetched at runtime from a Netlify Function.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { initSupabaseClient } from '@/lib/supabaseClient';

interface SupabaseContextValue {
  client: SupabaseClient | null;
  loading: boolean;
  error: Error | null;
}

const SupabaseClientContext = createContext<SupabaseContextValue | undefined>(undefined);

interface SupabaseClientProviderProps {
  children: ReactNode;
}

export function SupabaseClientProvider({ children }: SupabaseClientProviderProps) {
  const [state, setState] = useState<SupabaseContextValue>({
    client: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    initSupabaseClient()
      .then(client => {
        if (cancelled) return;
        setState({ client, loading: false, error: null });
      })
      .catch(error => {
        if (cancelled) return;
        console.error('Failed to initialize Supabase client:', error);
        setState({ 
          client: null, 
          loading: false, 
          error: error instanceof Error ? error : new Error(String(error)) 
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#6b7280', margin: 0 }}>Initializing...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: '600px',
        margin: '100px auto',
        padding: '40px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center',
      }}>
        <h1 style={{ color: '#c00', marginBottom: '20px' }}>Configuration Error</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Unable to initialize the application. Please contact support if this issue persists.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#0066cc',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <SupabaseClientContext.Provider value={state}>
      {children}
    </SupabaseClientContext.Provider>
  );
}

/**
 * Hook to get the Supabase client from context.
 * Must be used within a SupabaseClientProvider.
 * Throws an error if used outside the provider or before initialization.
 */
export function useSupabaseClient(): SupabaseClient {
  const ctx = useContext(SupabaseClientContext);
  if (!ctx) {
    throw new Error('useSupabaseClient must be used within SupabaseClientProvider');
  }
  if (!ctx.client) {
    throw new Error('Supabase client not initialized');
  }
  return ctx.client;
}

/**
 * Hook to get the Supabase context state (including loading and error states).
 * Useful for components that need to handle loading/error states themselves.
 */
export function useSupabaseContext(): SupabaseContextValue {
  const ctx = useContext(SupabaseClientContext);
  if (!ctx) {
    throw new Error('useSupabaseContext must be used within SupabaseClientProvider');
  }
  return ctx;
}
