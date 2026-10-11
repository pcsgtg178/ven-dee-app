-- Migration: Medications Master Table (ตารางจัดเก็บข้อมูลยาและเวชภัณฑ์)
-- Date: 2026-10-11
-- Fields: ชื่อ (name), ขนาด (size/dosage), หน่วย (unit), ราคา (price/price_satang), รายละเอียด (description)

CREATE TABLE IF NOT EXISTS public.medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                         -- ชื่อยา เช่น Botox, Vitamin B12
    size TEXT,                                  -- ขนาด เช่น 100, 50, 100ml
    unit TEXT DEFAULT 'ยูนิต',                   -- หน่วย เช่น ยูนิต, เข็ม, ขวด, แผง, ชุด
    price NUMERIC DEFAULT 0,                    -- ราคา (บาท) เช่น 2500, 1500
    description TEXT,                           -- รายละเอียด เช่น นาบูตะ *นำเข้า
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching medications by name
CREATE INDEX IF NOT EXISTS idx_medications_name ON public.medications(name);

-- Row Level Security (RLS) Policies (Single User App: Full Access)
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on medications" ON public.medications
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert Starter Seed Data (รวมตัวอย่าง Botox 100 ยูนิต และ Botox 50 ยูนิต)
INSERT INTO public.medications (name, size, unit, price, description)
VALUES
    ('Botox', '100', 'ยูนิต', 2500, 'นาบูตะ *นำเข้า'),
    ('Botox', '50', 'ยูนิต', 1500, 'นาบูตะ *นำเข้า'),
    ('Vitamin B12', '1', 'เข็ม', 200, 'วิตามินบำรุงประสาทและร่างกาย'),
    ('NSS 100ml', '100', 'ขวด', 150, 'น้ำเกลือ 0.9% Normal Saline Solution'),
    ('Fat Burner', '1', 'เข็ม', 500, 'สูตรเร่งเผาผลาญไขมันเฉพาะจุด'),
    ('Collagen IV Drip', '1', 'ชุด', 800, 'ดริปวิตามินผิวเข้มข้น'),
    ('Paracetamol', '10', 'แผง', 50, 'ยาลดไข้ บรรเทาปวด 500mg')
ON CONFLICT DO NOTHING;
