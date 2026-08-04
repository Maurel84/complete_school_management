-- Migration: Fix infinite recursion on roles table policies
-- Created: 2026-07-26
-- Description: Drop the write policy on the roles table to eliminate infinite recursion in RLS.

DROP POLICY IF EXISTS "Admins can manage roles" ON roles;
