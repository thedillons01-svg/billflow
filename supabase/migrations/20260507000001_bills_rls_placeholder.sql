-- Placeholder RLS policies for bills and line_items
-- Tightened once user/company membership table exists
create policy "Allow all on bills"
  on bills for all
  using (true);

create policy "Allow all on bill_line_items"
  on bill_line_items for all
  using (true);

create policy "Allow all on vendors"
  on vendors for all
  using (true);
