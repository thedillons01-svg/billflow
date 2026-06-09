-- Add published_at timestamp to bills, backfilled for existing published bills
alter table bills add column if not exists published_at timestamptz;

-- Backfill: existing published bills get their updated_at or created_at as a best-guess timestamp.
-- (There is no updated_at on bills, so we use created_at as a fallback.)
update bills set published_at = created_at where status = 'published' and published_at is null;
