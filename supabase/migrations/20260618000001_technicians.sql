create table if not exists technicians (
  technician_id uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(company_id) on delete cascade,
  name          text not null,
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table technicians enable row level security;

alter table purchase_orders
  add column if not exists notify_technician_id uuid references technicians(technician_id) on delete set null;

create policy "company members can manage technicians"
  on technicians
  for all
  to authenticated
  using (
    company_id in (
      select company_id from company_members where user_id = (select auth.uid())
    )
  )
  with check (
    company_id in (
      select company_id from company_members where user_id = (select auth.uid())
    )
  );
