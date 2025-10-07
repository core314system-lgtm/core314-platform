import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Notification } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Bell, CheckCircle } from 'lucide-react';

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const filteredNotifications =
    filter === 'unread'
      ? notifications.filter(n => !n.is_read)
      : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notification Center</h1>
          <p className="text-gray-600 dark:text-gray-400">
            System-wide alerts and messages
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark All as Read
          </Button>
        )}
      </div>

      <div className="flex space-x-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All ({notifications.length})
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </Button>
      </div>

      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No notifications to display</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={!notification.is_read ? 'border-l-4 border-blue-500' : ''}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-lg">{notification.title}</CardTitle>
                      <Badge className={getTypeBadgeColor(notification.type)}>
                        {notification.type}
                      </Badge>
                      {!notification.is_read && (
                        <Badge variant="outline">New</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(notification.id)}
                    >
                      Mark as Read
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 dark:text-gray-300">{notification.message}</p>
                {notification.action_url && (
                  <Button variant="link" className="mt-2 p-0" asChild>
                    <a href={notification.action_url}>View Details →</a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
