-- Allow authenticated users to manage files in their company's storage folder.
-- Path format: {company_id}/{bill_id}.pdf
-- We match on the first path segment (split_part on the name).

create policy "Authenticated users can read their company PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bill-pdfs'
    and exists (
      select 1 from company_members
      where company_members.user_id = auth.uid()
        and company_members.company_id::text = split_part(name, '/', 1)
    )
  );

create policy "Authenticated users can upload their company PDFs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bill-pdfs'
    and exists (
      select 1 from company_members
      where company_members.user_id = auth.uid()
        and company_members.company_id::text = split_part(name, '/', 1)
    )
  );

create policy "Authenticated users can delete their company PDFs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'bill-pdfs'
    and exists (
      select 1 from company_members
      where company_members.user_id = auth.uid()
        and company_members.company_id::text = split_part(name, '/', 1)
    )
  );
