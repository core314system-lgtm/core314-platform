import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ChatMessage } from '../types';
import { toast } from 'sonner';

interface SupportChatContextType {
  messages: ChatMessage[];
  loading: boolean;
  isOpen: boolean;
  sendMessage: (query: string) => Promise<void>;
  giveFeedback: (logId: string, feedback: 'up' | 'down', comment?: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  openChat: () => void;
  closeChat: () => void;
}

const SupportChatContext = createContext<SupportChatContextType | undefined>(undefined);

export function SupportChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('support_chat_messages');
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
    }
  }, [user?.id]);

  const loadMessagesFromSupabase = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('ai_support_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('mode', 'support')
        .order('created_at', { ascending: true })
        .limit(50);

      if (data) {
        const chatMessages: ChatMessage[] = data.map(log => ({
          id: log.id,
          query: log.query,
          response: log.response,
          mode: 'support',
          timestamp: log.created_at,
        }));

        setMessages(chatMessages);
        localStorage.setItem('support_chat_messages', JSON.stringify(chatMessages));
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      query,
      response: '',
      mode: 'support',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMessage]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': session 
          ? `Bearer ${session.access_token}` 
          : `Bearer ${anonKey}`,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat-handler`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ query }),
        }
      );

      const data = await response.json();

      if (data.success) {
        const newMessage: ChatMessage = {
          id: data.log_id || tempMessage.id,
          query,
          response: data.response,
          mode: 'support',
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => {
          const updated = prev.filter(m => m.id !== tempMessage.id);
          updated.push(newMessage);
          localStorage.setItem('support_chat_messages', JSON.stringify(updated));
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

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-feedback`,
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

  const clearHistory = async () => {
    setMessages([]);
    localStorage.removeItem('support_chat_messages');
    toast.success('Chat history cleared');
  };

  const openChat = () => setIsOpen(true);
  const closeChat = () => setIsOpen(false);

  return (
    <SupportChatContext.Provider
      value={{
        messages,
        loading,
        isOpen,
        sendMessage,
        giveFeedback,
        clearHistory,
        openChat,
        closeChat,
      }}
    >
      {children}
    </SupportChatContext.Provider>
  );
}

export function useSupportChat() {
  const context = useContext(SupportChatContext);
  if (context === undefined) {
    throw new Error('useSupportChat must be used within SupportChatProvider');
  }
  return context;
}
