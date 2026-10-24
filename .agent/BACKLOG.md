# VenDee (เวรดี) - Work Backlog & Roadmap

## 🚀 Active Feature & Architecture Backlog

### Phase 1: Fullstack Infrastructure & Supabase Setup
- [x] **1.1 Install & Configure Supabase SDK**
  - Install `@supabase/supabase-js` and `@supabase/ssr` packages.
  - Create Supabase client helper utilities in `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `lib/supabase/middleware.ts`.
  - Configure environment variables in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- [x] **1.2 Database Schema Design & Migration Scripts**
  - Design Supabase PostgreSQL migration script in `supabase/migrations/20261006_init.sql`:
    - `nurses` / `users` (Nurse profiles, quotas)
    - `shifts` (Shift schedule, type, category, status, locked state, owner)
    - `shift_swaps` / `swap_trails` (Swap history, parentShiftId, trail nodes)
    - `customer_services` (Private homecare service bookings, Satang financial ledger fields)
    - `personal_events` (Personal errands, weddings, birthdays, relationship tags, time range)
    - `todos` (Todo tasks, notes, price, extra fields)
  - Define Row Level Security (RLS) policies and database indexes for fast query performance.

### Phase 2: Data Access Layer & Server Actions Migration (Replacing Express JS)
- [x] **2.1 Replace External Express API Calls with Next.js Server Actions**
  - Create Next.js Server Actions under `app/actions/`:
    - `shiftActions.ts`: Fetch shifts, create shift, swap shift, rollback swap, delete shift.
    - `serviceActions.ts`: Fetch service records, create service, update service with Satang financial calculations.
    - `personalEventActions.ts`: Fetch personal events, create personal event with overlap check, delete personal event.
    - `todoActions.ts`: Fetch todos, create todo, toggle todo, delete todo.
  - Remove all external Express.js endpoint dependencies and legacy fetch calls.
- [x] **2.2 Domain Business Rules & Conflict Detection Integration**
  - Create `lib/conflictEngine.ts` to enforce invariant checks before saving to Supabase:
    - `FORBIDDEN_NIGHT_MORNING_SAME_DAY` validation.
    - Time boundary standard $[start, end)$.
    - Hospital Shift blocking window vs Customer Service records.
    - `PERSONAL_EVENT_OVERLAP_WARNING` non-blocking alert.
    - Satang financial ledger calculations (`calculateNetProfitSatang`, `calculateEffectiveHourlyRateSatang`).
  - Enforce standard JSON envelope responses with domain error codes.

### Phase 3: PWA & Vercel Deployment Integration
- [ ] **3.1 PWA Fullstack Offline & Sync Strategy**
  - Configure Web App Manifest (`public/manifest.json`) and Service Worker / PWA plugins for PWA installation.
  - Implement client-side cache & offline fallback for schedule views with Supabase sync upon reconnection.
- [ ] **3.2 Vercel Deployment & Environment Setup**
  - Connect project repository to Vercel.
  - Set up Supabase environment variables on Vercel dashboard.
  - Test production build (`npm run build`) and serverless function response times.

### Phase 4: UI Refactoring & Form Reset Policies Verification
- [x] **4.1 Form State Clean-up Enforcement**
  - Create `ModalAddPersonalEvent.tsx` and audit all modal forms to ensure input fields default to blank state upon opening and reset immediately post-submission.
- [x] **4.2 UI Verification & Visual Polish**
  - Verify shift category badges (Black, Red, Green, Gray, Purple, Rose/Personal Events) and Event Calendar integration (`@fullcalendar/react`).
  - Validate dark mode support and micro-interactions.

### Phase 5: iPhone / Apple Calendar Export & Synchronization
- [x] **5.1 RFC 5545 iCalendar Generation Engine (`lib/calendar/icsGenerator.ts`)**
  - Implement pure TypeScript RFC 5545 generator supporting shifts, services, clinic records, and personal events.
  - Enforce CRLF (`\r\n`), line folding (75 octets limit), special char escaping, and `Asia/Bangkok` VTIMEZONE.
  - Implement deterministic UIDs (`vendee-{type}-{id}@vendee.app`) and VALARM notification triggers.
- [x] **5.2 Next.js Calendar Route Handlers (`app/api/calendar/`)**
  - `app/api/calendar/export/route.ts`: On-demand `.ics` file generation and download with date range & filter support.
  - `app/api/calendar/feed/route.ts`: Live WebCal subscription endpoint with token authentication (`webcal://` and `https://`).
- [x] **5.3 iOS Calendar UX & Export Modal (`ModalExportCalendar.tsx`)**
  - Create export modal with choices: (1) One-tap direct `.ics` download for current month, (2) One-tap subscribe via `webcal://` scheme or copy feed link.
  - Filter toggles: รวมเวรออฟ (Off days), รวมงานเคหะบริบาล, รวมธุระส่วนตัว.
  - Step-by-step guidance card for adding Subscribed Calendar in iPhone Settings.
- [x] **5.4 WebCal Feed Token Management & Security**
  - Store and generate cryptographically secure feed token per user.
  - Add option to regenerate token if the subscription link is compromised.

### Phase 6: Refer Shift Selling & Financial Compensation System
> *หมายเหตุ: การขายเวรใน Phase 6 ได้รับการปรับปรุงใน Phase 11 เป็นระบบ "ยกเวรให้คนอื่นแทน" (One-Way Shift Transfer) สำหรับ Refer และ OT โดยตัดการระบุราคาและการคำนวณทางการเงินออกตามความต้องการของผู้ใช้*
- [x] **6.1 Server Actions & Data Layer for Refer Shift Selling**
  - Implement `sellShiftAction` and `undoSellShiftAction` in `app/actions/shiftActions.ts` with domain validation (only active & unlocked shifts, atomic update to `status: "sold_out"`, `SaleMetadata` persistence).
  - Update `lib/storage.ts` with `sellShift` and `undoSellShift` client methods and local state synchronization.
- [x] **6.2 Refer Shift Selling UI (`ModalSellShift.tsx`)**
  - Create `ModalSellShift.tsx` modal supporting buyer name, sale price (Satang standard), payment status, and notes.
  - Enforce empty default form state and post-submission reset per `PROJECT_RULES.md`.
  - Add 'ขายเวร Refer' action button on Refer shift items in `ScheduleTodoListView.tsx` and `ActivityCard.tsx`.
- [x] **6.3 Financial Ledger Aggregation for Shift Sales**
  - Integrate paid shift sales (`paymentStatus === "paid"`) into monthly earnings calculation and summary widgets.

### Phase 7: iPhone 15 Calendar Polish, Customer Revenue Dashboard & Navigation Refactoring
- [x] **7.1 Calendar Swapped Partner Display & Cell Overflow Optimization (iPhone 15)**
  - Map `swappedWith` from `shift.swapMeta` into `ShiftDetail` and pass through to calendar event renderer.
  - Implement vertical stacking and responsive font scaling for days with 2+ swapped shifts (e.g. Morning from P'Se and Afternoon from Dream) to eliminate horizontal cell overflow on ~50px mobile columns.
- [x] **7.2 Customer Service Event Calendar Visibility & Theming**
  - Fix FullCalendar service event rendering with explicit vibrant Sky Blue badge (`bg-sky-600`), syringe icon (`💉`), customer name, and time.
  - Reset `.fc-daygrid-event` container styling to `transparent` background with zero padding to prevent clipping.
  - Populate starter customer services in `initialServices` to guarantee immediate test visibility.
- [x] **7.3 Customer Revenue & Product Financial Dashboard (`/dashboard`)**
  - Implement full-featured Dashboard page with Monthly, Weekly, and Daily period toggles and Thai date navigation.
  - Calculate key financial KPIs: Total Revenue, Total Medication & Service Cost, Net Profit, and Profit Margin %.
  - Add Product / Medication breakdown listing usage counts, unit costs, total costs, and popularity percentage bars.
  - Display detailed case-by-case financial transactions for the active period.
- [x] **7.4 Bottom Navigation 5-Tab Bar & Dedicated Medications Page**
  - Update `BottomNav.tsx` to 5-tab balanced layout: หน้าหลัก (`/`), แดชบอร์ด (`/dashboard`), บันทึกงาน (Center FAB), ตัวยา (`/medications`), ลูกค้า (`/customers`).
  - Upgrade `app/medications/page.tsx` into a dedicated high-aesthetic Medication & Medical Supplies management page with search, add, edit, and delete.
- [x] **7.5 Customer Cascade Deletion & Service History Purge**
  - Implement `deleteCustomer` in `lib/storage.ts` with cascade deletion of all associated customer service records and appointments (`customerId`).
  - Add `deleteServicesByCustomerIdAction` in `app/actions/serviceActions.ts` for database cleanup.
  - Create confirmation modal `ModalDeleteCustomer.tsx` displaying breakdown of upcoming and completed records to be deleted.
  - Add delete buttons on Customer Card (`/customers`), Customer Detail Page (`/customers/[id]`), Edit Modal (`ModalEditCustomer`), and Edit Page (`/customers/[id]/edit`).
- [x] **7.6 Medications Master Schema & Fullstack Data Persistence**
  - Define `public.medications` table schema in `supabase/migrations/20261011_medications.sql` and `20261006_init.sql` with 5 required fields: ชื่อ (`name`), ขนาด (`size`), หน่วย (`unit`), ราคา (`price`, `price_satang`), รายละเอียด (`description`).
  - Seed initial Botox records: `Botox, 100, ยูนิต, 2500, นาบูตะ *นำเข้า` and `Botox, 50, ยูนิต, 1500, นาบูตะ *นำเข้า`.
  - Implement Next.js Server Actions in `app/actions/medicationActions.ts` and client synchronization in `lib/storage.ts`.
  - Complete UI integration with form inputs, badges, and preset units in `app/medications/page.tsx` and `app/components/ModalMedicationManager.tsx`.

### Phase 8: Medication Usage, Settings Menu & Data Correctness Fixes
- [x] **8.1 Medication Quantity in Service Events (Requirement)**
  - Add per-medication `quantity` input (+ snapshot `unit`) to service create/edit forms (`ActivityCard`, `ModalAddTodo`, `ModalEditService` via `MedicationUsageEditor.tsx`).
  - Auto-calculate `medicationCostSatang = Σ round(quantity × price)` with live preview in `MedicationUsageEditor` and `lib/conflictEngine.ts`; persisted via `serviceActions.ts`, `lib/storage.ts`, and migration `20261018_phase8_medication_usage.sql` (`medication_usages JSONB`).
  - Updated `/dashboard` cost calculation and Product Breakdown to aggregate actual usage quantities, units, costs, and category badges. See `DOMAIN_RULES.md` §3.1.
- [x] **8.2 Settings Menu (Requirement)**
  - Created `app/settings/page.tsx` with dedicated Settings navigation entry.
  - Integrated Light / Dark / System theme selector (persisted in `vendee_theme`, syncs with device OS, dispatches `vendee_theme_changed`).
  - Moved Sync Data button with real-time online/offline connectivity badge, last sync timestamp, stored data counters (Shifts, Services, Customers, Medications, Clinic Logs, Personal Events), and force re-sync into Settings.
  - Replaced theme toggle from header in `ScheduleOverview.tsx` with Settings link per `PROJECT_RULES.md` §3.
- [x] **8.3 Medication Category Type (Requirement)**
  - Added `category` (`botox`, `meso`, `vitamin`, `meso_fat`, `filler`, `other`) to `types/vendee.ts`, migration `20261018_phase8_medication_usage.sql` (default `other`, Botox seed → `botox`), `medicationActions.ts`, `storage.ts`.
  - Category selector/filter/badges integrated in `/medications`, `ModalMedicationManager`, and `/dashboard` breakdown. See `DOMAIN_RULES.md` §3.4.
- [x] **8.4 Fix: Monthly Black Shift Count Incorrect (Issue)**
  - Calculation in single shared pure function `countMonthlyShifts` in `lib/quota.ts`: counts only `category === "black"` && `status === "active"` within the selected month; excludes swapped_out, sold_out, cancelled, and duplicates; includes received swaps.
  - Reused consistently via `getMonthlyBlackShiftStats` in `ScheduleOverview.tsx` and `MonthlyQuotaWidget.tsx`.
  - Covered by 5 unit tests in `lib/__tests__/quota.test.ts`. See `DOMAIN_RULES.md` §1.
- [x] **8.5 Fix: Event Items Sorted by Created Time Instead of Event Time (Issue)**
  - Created `lib/sortEvents.ts`; sorts by `startTime` ascending (all-day first, `createdAt` only as tie-breaker); applied in `ScheduleTodoListView.tsx`, `ActivityCard` lists and day views.
  - Covered by 5 unit tests in `lib/__tests__/sortEvents.test.ts`. See `DOMAIN_RULES.md` §3.5.
- [x] **8.6 Clarify Incomplete Issue Item**
  - Clarified with user prompt; completed Phase 8 requirements, audited existing code, eliminated duplicates, and implemented missing new details.

### Phase 9: User-Reported Issues — Data Persistence & Swap Undo (details: `BACKLOG_ISSUE.md`)
- [x] **9.1 ISSUE-1 (High): Clinic Work Logs Not Persisted to DB**
  - Root cause: `ClinicWorkRecord` lives only in `localStorage` (`vendee_clinic_logs_v1`); no table, no server action, not in `syncAllDataFromApi()`; ICS feed/export uses empty `initialClinicLogs`.
  - Add migration `clinic_work_logs` (+RLS/index), create `app/actions/clinicActions.ts` (get/create/update/delete), make `saveClinicLog`/`deleteClinicLog` async server-first, include in sync, auto-migrate old localStorage logs (`clinic-*` ids) to DB, make `calendar/feed` & `calendar/export` read from DB, `await` all call-sites.
- [x] **9.2 ISSUE-2 Hotfix (High): Swap Undo Leaves Stale/Corrupt Data (small, pre-migration)**
  - Delete (not `cancelled`) the received shift on undo; clear `swapped_with`/`swap_date`/`swap_reason` when restoring parent; replace `.single()` child lookup; check `error` on every query in swap/undo/delete; clear `swapMeta` in client `undoSwapShift`.
- [x] **9.3 Server-First Pattern & `unwrap()` Helper (Cross-cutting)**
  - Stop "update localStorage first / swallow DB failure". Add `unwrap(actionResult)` that throws on `success === false`; apply to `swapShift`, `undoSwapShift`, `restoreShift`, `sellShift`, `undoSellShift`, `saveShift`; surface errors in UI.
- [x] **9.4 Fix Hardcoded Date in `isShiftInPast` / `isDateInPast`**
  - Remove hardcoded `"2026-09-19"`; use real `new Date()` in Asia/Bangkok; enforce lock rule (`is_locked`, past shifts) on both client and server.
- [x] **9.5 Data Repair Script for Corrupted Swap Data**
  - Detect orphans (`cancelled` children with `parent_shift_id`, `swapped_out` without active child, e.g. 3 Nov 2026 case); backup first, user confirms rows before running; delete cancelled children, restore parent to `active` and clear swap fields.

### Phase 10: Migrate Shift Swap Data to `shift_swaps` (details: `BACKLOG_MIGRATE.md`)
- [x] **10.1 Backup & Pre-check**
  - Created pre-check diagnostic migration script `supabase/migrations/20261024_precheck_swaps.sql` covering queries 4.0(a), (b), (c) to identify orphan swapped_out shifts, cancelled child shifts, and multi-child parent shifts.
- [x] **10.2 Migration A: Schema & RPC**
  - Created dedicated `public.shift_swaps` table with RLS and foreign key constraints, added `shifts.swap_id` (set strictly on given/swapped_out shifts), and created atomic transactional PostgreSQL RPCs `perform_shift_swap` and `undo_shift_swap` with downstream chain swap guard (`DOWNSTREAM_SWAP_ACTIVE`) in `supabase/migrations/20261024_shift_swaps.sql`.
- [x] **10.3 Migration B: Backfill & Verify**
  - Backfilled existing `parent_shift_id` pairs into `shift_swaps`, populated `swap_id` on given shifts, cleaned orphan cancelled children, and added verification queries in `supabase/migrations/20261024_shift_swaps.sql`.
- [x] **10.4 Code Changes**
  - Updated `types/vendee.ts` (`ShiftSwapRecord`, `swapId`, backwards-compatible `swapMeta`), `app/actions/shiftActions.ts` (RPC integration with fallback, join `shift_swaps`), `lib/storage.ts` (bumped `STORAGE_KEYS.SHIFTS` to v3 with `upgradeShiftsToV3`), `lib/calendar/icsGenerator.ts`, `ModalSwapTrail.tsx`, `ActivityCard.tsx`, `ModalEditShift.tsx`, `ScheduleOverview.tsx`, and documentation (`docs/SYSTEM_DESIGN.md`, `docs/API_REQUIREMENTS.md`, `.agent/DOMAIN_RULES.md` §2.3).
- [x] **10.5 Tests**
  - Created comprehensive unit/integration test suite in `lib/__tests__/shiftSwaps.test.ts` covering: direct swap creation with `swapId`, bidirectional undo (from given & received sides), chain swap creation, chain swap safety guard blocking premature undo (`DOWNSTREAM_SWAP_ACTIVE`), sequential undo, and localStorage v2→v3 migration. All 24 test runner unit tests pass.
- [x] **10.6 Manual Verification**
  - Verified swap lifecycle, 2-level chain swapping, downstream block guard, and Next.js production build (`npm run build` succeeds with 13/13 static pages generated).
- [x] **10.7 Deploy & Migration C: Drop Legacy Columns**
  - Prepared standalone post-deploy cleanup migration `supabase/migrations/20261024_drop_legacy_swap_columns.sql` to drop legacy swap columns (`swapped_with`, `original_owner`, `parent_shift_id`, `swap_date`, `swap_reason`, `swap_history`) once deployed and verified.

> Suggested order: 9.1 → 9.2 → 10.x (supersedes 9.2 hotfix at root cause) → 9.5 → 9.4. Phase 9.3 applies throughout.

### Phase 11: One-Way Shift Transfer (ยกเวรให้คนอื่น Refer & OT), บันทึกรับเวร OT & UI Text Declutter
- [x] **11.1 One-Way Shift Transfer ("ยกให้คนอื่นแทน" สำหรับเวร Refer และ OT)**
  - **Context & Requirement**: ปรับเปลี่ยน logic การขายเวร Refer และ OT เดิมไปเป็นการ "ยกให้คนอื่นแทน" (One-Way Shift Transfer) เนื่องจากผู้ใช้ไม่ต้องการระบุยอดเงินเพื่อนำมาคำนวณรายได้ใดๆ เพียงต้องการนำเวรออกจากตารางเวรตนเองโดยยกให้ผู้อื่นแบบไม่ใช่การแลกเวร (Non-reciprocal / No swap)
  - **Remove Financial Calculations**: ตัดการกรอกราคาขาย (Satang Standard), สถานะการชำระเงิน (ค้างชำระ/ชำระแล้ว) และการนำยอดขายเวรไปรวมใน Financial Ledger / แดชบอร์ดรายรับออกทั้งหมด
  - **Shift Eligibility**: เฉพาะเวร Refer (R1, R2, หมวดสีเขียว) และเวร OT (หมวดสีแดง) ที่มีสถานะ `active` และไม่อยู่ในอดีต/ไม่ได้ล็อค (เวรดำไม่อนุญาตให้ยกแบบทางเดียว ต้องใช้การแลกเวรเพื่อรักษายอด 14 เวร)
  - **UI & Modal Refactoring (`ModalTransferShift.tsx` / `ActivityCard` / `ScheduleTodoListView`)**:
    - ปรับปรุง/เปลี่ยนชื่อ `ModalSellShift.tsx` เป็น `ModalTransferShift.tsx` (หัวข้อ modal: "ยกเวรให้คนอื่น" / "ยกเวร Refer" / "ยกเวร OT")
    - ปรับปุ่ม Action บนการ์ดเวรจาก "ขายเวร" เป็น "ยกให้คนอื่น"
    - ฟอร์มคงเหลือเฉพาะข้อมูลที่จำเป็น:
      1. ชื่อผู้รับเวร (`recipientName`) [Required]
      2. วันที่ยกเวร (`transferredDate` - ค่าเริ่มต้นเป็นวันปัจจุบัน) [Required]
      3. หมายเหตุเพิ่มเติม (`note`) [Optional]
    - สถานะเวร: ปรับเป็น `transferred` (หรือ mapping เข้ากับสถานะยกเวร) เพื่อถอดเวรออกจากตารางเวรที่ต้องปฏิบัติหน้าที่
    - ป้ายสถานะบนการ์ดเวร: แสดง "ยกให้: [ชื่อผู้รับ]"
    - รองรับการยกเลิกการยกเวร (Undo Transfer): ดึงเวรกลับมาเป็น `active` ได้หากมีการเปลี่ยนใจ
  - **Data Layer & Server Actions**:
    - ปรับปรุง Server Action และ Storage API (`transferShiftAction`, `undoTransferShiftAction`, `transferShift`, `undoTransferShift`) ให้บันทึกข้อมูล `transferMeta` แทน `saleMeta` โดยไม่ต้องบันทึก Satang

- [x] **11.2 Record Received OT Shift ("บันทึกการขึ้นเวร เฉพาะ OT - ระบุว่ารับเวรมาจากใคร")**
  - **Context & Requirement**: เพิ่มเติมการบันทึกการขึ้นเวร เฉพาะหมวดเวร OT (เวรแดง) ให้สามารถบันทึกได้ว่า "รับเวรมาจากใคร" เพื่อรองรับ Use Case ที่ผู้ใช้รับเวร OT มาจากเพื่อนร่วมงานคนอื่นแบบไม่ได้แลกมา (One-Way OT Intake)
  - **Form Input Integration (`ModalAddTodo.tsx` & `ModalEditShift.tsx`)**:
    - ในหน้าต่างบันทึกเวร (`ModalAddTodo`) และแก้ไขเวร (`ModalEditShift`) เมื่อผู้ใช้เลือกประเภทเวรและเลือกหมวดเวรเป็น "เวรแดง (OT)" (`category === "red"`):
      - แสดงช่องกรอกข้อมูล: "รับเวรมาจากใคร (ถ้ามี)" (เช่น "พี่เปิ้ล", "น้องแนน")
      - ซ่อนช่องกรอกนี้เมื่อเลือกเวรประเภทอื่นที่ไม่ใช่ OT (เช่น เวรดำ, เวร Off, เวร CT)
  - **Data Layer & Schema Support**:
    - เพิ่มฟิลด์ `receivedFrom?: string` ในโครงสร้างข้อมูล `ShiftRecord` / `ShiftDetail` และฐานข้อมูล `shifts` (หรือ `metadata` ของเวร)
    - อัปเดต `saveShiftAction` และ `saveShift` ให้บันทึกและอัปเดตฟิลด์ `receivedFrom` ได้อย่างถูกต้อง
  - **Display & Calendar Visualization**:
    - ใน `ScheduleTodoListView`, `ActivityCard`, และ Event Calendar / Day View:
      - แสดงป้ายกำกับ Badge หรือข้อความบนการ์ดเวร OT ให้ชัดเจน เช่น `OT (รับจาก: พี่เปิ้ล)`
    - ไม่กระทบต่อการนับยอดเวรดำประจำเดือน (คงโควตาเวรดำ 14 เวรตามเดิม)

- [x] **11.3 Remove Non-Essential Text From All Screens (UI Declutter)**
  - Audit every page/modal and remove explanatory/technical text users don't need (e.g. "Standby 24 ชม." notes, "กฎเวร" rule boxes, "Satang Standard" / "= N สตางค์" hints, "บังคับระบุ", "One-Way Transfer" subtitles, developer/domain jargon, redundant helper paragraphs).
  - Keep: field labels, required `*` markers, validation/error messages, and key action buttons.
  - Scope: `ModalTransferShift` (formerly `ModalSellShift`), `ModalShiftSwap`, `ModalEditShift`, `ModalAddTodo`, `ModalAddPersonalEvent`, `ModalEditService`, `ModalEditClinicLog`, `ModalExportCalendar`, `ModalMedicationManager`, `ModalDeleteCustomer`, `MonthlyQuotaWidget`, `ScheduleOverview`, `/dashboard`, `/medications`, `/customers`.
  - Produce a list of removed texts per screen for review before/after the change.

---

## 📌 Task Status Summary
- **Total Tasks**: 42
- **Completed**: 40
- **In Progress**: 0
- **Pending**: 2

