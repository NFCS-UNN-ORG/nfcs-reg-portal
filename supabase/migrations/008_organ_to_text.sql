-- ============================================================
-- MIGRATION 008: MULTIPLE SELECTION FOR ORGAN & SOCIETY
-- ============================================================
-- This migration converts the `organ` column from enum `organ_type` to `TEXT`
-- in order to support multi-select checkbox choices (comma-separated storage).
-- The `society` column is already `TEXT` and already supports multiple choices.

ALTER TABLE public.profiles 
  ALTER COLUMN organ TYPE TEXT USING organ::TEXT;

ALTER TABLE public.legacy_members 
  ALTER COLUMN organ TYPE TEXT USING organ::TEXT;
