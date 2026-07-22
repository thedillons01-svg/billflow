-- OwnerID was derived directly from company_id, so it could never be rotated.
-- QuickBooks Desktop permanently remembers the first OwnerID/FileID pair it saw
-- for a company file — pre-fix customers who connected while FileID was still
-- being regenerated on every download got a mismatched pair baked in on the QB
-- side, which "remove and re-add" in Web Connector cannot clear (QBWC1039).
-- Making OwnerID a stored, rotatable value lets support hand a stuck customer a
-- pair QuickBooks has never seen before, by nulling out both columns.
alter table companies
  add column if not exists qbd_owner_id text;

-- Backfill: preserve the existing derived OwnerID for every company so already-
-- working QuickBooks Desktop connections keep matching after this migration.
update companies
  set qbd_owner_id = '{' || upper(company_id::text) || '}'
  where qbd_owner_id is null;
