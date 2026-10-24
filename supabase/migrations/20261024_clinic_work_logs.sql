-- Migration: 20261024_clinic_work_logs.sql
-- ISSUE-1: Clinic Work Logs Persistence
-- Persist ClinicWorkRecord to database so clinic duties survive browser cache clear,
-- sync across devices, and populate calendar exports/WebCal feeds.

CREATE TABLE IF NOT EXISTS public.clinic_work_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_date     DATE NOT NULL,
    preset_shift  TEXT NOT NULL CHECK (preset_shift IN ('12:30 - 17:30', '17:00 - 19:30', '12:30 - 19:30')),
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for date queries & calendar range lookups
CREATE INDEX IF NOT EXISTS idx_clinic_work_logs_date ON public.clinic_work_logs(work_date);

-- Enable Row Level Security (Single-user companion app)
ALTER TABLE public.clinic_work_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on clinic_work_logs" ON public.clinic_work_logs;
CREATE POLICY "Allow all operations on clinic_work_logs"
  ON public.clinic_work_logs FOR ALL USING (true) WITH CHECK (true);
