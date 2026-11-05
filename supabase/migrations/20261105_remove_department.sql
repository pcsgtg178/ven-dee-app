-- ========================================================================
-- VenDee Migration: Remove Department & Ward Information (Phase 13)
-- File: 20261105_remove_department.sql
-- Description:
-- 1. Drops 'department' column from public.shifts (ER nurse specialization).
-- 2. Updates RPC perform_shift_swap to remove all references to department.
-- ========================================================================

-- 1. Drop department column from public.shifts
ALTER TABLE public.shifts DROP COLUMN IF EXISTS department;

-- 2. Update perform_shift_swap RPC function without department
CREATE OR REPLACE FUNCTION public.perform_shift_swap(
  p_given_shift_id UUID,
  p_swapped_with TEXT,
  p_original_owner TEXT DEFAULT NULL,
  p_new_date DATE DEFAULT NULL,
  p_new_shift_type TEXT DEFAULT 'morning',
  p_new_category TEXT DEFAULT 'black',
  p_swap_reason TEXT DEFAULT NULL,
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

  -- Phase 12 Grace Period for Refer Shifts:
  -- Only block if shift is locked and not an exempt Refer shift
  IF v_given_shift.is_locked AND NOT (
    v_given_shift.shift_type IN ('r1', 'r2') OR v_given_shift.category = 'green'
  ) THEN
    RAISE EXCEPTION 'SHIFT_IS_LOCKED: ไม่สามารถแลกเวรในอดีตที่ถูกล็อกแล้วได้';
  END IF;

  -- 2. Format note for received shift
  v_new_note := 'เวรที่ได้รับจากการแลกกับ ' || trim(p_swapped_with);
  IF p_swap_reason IS NOT NULL AND trim(p_swap_reason) <> '' THEN
    v_new_note := v_new_note || ' (' || trim(p_swap_reason) || ')';
  END IF;

  -- 3. Insert received child shift (active, unlocked, department column removed)
  INSERT INTO public.shifts (
    shift_date,
    shift_type,
    category,
    status,
    note,
    is_locked,
    parent_shift_id
  ) VALUES (
    p_new_date,
    p_new_shift_type,
    COALESCE(p_new_category, 'black'),
    'active',
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

