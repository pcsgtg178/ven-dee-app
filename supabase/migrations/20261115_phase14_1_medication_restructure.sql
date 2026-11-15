-- Migration: Phase 14.1 — Medication Restructure & Deduplication
-- Date: 2026-11-15
-- Decisions: D12-D16, D19 (User decision: Botox combined to single entity 200u, no promotions table)

-- 1. เพิ่มคอลัมน์ในตาราง medications
ALTER TABLE public.medications
    ADD COLUMN IF NOT EXISTS pack_size NUMERIC NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS pack_unit TEXT DEFAULT 'ขวด',
    ADD COLUMN IF NOT EXISTS ref_cost_per_pack_satang NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- 2. เพิ่มคอลัมน์เก็บประวัติต้นทุนเก่าใน customer_services
ALTER TABLE public.customer_services
    ADD COLUMN IF NOT EXISTS medication_cost_satang_legacy BIGINT DEFAULT 0;

-- 3. สำรองต้นทุนเก่า และล้าง medication_cost_satang เดิมของงานเก่าให้เป็น 0 (D16)
UPDATE public.customer_services
   SET medication_cost_satang_legacy = COALESCE(medication_cost_satang, 0),
       medication_cost_satang = 0
 WHERE medication_cost_satang > 0;

-- 4. จัดการรวมรายการ Botox 100u และ 50u ให้เป็น Botox ตัวเดียวขนาด 200u (pack_size = 200, unit = 'ยูนิต', pack_unit = 'ขวด')
-- ปรับรายการ Botox หลัก (เช่น med-botox-100 หรือ row แรกที่ชื่อ Botox) ให้เป็นขนาด 200 ยูนิต
DO $$
DECLARE
    canonical_botox_id UUID;
    duplicate_botox_id UUID;
BEGIN
    SELECT id INTO canonical_botox_id FROM public.medications WHERE name ILIKE '%botox%' ORDER BY created_at ASC LIMIT 1;
    
    IF canonical_botox_id IS NOT NULL THEN
        -- ปรับ canonical Botox ให้เป็น 200 ยูนิต
        UPDATE public.medications
           SET size = '200',
               pack_size = 200,
               unit = 'ยูนิต',
               pack_unit = 'ขวด',
               description = 'Botox 200 ยูนิต/ขวด'
         WHERE id = canonical_botox_id;

        -- หาและ archive รายการ Botox ที่ซ้ำ
        UPDATE public.medications
           SET is_archived = true
         WHERE name ILIKE '%botox%' AND id <> canonical_botox_id;
    END IF;
END $$;
