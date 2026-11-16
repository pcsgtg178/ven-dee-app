# BACKLOG_ISSUE — Issue ที่ผู้ใช้แจ้ง

สถานะ: **Resolved (ISSUE-1, ISSUE-2, ISSUE-3 Cascading Swap, and ISSUE-4 Retroactive Shift Solved & Verified)**
ความสัมพันธ์: Phase 10 [BACKLOG_MIGRATE.md](./BACKLOG_MIGRATE.md) (แยก `shift_swaps`) จะต่อยอดโครงสร้างให้เป็นตารางแยกและ RPC เต็มรูปแบบ

| ID | หัวข้อ | Severity | ประเภท |
|---|---|---|---|
| ISSUE-1 | บันทึกงานคลินิกแล้วไม่พบใน DB | **High** (data loss) | Missing persistence |
| ISSUE-2 | คืนเวรแล้วข้อมูลแลกเวรค้าง/เวรเดิมถูกใส่เป็นของคนอื่น | **High** (data corruption) | Logic + error handling |
| ISSUE-3 | แลกเวรเป็นทอดๆ แล้วเวรต้นทางกลับมาแสดงซ้ำ (Cascading Swap / False Orphan Repair) | **High** (UI / state corruption) | Auto-repair logic flaw |
| ISSUE-4 | ไม่สามารถแก้ไขหรือลบเวรย้อนหลังได้ (Retroactive Shift Edit & Delete Blocked) | **Medium** (UX restriction) | Domain rule & locking logic |

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
`shiftActions.ts` รับ input แล้ว update ทันที ไม่ตรวจว่า parent ถูก swap ซ้ำไหม, `is_locked`, `shift_date` อยู่ในอดีตไหม

---

## ISSUE-3: แลกเวรเป็นทอดๆ แล้วเวรต้นทางกลับมาแสดงซ้ำ (Cascading Swap / False Orphan Repair)

### สถานการณ์ที่ผู้ใช้เจอ
> ผู้ใช้มีเวรเช้า (Shift A) แลกกับเวรบ่าย (Shift B) → ระบบสร้าง Shift B เป็น child และ mark Shift A เป็น `swapped_out`
> ต่อมาผู้ใช้นำเวรบ่าย (Shift B) ไปแลกต่อเป็นเวรดึก (Shift C) → ระบบสร้าง Shift C เป็น child และ mark Shift B เป็น `swapped_out`
> แต่เมื่อรีเฟรชหน้าจอหรือเปิดแอปใหม่ เวรเช้า (Shift A) กลับมาแสดงในตารางเวรเป็น `active` ทำให้มีทั้งเวร A และเวร C ขึ้นมาพร้อมกัน

### Root cause (ยืนยันจากโค้ด)
**A. อัลกอริทึม Auto-Repair ตรวจจับเฉพาะชั้นแรก (`status === 'active'`)**
- ใน [lib/swapRepair.ts#L10-L24](./lib/swapRepair.ts#L10-L24): ฟังก์ชัน `repairLocalSwapInconsistencies` ทำการเก็บ `validParentIds` จาก child shifts ที่มี `status === 'active'` เท่านั้น
- ในกรณี Cascading Swap (A ➔ B ➔ C):
  - Shift C มีสถานะ `active` และมี `parentShiftId = B` ➔ รหัสของ Shift B จึงถูกเก็บเป็น valid parent
  - แต่ Shift B ถูกนำไปแลกต่อจนมีสถานะ `swapped_out` ➔ ทำให้รหัสของ Shift A ไม่ถูกนับเป็น valid parent
- ฟังก์ชัน Auto-Repair จึงมองว่า Shift A เป็น **Orphan Swapped-Out Shift** (เวรต้นทางที่ไม่มีเวรลูกที่ active อยู่) และบังคับคืนสถานะ Shift A ให้กลับมาเป็น `active` อัตโนมัติ (`s.status = "active"`) ทำให้เวรต้นทางโผล่กลับมาซ้ำซ้อน

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

## ISSUE-4: ไม่สามารถแก้ไขหรือลบเวรย้อนหลังได้ (Retroactive Shift Edit & Delete Blocked)

### อาการ
ผู้ใช้ต้องการแก้ไขเวรในอดีต (เช่น เปลี่ยนเวรดำเป็นเวรแดง OT, แก้ไขหมายเหตุ, ปรับประเภทเวร, ลบเวรที่ลงผิด) แต่:
1. ปุ่ม "แก้ไข" บน ActivityCard และ ScheduleTodoListView ไม่แสดง (ถูกซ่อน)
2. เมื่อพยายามบันทึกผ่าน `saveShift` หรือ `updateShiftAction` จะแจ้งเตือนข้อผิดพลาด: `"ไม่สามารถแก้ไขเวรในอดีตที่ถูกล็อกแล้วได้"` (`SHIFT_IS_LOCKED`)
3. การลบเวรย้อนหลังผ่าน `deleteShift` หรือ `deleteShiftAction` ถูกปฏิเสธเช่นเดียวกัน

### Root cause (ยืนยันจากโค้ด)
1. **Domain Rule เดิมจำกัดสิทธิ์**: ใน Phase 12 เปิด Grace Period ให้เฉพาะเวร Refer และใน Phase 16 เปิดสิทธิ์ Grace Period สำหรับเวรปกติเฉพาะรายการ "แลกเวร (Swap)" และ "กู้คืนเวร (Undo Swap)" เท่านั้น ทำให้การแก้ไข (Edit) และการลบ (Delete) เวรปกติในอดีตยังติดล็อกตามกฎ Immutability เดิม
2. **`isShiftLocked` ใน `lib/dateUtils.ts`**: เวรปกติทุกประเภทที่มีวันที่ในอดีต (`isShiftInPast`) ถูกประเมินเป็น `isLocked = true` เสมอ แม้จะอยู่ในเดือนปัจจุบันหรือ Grace Period
3. **Guard clauses**:
   - `canEditShift` ใน `lib/storage.ts` อาศัย `!isShiftLocked(shift)` จึงส่งผลให้ปุ่ม "แก้ไข" ถูกซ่อน
   - `saveShift` และ `deleteShift` ใน `lib/storage.ts` บล็อกด้วย `isShiftLocked`
   - `updateShiftAction` และ `deleteShiftAction` ใน `app/actions/shiftActions.ts` บล็อกด้วย `SHIFT_IS_LOCKED` สำหรับเวรที่ไม่ใช่เวร Refer

### แนวทางแก้ (Phase 18: Unified Retroactive Shift Edit & Delete)
1. **`lib/dateUtils.ts`**:
   - ปรับปรุง `isShiftLocked`: เวรในอดีตที่อยู่ภายใน Grace Period (`isDateWithinGracePeriod`: เดือนปัจจุบัน หรือ วันที่ 1–7 ของเดือนถัดไป) จะไม่ถูกล็อก
   - เพิ่ม `isShiftEditable(shift, today)` และ `isShiftDeletable(shift, today)`
2. **`lib/storage.ts`**:
   - อัปเดต `canEditShift` ให้ใช้ `isShiftEditable`
   - เพิ่ม `canDeleteShift` โดยใช้ `isShiftDeletable` (เวร `swapped_out`/`sold_out` ห้ามลบ ต้องใช้ Undo)
   - ปรับ `saveShift` ส่งฟิลด์ `date` ไปยัง `updateShiftAction` และตรวจความถูกต้องหากมีการย้ายวันที่ไปยังอดีต
   - ปรับ `deleteShift` รองรับการลบเวรใน Grace Period
3. **`app/actions/shiftActions.ts`**:
   - `updateShiftAction`: ปลดล็อกเวรใน Grace Period, เพิ่มพารามิเตอร์ `date?: string` และตรวจไม่ให้ย้ายไปยังวันที่นอก Grace Period
   - `deleteShiftAction`: ปลดล็อกเวรใน Grace Period
4. **`ModalEditShift.tsx` & UI Components**:
   - แสดง Retroactive Warning Alert Banner เมื่อแก้ไขเวรย้อนหลัง
   - เพิ่ม `min={getEarliestGracePeriodDate()}` บน Date Picker
   - อัปเดตปุ่มลบเวรใน `ActivityCard.tsx` ให้เชื่อมโยงกับ `canDeleteShift`
5. **Unit Tests**:
   - เพิ่มการทดสอบครอบคลุมใน `lib/__tests__/shiftRetroactive.test.ts` และอัปเดต `lib/__tests__/referRetroactive.test.ts`

### Acceptance criteria
- [x] เวรปกติ (เช้า, บ่าย, ดึก ทั้งหมวดดำและแดง) ในเดือนปัจจุบัน สามารถกดแก้ไขและบันทึกย้อนหลังได้สำเร็จ
- [x] เวรปกติในเดือนก่อนหน้า สามารถแก้ไขและลบได้หากวันปัจจุบันอยู่ในวันที่ 1–7 ของเดือน
- [x] เวรที่อยู่นอก Grace Period (เช่น 2 เดือนก่อน หรือเดือนก่อนหน้าหลังจากวันที่ 7) จะถูกล็อกถาวร ไม่สามารถแก้ไขหรือลบได้
- [x] `ModalEditShift` แสดงแถบเตือนสีส้มเมื่อแก้ไขเวรย้อนหลัง และจำกัด `min` วันที่ไม่ให้เลือกเกิน Grace Period
- [x] เวรที่ถูกแลกออกไป (`swapped_out`) หรือขายออกไป (`sold_out`) ยังคงถูกห้ามลบโดยตรง (ต้องใช้ Undo)
- [x] Unit tests ทั้งหมดผ่าน 100%

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
