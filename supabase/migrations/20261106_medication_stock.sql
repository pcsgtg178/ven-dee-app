-- Migration: Phase 14.2 — Medication Stock Schema (FIFO Inventory & Append-Only Ledger)
-- Date: 2026-11-06
-- Standard: Satang Standard (1 THB = 100 Satang), NUMERIC quantities for fractional units

-- 1. เพิ่มคอลัมน์สต็อกในตาราง medications
ALTER TABLE public.medications
    ADD COLUMN IF NOT EXISTS stock_on_hand NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reorder_point_packs NUMERIC NOT NULL DEFAULT 1;

-- 2. ตาราง stock_movements (append-only ledger; ห้ามแก้ไข/ลบ ใช้ reversal แทน)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('receive', 'use', 'waste', 'giveaway', 'adjust', 'reversal')),
    quantity NUMERIC NOT NULL, -- มีเครื่องหมาย (+ เข้า / - ออก) หน่วยเป็นหน่วยที่ใช้จริง
    cost_satang NUMERIC DEFAULT 0,
    is_estimated_cost BOOLEAN NOT NULL DEFAULT false,
    packs NUMERIC,
    pack_cost_satang NUMERIC,
    supplier TEXT,
    reason TEXT CHECK (reason IS NULL OR reason IN ('expired', 'damaged', 'personal', 'free', 'sample', 'other')),
    service_id UUID NULL REFERENCES public.customer_services(id) ON DELETE SET NULL,
    reverses_movement_id UUID NULL REFERENCES public.stock_movements(id) ON DELETE SET NULL,
    reversed BOOLEAN NOT NULL DEFAULT false,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ตาราง stock_layers (FIFO cost layers จากการรับเข้าหรือตรวจนับเพิ่ม)
CREATE TABLE IF NOT EXISTS public.stock_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE RESTRICT,
    receive_movement_id UUID REFERENCES public.stock_movements(id) ON DELETE CASCADE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    qty_received NUMERIC NOT NULL,
    qty_remaining NUMERIC NOT NULL,
    unit_cost_satang NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ตาราง stock_layer_consumptions (บันทึกการตัดแต่ละ layer เพื่อใช้คืนสต็อกเมื่อ restore/reversal)
CREATE TABLE IF NOT EXISTS public.stock_layer_consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_id UUID NOT NULL REFERENCES public.stock_movements(id) ON DELETE CASCADE,
    layer_id UUID NOT NULL REFERENCES public.stock_layers(id) ON DELETE RESTRICT,
    quantity NUMERIC NOT NULL,
    unit_cost_satang NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. เพิ่มคอลัมน์สถานะการตัดสต็อกและ auto-complete ในตาราง customer_services
ALTER TABLE public.customer_services
    ADD COLUMN IF NOT EXISTS stock_consumed BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_complete_opt_out BOOLEAN NOT NULL DEFAULT false;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_medication_occurred
    ON public.stock_movements(medication_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_service_id
    ON public.stock_movements(service_id)
    WHERE service_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_reverses
    ON public.stock_movements(reverses_movement_id)
    WHERE reverses_movement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_layers_fifo
    ON public.stock_layers(medication_id, received_at ASC, created_at ASC)
    WHERE qty_remaining > 0;

CREATE INDEX IF NOT EXISTS idx_stock_layers_receive_movement
    ON public.stock_layers(receive_movement_id);

CREATE INDEX IF NOT EXISTS idx_stock_layer_consumptions_movement
    ON public.stock_layer_consumptions(movement_id);

CREATE INDEX IF NOT EXISTS idx_stock_layer_consumptions_layer
    ON public.stock_layer_consumptions(layer_id);

CREATE INDEX IF NOT EXISTS idx_customer_services_due_autocomplete
    ON public.customer_services(status, service_date, service_time)
    WHERE status = 'upcoming' AND auto_complete_opt_out = false;

-- 7. Row Level Security (RLS) Policies (Single User App: Full Access)
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on stock_movements" ON public.stock_movements;
CREATE POLICY "Allow all operations on stock_movements" ON public.stock_movements
    FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.stock_layers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on stock_layers" ON public.stock_layers;
CREATE POLICY "Allow all operations on stock_layers" ON public.stock_layers
    FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.stock_layer_consumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on stock_layer_consumptions" ON public.stock_layer_consumptions;
CREATE POLICY "Allow all operations on stock_layer_consumptions" ON public.stock_layer_consumptions
    FOR ALL USING (true) WITH CHECK (true);
