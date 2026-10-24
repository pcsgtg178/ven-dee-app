-- Migration: One-Way Shift Transfer & OT Received-From (Phase 11)
-- Date: 2026-10-24
-- Architecture: Single-User Personal Companion App

-- 1. Add columns to public.shifts for One-Way Shift Transfer and OT Intake
ALTER TABLE public.shifts 
  ADD COLUMN IF NOT EXISTS transfer_meta JSONB,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS transferred_date DATE,
  ADD COLUMN IF NOT EXISTS received_from TEXT;

-- 2. Indexes for queries on transferred shifts and received_from
CREATE INDEX IF NOT EXISTS idx_shifts_received_from ON public.shifts(received_from);
CREATE INDEX IF NOT EXISTS idx_shifts_transferred_date ON public.shifts(transferred_date);
