-- Company-level processing settings referenced in Section 12.2/12.3

alter table companies
  add column if not exists notify_uploader boolean not null default true,
  add column if not exists qb_ref_source text not null default 'po_number'
    check (qb_ref_source in ('invoice_number', 'po_number', 'blank')),
  add column if not exists default_due_date text not null default 'not_required'
    check (default_due_date in ('not_required', 'from_payment_terms'));
