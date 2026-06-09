-- Remove the created_at backfill — published_at should only be set by an actual QB push
UPDATE bills SET published_at = NULL WHERE status = 'published' AND published_at = created_at;
