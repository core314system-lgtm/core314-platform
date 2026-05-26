import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSupabaseClient } from './SupabaseClientContext';
import { getSupabaseFunctionUrl, getSupabaseAnonKey } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ChatMessage } from '../types';
import { toast } from 'sonner';

interface AISupportContextType {
  messages: ChatMessage[];
  loading: boolean;
  isOpen: boolean;
  mode: 'support' | 'onboarding';
  onboardingStep: number | null;
  sendMessage: (query: string) => Promise<void>;
  giveFeedback: (logId: string, feedback: 'up' | 'down', comment?: string) => Promise<void>;
  openChat: () => void;
  closeChat: () => void;
  setMode: (mode: 'support' | 'onboarding') => void;
}

const AISupportContext = createContext<AISupportContextType | undefined>(undefined);

export function AISupportProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'support' | 'onboarding'>('support');
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('ai_chat_messages');
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored messages:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadMessagesFromSupabase();
      checkOnboardingStatus();
    }
  }, [user?.id]);

  const loadMessagesFromSupabase = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('ai_support_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (data) {
        const chatMessages: ChatMessage[] = data.map(log => ({
          id: log.id,
          query: log.query,
          response: log.response,
          mode: log.mode,
          timestamp: log.created_at,
        }));

        setMessages(chatMessages);
        localStorage.setItem('ai_chat_messages', JSON.stringify(chatMessages));
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const checkOnboardingStatus = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_status')
        .eq('id', user.id)
        .single();

      if (profile?.onboarding_status === 'not_started') {
        setMode('onboarding');
        setOnboardingStep(1);
        setIsOpen(true);
      } else if (profile?.onboarding_status === 'in_progress') {
        const { data: progress } = await supabase
          .from('user_onboarding_progress')
          .select('current_step')
          .eq('user_id', user.id)
          .single();

        setOnboardingStep(progress?.current_step || 1);
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
    }
  };

  const sendMessage = async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      query,
      response: '',
      mode,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMessage]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const anonKey = await getSupabaseAnonKey();
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': session 
          ? `Bearer ${session.access_token}` 
          : `Bearer ${anonKey}`,
      };

      const url = await getSupabaseFunctionUrl('ai-support-handler');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ query, mode }),
        }
      );

      const data = await response.json();

      if (data.success) {
        const newMessage: ChatMessage = {
          id: data.log_id || tempMessage.id,
          query,
          response: data.response,
          mode,
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => {
          const updated = prev.filter(m => m.id !== tempMessage.id);
          updated.push(newMessage);
          localStorage.setItem('ai_chat_messages', JSON.stringify(updated));
          return updated;
        });

        if (data.escalation_triggered) {
          toast.success('Your request has been escalated to our support team. They will contact you shortly.');
        }
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
    } finally {
      setLoading(false);
    }
  };

  const giveFeedback = async (logId: string, feedback: 'up' | 'down', comment?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = await getSupabaseFunctionUrl('ai-feedback');
      await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ log_id: logId, feedback, comment }),
        }
      );

      setMessages(prev =>
        prev.map(m => m.id === logId ? { ...m, feedbackGiven: feedback } : m)
      );

      toast.success('Thank you for your feedback!');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const openChat = () => setIsOpen(true);
  const closeChat = () => setIsOpen(false);

  return (
    <AISupportContext.Provider
      value={{
        messages,
        loading,
        isOpen,
        mode,
        onboardingStep,
        sendMessage,
        giveFeedback,
        openChat,
        closeChat,
        setMode,
      }}
    >
      {children}
    </AISupportContext.Provider>
  );
}

export function useAISupport() {
  const context = useContext(AISupportContext);
  if (context === undefined) {
    throw new Error('useAISupport must be used within AISupportProvider');
  }
  return context;
}
