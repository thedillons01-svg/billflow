-- Add is_hidden flag to qb_accounts_cache so admins can hide individual accounts
-- from Purchasomatic dropdowns without removing them from the cache.

alter table qb_accounts_cache
  add column if not exists is_hidden boolean not null default false;
