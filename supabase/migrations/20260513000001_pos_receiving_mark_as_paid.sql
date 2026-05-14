-- ============================================================
-- BillFlow Migration: POs, Receiving, Mark as Paid, Notifications
-- Adds all tables/columns needed for steps 12-20
-- ============================================================

-- ── Payment method enum ──────────────────────────────────────────────────────
do $$ begin
  create type payment_method as enum ('check', 'ach', 'credit_card', 'other');
exception when duplicate_object then null;
end $$;

-- ── PO status enum ───────────────────────────────────────────────────────────
do $$ begin
  create type po_status as enum ('open', 'partially_received', 'received', 'closed');
exception when duplicate_object then null;
end $$;

-- ── GL account source enum for line items ────────────────────────────────────
do $$ begin
  create type gl_account_source as enum ('qb_default', 'billflow_override', 'rule', 'stored_mapping', 'manual');
exception when duplicate_object then null;
end $$;

-- ── Notification type enum ───────────────────────────────────────────────────
do $$ begin
  create type notification_type as enum ('error', 'success', 'info');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- BILLS — add Mark as Paid, memo, totals, soft delete, PO link
-- ============================================================

alter table bills
  add column if not exists description          text,
  add column if not exists line_items_total     numeric(10,2),
  add column if not exists mark_as_paid         boolean not null default false,
  add column if not exists payment_account_id   text,
  add column if not exists payment_method       payment_method,
  add column if not exists payment_date         date,
  add column if not exists payment_ref_number   text,
  add column if not exists qb_payment_id        text,
  add column if not exists deleted_at           timestamptz,
  add column if not exists matched_po_id        uuid;

create index if not exists bills_deleted_at_idx on bills(company_id, deleted_at);

-- ============================================================
-- BILL LINE ITEMS — add is_tax_line, gl_account_source
-- ============================================================

alter table bill_line_items
  add column if not exists is_tax_line       boolean not null default false,
  add column if not exists gl_account_source gl_account_source not null default 'manual';

-- ============================================================
-- VENDORS — add is_visible, description, mark-as-paid defaults
-- ============================================================

alter table vendors
  add column if not exists is_visible               boolean not null default true,
  add column if not exists default_description      text,
  add column if not exists default_payment_account_id text,
  add column if not exists default_payment_method   payment_method,
  add column if not exists mark_as_paid_default     boolean not null default false;

-- ============================================================
-- COMPANIES — add use_items_table, notification prefs, Stripe
-- ============================================================

alter table companies
  add column if not exists use_items_table            boolean not null default false,
  add column if not exists notification_emails        text[],
  add column if not exists notify_uploader            boolean not null default true,
  add column if not exists success_notifications      boolean not null default true,
  add column if not exists daily_digest               boolean not null default false,
  add column if not exists stripe_customer_id         text,
  add column if not exists stripe_subscription_id     text,
  add column if not exists plan_name                  text default 'free',
  add column if not exists credit_balance             integer not null default 0;

-- ============================================================
-- PROCESSING LOG — add document_type, credits_used columns
-- ============================================================

alter table processing_log
  add column if not exists document_type   text,
  add column if not exists document_id     uuid,
  add column if not exists credits_used    integer not null default 0;

-- ============================================================
-- VENDOR LINE ITEM MAPPINGS
-- ============================================================

create table if not exists vendor_line_item_mappings (
  id                  uuid primary key default gen_random_uuid(),
  vendor_id           uuid not null references vendors(vendor_id) on delete cascade,
  company_id          uuid not null references companies(company_id) on delete cascade,
  description_text    text not null,
  gl_account_id       text,
  qb_item_id          text,
  created_at          timestamptz not null default now()
);

create index if not exists vendor_mappings_vendor_idx on vendor_line_item_mappings(vendor_id);
alter table vendor_line_item_mappings enable row level security;
create policy "Members access their vendor_line_item_mappings"
  on vendor_line_item_mappings for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

-- ============================================================
-- VENDOR LINE ITEM RULES
-- ============================================================

create table if not exists vendor_line_item_rules (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references vendors(vendor_id) on delete cascade,
  company_id      uuid not null references companies(company_id) on delete cascade,
  rule_name       text not null,
  match_type      text not null default 'all',
  conditions      jsonb not null default '[]',
  gl_account_id   text,
  qb_item_id      text,
  priority        integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists vendor_rules_vendor_idx on vendor_line_item_rules(vendor_id, priority);
alter table vendor_line_item_rules enable row level security;
create policy "Members access their vendor_line_item_rules"
  on vendor_line_item_rules for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================

create table if not exists purchase_orders (
  po_id                   uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(company_id) on delete cascade,
  vendor_id               uuid references vendors(vendor_id),
  vendor_name_raw         text,
  po_number               text,
  order_date              date,
  expected_delivery_date  date,
  job_id                  text,
  status                  po_status not null default 'open',
  qb_po_id                text,
  qb_sync_error           text,
  pdf_url                 text,
  capture_source          capture_source,
  created_by              uuid,
  notes                   text,
  deleted_at              timestamptz,
  created_at              timestamptz not null default now()
);

create index if not exists purchase_orders_company_status_idx on purchase_orders(company_id, status);
create index if not exists purchase_orders_vendor_idx on purchase_orders(company_id, vendor_id);

alter table purchase_orders enable row level security;
create policy "Members access their purchase_orders"
  on purchase_orders for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

-- ============================================================
-- PO LINE ITEMS
-- ============================================================

create table if not exists po_line_items (
  line_id                 uuid primary key default gen_random_uuid(),
  po_id                   uuid not null references purchase_orders(po_id) on delete cascade,
  company_id              uuid not null references companies(company_id) on delete cascade,
  description             text,
  quantity_ordered        numeric(10,4),
  quantity_received       numeric(10,4) not null default 0,
  unit_cost               numeric(10,2),
  extended_cost           numeric(10,2),
  gl_account_id           text,
  job_id                  text,
  sort_order              integer not null default 0
);

create index if not exists po_line_items_po_idx on po_line_items(po_id);

alter table po_line_items enable row level security;
create policy "Members access their po_line_items"
  on po_line_items for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

-- ============================================================
-- RECEIVING RECORDS
-- ============================================================

create table if not exists receiving_records (
  id              uuid primary key default gen_random_uuid(),
  po_id           uuid not null references purchase_orders(po_id) on delete cascade,
  company_id      uuid not null references companies(company_id) on delete cascade,
  received_by     uuid,
  received_at     timestamptz not null default now(),
  notes           text,
  line_items      jsonb not null default '[]'
);

create index if not exists receiving_records_po_idx on receiving_records(po_id);

alter table receiving_records enable row level security;
create policy "Members access their receiving_records"
  on receiving_records for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

-- ============================================================
-- QB ACCOUNT & CLASS VISIBILITY
-- ============================================================

create table if not exists qb_accounts_visibility (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(company_id) on delete cascade,
  qb_account_id   text not null,
  is_visible      boolean not null default true,
  unique (company_id, qb_account_id)
);

alter table qb_accounts_visibility enable row level security;
create policy "Members access their qb_accounts_visibility"
  on qb_accounts_visibility for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create table if not exists qb_classes_visibility (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(company_id) on delete cascade,
  qb_class_id     text not null,
  is_visible      boolean not null default true,
  unique (company_id, qb_class_id)
);

alter table qb_classes_visibility enable row level security;
create policy "Members access their qb_classes_visibility"
  on qb_classes_visibility for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

-- ============================================================
-- NOTIFICATIONS (in-app bell)
-- ============================================================

create table if not exists notifications (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(company_id) on delete cascade,
  user_id         uuid,
  type            notification_type not null default 'info',
  title           text not null,
  body            text,
  bill_id         uuid references bills(bill_id),
  po_id           uuid references purchase_orders(po_id),
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists notifications_company_user_idx on notifications(company_id, user_id, is_read);
create index if not exists notifications_created_at_idx on notifications(company_id, created_at desc);

alter table notifications enable row level security;
create policy "Members access their notifications"
  on notifications for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

-- ============================================================
-- CREDIT LEDGER (for billing/credits step 23)
-- ============================================================

create table if not exists credit_ledger (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(company_id) on delete cascade,
  amount              integer not null,
  description         text not null,
  stripe_payment_id   text,
  bill_id             uuid references bills(bill_id),
  created_at          timestamptz not null default now()
);

create index if not exists credit_ledger_company_idx on credit_ledger(company_id, created_at desc);

alter table credit_ledger enable row level security;
create policy "Members access their credit_ledger"
  on credit_ledger for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));
