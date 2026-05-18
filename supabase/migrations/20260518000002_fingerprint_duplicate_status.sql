-- Add fingerprint_duplicate status for bills that are exact PDF re-submissions
alter type bill_status add value if not exists 'fingerprint_duplicate' before 'draft';
