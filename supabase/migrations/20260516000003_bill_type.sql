-- Add bill_type column to distinguish invoices from credit notes.
-- Default is 'bill'. Credit notes are negative-amount documents from vendors.

alter table bills
  add column if not exists bill_type text not null default 'bill'
  check (bill_type in ('bill', 'credit_note'));
