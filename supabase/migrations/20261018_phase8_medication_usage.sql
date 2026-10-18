-- Migration: Phase 8 — Medication category & per-service medication usage
-- Date: 2026-10-18
-- See DOMAIN_RULES.md §3.1 (usage) and §3.4 (categories)

-- 8.3 Medication category (default 'other'; Botox → 'botox')
ALTER TABLE public.medications
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

ALTER TABLE public.medications
    DROP CONSTRAINT IF EXISTS medications_category_check;
ALTER TABLE public.medications
    ADD CONSTRAINT medications_category_check
    CHECK (category IN ('botox', 'meso', 'vitamin', 'meso_fat', 'filler', 'other'));

UPDATE public.medications
   SET category = 'botox'
 WHERE category = 'other' AND name ILIKE '%botox%';

CREATE INDEX IF NOT EXISTS idx_medications_category ON public.medications(category);

-- 8.1 Medication usage per service event (JSONB snapshot lines)
-- Each element: { medicationId, name, category, quantity, unit, unitCostSatang, lineCostSatang }
ALTER TABLE public.customer_services
    ADD COLUMN IF NOT EXISTS medication_usages JSONB NOT NULL DEFAULT '[]'::jsonb;
