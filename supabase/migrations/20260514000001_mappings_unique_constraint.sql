-- Add unique constraint to vendor_line_item_mappings for safe upsert
-- (vendor_id, description_text) must be unique per vendor

alter table vendor_line_item_mappings
  add constraint vendor_mappings_unique_desc
  unique (vendor_id, description_text);

-- Also add updated_at to track when mappings change
alter table vendor_line_item_mappings
  add column if not exists updated_at timestamptz not null default now();
