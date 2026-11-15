-- Migration: Phase 14.3 — Transactional Stock RPCs (FIFO & Append-Only Ledger)
-- Date: 2026-11-15
-- Standard: Satang Standard (1 THB = 100 Satang), Atomic PostgreSQL RPCs

-- ============================================================================
-- Helper: _fifo_consume
-- ตัดสต็อกแบบ FIFO จาก stock_layers ที่ received_at เก่าที่สุดก่อน
-- หากไม่พอ ให้คิดส่วนที่ขาดด้วย ref_cost_per_pack_satang / pack_size (ถ้าไม่มีเป็น 0)
-- และตั้ง is_estimated = true
-- ============================================================================
CREATE OR REPLACE FUNCTION public._fifo_consume(
  p_med_id UUID,
  p_qty NUMERIC,
  p_movement_id UUID
)
RETURNS TABLE(total_cost_satang NUMERIC, is_estimated BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_med public.medications%ROWTYPE;
  v_rem NUMERIC := p_qty;
  v_layer public.stock_layers%ROWTYPE;
  v_take NUMERIC;
  v_cost NUMERIC := 0;
  v_est BOOLEAN := false;
  v_fallback_unit_cost NUMERIC := 0;
BEGIN
  SELECT * INTO v_med FROM public.medications WHERE id = p_med_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEDICATION_NOT_FOUND: ไม่พบรายการยา';
  END IF;

  FOR v_layer IN
    SELECT * FROM public.stock_layers
     WHERE medication_id = p_med_id
       AND qty_remaining > 0
     ORDER BY received_at ASC, created_at ASC, id ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_rem <= 0;
    v_take := LEAST(v_rem, v_layer.qty_remaining);

    UPDATE public.stock_layers
       SET qty_remaining = qty_remaining - v_take
     WHERE id = v_layer.id;

    INSERT INTO public.stock_layer_consumptions (
      movement_id,
      layer_id,
      quantity,
      unit_cost_satang
    ) VALUES (
      p_movement_id,
      v_layer.id,
      v_take,
      v_layer.unit_cost_satang
    );

    v_cost := v_cost + ROUND(v_take * v_layer.unit_cost_satang);
    v_rem := v_rem - v_take;
  END LOOP;

  IF v_rem > 0 THEN
    v_est := true;
    IF COALESCE(v_med.pack_size, 0) > 0 AND COALESCE(v_med.ref_cost_per_pack_satang, 0) > 0 THEN
      v_fallback_unit_cost := v_med.ref_cost_per_pack_satang / v_med.pack_size;
    ELSE
      v_fallback_unit_cost := 0;
    END IF;
    v_cost := v_cost + ROUND(v_rem * v_fallback_unit_cost);
  END IF;

  RETURN QUERY SELECT v_cost, v_est;
END;
$$;

-- ============================================================================
-- 1. receive_stock
-- รับยาเข้าสต็อกเป็นแพ็ค/ขวด; หักยอดติดลบค้างก่อนสร้าง layer คงเหลือ (D9)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.receive_stock(
  p_med_id UUID,
  p_packs NUMERIC,
  p_pack_cost_satang NUMERIC,
  p_supplier TEXT DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW(),
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_med public.medications%ROWTYPE;
  v_qty NUMERIC;
  v_total_cost NUMERIC;
  v_unit_cost NUMERIC;
  v_mov_id UUID;
  v_layer_id UUID;
  v_deficit NUMERIC := 0;
  v_layer_remaining NUMERIC;
  v_new_on_hand NUMERIC;
  v_occurred TIMESTAMPTZ := COALESCE(p_occurred_at, NOW());
BEGIN
  IF p_packs IS NULL OR p_packs <= 0 THEN
    RAISE EXCEPTION 'INVALID_PACKS: จำนวนแพ็ค/ขวดต้องมากกว่า 0';
  END IF;
  IF p_pack_cost_satang IS NULL OR p_pack_cost_satang < 0 THEN
    RAISE EXCEPTION 'INVALID_COST: ต้นทุนต่อแพ็ค/ขวดต้องไม่ติดลบ';
  END IF;

  SELECT * INTO v_med FROM public.medications WHERE id = p_med_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEDICATION_NOT_FOUND: ไม่พบรายการยา';
  END IF;
  IF COALESCE(v_med.pack_size, 0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_PACK_SIZE: pack_size ต้องมากกว่า 0';
  END IF;

  v_qty := p_packs * v_med.pack_size;
  v_total_cost := ROUND(p_packs * p_pack_cost_satang);
  v_unit_cost := p_pack_cost_satang / v_med.pack_size;

  INSERT INTO public.stock_movements (
    medication_id,
    type,
    quantity,
    cost_satang,
    is_estimated_cost,
    packs,
    pack_cost_satang,
    supplier,
    occurred_at,
    note
  ) VALUES (
    p_med_id,
    'receive',
    v_qty,
    v_total_cost,
    false,
    p_packs,
    p_pack_cost_satang,
    NULLIF(TRIM(COALESCE(p_supplier, '')), ''),
    v_occurred,
    NULLIF(TRIM(COALESCE(p_note, '')), '')
  ) RETURNING id INTO v_mov_id;

  -- หักยอดติดลบค้างก่อน (ไม่ย้อนแก้ต้นทุนเดิม, D9)
  IF v_med.stock_on_hand < 0 THEN
    v_deficit := LEAST(v_qty, ABS(v_med.stock_on_hand));
  END IF;
  v_layer_remaining := v_qty - v_deficit;

  INSERT INTO public.stock_layers (
    medication_id,
    receive_movement_id,
    received_at,
    qty_received,
    qty_remaining,
    unit_cost_satang
  ) VALUES (
    p_med_id,
    v_mov_id,
    v_occurred,
    v_qty,
    v_layer_remaining,
    v_unit_cost
  ) RETURNING id INTO v_layer_id;

  v_new_on_hand := v_med.stock_on_hand + v_qty;

  UPDATE public.medications
     SET stock_on_hand = v_new_on_hand,
         ref_cost_per_pack_satang = p_pack_cost_satang,
         updated_at = NOW()
   WHERE id = p_med_id;

  RETURN jsonb_build_object(
    'movement_id', v_mov_id,
    'layer_id', v_layer_id,
    'quantity', v_qty,
    'cost_satang', v_total_cost,
    'stock_on_hand', v_new_on_hand,
    'warnings', '[]'::jsonb
  );
END;
$$;

-- ============================================================================
-- 2. issue_stock
-- ตัดสต็อกสำหรับ waste / giveaway ด้วย FIFO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.issue_stock(
  p_med_id UUID,
  p_qty NUMERIC,
  p_type TEXT,
  p_reason TEXT DEFAULT 'other',
  p_note TEXT DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_med public.medications%ROWTYPE;
  v_mov_id UUID;
  v_fifo RECORD;
  v_new_on_hand NUMERIC;
  v_warnings JSONB := '[]'::jsonb;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY: ปริมาณที่ตัดออกต้องมากกว่า 0';
  END IF;
  IF p_type NOT IN ('waste', 'giveaway') THEN
    RAISE EXCEPTION 'INVALID_TYPE: type ต้องเป็น waste หรือ giveaway';
  END IF;

  SELECT * INTO v_med FROM public.medications WHERE id = p_med_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEDICATION_NOT_FOUND: ไม่พบรายการยา';
  END IF;

  INSERT INTO public.stock_movements (
    medication_id,
    type,
    quantity,
    reason,
    occurred_at,
    note
  ) VALUES (
    p_med_id,
    p_type,
    -p_qty,
    COALESCE(NULLIF(TRIM(COALESCE(p_reason, '')), ''), 'other'),
    COALESCE(p_occurred_at, NOW()),
    NULLIF(TRIM(COALESCE(p_note, '')), '')
  ) RETURNING id INTO v_mov_id;

  SELECT * INTO v_fifo FROM public._fifo_consume(p_med_id, p_qty, v_mov_id);

  UPDATE public.stock_movements
     SET cost_satang = v_fifo.total_cost_satang,
         is_estimated_cost = v_fifo.is_estimated
   WHERE id = v_mov_id;

  v_new_on_hand := v_med.stock_on_hand - p_qty;

  UPDATE public.medications
     SET stock_on_hand = v_new_on_hand,
         updated_at = NOW()
   WHERE id = p_med_id;

  IF v_new_on_hand < 0 THEN
    v_warnings := jsonb_build_array(
      jsonb_build_object(
        'code', 'STOCK_NEGATIVE',
        'medicationId', p_med_id,
        'onHand', v_new_on_hand
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'movement_id', v_mov_id,
    'quantity', -p_qty,
    'cost_satang', v_fifo.total_cost_satang,
    'is_estimated_cost', v_fifo.is_estimated,
    'stock_on_hand', v_new_on_hand,
    'warnings', v_warnings
  );
END;
$$;

-- ============================================================================
-- 3. adjust_stock_to_count
-- ปรับยอดสต็อกตามผลการนับจริง (diff > 0 สร้าง layer อ้างอิง, diff < 0 ตัด FIFO)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.adjust_stock_to_count(
  p_med_id UUID,
  p_counted_qty NUMERIC,
  p_note TEXT DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_med public.medications%ROWTYPE;
  v_diff NUMERIC;
  v_mov_id UUID;
  v_unit_cost NUMERIC := 0;
  v_cost NUMERIC := 0;
  v_deficit NUMERIC := 0;
  v_layer_remaining NUMERIC;
  v_fifo RECORD;
  v_warnings JSONB := '[]'::jsonb;
  v_occurred TIMESTAMPTZ := COALESCE(p_occurred_at, NOW());
BEGIN
  IF p_counted_qty IS NULL THEN
    RAISE EXCEPTION 'INVALID_COUNT: กรุณาระบุยอดที่นับได้';
  END IF;

  SELECT * INTO v_med FROM public.medications WHERE id = p_med_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEDICATION_NOT_FOUND: ไม่พบรายการยา';
  END IF;

  v_diff := p_counted_qty - v_med.stock_on_hand;
  IF v_diff = 0 THEN
    RETURN jsonb_build_object(
      'changed', false,
      'stock_on_hand', p_counted_qty,
      'warnings', '[]'::jsonb
    );
  END IF;

  IF v_diff > 0 THEN
    IF COALESCE(v_med.pack_size, 0) > 0 AND COALESCE(v_med.ref_cost_per_pack_satang, 0) > 0 THEN
      v_unit_cost := v_med.ref_cost_per_pack_satang / v_med.pack_size;
    END IF;
    v_cost := ROUND(v_diff * v_unit_cost);

    INSERT INTO public.stock_movements (
      medication_id,
      type,
      quantity,
      cost_satang,
      is_estimated_cost,
      occurred_at,
      note
    ) VALUES (
      p_med_id,
      'adjust',
      v_diff,
      v_cost,
      true,
      v_occurred,
      COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), 'ปรับยอดตรวจนับ (+)')
    ) RETURNING id INTO v_mov_id;

    IF v_med.stock_on_hand < 0 THEN
      v_deficit := LEAST(v_diff, ABS(v_med.stock_on_hand));
    END IF;
    v_layer_remaining := v_diff - v_deficit;

    INSERT INTO public.stock_layers (
      medication_id,
      receive_movement_id,
      received_at,
      qty_received,
      qty_remaining,
      unit_cost_satang
    ) VALUES (
      p_med_id,
      v_mov_id,
      v_occurred,
      v_diff,
      v_layer_remaining,
      v_unit_cost
    );
  ELSE
    INSERT INTO public.stock_movements (
      medication_id,
      type,
      quantity,
      occurred_at,
      note
    ) VALUES (
      p_med_id,
      'adjust',
      v_diff,
      v_occurred,
      COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), 'ปรับยอดตรวจนับ (-)')
    ) RETURNING id INTO v_mov_id;

    SELECT * INTO v_fifo FROM public._fifo_consume(p_med_id, ABS(v_diff), v_mov_id);
    v_cost := v_fifo.total_cost_satang;

    UPDATE public.stock_movements
       SET cost_satang = v_cost,
           is_estimated_cost = v_fifo.is_estimated
     WHERE id = v_mov_id;
  END IF;

  UPDATE public.medications
     SET stock_on_hand = p_counted_qty,
         updated_at = NOW()
   WHERE id = p_med_id;

  IF p_counted_qty < 0 THEN
    v_warnings := jsonb_build_array(
      jsonb_build_object(
        'code', 'STOCK_NEGATIVE',
        'medicationId', p_med_id,
        'onHand', p_counted_qty
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'changed', true,
    'movement_id', v_mov_id,
    'diff', v_diff,
    'cost_satang', v_cost,
    'stock_on_hand', p_counted_qty,
    'warnings', v_warnings
  );
END;
$$;

-- ============================================================================
-- 4. consume_stock_for_service
-- ตัดสต็อก FIFO ทีละรายการใน medication_usages และเขียนต้นทุนจริงกลับ
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consume_stock_for_service(
  p_service_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_svc public.customer_services%ROWTYPE;
  v_usage JSONB;
  v_updated_usages JSONB := '[]'::jsonb;
  v_med_id UUID;
  v_qty NUMERIC;
  v_mov_id UUID;
  v_fifo RECORD;
  v_unit_cost NUMERIC;
  v_total_cost NUMERIC := 0;
  v_new_on_hand NUMERIC;
  v_warnings JSONB := '[]'::jsonb;
  v_occurred TIMESTAMPTZ;
  v_med_exists BOOLEAN;
BEGIN
  SELECT * INTO v_svc FROM public.customer_services WHERE id = p_service_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND: ไม่พบรายการบริการ';
  END IF;

  IF v_svc.stock_consumed THEN
    RETURN jsonb_build_object(
      'skipped', true,
      'reason', 'ALREADY_CONSUMED',
      'service_id', p_service_id,
      'warnings', '[]'::jsonb
    );
  END IF;

  v_occurred := (v_svc.service_date + v_svc.service_time) AT TIME ZONE 'Asia/Bangkok';

  FOR v_usage IN
    SELECT * FROM jsonb_array_elements(COALESCE(v_svc.medication_usages, '[]'::jsonb))
  LOOP
    v_qty := COALESCE((v_usage->>'quantity')::NUMERIC, 0);

    IF v_qty > 0 AND (v_usage->>'medicationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_med_id := (v_usage->>'medicationId')::UUID;
      SELECT EXISTS (SELECT 1 FROM public.medications WHERE id = v_med_id) INTO v_med_exists;

      IF v_med_exists THEN
        INSERT INTO public.stock_movements (
          medication_id,
          type,
          quantity,
          service_id,
          occurred_at,
          note
        ) VALUES (
          v_med_id,
          'use',
          -v_qty,
          p_service_id,
          v_occurred,
          'ใช้ยาในบริการลูกค้า'
        ) RETURNING id INTO v_mov_id;

        SELECT * INTO v_fifo FROM public._fifo_consume(v_med_id, v_qty, v_mov_id);

        UPDATE public.stock_movements
           SET cost_satang = v_fifo.total_cost_satang,
               is_estimated_cost = v_fifo.is_estimated
         WHERE id = v_mov_id;

        UPDATE public.medications
           SET stock_on_hand = stock_on_hand - v_qty,
               updated_at = NOW()
         WHERE id = v_med_id
         RETURNING stock_on_hand INTO v_new_on_hand;

        v_unit_cost := ROUND(v_fifo.total_cost_satang / v_qty);
        v_total_cost := v_total_cost + v_fifo.total_cost_satang;

        IF v_new_on_hand < 0 THEN
          v_warnings := v_warnings || jsonb_build_array(
            jsonb_build_object(
              'code', 'STOCK_NEGATIVE',
              'medicationId', v_med_id,
              'onHand', v_new_on_hand
            )
          );
        END IF;

        v_usage := v_usage || jsonb_build_object(
          'unitCostSatang', v_unit_cost,
          'lineCostSatang', v_fifo.total_cost_satang
        );
      END IF;
    END IF;

    v_updated_usages := v_updated_usages || jsonb_build_array(v_usage);
  END LOOP;

  UPDATE public.customer_services
     SET medication_usages = v_updated_usages,
         medication_cost_satang = v_total_cost::BIGINT,
         stock_consumed = true
   WHERE id = p_service_id;

  RETURN jsonb_build_object(
    'skipped', false,
    'service_id', p_service_id,
    'medication_cost_satang', v_total_cost,
    'warnings', v_warnings
  );
END;
$$;

-- ============================================================================
-- 5. restore_stock_for_service
-- กลับรายการ use ของงานนี้ คืน layer เดิมตาม consumptions และรีเซ็ตต้นทุนเป็น 0
-- ============================================================================
CREATE OR REPLACE FUNCTION public.restore_stock_for_service(
  p_service_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_svc public.customer_services%ROWTYPE;
  v_mov public.stock_movements%ROWTYPE;
  v_cons public.stock_layer_consumptions%ROWTYPE;
  v_usage JSONB;
  v_reset_usages JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_svc FROM public.customer_services WHERE id = p_service_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND: ไม่พบรายการบริการ';
  END IF;

  IF NOT v_svc.stock_consumed THEN
    RETURN jsonb_build_object(
      'skipped', true,
      'reason', 'NOT_CONSUMED',
      'service_id', p_service_id
    );
  END IF;

  FOR v_mov IN
    SELECT * FROM public.stock_movements
     WHERE service_id = p_service_id
       AND type = 'use'
       AND reversed = false
     FOR UPDATE
  LOOP
    PERFORM 1 FROM public.medications WHERE id = v_mov.medication_id FOR UPDATE;

    FOR v_cons IN
      SELECT * FROM public.stock_layer_consumptions
       WHERE movement_id = v_mov.id
    LOOP
      UPDATE public.stock_layers
         SET qty_remaining = qty_remaining + v_cons.quantity
       WHERE id = v_cons.layer_id;
    END LOOP;

    INSERT INTO public.stock_movements (
      medication_id,
      type,
      quantity,
      cost_satang,
      is_estimated_cost,
      service_id,
      reverses_movement_id,
      occurred_at,
      note
    ) VALUES (
      v_mov.medication_id,
      'reversal',
      ABS(v_mov.quantity),
      v_mov.cost_satang,
      v_mov.is_estimated_cost,
      p_service_id,
      v_mov.id,
      NOW(),
      'คืนสต็อกจากงานบริการ'
    );

    UPDATE public.stock_movements
       SET reversed = true
     WHERE id = v_mov.id;

    UPDATE public.medications
       SET stock_on_hand = stock_on_hand + ABS(v_mov.quantity),
           updated_at = NOW()
     WHERE id = v_mov.medication_id;
  END LOOP;

  FOR v_usage IN
    SELECT * FROM jsonb_array_elements(COALESCE(v_svc.medication_usages, '[]'::jsonb))
  LOOP
    v_usage := v_usage || jsonb_build_object('unitCostSatang', 0, 'lineCostSatang', 0);
    v_reset_usages := v_reset_usages || jsonb_build_array(v_usage);
  END LOOP;

  UPDATE public.customer_services
     SET medication_usages = v_reset_usages,
         medication_cost_satang = 0,
         stock_consumed = false
   WHERE id = p_service_id;

  RETURN jsonb_build_object(
    'skipped', false,
    'service_id', p_service_id
  );
END;
$$;

-- ============================================================================
-- 6. reconsume_stock_for_service
-- Restore แล้วอัปเดต usages ใหม่และ consume ภายใน transaction เดียว (D6)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reconsume_stock_for_service(
  p_service_id UUID,
  p_new_usages JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.restore_stock_for_service(p_service_id);

  UPDATE public.customer_services
     SET medication_usages = COALESCE(p_new_usages, '[]'::jsonb)
   WHERE id = p_service_id;

  RETURN public.consume_stock_for_service(p_service_id);
END;
$$;

-- ============================================================================
-- 7. complete_due_services
-- ปิดงาน upcoming ที่ถึงเวลาแล้ว (Asia/Bangkok) และ auto_complete_opt_out = false
-- ============================================================================
CREATE OR REPLACE FUNCTION public.complete_due_services(
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_svc public.customer_services%ROWTYPE;
  v_consume_res JSONB;
  v_completed_ids JSONB := '[]'::jsonb;
  v_warnings JSONB := '[]'::jsonb;
  v_count INT := 0;
BEGIN
  FOR v_svc IN
    SELECT * FROM public.customer_services
     WHERE status = 'upcoming'
       AND COALESCE(auto_complete_opt_out, false) = false
       AND ((service_date + service_time) AT TIME ZONE 'Asia/Bangkok') <= COALESCE(p_now, NOW())
     ORDER BY service_date ASC, service_time ASC
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.customer_services
       SET status = 'completed'
     WHERE id = v_svc.id;

    v_consume_res := public.consume_stock_for_service(v_svc.id);
    v_count := v_count + 1;
    v_completed_ids := v_completed_ids || jsonb_build_array(v_svc.id);

    IF v_consume_res ? 'warnings' THEN
      v_warnings := v_warnings || (v_consume_res->'warnings');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'completed_count', v_count,
    'completed_ids', v_completed_ids,
    'warnings', v_warnings
  );
END;
$$;

-- ============================================================================
-- 8. reverse_stock_movement
-- ยกเลิกรายการ receive / waste / giveaway / adjust ที่กรอกผิด
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reverse_stock_movement(
  p_movement_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov public.stock_movements%ROWTYPE;
  v_med public.medications%ROWTYPE;
  v_layer public.stock_layers%ROWTYPE;
  v_cons public.stock_layer_consumptions%ROWTYPE;
  v_rev_id UUID;
  v_new_on_hand NUMERIC;
BEGIN
  SELECT * INTO v_mov FROM public.stock_movements WHERE id = p_movement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MOVEMENT_NOT_FOUND: ไม่พบรายการเคลื่อนไหวสต็อก';
  END IF;
  IF v_mov.reversed THEN
    RAISE EXCEPTION 'MOVEMENT_ALREADY_REVERSED: รายการนี้ถูกยกเลิกไปแล้ว';
  END IF;
  IF v_mov.type = 'reversal' THEN
    RAISE EXCEPTION 'CANNOT_REVERSE_REVERSAL: ไม่สามารถยกเลิกรายการ reversal ได้';
  END IF;
  IF v_mov.type = 'use' THEN
    RAISE EXCEPTION 'USE_RESTORE_FOR_SERVICE: กรุณายกเลิกหรือแก้สถานะที่รายการบริการลูกค้า';
  END IF;

  SELECT * INTO v_med FROM public.medications WHERE id = v_mov.medication_id FOR UPDATE;

  IF v_mov.quantity > 0 THEN
    -- receive หรือ adjust (+) ที่สร้าง layer
    SELECT * INTO v_layer
      FROM public.stock_layers
     WHERE receive_movement_id = p_movement_id
     FOR UPDATE;

    IF FOUND AND v_layer.qty_remaining < v_layer.qty_received THEN
      RAISE EXCEPTION 'LAYER_ALREADY_CONSUMED: ไม่สามารถยกเลิกรายการรับเข้าที่ถูกตัดใช้ไปแล้วได้';
    END IF;

    IF FOUND THEN
      UPDATE public.stock_layers
         SET qty_remaining = 0
       WHERE id = v_layer.id;
    END IF;

    v_new_on_hand := v_med.stock_on_hand - v_mov.quantity;
  ELSE
    -- waste, giveaway หรือ adjust (-)
    FOR v_cons IN
      SELECT * FROM public.stock_layer_consumptions
       WHERE movement_id = p_movement_id
    LOOP
      UPDATE public.stock_layers
         SET qty_remaining = qty_remaining + v_cons.quantity
       WHERE id = v_cons.layer_id;
    END LOOP;

    v_new_on_hand := v_med.stock_on_hand + ABS(v_mov.quantity);
  END IF;

  INSERT INTO public.stock_movements (
    medication_id,
    type,
    quantity,
    cost_satang,
    is_estimated_cost,
    reverses_movement_id,
    occurred_at,
    note
  ) VALUES (
    v_mov.medication_id,
    'reversal',
    -v_mov.quantity,
    v_mov.cost_satang,
    v_mov.is_estimated_cost,
    p_movement_id,
    NOW(),
    COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), 'ยกเลิกรายการสต็อก')
  ) RETURNING id INTO v_rev_id;

  UPDATE public.stock_movements
     SET reversed = true
   WHERE id = p_movement_id;

  UPDATE public.medications
     SET stock_on_hand = v_new_on_hand,
         updated_at = NOW()
   WHERE id = v_mov.medication_id;

  RETURN jsonb_build_object(
    'reversed_movement_id', p_movement_id,
    'reversal_movement_id', v_rev_id,
    'stock_on_hand', v_new_on_hand
  );
END;
$$;
