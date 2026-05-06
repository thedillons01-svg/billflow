-- Add QBO OAuth token storage to companies
alter table companies
  add column if not exists qb_realm_id           text,
  add column if not exists qb_access_token       text,
  add column if not exists qb_refresh_token      text,
  add column if not exists qb_token_expires_at   timestamptz;
