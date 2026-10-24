# BACKLOG_MIGRATE — แยกข้อมูลการแลกเวรออกจาก `shifts`

สถานะ: **Draft / ยังไม่เริ่มทำ**
ไฟล์ migration ที่จะสร้าง: `supabase/migrations/20261024_shift_swaps.sql`

---

## 1. เป้าหมาย

- ตาราง `shifts` เก็บเฉพาะ **`swap_id`** (อ้างอิงไปที่ตารางแลกเวร) ไม่เก็บรายละเอียดการแลกอีกต่อไป
- ตารางใหม่ `shift_swaps` เก็บประวัติการแลก: แลกกับใคร, เวรไหนแลกกับเวรไหน, เหตุผล, วันที่
- เวรที่ถูกแลกออก → `status = 'swapped_out'` + มี `swap_id`
- คืนเวร/ยกเลิก → **ลบ record ใน `shift_swaps`** แล้ว update เวรเดิมกลับเป็น `active` และเอา `swap_id` ออก

> [!NOTE]
> ที่ผู้ใช้เขียนว่า `swap_out` — โค้ดปัจจุบันใช้ค่า `swapped_out` (ใน `ShiftStatus`, SQL, `shiftActions.ts`, `quota.ts`)
> แผนนี้ **คงค่าเดิม `swapped_out`** เพื่อไม่ต้อง migrate ค่า status และไม่กระทบ test ถ้าต้องการเปลี่ยนจริง ดูข้อ 9

---

## 2. โครงสร้างปัจจุบัน (as-is)

`public.shifts` มี column เกี่ยวกับการแลกปนอยู่:

| Column | ความหมาย |
|---|---|
| `swapped_with` | ชื่อคนที่แลกด้วย |
| `original_owner` | เจ้าของเวรเดิมตามตาราง |
| `parent_shift_id` | ชี้จากเวรที่ได้มา → เวรที่ให้ไป (self FK) |
| `swap_date`, `swap_reason` | วันที่/เหตุผล |
| `swap_history` (JSONB) | trail สำหรับ `ModalSwapTrail` |
| `is_locked` | ล็อกเมื่อเวรผ่านไปแล้ว (ไม่เฉพาะการแลก) |

การแลก 1 ครั้งปัจจุบัน = 2 แถวใน `shifts`:
1. เวรที่ให้ไป → `status = 'swapped_out'`
2. เวรที่ได้มา → `status = 'active'`, `parent_shift_id` ชี้ไปเวรที่ 1

---

## 3. โครงสร้างใหม่ (to-be)

### 3.1 ตาราง `shift_swaps` (ใหม่)

```sql
CREATE TABLE public.shift_swaps (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    given_shift_id     UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE, -- เวรที่ให้ไป (swapped_out)
    received_shift_id  UUID NOT NULL UNIQUE REFERENCES public.shifts(id) ON DELETE CASCADE, -- เวรที่ได้มา
    swapped_with       TEXT NOT NULL,   -- คนที่ตกลงแลกด้วย (direct partner)
    original_owner     TEXT,            -- เจ้าของเวรเดิมตามตาราง (ถ้าเป็นการแลกต่อยอด)
    swap_date          DATE NOT NULL DEFAULT CURRENT_DATE, -- วันที่ทำรายการแลก
    swap_reason        TEXT,
    swap_history       JSONB NOT NULL DEFAULT '[]'::jsonb, -- trail เดิม (SwapTrailNode[])
    created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_shift_swaps_given ON public.shift_swaps(given_shift_id);
ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on shift_swaps"
  ON public.shift_swaps FOR ALL USING (true) WITH CHECK (true);
```

### 3.2 ตาราง `shifts` (แก้)

```sql
ALTER TABLE public.shifts
  ADD COLUMN swap_id UUID REFERENCES public.shift_swaps(id) ON DELETE SET NULL;
CREATE INDEX idx_shifts_swap_id ON public.shifts(swap_id);
```

- `swap_id` ถูกตั้งที่ **เวรที่ให้ไป (swapped_out)** เท่านั้น (เหตุผลดูข้อ 3.3)
- เหลือ column แลกเวรใน `shifts` แค่ `swap_id` (+ `is_locked` ที่เก็บไว้ เพราะไม่ใช่ข้อมูลเฉพาะการแลก)
- หลัง backfill เสร็จและ verify แล้วค่อย **drop**: `swapped_with`, `original_owner`, `parent_shift_id`, `swap_date`, `swap_reason`, `swap_history`

### 3.3 ทำไม `swap_id` อยู่ที่เวรที่ให้ไปเท่านั้น

เวรที่ได้มา (active) สามารถถูกแลกต่ออีกครั้งได้ → มันเป็นทั้ง "received" ของการแลก A และ "given" ของการแลก B
ถ้าใช้ `swap_id` ตัวเดียวบน `shifts` จะบอกไม่ได้ว่าเป็นของ A หรือ B

- ฝั่ง given: `shifts.swap_id` → `shift_swaps.id`
- ฝั่ง received: หาจาก `shift_swaps.received_shift_id = shifts.id` (UNIQUE, มี index)

### 3.4 กฎ lifecycle

| เหตุการณ์ | `shift_swaps` | เวรที่ให้ไป | เวรที่ได้มา |
|---|---|---|---|
| แลกเวร | INSERT 1 แถว | `status='swapped_out'`, `swap_id=<id>` | INSERT shift ใหม่ `status='active'` |
| คืนเวร / ยกเลิกการแลก | **DELETE แถวนั้น** | `status='active'`, `swap_id=NULL` | ลบทิ้ง (ดูข้อ 9 คำถามที่ 2) |
| ลบเวรที่ได้มา (`deleteShift`) | DELETE แถวนั้น | กลับเป็น `active`, `swap_id=NULL` | ลบ |

ทุกขั้นตอนต้องทำใน **transaction เดียว** → ทำเป็น Postgres function (RPC) แทนการยิงหลาย query จาก server action:

- `perform_shift_swap(...)` — insert shift ใหม่ + insert swap + update given shift
- `undo_shift_swap(p_swap_id uuid)` — update given shift → active/NULL, delete received shift, delete swap

---

## 4. Data migration (backfill)

ทำเป็นไฟล์ SQL เดียว รันใน transaction

### 4.0 Pre-check (รันก่อน, ต้องรู้ผลก่อนไปต่อ)

```sql
-- (a) swapped_out ที่ไม่มีเวรลูก (ข้อมูลกำพร้า)
SELECT s.id FROM shifts s
WHERE s.status = 'swapped_out'
  AND NOT EXISTS (SELECT 1 FROM shifts c WHERE c.parent_shift_id = s.id AND c.status <> 'cancelled');

-- (b) เวรลูกที่ status = cancelled (เกิดจาก undo แบบเก่า)
SELECT id FROM shifts WHERE parent_shift_id IS NOT NULL AND status = 'cancelled';

-- (c) parent หนึ่งตัวมีลูกมากกว่า 1
SELECT parent_shift_id, count(*) FROM shifts
WHERE parent_shift_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
```

### 4.1 Backfill

```sql
BEGIN;

-- 1) สร้าง shift_swaps จากทุกเวรลูกที่ยังไม่ cancelled
INSERT INTO shift_swaps
  (id, given_shift_id, received_shift_id, swapped_with, original_owner,
   swap_date, swap_reason, swap_history, created_at)
SELECT gen_random_uuid(), c.parent_shift_id, c.id,
       COALESCE(c.swapped_with, p.swapped_with, '-'),
       c.original_owner,
       COALESCE(c.swap_date, p.swap_date, c.created_at::date),
       COALESCE(c.swap_reason, p.swap_reason),
       COALESCE(c.swap_history, '[]'::jsonb),
       c.created_at
FROM shifts c
JOIN shifts p ON p.id = c.parent_shift_id
WHERE c.parent_shift_id IS NOT NULL AND c.status <> 'cancelled';

-- 2) ตั้ง swap_id ที่เวรที่ให้ไป
UPDATE shifts s SET swap_id = sw.id
FROM shift_swaps sw WHERE sw.given_shift_id = s.id;

-- 3) เวรลูกที่ cancelled: ลบทิ้ง (ความหมายใหม่ = ไม่มีประวัติเหลือ) และ ensure parent เป็น active
UPDATE shifts SET status = 'active'
WHERE id IN (SELECT parent_shift_id FROM shifts WHERE status = 'cancelled' AND parent_shift_id IS NOT NULL)
  AND swap_id IS NULL AND status = 'swapped_out';
DELETE FROM shifts WHERE status = 'cancelled' AND parent_shift_id IS NOT NULL;

COMMIT;
```

### 4.2 Verify

```sql
-- ทุก swapped_out ต้องมี swap_id และทุก swap_id ชี้ swap ที่มีอยู่จริง
SELECT count(*) FROM shifts WHERE status='swapped_out' AND swap_id IS NULL;      -- ต้อง 0
SELECT count(*) FROM shifts WHERE status<>'swapped_out' AND swap_id IS NOT NULL; -- ต้อง 0
SELECT count(*) FROM shift_swaps sw
  JOIN shifts g ON g.id = sw.given_shift_id
  JOIN shifts r ON r.id = sw.received_shift_id;                                  -- = count(*) ของ shift_swaps
```

### 4.3 Cleanup (migration แยกไฟล์, ทำหลังแอปใหม่ deploy และยืนยันแล้ว)

```sql
ALTER TABLE shifts
  DROP COLUMN swapped_with, DROP COLUMN original_owner, DROP COLUMN parent_shift_id,
  DROP COLUMN swap_date, DROP COLUMN swap_reason, DROP COLUMN swap_history;
```

> [!WARNING]
> ทำ backup (`pg_dump` ของ `shifts`) ก่อนรัน 4.1 และอย่า drop column ในไฟล์เดียวกับ backfill เพื่อ rollback ได้

---

## 5. งานแก้โค้ด

| ไฟล์ | สิ่งที่ต้องแก้ |
|---|---|
| `supabase/migrations/` | ไฟล์ใหม่: create `shift_swaps`, add `swap_id`, RPC functions, backfill; ไฟล์แยก: cleanup |
| [types/vendee.ts](types/vendee.ts) | เพิ่ม `ShiftSwapRecord`; `ShiftRecord` เพิ่ม `swapId?`; `SwapMetadata` เหลือเป็นข้อมูลที่ join มา (read-only) หรือแทนด้วย `swap?: ShiftSwapRecord` |
| [app/actions/shiftActions.ts](app/actions/shiftActions.ts) | `mapRowToShift` (L17-25) join `shift_swaps`; `swapShiftAction` (L215+), `undoSwapShiftAction` (L325+), `deleteShiftAction` (L416+) → เรียก RPC; undo เปลี่ยนจาก "update cancelled" เป็น "delete swap" |
| [lib/storage.ts](lib/storage.ts) | `swapShift` (L949), `undoSwapShift` (L1112), `deleteShift` (L864), `restoreShift` (L920) — เลิกใช้ `parentShiftId`/`swapMeta` เป็นตัวหา child, ใช้ swap lookup; bump `STORAGE_KEYS.SHIFTS` `v2` → `v3` + migrate localStorage; sample data (L236-261) |
| [lib/calendar/icsGenerator.ts](lib/calendar/icsGenerator.ts) | อ่าน `swappedWith`/`originalOwner` จาก swap ที่ join มา |
| [lib/quota.ts](lib/quota.ts) + `__tests__/quota.test.ts` | logic นับโควต้าไม่ควรเปลี่ยน (นับ `status='active'`) แต่ปรับ fixture ที่ใช้ `swapMeta` |
| `ModalSwapTrail.tsx`, `ModalEditShift.tsx`, `ActivityCard.tsx`, `ScheduleOverview.tsx`, `ScheduleTodoListView.tsx` | เปลี่ยนการอ่าน `swapMeta` → ข้อมูลจาก swap |
| `docs/SYSTEM_DESIGN.md`, `docs/API_REQUIREMENTS.md`, `DOMAIN_RULES.md` §2.3 | อัปเดต schema และกฎ rollback |

---

## 6. ลำดับการทำ (แนะนำ)

1. [ ] Backup + รัน pre-check 4.0 บนฐานข้อมูลจริง
2. [ ] Migration A: create `shift_swaps`, add `shifts.swap_id`, สร้าง RPC
3. [ ] Migration B: backfill 4.1 + verify 4.2
4. [ ] แก้ types + server actions + storage.ts + UI (ข้อ 5) — อ่านจาก `shift_swaps`
5. [ ] อัปเดต/เพิ่ม test (swap, undo, chain swap, delete received shift)
6. [ ] ทดสอบ manual: แลก → คืน, แลกต่อยอด 2 ชั้น, คืนชั้นแรกขณะชั้นสองยังอยู่ (ต้องถูกบล็อก)
7. [ ] Deploy แอป → ยืนยัน → Migration C: drop column เก่า (4.3)

## 7. Rollback plan

- ก่อน Migration C: column เก่ายังอยู่ครบ → revert โค้ดกลับได้เลย (ข้อมูลใน `shifts` ไม่ถูกแตะนอกจากเพิ่ม `swap_id`)
- หลัง Migration C: restore จาก backup ในข้อ 1

## 8. ความเสี่ยง

- **Chain swap**: คืนเวรชั้นแรกขณะที่ received shift ถูกแลกต่อไปแล้ว → ต้องบล็อกให้คืนชั้นหลังก่อน (สอดคล้อง guard ใน `deleteShift` L875)
- **Local-first storage**: ผู้ใช้มีข้อมูลใน localStorage (`vendee_shifts_v2`) ต้องมี migration ฝั่ง client ไม่งั้นแสดงผลเพี้ยน
- **ID `shift-*` (ออฟไลน์/ sample)** ไม่ใช่ UUID — โค้ดเดิมข้าม Supabase ด้วย `startsWith("shift-")` ต้องคงพฤติกรรมนี้
- Circular FK (`shifts.swap_id` ↔ `shift_swaps.*_shift_id`) — ใช้ `ON DELETE` ตามข้อ 3 และสร้างผ่าน `ALTER TABLE` ตามลำดับ

## 9. การตัดสินใจ (Decision log)

| # | หัวข้อ | ผลสรุป |
|---|---|---|
| 1 | ชื่อ status | ✅ คง `swapped_out` ตามโค้ดปัจจุบัน (ไม่เปลี่ยนเป็น `swap_out`) |
| 2 | เวรที่ได้มาเมื่อคืน/ยกเลิก | ✅ **ลบแถวทิ้ง** (ต้องแก้ `undoSwapShiftAction` ที่เดิม mark `cancelled` ให้ลบแทน) |
| 3 | ตำแหน่ง `swap_id` | ✅ อยู่ที่เวรที่ให้ไป (`swapped_out`) เท่านั้น; เวรที่ได้มาหาจาก `shift_swaps.received_shift_id`; **แลกต่อยอดได้** |
| 4 | `is_locked` | ✅ เก็บไว้ใน `shifts` ตามเดิม |
| 5 | เวรกำพร้า (`swapped_out` ไม่มีเวรที่ได้มา) ตอน backfill | ✅ รัน pre-check 4.0(a) ก่อน แล้วตัดสินใจ**ทีละแถว** (ไม่ auto-fix) |

> [!NOTE]
> ข้อ 5 เกิดจากข้อมูลเก่า: เดิมการแลกเก็บเป็น 2 แถวที่เชื่อมด้วย `parent_shift_id` ถ้าแถวที่ได้มาถูกลบ/ผิดพลาดไป
> แถวที่ให้ไปจะค้างเป็น `swapped_out` โดยไม่มีคู่ → สร้าง `shift_swaps` ไม่ได้ (เพราะ `received_shift_id` เป็น NOT NULL)
> ถ้า pre-check 4.0(a) ได้ **0 แถว** ข้อนี้ไม่ต้องตัดสินใจ

