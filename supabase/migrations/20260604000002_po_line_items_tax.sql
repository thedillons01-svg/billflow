-- PO line items: add is_tax_line flag (mirrors bill_line_items)

alter table po_line_items
  add column if not exists is_tax_line boolean not null default false;
