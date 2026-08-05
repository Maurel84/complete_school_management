-- Migration: Add school images columns and allow public SELECT on schools
-- Created: 2026-08-05

ALTER TABLE schools ADD COLUMN IF NOT EXISTS facade_url text DEFAULT '';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS students_uniform_url text DEFAULT '';

-- Allow anyone (public) to SELECT school details for branding on login page / parent portal
DROP POLICY IF EXISTS "Authenticated users can view their school" ON schools;
DROP POLICY IF EXISTS "Anyone can view schools" ON schools;
CREATE POLICY "Anyone can view schools" ON schools FOR SELECT USING (true);
