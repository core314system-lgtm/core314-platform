import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/use-toast';
import { getSupabaseFunctionUrl, getSupabaseAnonKey } from '../../lib/supabase';
import { authenticatedFetch, SessionExpiredError } from '../../utils/authenticatedFetch';
import { normalizeIntegrationName } from '../../utils/normalizeIntegrationName';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2, CheckCircle } from 'lucide-react';

const CATEGORIES = [
  'CRM',
  'Finance',
  'Project Management',
  'Communication',
  'Marketing',
  'Support',
  'Dev Tools',
  'Other',
];

interface RequestIntegrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function RequestIntegrationModal({ open, onOpenChange, onSubmitted }: RequestIntegrationModalProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [integrationName, setIntegrationName] = useState('');
  const [category, setCategory] = useState('');
  const [url, setUrl] = useState('');
  const [useCase, setUseCase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!integrationName || integrationName.trim().length < 2) {
      newErrors.integrationName = 'Integration name must be at least 2 characters';
    }
    if (!category) {
      newErrors.category = 'Please select a category';
    }
    if (url && url.trim().length > 0) {
      try {
        new URL(url.trim());
      } catch {
        newErrors.url = 'Please enter a valid URL (e.g., https://example.com)';
      }
    }
    if (!useCase || useCase.trim().length < 10) {
      newErrors.useCase = 'Use case must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!profile?.id) return;

    setSubmitting(true);
    console.log('[IntegrationRequest] Submission attempt:', { integrationName, category, url, useCase });

    try {
      // Step 1: Normalize integration name
      const normalizedKey = normalizeIntegrationName(integrationName);
      const trimmedName = integrationName.trim();
      console.log('[IntegrationRequest] Normalized key:', normalizedKey);

      // Step 2: Match catalog directly by normalized_key
      let catalogId: string;
      let matchSource: 'catalog' | 'alias' | 'new' = 'new';
      const { data: existingCatalog } = await supabase
        .from('integration_catalog')
        .select('id')
        .eq('normalized_key', normalizedKey)
        .limit(1)
        .single();

      if (existingCatalog) {
        catalogId = existingCatalog.id;
        matchSource = 'catalog';
        console.log('[IntegrationRequest] Matched existing catalog entry:', catalogId);
      } else {
        // Step 2b: Check aliases table for a match
        const { data: existingAlias } = await supabase
          .from('integration_aliases')
          .select('integration_catalog_id')
          .eq('normalized_key', normalizedKey)
          .limit(1)
          .single();

        if (existingAlias) {
          catalogId = existingAlias.integration_catalog_id;
          matchSource = 'alias';
          console.log('[IntegrationRequest] Matched via alias → catalog:', catalogId);
        } else {
          // Step 2c: Create new catalog entry
          const { data: newCatalog, error: catalogError } = await supabase
            .from('integration_catalog')
            .insert([{
              canonical_name: trimmedName,
              normalized_key: normalizedKey,
              category,
            }])
            .select()
            .single();

          if (catalogError) {
            console.error('[IntegrationRequest] Catalog insert error:', catalogError);
            toast({
              title: 'Error',
              description: 'Failed to submit request. Please try again.',
              variant: 'destructive',
            });
            return;
          }
          catalogId = newCatalog.id;
          matchSource = 'new';
          console.log('[IntegrationRequest] Created new catalog entry:', catalogId);

          // Step 2d: Auto-create alias for the new catalog entry
          const { error: aliasError } = await supabase
            .from('integration_aliases')
            .insert([{
              integration_catalog_id: catalogId,
              alias_name: trimmedName,
              normalized_key: normalizedKey,
            }]);

          if (aliasError) {
            console.error('[IntegrationRequest] Auto-alias creation error:', aliasError);
          } else {
            console.log('[IntegrationRequest] Auto-alias created for new catalog entry');
          }
        }
      }

      console.log('[IntegrationRequest] Match source:', matchSource);

      // Step 3: Insert the integration request linked to catalog
      const { data, error } = await supabase
        .from('integration_requests')
        .insert([
          {
            user_id: profile.id,
            integration_name: trimmedName,
            category,
            url: url.trim() || null,
            use_case: useCase.trim(),
            integration_catalog_id: catalogId,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('[IntegrationRequest] Insert error:', error);
        toast({
          title: 'Error',
          description: 'Failed to submit request. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      console.log('[IntegrationRequest] Insert success:', data);

      // Step 4: Update demand count in catalog
      const { count } = await supabase
        .from('integration_requests')
        .select('id', { count: 'exact', head: true })
        .eq('integration_catalog_id', catalogId);

      await supabase
        .from('integration_catalog')
        .update({
          total_requests: count ?? 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', catalogId);

      console.log('[IntegrationRequest] Catalog count updated:', count, '(match source:', matchSource, ')');

      // Trigger Slack notification via edge function
      try {
        console.log('[IntegrationRequest] Triggering Slack notification...');
        const fnUrl = await getSupabaseFunctionUrl('notify-integration-request');
        const anonKey = await getSupabaseAnonKey();

        await authenticatedFetch(async (token) => {
          return await fetch(fnUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': anonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ request_id: data.id }),
          });
        });
        console.log('[IntegrationRequest] Slack notification triggered');
      } catch (slackErr) {
        // Non-blocking: Slack failure should not block the user
        if (slackErr instanceof SessionExpiredError) {
          console.error('[IntegrationRequest] Session expired during Slack notification');
        } else {
          console.error('[IntegrationRequest] Slack notification failed:', slackErr);
        }
      }

      setSubmitted(true);
      toast({
        title: 'Request Submitted',
        description: 'Integration request submitted successfully',
      });

      // Auto-close after 2 seconds
      setTimeout(() => {
        resetForm();
        onOpenChange(false);
        onSubmitted?.();
      }, 2000);

    } catch (err) {
      console.error('[IntegrationRequest] Unexpected error:', err);
      toast({
        title: 'Error',
        description: err instanceof SessionExpiredError
          ? 'Session expired. Please sign in again.'
          : 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setIntegrationName('');
    setCategory('');
    setUrl('');
    setUseCase('');
    setErrors({});
    setSubmitted(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Integration</DialogTitle>
          <DialogDescription>
            Submit a request for a new integration. Our team will review it and keep you updated on the status.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">Request Submitted!</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              We&apos;ll review your request and keep you updated.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              {/* Integration Name */}
              <div className="space-y-2">
                <Label htmlFor="integration-name">
                  Integration Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="integration-name"
                  placeholder="e.g., Salesforce, Monday.com, Notion"
                  value={integrationName}
                  onChange={(e) => {
                    setIntegrationName(e.target.value);
                    if (errors.integrationName) setErrors({ ...errors, integrationName: '' });
                  }}
                  disabled={submitting}
                />
                {errors.integrationName && (
                  <p className="text-sm text-red-500">{errors.integrationName}</p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={category}
                  onValueChange={(val) => {
                    setCategory(val);
                    if (errors.category) setErrors({ ...errors, category: '' });
                  }}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-red-500">{errors.category}</p>
                )}
              </div>

              {/* URL */}
              <div className="space-y-2">
                <Label htmlFor="integration-url">URL (optional)</Label>
                <Input
                  id="integration-url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (errors.url) setErrors({ ...errors, url: '' });
                  }}
                  disabled={submitting}
                />
                {errors.url && (
                  <p className="text-sm text-red-500">{errors.url}</p>
                )}
              </div>

              {/* Use Case */}
              <div className="space-y-2">
                <Label htmlFor="use-case">
                  Use Case <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="use-case"
                  placeholder="Describe how you would use this integration and what data you'd like to connect..."
                  value={useCase}
                  onChange={(e) => {
                    setUseCase(e.target.value);
                    if (errors.useCase) setErrors({ ...errors, useCase: '' });
                  }}
                  disabled={submitting}
                  rows={4}
                />
                {errors.useCase && (
                  <p className="text-sm text-red-500">{errors.useCase}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
