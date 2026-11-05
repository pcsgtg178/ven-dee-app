# BACKLOG_ISSUE — Issue ที่ผู้ใช้แจ้ง

สถานะ: **Resolved (ISSUE-1, ISSUE-2, and ISSUE-3 Cascading Swap Solved & Verified)**
ความสัมพันธ์: Phase 10 [BACKLOG_MIGRATE.md](./BACKLOG_MIGRATE.md) (แยก `shift_swaps`) จะต่อยอดโครงสร้างให้เป็นตารางแยกและ RPC เต็มรูปแบบ

| ID | หัวข้อ | Severity | ประเภท |
|---|---|---|---|
| ISSUE-1 | บันทึกงานคลินิกแล้วไม่พบใน DB | **High** (data loss) | Missing persistence |
| ISSUE-2 | คืนเวรแล้วข้อมูลแลกเวรค้าง/เวรเดิมถูกใส่เป็นของคนอื่น | **High** (data corruption) | Logic + error handling |
| ISSUE-3 | แลกเวรเป็นทอดๆ แล้วเวรต้นทางกลับมาแสดงซ้ำ (Cascading Swap / False Orphan Repair) | **High** (UI / state corruption) | Auto-repair logic flaw |

---

## ISSUE-1: บันทึกงานที่คลินิก แสดงบนหน้าจอแต่ไม่มีใน DB

### อาการ
ผู้ใช้บันทึกงานคลินิก (เช่น `12:30 - 17:30`) → เห็นบนหน้าจอทันที แต่ query ฐานข้อมูล Supabase ไม่พบ record

### Root cause (ยืนยันจากโค้ด)
งานคลินิก (`ClinicWorkRecord`) **เก็บใน `localStorage` อย่างเดียว ไม่เคยถูกส่งไป Supabase**

| จุด | หลักฐาน |
|---|---|
| `lib/storage.ts` → `saveClinicLog()`, `deleteClinicLog()`, `getClinicLogs()` | อ่าน/เขียน `localStorage` key `vendee_clinic_logs_v1` เท่านั้น ไม่เรียก Server Action |
| `app/actions/` | **ไม่มี** `clinicActions.ts` (มีแค่ calendar, customer, medication, personalEvent, service, shift, todo) |
| `supabase/migrations/` | **ไม่มี** ตาราง clinic logs |
| `syncAllDataFromApi()` | ดึง shifts/customers/services/personalEvents/medications — **ไม่รวม clinic logs** |
| `app/api/calendar/feed/route.ts`, `export/route.ts` | ใช้ `initialClinicLogs` (ค่าว่าง `[]`) → ปฏิทิน feed ฝั่ง server ไม่เห็นงานคลินิกเลย |

### ผลกระทบ
- ข้อมูลหายเมื่อล้าง browser / เปลี่ยนเครื่อง / เปิดบนมือถืออีกเครื่อง
- Calendar feed (ICS) ที่สร้างฝั่ง server ไม่มีงานคลินิก (ตั้ง `includeClinic` ก็ไม่มีข้อมูล)
- ไม่มี backup / audit

### แนวทางแก้
1. **Migration** `supabase/migrations/2026XXXX_clinic_work_logs.sql`
   ```sql
   CREATE TABLE public.clinic_work_logs (
       id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       work_date     DATE NOT NULL,
       preset_shift  TEXT NOT NULL CHECK (preset_shift IN ('12:30 - 17:30','17:00 - 19:30','12:30 - 19:30')),
       note          TEXT,
       created_at    TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE INDEX idx_clinic_work_logs_date ON public.clinic_work_logs(work_date);
   ALTER TABLE public.clinic_work_logs ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Allow all operations on clinic_work_logs"
     ON public.clinic_work_logs FOR ALL USING (true) WITH CHECK (true);
   ```
2. สร้าง `app/actions/clinicActions.ts`: `getClinicLogsAction`, `createClinicLogAction`, `updateClinicLogAction`, `deleteClinicLogAction` (รูปแบบ `ActionResult` เหมือน action อื่น)
3. แก้ `saveClinicLog` / `deleteClinicLog` ใน `storage.ts` ให้เป็น `async` แล้วเรียก action ก่อน (pattern เดียวกับ `saveShift`) — **ต้อง check `res.success` และแจ้ง user เมื่อ fail** (ดู ISSUE-2 ข้อ B)
4. เพิ่ม clinic logs ใน `syncAllDataFromApi()` + **migrate ข้อมูลเก่าใน localStorage ขึ้น DB อัตโนมัติ** (id ขึ้นต้น `clinic-` ที่ยังไม่มีใน DB) เพื่อกู้ข้อมูลที่ผู้ใช้บันทึกไปแล้ว
5. ให้ `calendar/feed` และ `calendar/export` อ่านจาก DB แทน `initialClinicLogs`
6. แก้ call-site ที่เรียก `saveClinicLog`/`deleteClinicLog` (ตอนนี้ sync) ให้ `await`

### Acceptance criteria
- [x] บันทึกงานคลินิก → มี row ใน `clinic_work_logs`
- [x] ลบ/แก้ไข → สะท้อนใน DB
- [x] เปิดอีก browser/เครื่อง → เห็นข้อมูลเดียวกัน
- [x] ข้อมูลเก่าใน localStorage ถูก migrate ขึ้น DB ครั้งแรกที่ sync
- [x] ICS feed มีงานคลินิก
- [x] ถ้าบันทึก DB ไม่สำเร็จ → แสดง error ไม่ใช่ทำเหมือนสำเร็จ

---

## ISSUE-2: แลกเวรแล้ว "คืนเวร" ข้อมูลแลกยังค้างใน DB

### สถานการณ์ที่ผู้ใช้เจอ
> แลก **เช้า 3 พ.ย. (ของเรา)** ↔ **บ่าย 3 พ.ย. (ของบีม)** แล้วกด "คืนเวร"

ผลที่ผิด:
- (a) เวร **บีม บ่าย 3 พ.ย.** ยังค้างใน DB
- (b) เวร **เช้า 3 พ.ย. เดิมของเรา** ยังเป็นของบีม (ยังเป็น `swapped_out` / มี `swapped_with = บีม`)

### Root causes (ยืนยันจากโค้ด)

**A. "คืนเวร" ไม่ลบ record — แค่ set `status = 'cancelled'`**
`undoSwapShiftAction` ([shiftActions.ts#L325-L383](./app/actions/shiftActions.ts#L325-L383)) แก้เวรที่ได้มาเป็น `cancelled` แต่ไม่ delete → แถว "บีม บ่าย 3 พ.ย." ยังอยู่ใน DB (อาการ a)
และ `getShiftsAction` ดึงทุก status จึงอาจกลับมาที่ UI ตอน sync

**B. Server Action ล้มเหลวแบบเงียบ (silent failure) → local กับ DB ไม่ตรงกัน**
`undoSwapShift` / `swapShift` ใน [storage.ts#L1112-L1164](./lib/storage.ts#L1112-L1164) อัปเดต `localStorage` **ก่อน** แล้วค่อยเรียก server และห่อ `try/catch` ที่ catch แค่ exception
แต่ Server Action คืน `{ success: false, error }` (ไม่ throw) → **ไม่เคยเช็ก `res.success`** ผู้ใช้เห็นว่าคืนสำเร็จ แต่ DB ไม่เปลี่ยน
`swapShift` ก็เช่นกัน ถ้า action fail จะ fallback สร้างเวรใหม่ด้วย id `shift-<timestamp>` ใน local อย่างเดียว (เวรเดิมถูก set `swapped_out` ใน local แต่ DB ยัง active หรือกลับกัน)

**C. การ update หลายขั้นไม่เป็น atomic และไม่เช็ก error ทีละขั้น**
ใน `undoSwapShiftAction` แต่ละ `.update()` ไม่ตรวจ `error`:
1. restore parent → `active`
2. cancel child
ถ้าขั้นใดพัง อีกขั้นยังทำ → state ครึ่งๆ กลางๆ (อาการ b)
`swapShiftAction` ก็ insert เวรใหม่หลัง update เวรเก่า มี rollback แค่กรณี insert fail และ rollback เองก็ไม่เช็ก error

**D. restore parent ไม่ล้างข้อมูลการแลก**
ตอน restore เวรเดิมเป็น `active` ไม่ได้ clear `swapped_with`, `swap_date`, `swap_reason`
→ `mapRowToShiftRecord` ([shiftActions.ts#L17](./app/actions/shiftActions.ts#L17)) เห็น `swapped_with` ยังมีค่า จึงสร้าง `swapMeta` ต่อ → UI ยังแสดงว่าเวรเช้า 3 พ.ย. เกี่ยวกับ "บีม" (อาการ b)

**E. `.single()` ตอนหา child พังเมื่อมีหลายแถว**
กรณีผู้ใช้เลือกกด undo จากเวรที่ `swapped_out`: `select("id").eq("parent_shift_id", ...).single()` → error ถ้ามี child >1 แถว (เช่น cancelled เก่า + ใหม่) → `child` เป็น null → ไม่ cancel child เลย

**F. ไม่มี validation ฝั่ง server**
`undoSwapShiftAction` ไม่เช็ก `is_locked`, ไม่เช็กว่าเวรอยู่สถานะที่ถูกต้อง, และไม่เช็ก conflict ตอน restore parent
(กฎ lock ฝั่ง client พึ่ง `isShiftInPast` ซึ่ง **hardcode วันที่ `"2026-09-19"`** — [storage.ts#L171-L187](./lib/storage.ts#L171-L187) ทำให้ lock ผิดเวลาจริง)

**G. Client ไม่ clear `swapMeta` ของ parent ตอน undo**
`undoSwapShift` set แค่ `parentShift.status = "active"` แต่ปล่อย `swapMeta.swappedWith = บีม` ค้างใน local

### แนวทางแก้
1. **ทำตาม [BACKLOG_MIGRATE.md](./BACKLOG_MIGRATE.md)**: ตาราง `shift_swaps` + `swap_id` — คืนเวร = **ลบ row `shift_swaps` + ลบ (ไม่ใช่ cancel) เวรที่ได้มา + restore เวรเดิมเป็น `active` พร้อม clear `swap_id`**
2. ทำ swap/undo เป็น **transaction เดียวใน Postgres RPC** (`create_shift_swap`, `undo_shift_swap` เป็น `plpgsql function`) แทนการยิงหลาย `.update()` จาก server action
3. เปลี่ยน flow ฝั่ง client เป็น **server-first**: เรียก action → ถ้า `success` ค่อยอัปเดต localStorage → ถ้า fail ให้ throw error ให้ UI แสดง (ห้ามอัปเดต local ก่อน)
4. เพิ่มการตรวจ `error` ของทุก query ใน `shiftActions.ts` (โดยเฉพาะ swap/undo/delete)
5. แก้ undo ให้ถูกต้องทั้งสองทิศ (เรียกจากเวรที่ได้มา หรือเวรที่ส่งไป) โดยหา record ผ่าน `shift_swaps` แทน `.single()` บน `parent_shift_id`
6. ตรวจ `is_locked` และ conflict ฝั่ง server; เลิก hardcode วันที่ใน `isShiftInPast`/`isDateInPast` (ใช้ `new Date()` ตาม timezone Asia/Bangkok)
7. **Data repair script** สำหรับข้อมูลที่เสียไปแล้ว (ดูด้านล่าง)

### Data repair (ข้อมูลที่เสียอยู่แล้ว)
ตรวจหา orphan:
```sql
-- เวรที่ได้มาแต่ถูก cancel แล้ว (ค้างจากการคืนเวร)
SELECT * FROM public.shifts WHERE status = 'cancelled' AND parent_shift_id IS NOT NULL;

-- เวรเดิมที่ควรคืนแล้ว แต่ยังเป็น swapped_out ทั้งที่ไม่มี child active
SELECT s.* FROM public.shifts s
WHERE s.status = 'swapped_out'
  AND NOT EXISTS (
    SELECT 1 FROM public.shifts c
    WHERE c.parent_shift_id = s.id AND c.status = 'active'
  );

-- กรณีผู้ใช้: 3 พ.ย.
SELECT * FROM public.shifts WHERE shift_date = '2026-11-03' ORDER BY shift_type, created_at;
```
ซ่อม: ลบ child `cancelled`, set parent กลับ `active` และเคลียร์ `swapped_with/swap_date/swap_reason` — **ต้อง backup ก่อน และให้ผู้ใช้ยืนยันรายการก่อนรัน**

### Acceptance criteria
- [x] แลกเวร เช้า 3 พ.ย. ↔ บ่าย (บีม) 3 พ.ย. แล้วกดคืนเวร → ใน DB ไม่เหลือเวร "บีม บ่าย 3 พ.ย." (ไม่ใช่แค่ `cancelled`)
- [x] เวรเช้า 3 พ.ย. เดิมกลับเป็น `active` และ **ไม่มีข้อมูลบีมค้าง** (`swapMeta` ว่าง / `swap_id` เป็น null)
- [x] Undo ได้ทั้งเมื่อกดจากเวรเดิมและจากเวรที่ได้มา
- [x] ถ้า DB ล้มเหลวกลางทาง → rollback ทั้งหมด และ UI แสดง error (local ไม่เปลี่ยน)
- [x] Reload/sync แล้ว UI ตรงกับ DB
- [x] เวรที่ผ่านไปแล้วจริง (ตามเวลาจริง) คืนไม่ได้ ทั้ง client และ server
- [x] Test: unit/integration สำหรับ swap → undo → state ตรง DB (รวมกรณี fail กลางทาง)

---

## ISSUE-3: แลกเวรเป็นทอดๆ แล้วเวรต้นทางกลับมาแสดงซ้ำ (Cascading Swap / False Orphan Repair)

### สถานการณ์ที่ผู้ใช้เจอ (ยืนยันจาก DB จริง เมื่อ 3 พ.ย. 2026)
1. ผู้ใช้มี **เวรบ่าย 29 พ.ย. 2026 (Shift A: `f57fbbe7-...`)**
2. นำไปแลกกับ "พี่ไกร" ได้ **เวรบ่าย 30 พ.ย. 2026 (Shift B: `bbca5b20-...`)**
   - Shift A เปลี่ยนสถานะเป็น `swapped_out` ซ่อนจากตารางเวรตามปกติ ถูกต้อง
3. ต่อมา นำ **เวรบ่าย 30 พ.ย. 2026 (Shift B)** ไปแลกต่อกับ "บีม" ได้ **เวรเช้า 12 พ.ย. 2026 (Shift C: `43dce317-...`)**
4. **พบบัค:** **เวรบ่าย 29 พ.ย. (Shift A)** กลับมาโผล่แสดงเป็นเวรปกติ (`active`) บนตารางเวรอีกครั้ง ทั้งๆ ที่ไม่ได้กดยกเลิกการแลก

### ข้อมูลบนฐานข้อมูลจริง (Supabase)
- **Shift A (29 พ.ย. บ่าย):** `status: swapped_out`, `swap_id: 49a558b8-...` (ถูกต้อง)
- **Shift B (30 พ.ย. บ่าย):** `status: swapped_out`, `parent_shift_id: Shift A`, `swap_id: 2f25f9a6-...` (ถูกต้อง)
- **Shift C (12 พ.ย. เช้า):** `status: active`, `parent_shift_id: Shift B` (ถูกต้อง)
- ในตาราง `shift_swaps` มีประวัติการแลกครบทั้ง 2 ทอด (แลกกับพี่ไกร เมื่อ 11:55:38 น. และแลกต่อกับบีม เมื่อ 11:56:01 น.)
- **ข้อสรุปสำคัญ:** ข้อมูลบนฐานข้อมูล Supabase ถูกต้อง แต่ถูก Logic Client-Side Mutate สถานะใน LocalStorage/UI ให้กลายเป็น `active`

### Root causes (ยืนยันจากโค้ด)

**A. ฟังก์ชัน Auto-Repair `repairLocalSwapInconsistencies` กรองเฉพาะเวรลูกที่ `active`**
ใน [lib/swapRepair.ts#L33-L50](./lib/swapRepair.ts#L33-L50):
```typescript
const activeParentIds = new Set(
  filtered
    .filter((s) => s.status === "active" && (s.swap?.givenShiftId || s.swapMeta?.parentShiftId))
    .map((s) => s.swap?.givenShiftId || s.swapMeta!.parentShiftId!)
);
```
- ใน Chain การแลก (A ➔ B ➔ C): Shift B ถูกแลกออกไปจึงมีสถานะเป็น `swapped_out` (ไม่ใช่ `active`)
- ฟังก์ชันจึงข้าม Shift B ทำให้ parent ID ของ Shift A ไม่ถูกนับรวมใน `activeParentIds` (มีเฉพาะ `{ B }`)
- เมื่อวนลูปตรวจสอบเวรที่เป็น `swapped_out`:
  - ตรวจ Shift A: `!activeParentIds.has(A.id)` เป็นจริง!
  - ฟังก์ชันเข้าใจผิดว่า Shift A เป็น **"เวรที่เคยถูก swap ออกไปแต่ไม่มีลูกเหลืออยู่ (Orphan)"**
  - จึงสั่ง Force-Restore Shift A กลับมาเป็น `status = 'active'` และล้าง `swapMeta` / `swapId` ทิ้งทันที!

**B. Auto-Repair ถูกเรียกทำงานอัตโนมัติในทุกๆ การอ่านข้อมูล**
- ใน [lib/storage.ts#L831](./lib/storage.ts#L831): ฟังก์ชัน `getShifts()` เรียก `repairLocalSwapInconsistencies(parsed)` ทุกครั้งที่โหลดเวร และเซฟทับลง `localStorage` ทันทีที่ `modified === true`
- ใน [lib/storage.ts#L408](./lib/storage.ts#L408): ฟังก์ชัน `syncWithDatabase()` เรียก `repairLocalSwapInconsistencies(shiftsRes.value.data)` ซ้ำอีกครั้งตอนดึงข้อมูลจาก Supabase ทำให้แม้รีเฟรชหน้าจอก็ยังถูกแปลงกลับมาเป็น `active`

**C. Server Actions มีสมมติฐานเดียวกัน**
- ใน [app/actions/shiftActions.ts#L1210-L1217](./app/actions/shiftActions.ts#L1210-L1217) (`detectCorruptedSwapDataAction`) และบรรทัดที่ 1284–1300 (`repairCorruptedSwapDataAction`) ต่างก็ใช้ `.eq("status", "active")` ในการหา child จึงมองว่า Shift A เป็น orphan เช่นเดียวกัน

### แนวทางแก้
1. **แก้ `repairLocalSwapInconsistencies` ใน `lib/swapRepair.ts`:**
   - ในการหา valid parent IDs ต้องนับเวรลูกที่อยู่ในสถานะ `swapped_out`, `sold_out`, หรือ `transferred` ด้วย (ไม่ใช่เฉพาะ `active`) หรือ Traverse Chain ตรวจสอบจนถึงปลายทาง
   - เวรบรรพบุรุษที่มีลูกอยู่ในห่วงโซ่การแลก (Chain Swap) จะต้องไม่ถูก restore กลับเป็น `active`
2. **แก้ Server Actions ใน `app/actions/shiftActions.ts`:**
   - ปรับ `detectCorruptedSwapDataAction` และ `repairCorruptedSwapDataAction` ให้รองรับ chain swap
3. **เพิ่ม Unit Test สำหรับ Cascading Swap Repair:**
   - เพิ่มเคสทดสอบ Chain A ➔ B ➔ C ใน `lib/__tests__/swapUndoRepair.test.ts` เพื่อป้องกันไม่ให้เกิด Regression ในอนาคต

### Acceptance criteria
- [x] แลกเวร A ➔ B แล้วแลกต่อ B ➔ C → เวร A และ B ต้องคงสถานะ `swapped_out` ไม่โผล่ขึ้นมาในตารางเวร
- [x] เมื่อเรียก `repairLocalSwapInconsistencies` กับข้อมูลเวรใน Chain จะต้องไม่ flag เวร A เป็น orphan และไม่เปลี่ยนกลับเป็น `active`
- [x] เมื่อ reload/sync หน้าจอ เวร A ยังคงซ่อนอยู่ตามปกติ และเวร C แสดงผลเป็น `active`
- [x] Unit test สำหรับ cascading swap repair ผ่าน 100%

---

## ปัญหาร่วมที่พบ (Cross-cutting)

> [!WARNING]
> pattern **"อัปเดต localStorage ก่อน/แม้ DB fail แล้วเงียบ"** เป็นต้นเหตุร่วมของทั้งสอง issue และอาจเกิดกับ `saveShift`, `sellShift`, `restoreShift` ด้วย
> - `restoreShift` ([storage.ts#L920](./lib/storage.ts#L920)) อัปเดต local ก่อน และกลืน error
> - `sellShift`/`undoSellShift` ไม่เช็ก `res.success` (fail แล้ว fallback เป็นค่า local)

เสนอ: ทำ helper กลาง เช่น `unwrap(actionResult)` ที่ throw เมื่อ `success === false` แล้วใช้กับทุก call-site

## ลำดับการทำที่เสนอ

1. ISSUE-1: migration + `clinicActions.ts` + sync + migrate local → DB (ไม่พึ่งอย่างอื่น ทำได้ทันที)
2. Hotfix ISSUE-2 (เล็ก): เช็ก `res.success`, clear swap fields ตอน restore, delete child แทน cancel, เลิก `.single()` — บรรเทาได้ก่อน migration ใหญ่
3. ISSUE-2 (เต็ม): ทำตาม BACKLOG_MIGRATE + RPC transaction
4. Data repair script (รันหลังผู้ใช้ยืนยัน)
5. แก้ hardcode วันที่ใน `isShiftInPast`/`isDateInPast`
