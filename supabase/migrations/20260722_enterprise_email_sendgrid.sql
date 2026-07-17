-- Finish the Mailgun -> SendGrid migration for enterprise custom email domains.
-- The SendGrid whitelabel domain id was being stored in a column still named
-- `mailgun_domain_id`. Rename it to `sendgrid_domain_id` so the schema reflects
-- the actual (and only) email provider. No data is lost — the values (SendGrid
-- domain ids) are preserved by the rename.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_email_domains'
      AND column_name = 'mailgun_domain_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_email_domains'
      AND column_name = 'sendgrid_domain_id'
  ) THEN
    ALTER TABLE public.org_email_domains RENAME COLUMN mailgun_domain_id TO sendgrid_domain_id;
  END IF;
END $$;

-- Default new domains to the SendGrid provider (the platform's sole email provider).
ALTER TABLE public.org_email_domains
  ALTER COLUMN provider SET DEFAULT 'sendgrid';
