-- Add OCR-extracted fields to bills table
alter table bills
  add column if not exists vendor_name_raw  text,
  add column if not exists subtotal         numeric(12, 2),
  add column if not exists tax_amount       numeric(12, 2),
  add column if not exists ocr_tier         smallint,
  add column if not exists ocr_confidence   numeric(4, 3);
