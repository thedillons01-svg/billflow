-- Job customer/sub-customer hierarchy and status management (v4.1 items 24–25)

-- ============================================================
-- qb_jobs_cache — hierarchy and status fields
-- ============================================================

alter table qb_jobs_cache
  add column if not exists parent_id   text,        -- qb_customer_id of parent; null if top-level
  add column if not exists is_customer boolean not null default false,  -- true = top-level customer
  add column if not exists status      text not null default 'active'
    check (status in ('active', 'closed'));

-- ============================================================
-- companies — job tagging level and auto-close threshold
-- ============================================================

alter table companies
  add column if not exists job_tagging_level    text not null default 'sub_customers_only'
    check (job_tagging_level in ('sub_customers_only', 'customers_only', 'both')),
  add column if not exists auto_close_jobs_days integer;  -- null = disabled; default 90 enforced in app
