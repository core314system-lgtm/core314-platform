-- GSA eLibrary Scrape Progress Tracking Table
-- Run this in Supabase SQL Editor before using the background scraper

CREATE TABLE IF NOT EXISTS public.gsa_scrape_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle',
  current_letter TEXT DEFAULT 'A',
  current_url_index INTEGER DEFAULT 0,
  urls_for_letter JSONB DEFAULT '[]',
  letters_completed TEXT[] DEFAULT '{}',
  total_scraped INTEGER DEFAULT 0,
  total_inserted INTEGER DEFAULT 0,
  total_updated INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Allow service role full access (no RLS restrictions for server-side functions)
ALTER TABLE public.gsa_scrape_progress ENABLE ROW LEVEL SECURITY;

-- Policy for service role
CREATE POLICY "Service role full access" ON public.gsa_scrape_progress
  FOR ALL USING (true) WITH CHECK (true);
