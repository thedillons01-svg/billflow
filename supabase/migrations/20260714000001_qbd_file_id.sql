-- FileID must be stable per company, not regenerated on every .QWC download.
-- Regenerating it caused QBWC1039 (Unique OwnerID/FileID pair value required)
-- whenever a customer re-added the app in QuickBooks Integrated Applications.
alter table companies
  add column if not exists qbd_file_id text;
