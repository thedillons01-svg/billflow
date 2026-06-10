-- Backfill bill status based on data completeness (vendor + GL accounts).
-- Going forward, refreshBillStatus() in actions.ts handles this automatically.

-- Promote draft → ready where data is complete
UPDATE bills b
SET status = 'ready'
WHERE b.status = 'draft'
  AND b.deleted_at IS NULL
  AND b.vendor_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM bill_line_items li WHERE li.bill_id = b.bill_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM bill_line_items li WHERE li.bill_id = b.bill_id AND li.gl_account_id IS NULL
  );

-- Demote ready → draft where data is incomplete
UPDATE bills b
SET status = 'draft'
WHERE b.status = 'ready'
  AND b.deleted_at IS NULL
  AND (
    b.vendor_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM bill_line_items li WHERE li.bill_id = b.bill_id
    )
    OR EXISTS (
      SELECT 1 FROM bill_line_items li WHERE li.bill_id = b.bill_id AND li.gl_account_id IS NULL
    )
  );
