-- Contact form submissions table
-- Stores all contact form submissions so they are never lost,
-- even when SendGrid is unavailable (e.g. credits exceeded)
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  company text,
  phone text,
  message text NOT NULL,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Allow service role full access (used by Netlify function)
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Service role bypass policy (Netlify function uses service role key)
CREATE POLICY "Service role full access on contact_submissions"
  ON public.contact_submissions
  FOR ALL
  USING (true)
  WITH CHECK (true);
