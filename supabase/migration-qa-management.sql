-- =====================================================
-- AI-Powered Q&A Management Migration
-- Phase 1: Core tables, AI search, question tracking
-- =====================================================

-- 1. Opportunity Questions — tracks every question from both prime team and subcontractors
--    with AI analysis results, confidence scores, and mandatory source citations
CREATE TABLE IF NOT EXISTS public.opportunity_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_order_id uuid NOT NULL REFERENCES public.task_orders ON DELETE CASCADE,
  sow_subcontractor_id uuid REFERENCES public.sow_subcontractors ON DELETE SET NULL,
  subcontractor_id uuid REFERENCES public.subcontractors ON DELETE SET NULL,
  submitted_by_type text NOT NULL DEFAULT 'subcontractor' CHECK (submitted_by_type IN ('subcontractor', 'prime_team')),
  submitted_by_user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  question_text text NOT NULL,
  related_section text,

  -- AI Analysis results
  ai_answer text,
  ai_confidence_score numeric(5,2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 100),
  ai_source_references jsonb DEFAULT '[]',

  -- Official answer (from buyer Q&A response)
  official_answer text,
  official_source_document_id uuid REFERENCES public.documents ON DELETE SET NULL,

  -- Status tracking
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'auto_answered',
    'pending_review',
    'pending_submission',
    'submitted',
    'answered',
    'unanswerable',
    'dismissed'
  )),

  -- Metadata
  question_category text,
  is_from_portal boolean NOT NULL DEFAULT false,
  rfq_token_id uuid REFERENCES public.rfq_tokens ON DELETE SET NULL,
  submission_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunity_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage opportunity questions" ON public.opportunity_questions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Portal users can insert opportunity questions" ON public.opportunity_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Portal users can read own questions" ON public.opportunity_questions FOR SELECT USING (true);


-- 2. Question Submissions — tracks formal Q&A submission batches to buyer
CREATE TABLE IF NOT EXISTS public.question_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_order_id uuid NOT NULL REFERENCES public.task_orders ON DELETE CASCADE,
  submission_deadline timestamptz NOT NULL,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users ON DELETE SET NULL,
  question_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'response_received', 'closed')),
  response_received_at timestamptz,
  response_document_id uuid REFERENCES public.documents ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.question_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage question submissions" ON public.question_submissions FOR ALL USING (auth.uid() IS NOT NULL);

-- Add FK from opportunity_questions to question_submissions
ALTER TABLE public.opportunity_questions
  ADD CONSTRAINT fk_oq_submission FOREIGN KEY (submission_id) REFERENCES public.question_submissions(id) ON DELETE SET NULL;


-- 3. Question Answer History — long-term learning repository
CREATE TABLE IF NOT EXISTS public.question_answer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_question_id uuid REFERENCES public.opportunity_questions ON DELETE SET NULL,
  task_order_id uuid REFERENCES public.task_orders ON DELETE SET NULL,
  question_category text,
  question_pattern text NOT NULL,
  answer_pattern text,
  opportunity_type text,
  agency text,
  was_auto_answered boolean NOT NULL DEFAULT false,
  confidence_score numeric(5,2),
  source_document_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.question_answer_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage question history" ON public.question_answer_history FOR ALL USING (auth.uid() IS NOT NULL);


-- 4. Add question_deadline to task_orders for tracking formal Q&A submission dates
ALTER TABLE public.task_orders ADD COLUMN IF NOT EXISTS question_deadline timestamptz;


-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_oq_task_order ON public.opportunity_questions(task_order_id);
CREATE INDEX IF NOT EXISTS idx_oq_status ON public.opportunity_questions(status);
CREATE INDEX IF NOT EXISTS idx_oq_sub ON public.opportunity_questions(sow_subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_oq_created ON public.opportunity_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oq_confidence ON public.opportunity_questions(ai_confidence_score);
CREATE INDEX IF NOT EXISTS idx_qs_task_order ON public.question_submissions(task_order_id);
CREATE INDEX IF NOT EXISTS idx_qs_deadline ON public.question_submissions(submission_deadline);
CREATE INDEX IF NOT EXISTS idx_qah_category ON public.question_answer_history(question_category);
CREATE INDEX IF NOT EXISTS idx_qah_pattern ON public.question_answer_history(question_pattern);
