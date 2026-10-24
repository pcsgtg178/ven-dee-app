-- Pre-check & Verification queries before running shift_swaps migration
-- Reference: BACKLOG_MIGRATE.md §4.0

-- (a) Check for orphan swapped_out shifts with no valid active child
SELECT s.id, s.shift_date, s.shift_type, s.swapped_with
FROM public.shifts s
WHERE s.status = 'swapped_out'
  AND NOT EXISTS (
    SELECT 1 FROM public.shifts c
    WHERE c.parent_shift_id = s.id AND c.status <> 'cancelled'
  );

-- (b) Check for child shifts marked as cancelled (from old undo logic)
SELECT id, shift_date, shift_type, parent_shift_id
FROM public.shifts
WHERE parent_shift_id IS NOT NULL AND status = 'cancelled';

-- (c) Check for parent shifts referencing multiple child shifts
SELECT parent_shift_id, count(*) AS child_count
FROM public.shifts
WHERE parent_shift_id IS NOT NULL
GROUP BY parent_shift_id
HAVING count(*) > 1;
