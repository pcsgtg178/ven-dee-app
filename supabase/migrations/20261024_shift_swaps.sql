-- Migration: 20261024_shift_swaps.sql
-- Phase 10: Migrate Shift Swap Data to Dedicated shift_swaps Table & Transactional RPCs
-- Reference: BACKLOG_MIGRATE.md §3, §4

BEGIN;

-- ========================================================================
-- 1. Create shift_swaps table
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.shift_swaps (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    given_shift_id     UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    received_shift_id  UUID NOT NULL UNIQUE REFERENCES public.shifts(id) ON DELETE CASCADE,
    swapped_with       TEXT NOT NULL,
    original_owner     TEXT,
    swap_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    swap_reason        TEXT,
    swap_history       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index to ensure 1 swap record per given shift
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_swaps_given ON public.shift_swaps(given_shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_received ON public.shift_swaps(received_shift_id);

-- Enable Row Level Security
ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on shift_swaps" ON public.shift_swaps;
CREATE POLICY "Allow all operations on shift_swaps"
  ON public.shift_swaps FOR ALL USING (true) WITH CHECK (true);

-- ========================================================================
-- 2. Alter shifts table: add swap_id foreign key (on given/swapped_out shift)
-- ========================================================================
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS swap_id UUID REFERENCES public.shift_swaps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_swap_id ON public.shifts(swap_id);

-- ========================================================================
-- 3. Transactional RPC: perform_shift_swap
-- ========================================================================
CREATE OR REPLACE FUNCTION public.perform_shift_swap(
  p_given_shift_id UUID,
  p_swapped_with TEXT,
  p_original_owner TEXT,
  p_new_date DATE,
  p_new_shift_type TEXT,
  p_new_category TEXT,
  p_swap_reason TEXT,
  p_swap_history JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_given_shift public.shifts%ROWTYPE;
  v_received_shift_id UUID;
  v_swap_id UUID;
  v_swap_date DATE := CURRENT_DATE;
  v_new_note TEXT;
BEGIN
  -- 1. Validate given shift
  SELECT * INTO v_given_shift FROM public.shifts WHERE id = p_given_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIFT_NOT_FOUND: ไม่พบเวรที่ต้องการแลก';
  END IF;

  IF v_given_shift.status = 'swapped_out' OR v_given_shift.status = 'sold_out' THEN
    RAISE EXCEPTION 'SHIFT_ALREADY_SWAPPED: เวรนี้ถูกแลกหรือส่งต่อออกไปแล้ว';
  END IF;

  IF v_given_shift.is_locked THEN
    RAISE EXCEPTION 'SHIFT_IS_LOCKED: ไม่สามารถแลกเวรในอดีตที่ถูกล็อกแล้วได้';
  END IF;

  -- 2. Format note for received shift
  v_new_note := 'เวรที่ได้รับจากการแลกกับ ' || trim(p_swapped_with);
  IF p_swap_reason IS NOT NULL AND trim(p_swap_reason) <> '' THEN
    v_new_note := v_new_note || ' (' || trim(p_swap_reason) || ')';
  END IF;

  -- 3. Insert received child shift (active, unlocked)
  INSERT INTO public.shifts (
    shift_date,
    shift_type,
    category,
    status,
    department,
    note,
    is_locked,
    parent_shift_id
  ) VALUES (
    p_new_date,
    p_new_shift_type,
    COALESCE(p_new_category, 'black'),
    'active',
    COALESCE(v_given_shift.department, ''),
    v_new_note,
    false,
    p_given_shift_id
  ) RETURNING id INTO v_received_shift_id;

  -- 4. Insert shift_swaps entry
  INSERT INTO public.shift_swaps (
    given_shift_id,
    received_shift_id,
    swapped_with,
    original_owner,
    swap_date,
    swap_reason,
    swap_history
  ) VALUES (
    p_given_shift_id,
    v_received_shift_id,
    trim(p_swapped_with),
    CASE WHEN p_original_owner IS NOT NULL AND trim(p_original_owner) <> '' THEN trim(p_original_owner) ELSE NULL END,
    v_swap_date,
    CASE WHEN p_swap_reason IS NOT NULL AND trim(p_swap_reason) <> '' THEN trim(p_swap_reason) ELSE NULL END,
    COALESCE(p_swap_history, '[]'::jsonb)
  ) RETURNING id INTO v_swap_id;

  -- 5. Update given shift to swapped_out and record swap_id
  UPDATE public.shifts
  SET
    status = 'swapped_out',
    swap_id = v_swap_id
  WHERE id = p_given_shift_id;

  RETURN jsonb_build_object(
    'swap_id', v_swap_id,
    'given_shift_id', p_given_shift_id,
    'received_shift_id', v_received_shift_id
  );
END;
$$;

-- ========================================================================
-- 4. Transactional RPC: undo_shift_swap
-- ========================================================================
CREATE OR REPLACE FUNCTION public.undo_shift_swap(
  p_target_shift_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_swap public.shift_swaps%ROWTYPE;
  v_given_shift public.shifts%ROWTYPE;
  v_received_shift public.shifts%ROWTYPE;
  v_downstream_swap_count INT;
BEGIN
  -- Find swap record where target is either the given shift OR the received shift
  SELECT * INTO v_swap
  FROM public.shift_swaps
  WHERE given_shift_id = p_target_shift_id OR received_shift_id = p_target_shift_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SWAP_NOT_FOUND: ไม่พบข้อมูลการแลกเวรของเวรนี้';
  END IF;

  -- Verify given shift & received shift
  SELECT * INTO v_given_shift FROM public.shifts WHERE id = v_swap.given_shift_id;
  SELECT * INTO v_received_shift FROM public.shifts WHERE id = v_swap.received_shift_id;

  IF v_given_shift.is_locked THEN
    RAISE EXCEPTION 'SHIFT_IS_LOCKED: ไม่สามารถยกเลิกได้เนื่องจากเวรเดิมผ่านเวลาไปแล้ว (เวรถูกล็อกอยู่)';
  END IF;

  IF v_received_shift.is_locked THEN
    RAISE EXCEPTION 'SHIFT_IS_LOCKED: ไม่สามารถยกเลิกได้เนื่องจากเวรที่ได้รับมาผ่านเวลาไปแล้ว (เวรถูกล็อกอยู่)';
  END IF;

  -- Chain swap safety check: Has the received shift been swapped out in a downstream swap?
  SELECT count(*) INTO v_downstream_swap_count
  FROM public.shift_swaps
  WHERE given_shift_id = v_swap.received_shift_id;

  IF v_downstream_swap_count > 0 THEN
    RAISE EXCEPTION 'DOWNSTREAM_SWAP_ACTIVE: ไม่สามารถยกเลิกการแลกเวรนี้ได้ เนื่องจากเวรที่ได้รับมาถูกนำไปแลกเปลี่ยนต่อแล้ว กรุณายกเลิกการแลกขั้นหลังก่อน';
  END IF;

  -- 1. Restore given shift back to active and clear swap_id
  UPDATE public.shifts
  SET
    status = 'active',
    swap_id = NULL,
    swapped_with = NULL,
    swap_date = NULL,
    swap_reason = NULL,
    original_owner = NULL,
    swap_history = '[]'::jsonb
  WHERE id = v_swap.given_shift_id;

  -- 2. Delete swap record from shift_swaps
  DELETE FROM public.shift_swaps WHERE id = v_swap.id;

  -- 3. Hard-delete the received shift from shifts
  DELETE FROM public.shifts WHERE id = v_swap.received_shift_id;

  -- Also delete any stale children referencing this given shift as parent
  DELETE FROM public.shifts WHERE parent_shift_id = v_swap.given_shift_id;

  RETURN jsonb_build_object(
    'undone_swap_id', v_swap.id,
    'restored_shift_id', v_swap.given_shift_id,
    'deleted_shift_id', v_swap.received_shift_id
  );
END;
$$;

-- ========================================================================
-- 5. Backfill existing swap records from shifts to shift_swaps (Migration B)
-- ========================================================================
-- 1) Create shift_swaps records from existing active child/parent pairs
INSERT INTO public.shift_swaps (
  id,
  given_shift_id,
  received_shift_id,
  swapped_with,
  original_owner,
  swap_date,
  swap_reason,
  swap_history,
  created_at
)
SELECT
  gen_random_uuid(),
  c.parent_shift_id,
  c.id,
  COALESCE(c.swapped_with, p.swapped_with, 'คู่แลกเวร'),
  COALESCE(c.original_owner, p.original_owner),
  COALESCE(c.swap_date, p.swap_date, c.created_at::date),
  COALESCE(c.swap_reason, p.swap_reason),
  COALESCE(c.swap_history, '[]'::jsonb),
  c.created_at
FROM public.shifts c
JOIN public.shifts p ON p.id = c.parent_shift_id
WHERE c.parent_shift_id IS NOT NULL
  AND c.status <> 'cancelled'
ON CONFLICT (received_shift_id) DO NOTHING;

-- 2) Update given shifts to reference swap_id
UPDATE public.shifts s
SET swap_id = sw.id
FROM public.shift_swaps sw
WHERE sw.given_shift_id = s.id
  AND s.swap_id IS NULL;

-- 3) Delete orphan cancelled child shifts
DELETE FROM public.shifts
WHERE status = 'cancelled'
  AND parent_shift_id IS NOT NULL;

COMMIT;
