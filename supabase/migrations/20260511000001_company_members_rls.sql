-- ============================================================
-- COMPANY MEMBERS
-- One row per user per company. Drives all RLS policies.
-- ============================================================

create table company_members (
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(company_id) on delete cascade,
  role       text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

alter table company_members enable row level security;

-- Users can see and manage their own memberships only
create policy "Users manage their own memberships"
  on company_members for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index company_members_user_id_idx on company_members(user_id);
create index company_members_company_id_idx on company_members(company_id);

-- ============================================================
-- Add company_id to processing_log for efficient RLS
-- ============================================================

alter table processing_log
  add column if not exists company_id uuid references companies(company_id);

-- ============================================================
-- DROP all placeholder policies
-- ============================================================

drop policy if exists "Users see their own company"    on companies;
drop policy if exists "Allow all on bills"             on bills;
drop policy if exists "Allow all on bill_line_items"   on bill_line_items;
drop policy if exists "Allow all on vendors"           on vendors;
drop policy if exists "Allow all on qb_accounts_cache" on qb_accounts_cache;
drop policy if exists "Allow all on qb_vendors_cache"  on qb_vendors_cache;
drop policy if exists "Allow all on qb_jobs_cache"     on qb_jobs_cache;
drop policy if exists "Allow all on qb_classes_cache"  on qb_classes_cache;

-- ============================================================
-- REAL RLS POLICIES
-- All use company_members as the source of truth.
-- ============================================================

-- companies: any authenticated user may insert (new account setup),
-- but can only select/update companies they are a member of.
create policy "Members select their company"
  on companies for select
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Members update their company"
  on companies for update
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Authenticated users may create a company"
  on companies for insert
  with check (auth.uid() is not null);

-- All other tables: select/insert/update/delete scoped to member companies
create policy "Members access their vendors"
  on vendors for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Members access their bills"
  on bills for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Members access their bill_line_items"
  on bill_line_items for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Members access their qb_accounts_cache"
  on qb_accounts_cache for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Members access their qb_vendors_cache"
  on qb_vendors_cache for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Members access their qb_jobs_cache"
  on qb_jobs_cache for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Members access their qb_classes_cache"
  on qb_classes_cache for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Members access their exports"
  on exports for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Members access their qbd_heartbeats"
  on qbd_heartbeats for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

create policy "Members access their processing_log"
  on processing_log for all
  using (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ))
  with check (company_id in (
    select company_id from company_members where user_id = auth.uid()
  ));

-- ============================================================
-- BACKFILL: link every existing user to every existing company.
-- Safe for current state (1 user, 1 company). After this, new
-- memberships are created through the onboarding flow.
-- ============================================================

insert into company_members (user_id, company_id, role)
select u.id, c.company_id, 'owner'
from auth.users u
cross join companies c
on conflict do nothing;
