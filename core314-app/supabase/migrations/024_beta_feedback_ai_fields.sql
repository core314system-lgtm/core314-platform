
ALTER TABLE public.beta_feedback 
ADD COLUMN IF NOT EXISTS ai_category TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_summary TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_sentiment TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS beta_feedback_ai_category_idx ON public.beta_feedback(ai_category);
CREATE INDEX IF NOT EXISTS beta_feedback_ai_sentiment_idx ON public.beta_feedback(ai_sentiment);


COMMENT ON COLUMN public.beta_feedback.ai_category IS 'AI-generated category classification (admin-only)';
COMMENT ON COLUMN public.beta_feedback.ai_summary IS 'AI-generated summary of feedback (admin-only)';
COMMENT ON COLUMN public.beta_feedback.ai_sentiment IS 'AI-generated sentiment analysis: positive, neutral, negative (admin-only)';
