-- Migration: Phase 15 — Customer Service Discount & Financial Integration
-- Date: 2026-11-05
-- Standard: Satang Standard (1 THB = 100 Satang)

ALTER TABLE public.customer_services
    ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_satang BIGINT DEFAULT 0;
