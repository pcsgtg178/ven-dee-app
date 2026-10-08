-- Migration: Single-User Schema for VenDee (เวรดี) Fullstack PWA
-- Architecture: Single-User Personal Companion App (แอปพลิเคชันสำหรับใช้งานคนเดียว)
-- Date: 2026-10-06

-- 1. Single User Profile & Settings Table
CREATE TABLE IF NOT EXISTS public.user_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'พยาบาล',
    avatar_color TEXT DEFAULT '#3b82f6',
    black_shift_quota INT DEFAULT 14,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default single user profile if not exists
INSERT INTO public.user_profile (name, avatar_color, black_shift_quota)
SELECT 'พยาบาล', '#3b82f6', 14
WHERE NOT EXISTS (SELECT 1 FROM public.user_profile);

-- 2. Shifts Table (Single-User Personal Schedule)
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_date DATE NOT NULL,
    shift_type TEXT NOT NULL, -- 'morning', 'afternoon', 'night', 'r1', 'r2', 'off', 'ctm', 'cta'
    category TEXT NOT NULL DEFAULT 'black', -- 'black', 'red', 'green', 'gray', 'purple'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'swapped_out', 'cancelled'
    department TEXT,
    note TEXT,
    swapped_with TEXT, -- ชื่อเพื่อนร่วมงานที่ตกลงแลกเวรด้วย (Audit log)
    original_owner TEXT, -- เจ้าของเวรเดิมตามตาราง (ถ้ามี)
    parent_shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    swap_date DATE,
    swap_reason TEXT,
    swap_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Shifts
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);

-- 3. Customer Services Table (External Gig & Financial Ledger)
CREATE TABLE IF NOT EXISTS public.customer_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    service_date DATE NOT NULL,
    service_time TIME NOT NULL,
    services TEXT[] DEFAULT '{}',
    other_service_text TEXT,
    medications TEXT[] DEFAULT '{}',
    note TEXT,
    price NUMERIC DEFAULT 0,
    service_fee_satang BIGINT DEFAULT 0, -- Satang integer (1 THB = 100 Satang)
    medication_cost_satang BIGINT DEFAULT 0,
    duration_hours NUMERIC(4,2),
    travel_expense_satang BIGINT DEFAULT 0,
    other_expenses_satang BIGINT DEFAULT 0,
    status TEXT DEFAULT 'upcoming', -- 'upcoming', 'completed', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Customer Services
CREATE INDEX IF NOT EXISTS idx_services_date ON public.customer_services(service_date);

-- 4. Personal Events Table (ธุระส่วนตัว / Event Calendar)
CREATE TABLE IF NOT EXISTS public.personal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL, -- ไปทำอะไร / กิจกรรมส่วนตัว
    event_date DATE NOT NULL,
    start_time TIME NOT NULL, -- กี่โมง
    end_time TIME NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    relationship_tag TEXT DEFAULT 'other', -- Optional
    location TEXT,
    notes TEXT, -- เพิ่มเติม
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Personal Events
CREATE INDEX IF NOT EXISTS idx_personal_events_date ON public.personal_events(event_date);

-- 5. Todos Table
CREATE TABLE IF NOT EXISTS public.todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    price_satang BIGINT DEFAULT 0,
    note TEXT,
    extra_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Policies (Single User App: Full Access)
ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on user_profile" ON public.user_profile FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on shifts" ON public.shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on customer_services" ON public.customer_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on personal_events" ON public.personal_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on todos" ON public.todos FOR ALL USING (true) WITH CHECK (true);
