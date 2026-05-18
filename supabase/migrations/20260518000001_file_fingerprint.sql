-- File fingerprint for duplicate PDF detection at ingest

alter table bills
  add column if not exists file_fingerprint text;

create index if not exists bills_company_fingerprint_idx
  on bills (company_id, file_fingerprint)
  where file_fingerprint is not null and deleted_at is null;

alter table purchase_orders
  add column if not exists file_fingerprint text;

create index if not exists pos_company_fingerprint_idx
  on purchase_orders (company_id, file_fingerprint)
  where file_fingerprint is not null and deleted_at is null;
