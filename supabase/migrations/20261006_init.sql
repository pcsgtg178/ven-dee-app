-- Migration: Initial Schema for VenDee (เวรดี) Fullstack PWA
-- Date: 2026-10-06

-- 1. Nurses Table
CREATE TABLE IF NOT EXISTS public.nurses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#3b82f6',
    black_shift_quota INT DEFAULT 14,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Shifts Table
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nurse_id UUID REFERENCES public.nurses(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type TEXT NOT NULL, -- 'morning', 'afternoon', 'night', 'r1', 'r2', 'off', 'ctm', 'cta'
    category TEXT NOT NULL DEFAULT 'black', -- 'black', 'red', 'green', 'gray', 'purple'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'swapped_out', 'cancelled'
    department TEXT,
    note TEXT,
    swapped_with TEXT,
    original_owner TEXT,
    parent_shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    swap_date DATE,
    swap_reason TEXT,
    swap_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Shifts
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_nurse ON public.shifts(nurse_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);

-- 3. Customer Services Table (with Satang Financial Ledger)
CREATE TABLE IF NOT EXISTS public.customer_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nurse_id UUID REFERENCES public.nurses(id) ON DELETE CASCADE,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    service_date DATE NOT NULL,
    service_time TIME NOT NULL,
    services TEXT[] DEFAULT '{}',
    other_service_text TEXT,
    medications TEXT[] DEFAULT '{}',
    note TEXT,
    price NUMERIC,
    service_fee_satang BIGINT DEFAULT 0,
    medication_cost_satang BIGINT DEFAULT 0,
    duration_hours NUMERIC(4,2),
    travel_expense_satang BIGINT DEFAULT 0,
    other_expenses_satang BIGINT DEFAULT 0,
    status TEXT DEFAULT 'upcoming', -- 'upcoming', 'completed', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Customer Services
CREATE INDEX IF NOT EXISTS idx_services_date ON public.customer_services(service_date);

-- 4. Personal Events Table (ธุระส่วนตัว)
CREATE TABLE IF NOT EXISTS public.personal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nurse_id UUID REFERENCES public.nurses(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- ไปทำอะไร / ชื่อกิจกรรม
    event_date DATE NOT NULL,
    start_time TIME NOT NULL, -- กี่โมง
    end_time TIME NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    relationship_tag TEXT DEFAULT 'other', -- Optional / default: 'other'
    location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Personal Events
CREATE INDEX IF NOT EXISTS idx_personal_events_date ON public.personal_events(event_date);

-- 5. Todos Table
CREATE TABLE IF NOT EXISTS public.todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nurse_id UUID REFERENCES public.nurses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    price_satang BIGINT DEFAULT 0,
    note TEXT,
    extra_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies
ALTER TABLE public.nurses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Allow public/anon access for demo (adjust in production)
CREATE POLICY "Allow anon read/write nurses" ON public.nurses FOR ALL USING (true);
CREATE POLICY "Allow anon read/write shifts" ON public.shifts FOR ALL USING (true);
CREATE POLICY "Allow anon read/write services" ON public.customer_services FOR ALL USING (true);
CREATE POLICY "Allow anon read/write personal_events" ON public.personal_events FOR ALL USING (true);
CREATE POLICY "Allow anon read/write todos" ON public.todos FOR ALL USING (true);
