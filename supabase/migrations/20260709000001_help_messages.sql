CREATE TABLE help_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(company_id),
  user_id uuid,
  user_email text,
  message text NOT NULL,
  page_url text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE help_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members access their help messages"
  ON help_messages
  FOR ALL
  TO authenticated
  USING (company_id IN (SELECT company_members.company_id FROM company_members WHERE company_members.user_id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_members.company_id FROM company_members WHERE company_members.user_id = (select auth.uid())));
