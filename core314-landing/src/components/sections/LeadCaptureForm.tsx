import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { supabase } from '../../lib/supabase';
import { CheckCircle2 } from 'lucide-react';

export function LeadCaptureForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    industry: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: submitError } = await supabase
        .from('leads')
        .insert([
          {
            name: formData.name,
            email: formData.email,
            company: formData.company,
            industry: formData.industry,
            is_beta_tester: true,
          },
        ]);

      if (submitError) throw submitError;

      setSubmitted(true);
      setFormData({ name: '', email: '', company: '', industry: '' });
    } catch (err) {
      console.error('Form submission error:', err);
      setError('Failed to submit. Please try again or email us directly.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <section id="signup" className="py-24 bg-gradient-to-br from-core314-navy to-gray-900">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="border-2 border-core314-electric-blue">
            <CardContent className="pt-12 pb-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-core314-electric-blue mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Thank You!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                We've received your request. Our team will be in touch within 24 hours to set up your Core314 account.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section id="signup" className="py-24 bg-gradient-to-br from-core314-navy to-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="border-2 border-core314-electric-blue/20">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Request Early Access</CardTitle>
            <CardDescription className="text-lg">
              Join leading organizations using Core314 to transform their operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Full Name *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="h-12"
                />
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="Work Email *"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-12"
                />
              </div>
              <div>
                <Input
                  type="text"
                  placeholder="Company Name"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="h-12"
                />
              </div>
              <div>
                <select
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full h-12 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
                >
                  <option value="">Select Industry (Optional)</option>
                  <option value="facilities">Facilities Management</option>
                  <option value="govcon">Government Contracting</option>
                  <option value="it">IT Operations</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              {error && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-core314-electric-blue hover:bg-core314-electric-blue/90 text-white text-lg"
              >
                {loading ? 'Submitting...' : 'Request Access'}
              </Button>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                By submitting, you agree to our Terms of Service and Privacy Policy
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
