import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { EditUserModal } from '../../components/modals/EditUserModal';
import { EmailUsersModal } from '../../components/modals/EmailUsersModal';
import { ReplyToSettingsModal } from '../../components/modals/ReplyToSettingsModal';
import { RefreshCw, Pencil, Mail, Settings } from 'lucide-react';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [replyToSettingsOpen, setReplyToSettingsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; is_platform_admin: boolean } | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, is_platform_admin')
          .eq('id', user.id)
          .single();
        if (profile) {
          setCurrentUser({ id: profile.id, is_platform_admin: profile.is_platform_admin || false });
        }
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

    const handleUserUpdated = (updatedUser: User) => {
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      setEditModalOpen(false);
    };

    const handleUserDeleted = (userId: string) => {
      setUsers(users.filter(u => u.id !== userId));
      setEditModalOpen(false);
      setSelectedUser(null);
    };

    const filteredUsers = showDeleted 
      ? users 
      : users.filter(u => !u.deleted_at);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'trialing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'past_due':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'canceled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage all users and their permissions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setReplyToSettingsOpen(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Reply-To Settings
          </Button>
          <Button 
            variant="default" 
            onClick={() => setEmailModalOpen(true)}
            disabled={users.length === 0}
          >
            <Mail className="mr-2 h-4 w-4" />
            Send Email
          </Button>
          <Button onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>All Users ({filteredUsers.length})</CardTitle>
                  <div className="flex items-center gap-2">
                    <label htmlFor="show-deleted" className="text-sm text-gray-600 dark:text-gray-400">
                      Show deleted
                    </label>
                    <input
                      type="checkbox"
                      id="show-deleted"
                      checked={showDeleted}
                      onChange={(e) => setShowDeleted(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </div>
                </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Access Level</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
                        <TableBody>
                          {filteredUsers.map((user) => (
                            <TableRow key={user.id} className={user.deleted_at ? 'opacity-50' : ''}>
                              <TableCell className="font-medium">
                                {user.full_name || 'N/A'}
                                {user.deleted_at && (
                                  <Badge className="ml-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                    Deleted
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>
                                <Badge className={getRoleBadgeColor(user.role)}>
                                  {user.role}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {user.role === 'admin' ? (
                                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                    Global Access: Enabled
                                  </Badge>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="text-sm capitalize">{user.subscription_tier}</div>
                                    <Badge className={getStatusBadgeColor(user.subscription_status)}>
                                      {user.subscription_status}
                                    </Badge>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {new Date(user.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEdit(user)}
                                  disabled={!!user.deleted_at}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
          </Table>
        </CardContent>
      </Card>

            {selectedUser && (
              <EditUserModal
                user={selectedUser}
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                onUserUpdated={handleUserUpdated}
                onUserDeleted={handleUserDeleted}
                currentUserId={currentUser?.id}
                isPlatformAdmin={currentUser?.is_platform_admin}
              />
            )}

      <EmailUsersModal
        users={users}
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
      />

      <ReplyToSettingsModal
        open={replyToSettingsOpen}
        onOpenChange={setReplyToSettingsOpen}
      />
    </div>
  );
}
