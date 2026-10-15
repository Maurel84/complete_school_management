-- Add stamp_url, signature_url, and director_name to schools table for official card stamping and signing
ALTER TABLE schools ADD COLUMN IF NOT EXISTS stamp_url text DEFAULT '';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS signature_url text DEFAULT '';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS director_name text DEFAULT '';
