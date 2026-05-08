-- Placeholder RLS for QB cache tables
create policy "Allow all on qb_accounts_cache"
  on qb_accounts_cache for all
  using (true);

create policy "Allow all on qb_vendors_cache"
  on qb_vendors_cache for all
  using (true);

create policy "Allow all on qb_jobs_cache"
  on qb_jobs_cache for all
  using (true);

create policy "Allow all on qb_classes_cache"
  on qb_classes_cache for all
  using (true);
