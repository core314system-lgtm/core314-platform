-- Partner Program: Influencer referral tracking tables
-- Run this in Supabase SQL Editor

-- Referral partners (influencers/affiliates)
CREATE TABLE IF NOT EXISTS referral_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  audience_size TEXT,
  promotion_method TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  magic_token TEXT NOT NULL,
  commission_rate NUMERIC(4,2) NOT NULL DEFAULT 0.20,
  commission_months INTEGER NOT NULL DEFAULT 12,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Referral signups (customers referred by partners)
CREATE TABLE IF NOT EXISTS referral_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES referral_partners(id),
  user_email TEXT NOT NULL,
  company_name TEXT,
  plan_name TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'past_due')),
  subscription_started_at TIMESTAMPTZ,
  subscription_cancelled_at TIMESTAMPTZ,
  monthly_amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partner_id, user_email)
);

-- Partner payouts (manual payout tracking)
CREATE TABLE IF NOT EXISTS partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES referral_partners(id),
  month TEXT NOT NULL, -- YYYY-MM format
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partner_id, month)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_partners_email ON referral_partners(email);
CREATE INDEX IF NOT EXISTS idx_referral_partners_code ON referral_partners(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_partners_status ON referral_partners(status);
CREATE INDEX IF NOT EXISTS idx_referral_signups_partner ON referral_signups(partner_id);
CREATE INDEX IF NOT EXISTS idx_referral_signups_stripe ON referral_signups(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner ON partner_payouts(partner_id);

-- RLS policies
ALTER TABLE referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_payouts ENABLE ROW LEVEL SECURITY;

-- Service role has full access (Netlify functions use service role key)
CREATE POLICY "service_role_all_referral_partners" ON referral_partners
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_referral_signups" ON referral_signups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_partner_payouts" ON partner_payouts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
