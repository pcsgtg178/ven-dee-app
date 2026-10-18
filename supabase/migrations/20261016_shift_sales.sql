-- Migration: Refer Shift Selling & Financial Compensation System (Phase 6)
-- Architecture: Single-User Personal Companion App
-- Date: 2026-10-16

-- Add columns to public.shifts for Refer Shift Selling
ALTER TABLE public.shifts 
  ADD COLUMN IF NOT EXISTS buyer_name TEXT,
  ADD COLUMN IF NOT EXISTS sale_price_satang BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_date DATE,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS sale_note TEXT,
  ADD COLUMN IF NOT EXISTS sale_meta JSONB;

-- Index for payment_status and sold shifts
CREATE INDEX IF NOT EXISTS idx_shifts_payment_status ON public.shifts(payment_status);
