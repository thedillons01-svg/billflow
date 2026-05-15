-- Run in Supabase SQL editor: Dashboard → SQL Editor → New query
-- Adds subscription tracking columns to the companies table.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_status  TEXT    NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS plan_credits         INT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Set all existing companies to trial status
UPDATE companies SET subscription_status = 'trial' WHERE subscription_status IS NULL;

-- Grant 25 trial credits to any existing companies that have 0 credits
-- (new signups will get credits via the onboarding action going forward)
UPDATE companies
  SET credit_balance = 25
WHERE credit_balance = 0 OR credit_balance IS NULL;
