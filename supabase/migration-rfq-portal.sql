-- =====================================================
-- RFQ Portal & Email Tracking Migration
-- =====================================================

-- 1. Quote Form Templates (admin-configurable forms per task order or SOW)
CREATE TABLE IF NOT EXISTS public.quote_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  task_order_id uuid REFERENCES public.task_orders ON DELETE CASCADE,
  sow_item_id uuid REFERENCES public.sow_items ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_form_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage quote form templates" ON public.quote_form_templates FOR ALL USING (auth.uid() IS NOT NULL);

-- 2. Quote Form Fields (individual fields in a template)
CREATE TABLE IF NOT EXISTS public.quote_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.quote_form_templates ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'currency', 'textarea', 'select', 'file', 'date', 'checkbox', 'email', 'phone')),
  is_required boolean NOT NULL DEFAULT false,
  help_text text,
  placeholder text,
  options jsonb, -- For select fields: ["Option 1", "Option 2"]
  display_order integer NOT NULL DEFAULT 0,
  is_default_field boolean NOT NULL DEFAULT false, -- true for standard fields like total_amount
  default_field_key text, -- Maps to sow_quotes column: 'total_amount', 'labor_cost', etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_form_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage quote form fields" ON public.quote_form_fields FOR ALL USING (auth.uid() IS NOT NULL);

-- 3. RFQ Tokens (unique tokens for subcontractor portal access)
CREATE TABLE IF NOT EXISTS public.rfq_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  sow_subcontractor_id uuid NOT NULL REFERENCES public.sow_subcontractors ON DELETE CASCADE,
  sow_item_id uuid NOT NULL REFERENCES public.sow_items ON DELETE CASCADE,
  task_order_id uuid NOT NULL REFERENCES public.task_orders ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rfq_tokens ENABLE ROW LEVEL SECURITY;
-- Portal access is via token, not auth - need public read for token validation
CREATE POLICY "Anyone can read rfq tokens" ON public.rfq_tokens FOR SELECT USING (true);
CREATE POLICY "Auth users can manage rfq tokens" ON public.rfq_tokens FOR ALL USING (auth.uid() IS NOT NULL);

-- 4. Email Tracking Events
CREATE TABLE IF NOT EXISTS public.email_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_token_id uuid REFERENCES public.rfq_tokens ON DELETE SET NULL,
  sow_subcontractor_id uuid REFERENCES public.sow_subcontractors ON DELETE SET NULL,
  sendgrid_message_id text,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'deferred', 'dropped', 'spam_report', 'unsubscribe')),
  email_to text,
  email_subject text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view email tracking" ON public.email_tracking FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can insert email tracking" ON public.email_tracking FOR INSERT WITH CHECK (true); -- webhook needs to insert

-- 5. Portal Quote Submissions (custom field values from portal submissions)
CREATE TABLE IF NOT EXISTS public.portal_quote_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_token_id uuid NOT NULL REFERENCES public.rfq_tokens ON DELETE CASCADE,
  sow_quote_id uuid REFERENCES public.sow_quotes ON DELETE SET NULL,
  custom_fields jsonb NOT NULL DEFAULT '{}', -- { "field_id": "value", ... }
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_quote_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert portal submissions" ON public.portal_quote_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can view portal submissions" ON public.portal_quote_submissions FOR SELECT USING (auth.uid() IS NOT NULL);

-- 6. Subcontractor Questions (from portal)
CREATE TABLE IF NOT EXISTS public.subcontractor_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_token_id uuid REFERENCES public.rfq_tokens ON DELETE SET NULL,
  sow_subcontractor_id uuid NOT NULL REFERENCES public.sow_subcontractors ON DELETE CASCADE,
  sow_item_id uuid NOT NULL REFERENCES public.sow_items ON DELETE CASCADE,
  task_order_id uuid NOT NULL REFERENCES public.task_orders ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors ON DELETE CASCADE,
  question_text text NOT NULL,
  related_section text, -- which part of SOW they're asking about
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'shared', 'dismissed')),
  answer_text text,
  answered_by uuid REFERENCES auth.users,
  answered_at timestamptz,
  shared_with_all boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subcontractor_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert questions" ON public.subcontractor_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can manage questions" ON public.subcontractor_questions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can read shared questions" ON public.subcontractor_questions FOR SELECT USING (shared_with_all = true);

-- 7. Add email tracking fields to sow_subcontractors
ALTER TABLE public.sow_subcontractors ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE public.sow_subcontractors ADD COLUMN IF NOT EXISTS email_opened_at timestamptz;
ALTER TABLE public.sow_subcontractors ADD COLUMN IF NOT EXISTS email_clicked_at timestamptz;
ALTER TABLE public.sow_subcontractors ADD COLUMN IF NOT EXISTS portal_viewed_at timestamptz;
ALTER TABLE public.sow_subcontractors ADD COLUMN IF NOT EXISTS follow_up_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.sow_subcontractors ADD COLUMN IF NOT EXISTS last_follow_up_at timestamptz;

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rfq_tokens_token ON public.rfq_tokens(token);
CREATE INDEX IF NOT EXISTS idx_rfq_tokens_sow_sub ON public.rfq_tokens(sow_subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_sow_sub ON public.email_tracking(sow_subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event ON public.email_tracking(event_type);
CREATE INDEX IF NOT EXISTS idx_sub_questions_task_order ON public.subcontractor_questions(task_order_id);
CREATE INDEX IF NOT EXISTS idx_sub_questions_status ON public.subcontractor_questions(status);
CREATE INDEX IF NOT EXISTS idx_quote_form_fields_template ON public.quote_form_fields(template_id);
