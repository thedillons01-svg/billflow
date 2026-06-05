-- Add created_at to po_line_items
alter table po_line_items
  add column if not exists created_at timestamptz not null default now();

-- Add QB metadata dates to qb_jobs_cache for activity-based auto-close
alter table qb_jobs_cache
  add column if not exists qb_created_at  timestamptz,
  add column if not exists qb_updated_at  timestamptz;
