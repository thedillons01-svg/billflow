-- Company-level line item rules (apply across all vendors; vendor rules take priority)
create table if not exists company_line_item_rules (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(company_id) on delete cascade,
  rule_name     text not null,
  match_type    text not null default 'all',
  conditions    jsonb not null default '[]',
  gl_account_id text,
  priority      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists company_line_item_rules_company_id_priority
  on company_line_item_rules(company_id, priority);

alter table company_line_item_rules enable row level security;

create policy "company_rules_select" on company_line_item_rules
  for select using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );

create policy "company_rules_insert" on company_line_item_rules
  for insert with check (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );

create policy "company_rules_delete" on company_line_item_rules
  for delete using (
    company_id in (
      select company_id from company_members where user_id = auth.uid()
    )
  );
