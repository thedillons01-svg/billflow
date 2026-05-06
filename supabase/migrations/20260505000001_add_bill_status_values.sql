-- Add bill status values for inbox tabs
alter type bill_status add value if not exists 'needs_review' before 'draft';
alter type bill_status add value if not exists 'pending_job_match' before 'publishing';
