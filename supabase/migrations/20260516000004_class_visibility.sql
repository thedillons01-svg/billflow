-- Add is_hidden to qb_classes_cache so admins can hide individual QB classes
-- from Purchasomatic dropdowns without affecting QB itself.

alter table qb_classes_cache
  add column if not exists is_hidden boolean not null default false;
