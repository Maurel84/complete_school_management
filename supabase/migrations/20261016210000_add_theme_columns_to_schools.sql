-- Add theme color customization columns to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS theme_primary text DEFAULT '#059669';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS theme_accent text DEFAULT '#d97706';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS theme_preset text DEFAULT 'emerald';
