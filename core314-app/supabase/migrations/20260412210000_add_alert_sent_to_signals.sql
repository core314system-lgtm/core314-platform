-- Add alert_sent column to operational_signals for tracking Slack alert dispatch
ALTER TABLE operational_signals ADD COLUMN IF NOT EXISTS alert_sent boolean DEFAULT false;
