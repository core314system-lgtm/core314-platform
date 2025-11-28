import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const FEEDBACK_CATEGORIES = [
  'UI/UX',
  'Bug',
  'Performance',
  'Feature Request',
  'Other'
] as const;

export default function Feedback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [category, setCategory] = useState<string>('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('You must be logged in to submit feedback');
      return;
    }

    if (!category) {
      toast.error('Please select a category');
      return;
    }

    if (!message.trim()) {
      toast.error('Please enter your feedback message');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('beta_feedback')
        .insert({
          user_id: user.id,
          category,
          message: message.trim(),
          screenshot_url: null, // Placeholder for future screenshot upload
        });

      if (error) throw error;

      toast.success('Feedback submitted successfully! Thank you for helping us improve.');
      
      setCategory('');
      setMessage('');
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Submit Feedback</CardTitle>
                <CardDescription>
                  Help us improve Core314 by sharing your thoughts, reporting bugs, or suggesting features
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEEDBACK_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Your Feedback *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your feedback in detail..."
                  rows={8}
                  className="resize-none"
                  required
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {message.length} characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="screenshot">Screenshot (Optional)</Label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Screenshot upload functionality coming soon
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting || !category || !message.trim()}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>Submitting...</>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Feedback
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
