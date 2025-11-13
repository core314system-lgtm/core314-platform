import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Headphones, MessageSquare, Send, CheckCircle, Clock, AlertCircle, User, Calendar } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { FeatureGuard } from '../components/FeatureGuard';
import { format } from 'date-fns';

interface SupportTicket {
  id: string;
  created_at: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  last_updated: string;
  assigned_to: string | null;
}

export function AccountSupport() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchTickets();
    }
  }, [profile?.id]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false });

      if (data) {
        setTickets(data);
      }
    } catch (error) {
      console.error('Error fetching support tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!newTicket.subject || !newTicket.description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: profile?.id,
          subject: newTicket.subject,
          description: newTicket.description,
          priority: newTicket.priority,
          status: 'open',
        });

      if (!error) {
        toast({
          title: '✅ Ticket submitted',
          description: 'Your support request has been received. Our team will respond within 24 hours.',
        });
        setNewTicket({ subject: '', description: '', priority: 'medium' });
        setShowNewTicketForm(false);
        await fetchTickets();
      }
    } catch (error) {
      console.error('Error submitting ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit support ticket',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'resolved':
      case 'closed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <FeatureGuard feature="account_manager">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Headphones className="h-8 w-8" />
              Account Support
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Dedicated enterprise support and account management
            </p>
          </div>
          <Button onClick={() => setShowNewTicketForm(!showNewTicketForm)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            New Support Request
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {showNewTicketForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    New Support Request
                  </CardTitle>
                  <CardDescription>Submit a ticket to our enterprise support team</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Subject *</label>
                    <Input
                      placeholder="Brief description of your issue"
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Priority</label>
                    <select
                      className="w-full border rounded-md px-3 py-2"
                      value={newTicket.priority}
                      onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                    >
                      <option value="low">Low - General inquiry</option>
                      <option value="medium">Medium - Issue affecting workflow</option>
                      <option value="high">High - Critical functionality impacted</option>
                      <option value="urgent">Urgent - System down or data loss</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Description *</label>
                    <Textarea
                      placeholder="Detailed description of your issue or request..."
                      rows={6}
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleSubmitTicket} disabled={submitting}>
                      <Send className="h-4 w-4 mr-2" />
                      {submitting ? 'Submitting...' : 'Submit Ticket'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewTicketForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Your Support Tickets
                </CardTitle>
                <CardDescription>Track the status of your support requests</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                  </div>
                ) : tickets.length > 0 ? (
                  <div className="space-y-4">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getStatusColor(ticket.status)}>
                                {getStatusIcon(ticket.status)}
                                <span className="ml-1">{ticket.status.replace('_', ' ').toUpperCase()}</span>
                              </Badge>
                              <Badge className={getPriorityColor(ticket.priority)}>
                                {ticket.priority.toUpperCase()}
                              </Badge>
                            </div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {ticket.subject}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {ticket.description.length > 150
                                ? `${ticket.description.substring(0, 150)}...`
                                : ticket.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Created: {format(new Date(ticket.created_at), 'MMM dd, yyyy')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Updated: {format(new Date(ticket.last_updated || ticket.created_at), 'MMM dd, yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      No support tickets yet
                    </p>
                    <Button onClick={() => setShowNewTicketForm(true)}>
                      Create Your First Ticket
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Your Account Manager
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Sarah Johnson</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Enterprise Account Manager</p>
                  </div>
                </div>
                <div className="pt-3 border-t space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Email:</span>
                    <a href="mailto:sarah.johnson@core314.com" className="text-blue-600 hover:underline">
                      sarah.johnson@core314.com
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                    <a href="tel:+1-555-0123" className="text-blue-600 hover:underline">
                      +1 (555) 012-3456
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Availability:</span>
                    <span className="font-medium">Mon-Fri, 9am-6pm EST</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Support SLA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Urgent:</span>
                  <span className="font-medium">1 hour</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">High:</span>
                  <span className="font-medium">4 hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Medium:</span>
                  <span className="font-medium">24 hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Low:</span>
                  <span className="font-medium">48 hours</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <a
                  href="https://docs.core314.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 text-sm text-blue-600 hover:underline"
                >
                  📚 Documentation
                </a>
                <a
                  href="https://status.core314.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 text-sm text-blue-600 hover:underline"
                >
                  🟢 System Status
                </a>
                <a
                  href="https://community.core314.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 text-sm text-blue-600 hover:underline"
                >
                  💬 Community Forum
                </a>
                <a
                  href="https://core314.com/training"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 text-sm text-blue-600 hover:underline"
                >
                  🎓 Training Resources
                </a>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Headphones className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      24/7 Enterprise Support
                    </p>
                    <p className="text-blue-700 dark:text-blue-300 text-xs">
                      For critical issues outside business hours, call our emergency hotline: +1 (555) 999-9999
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}
