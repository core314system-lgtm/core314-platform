import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOrg } from '../contexts/OrgContext'

export interface AppNotification {
  id: string
  type: 'quote_received' | 'question_asked' | 'profile_claimed' | 'compliance_gap' | 'deadline_approaching' | 'system' | 'outreach'
  title: string
  message: string
  link?: string | null
  read: boolean
  created_at: string
  metadata?: Record<string, unknown>
}

interface UseNotificationsReturn {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refresh: () => Promise<void>
}

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth()
  const { currentOrg } = useOrg()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!user?.id || !currentOrg?.id) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        setNotifications(data as AppNotification[])
      }
    } catch {
      // Table may not exist yet — fail silently
    }
    setLoading(false)
  }, [user?.id, currentOrg?.id])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!user?.id || !currentOrg?.id) return
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [user?.id, currentOrg?.id, loadNotifications])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!currentOrg?.id) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('org_id', currentOrg.id)
      .eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [currentOrg?.id])

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: loadNotifications,
  }
}
