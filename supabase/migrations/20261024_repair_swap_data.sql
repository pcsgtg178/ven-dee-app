-- Migration: Data Repair Script for VenDee Shift Swap Inconsistencies
-- Date: 2026-10-24
-- Purpose:
-- 1. Hard-delete orphan cancelled child shifts created by previous incomplete undo swaps.
-- 2. Restore orphan swapped_out parent shifts whose swapped children have been deleted.
-- 3. Clear lingering swap metadata on active shifts where no active swap exists.
-- 4. Specifically clean up the known corrupt swap entry ("บีม บ่าย 3 พ.ย. 2026").

BEGIN;

-- 1. Specifically purge the corrupted swap child for Beam (afternoon, 2026-11-03)
DELETE FROM public.shifts
WHERE shift_date = '2026-11-03'
  AND shift_type = 'afternoon'
  AND (swapped_with = 'บีม' OR original_owner = 'บีม' OR parent_shift_id IS NOT NULL);

-- 2. Delete all child shifts that were marked as 'cancelled' from previous incomplete swap undos
DELETE FROM public.shifts
WHERE status = 'cancelled'
  AND parent_shift_id IS NOT NULL;

-- 3. Restore any parent shifts that remain 'swapped_out' but have no active/chain child referencing them
UPDATE public.shifts
SET
  status = 'active',
  swapped_with = NULL,
  swap_date = NULL,
  swap_reason = NULL,
  original_owner = NULL,
  swap_history = '[]'::jsonb
WHERE status = 'swapped_out'
  AND id NOT IN (
    SELECT DISTINCT parent_shift_id
    FROM public.shifts
    WHERE parent_shift_id IS NOT NULL
      AND status IN ('active', 'swapped_out')
  );

-- 4. Clear lingering swap fields on active parent shifts that have no child referencing them
UPDATE public.shifts
SET
  swapped_with = NULL,
  swap_date = NULL,
  swap_reason = NULL,
  original_owner = NULL,
  swap_history = '[]'::jsonb
WHERE status = 'active'
  AND (swapped_with IS NOT NULL OR original_owner IS NOT NULL)
  AND id NOT IN (
    SELECT DISTINCT parent_shift_id
    FROM public.shifts
    WHERE parent_shift_id IS NOT NULL
      AND status IN ('active', 'swapped_out')
  );

COMMIT;
