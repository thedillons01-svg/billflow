-- Add class tracking toggle to companies.
-- When enabled, class fields appear on bill line items in Purchasomatic.

alter table companies
  add column if not exists class_tracking_enabled boolean not null default false;
