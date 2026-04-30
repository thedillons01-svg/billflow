-- BillFlow Initial Schema
-- Migration: 20260429000000_initial_schema
-- Based on Section 12 of BillFlow_Requirements_v3.md

-- ============================================================
-- ENUMS
-- ============================================================

create type qb_type as enum ('qbo', 'qbd');

create type fsm_platform as enum ('hcp', 'workiz', 'servicetrade', 'jobber', 'other', 'unknown');

create type source_override as enum ('qb_default', 'billflow_override', 'not_set');

create type confidence_level as enum ('high', 'medium', 'low');

create type bill_status as enum ('draft', 'ready', 'publishing', 'published', 'sync_error');

create type publish_method as enum ('manual', 'auto');

create type capture_source as enum ('email', 'upload');

create type export_format as enum ('pdf', 'excel');

create type connector_status as enum ('running', 'overdue', 'alert');

-- ============================================================
-- COMPANIES
-- ============================================================

create table companies (
  company_id              uuid primary key default gen_random_uuid(),
  name                    text not null,
  qb_type                 qb_type,
  qb_connection_status    text,
  qb_last_sync            timestamptz,
  capture_email_prefix    text unique,
  fsm_platform            fsm_platform default 'unknown',
  job_costing_enabled     boolean not null default false,
  created_at              timestamptz not null default now()
);

-- ============================================================
-- VENDORS
-- ============================================================

create table vendors (
  vendor_id                   uuid primary key default gen_random_uuid(),
  company_id                  uuid not null references companies(company_id) on delete cascade,
  vendor_name_extracted       text not null,
  vendor_name_display         text,
  qb_vendor_id                text,
  qb_vendor_name              text,
  qb_default_gl_account_id    text,
  billflow_gl_account_id      text,
  gl_account_source           source_override not null default 'not_set',
  qb_default_class_id         text,
  billflow_class_id           text,
  class_source                source_override not null default 'not_set',
  qb_payment_terms            text,
  billflow_payment_terms      text,
  payment_terms_source        source_override not null default 'not_set',
  auto_publish_enabled        boolean not null default false,
  hold_for_job_match          boolean not null default false,
  copy_po_to_qb_reference     boolean not null default true,
  invoices_processed          integer not null default 0,
  confidence_score            numeric(4,2) check (confidence_score >= 0 and confidence_score <= 1),
  confidence_display          confidence_level,
  known_format                jsonb,
  email_domains               text[],
  last_invoice_date           date,
  created_at                  timestamptz not null default now()
);

create index vendors_company_id_idx on vendors(company_id);
create index vendors_qb_vendor_id_idx on vendors(company_id, qb_vendor_id);

-- ============================================================
-- BILLS
-- ============================================================

create table bills (
  bill_id                 uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(company_id) on delete cascade,
  vendor_id               uuid references vendors(vendor_id),
  invoice_number          text,
  invoice_date            date,
  due_date                date,
  total                   numeric(10,2),
  vendor_po_reference     text,
  qb_reference_number     text,
  status                  bill_status not null default 'draft',
  publish_method          publish_method,
  qb_bill_id              text,  -- only set after QB confirms receipt
  qb_sync_status          text,
  qb_sync_error           text,
  autopublish_hold_reason text,
  pdf_url                 text,
  capture_source          capture_source,
  created_at              timestamptz not null default now()
);

create index bills_company_id_status_idx on bills(company_id, status);
create index bills_company_id_vendor_idx on bills(company_id, vendor_id);
-- Duplicate detection: same vendor + same invoice number
create index bills_duplicate_check_idx on bills(vendor_id, invoice_number);

-- ============================================================
-- BILL LINE ITEMS
-- ============================================================

create table bill_line_items (
  line_id                 uuid primary key default gen_random_uuid(),
  bill_id                 uuid not null references bills(bill_id) on delete cascade,
  company_id              uuid not null references companies(company_id) on delete cascade,
  description             text,
  quantity                numeric(10,4),
  unit_cost               numeric(10,2),
  extended_cost           numeric(10,2),
  gl_account_id           text,   -- QB GL account ID
  qb_item_id              text,   -- nullable: only used when Items table mode is on
  job_id                  text,   -- QB job/project ID, nullable
  class_id                text,   -- QB class ID, nullable
  extraction_confidence   numeric(4,2) check (extraction_confidence >= 0 and extraction_confidence <= 1),
  sort_order              integer not null default 0
);

create index bill_line_items_bill_id_idx on bill_line_items(bill_id);

-- ============================================================
-- QB CACHE TABLES
-- ============================================================

create table qb_jobs_cache (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references companies(company_id) on delete cascade,
  qb_job_id               text not null,
  job_name                text,
  job_number              text,
  customer_name           text,
  customer_id             text,
  qb_class_id             text,
  last_transaction_date   date,
  cached_at               timestamptz not null default now(),
  unique (company_id, qb_job_id)
);

create index qb_jobs_cache_company_idx on qb_jobs_cache(company_id);
-- Support type-to-filter search across job number, name, customer name
create index qb_jobs_cache_search_idx on qb_jobs_cache using gin(
  to_tsvector('english', coalesce(job_number, '') || ' ' || coalesce(job_name, '') || ' ' || coalesce(customer_name, ''))
);

create table qb_vendors_cache (
  id                          uuid primary key default gen_random_uuid(),
  company_id                  uuid not null references companies(company_id) on delete cascade,
  qb_vendor_id                text not null,
  name                        text,
  default_expense_account_id  text,
  payment_terms               text,
  cached_at                   timestamptz not null default now(),
  unique (company_id, qb_vendor_id)
);

create index qb_vendors_cache_company_idx on qb_vendors_cache(company_id);

create table qb_accounts_cache (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(company_id) on delete cascade,
  qb_account_id       text not null,
  name                text,
  account_type        text,
  account_sub_type    text,
  cached_at           timestamptz not null default now(),
  unique (company_id, qb_account_id)
);

create index qb_accounts_cache_company_idx on qb_accounts_cache(company_id);

create table qb_classes_cache (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(company_id) on delete cascade,
  qb_class_id     text not null,
  name            text,
  cached_at       timestamptz not null default now(),
  unique (company_id, qb_class_id)
);

create index qb_classes_cache_company_idx on qb_classes_cache(company_id);

-- ============================================================
-- PROCESSING LOG
-- Append-only audit trail. Every action on every bill permanently recorded.
-- ============================================================

create table processing_log (
  id              uuid primary key default gen_random_uuid(),
  bill_id         uuid references bills(bill_id),
  action          text not null,
  actor           text not null,  -- user_id or 'system'
  timestamp       timestamptz not null default now(),
  before_state    jsonb,
  after_state     jsonb
);

create index processing_log_bill_id_idx on processing_log(bill_id);
create index processing_log_timestamp_idx on processing_log(timestamp);

-- ============================================================
-- EXPORTS
-- ============================================================

create table exports (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(company_id) on delete cascade,
  export_date         timestamptz not null default now(),
  date_range_start    date,
  date_range_end      date,
  vendor_filter       text[],
  job_filter          text[],
  bill_ids_included   uuid[],
  format              export_format not null
);

create index exports_company_id_idx on exports(company_id);

-- ============================================================
-- QBD HEARTBEATS
-- One row per company. Upserted on every Web Connector poll.
-- ============================================================

create table qbd_heartbeats (
  company_id          uuid primary key references companies(company_id) on delete cascade,
  last_heartbeat_at   timestamptz,
  last_sync_at        timestamptz,
  connector_status    connector_status not null default 'overdue'
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Enable RLS on all tables. Policies scoped to company_id.
-- ============================================================

alter table companies         enable row level security;
alter table vendors           enable row level security;
alter table bills             enable row level security;
alter table bill_line_items   enable row level security;
alter table qb_jobs_cache     enable row level security;
alter table qb_vendors_cache  enable row level security;
alter table qb_accounts_cache enable row level security;
alter table qb_classes_cache  enable row level security;
alter table processing_log    enable row level security;
alter table exports           enable row level security;
alter table qbd_heartbeats    enable row level security;

-- companies: user can only see their own company
-- (company membership join table added in auth migration)
-- Placeholder policy — tightened once user/company membership table exists:
create policy "Users see their own company"
  on companies for all
  using (true);  -- replaced once auth layer is in place
