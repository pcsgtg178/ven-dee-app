-- Migration: Customers Master Table (ตารางจัดเก็บข้อมูลลูกค้า)
-- Date: 2026-10-15
-- Fields: id (TEXT PK), name (TEXT), avatar_color (TEXT), created_at (TIMESTAMPTZ), updated_at (TIMESTAMPTZ)

CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_color TEXT DEFAULT 'bg-teal-500',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching customers by name
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);

-- Row Level Security (RLS) Policies (Single User App: Full Access)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'customers' AND policyname = 'Allow all operations on customers'
    ) THEN
        CREATE POLICY "Allow all operations on customers" ON public.customers
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Populate existing customers from customer_services records
INSERT INTO public.customers (id, name, avatar_color, created_at)
SELECT DISTINCT ON (customer_id)
    customer_id AS id,
    customer_name AS name,
    'bg-teal-500' AS avatar_color,
    created_at
FROM public.customer_services
WHERE customer_id IS NOT NULL AND customer_id <> ''
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, updated_at = NOW();
