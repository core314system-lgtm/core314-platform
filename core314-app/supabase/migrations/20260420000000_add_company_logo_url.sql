-- Add company_logo_url column to profiles table for PowerPoint brief branding
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_logo_url text;
