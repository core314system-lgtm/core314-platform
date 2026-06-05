import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, Clock, FileText, MessageSquare, UserPlus, AlertTriangle, Radio, X } from 'lucide-react'
import { useNotifications, type AppNotification } from '../hooks/useNotifications'

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  quote_received: { icon: FileText, color: 'text-green-600', bg: 'bg-green-100' },
  question_asked: { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-100' },
  profile_claimed: { icon: UserPlus, color: 'text-purple-600', bg: 'bg-purple-100' },
  compliance_gap: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100' },
  deadline_approaching: { icon: Clock, color: 'text-red-600', bg: 'bg-red-100' },
  outreach: { icon: Radio, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  system: { icon: Bell, color: 'text-gray-600', bg: 'bg-gray-100' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function NotificationItem({ notification, onMarkRead }: { notification: AppNotification; onMarkRead: (id: string) => void }) {
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system
  const Icon = config.icon

  const content = (
    <div
      className={`flex gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
        notification.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50'
      }`}
      onClick={() => !notification.read && onMarkRead(notification.id)}
    >
      <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={14} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
          {notification.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-xs text-gray-400 mt-1">{timeAgo(notification.created_at)}</p>
      </div>
      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
      )}
    </div>
  )

  if (notification.link) {
    return <Link to={notification.link}>{content}</Link>
  }
  return content
}

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-[480px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bell size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={markAsRead}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
