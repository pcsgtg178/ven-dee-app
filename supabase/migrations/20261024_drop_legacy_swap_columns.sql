-- Migration: 20261024_drop_legacy_swap_columns.sql
-- Migration C: Drop Legacy Shift Swap Columns from public.shifts
-- Run ONLY after application deployment with shift_swaps table is confirmed in production.
-- Reference: BACKLOG_MIGRATE.md §4.3, Phase 10.7

BEGIN;

ALTER TABLE public.shifts
  DROP COLUMN IF EXISTS swapped_with,
  DROP COLUMN IF EXISTS original_owner,
  DROP COLUMN IF EXISTS parent_shift_id,
  DROP COLUMN IF EXISTS swap_date,
  DROP COLUMN IF EXISTS swap_reason,
  DROP COLUMN IF EXISTS swap_history;

COMMIT;
