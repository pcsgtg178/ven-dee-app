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
- [ ] **8.1 Medication Quantity in Service Events (Requirement)**
  - Add per-medication `quantity` input (+ snapshot `unit`) to service create/edit forms (`ActivityCard`/service modals).
  - Auto-calculate `medicationCostSatang = Σ round(quantity × price)` with live preview; update `serviceActions.ts`, `lib/storage.ts`, `lib/conflictEngine.ts` and Supabase migration (e.g. `service_medications` or JSONB column).
  - Dashboard cost/breakdown must use new usage data. See `DOMAIN_RULES.md` §3.1.
- [ ] **8.2 Settings Menu (Requirement)**
  - Create `app/settings/page.tsx` and navigation entry.
  - Move Sync Data button + sync status into Settings; move theme toggle into Settings (Light/Dark/System, persisted).
  - Remove them from existing header/home. See `PROJECT_RULES.md` §3.
- [ ] **8.3 Medication Category Type (Requirement)**
  - Add `category` (`botox`, `meso`, `vitamin`, `meso_fat`, `filler`, `other`) to `types/vendee.ts`, migration (default `other`, Botox seed → `botox`), `medicationActions.ts`, `storage.ts`.
  - Category selector/filter/badge in `/medications` and `ModalMedicationManager`. See `DOMAIN_RULES.md` §3.4.
- [ ] **8.4 Fix: Monthly Black Shift Count Incorrect (Issue)**
  - Reproduce and fix calculation: count only `category === "black"` && `status === "active"` within the selected month; exclude swapped_out/sold_out/cancelled/duplicates; include received swaps.
  - Extract single shared pure function; add unit tests (month boundaries, swaps, duplicates). See `DOMAIN_RULES.md` §1.
- [ ] **8.5 Fix: Event Items Sorted by Created Time Instead of Event Time (Issue)**
  - Create `lib/sortEvents.ts`; sort by `startTime` ascending (all-day first, `createdAt` only as tie-breaker); apply in `ScheduleTodoListView.tsx`, `ActivityCard` lists and day views. See `DOMAIN_RULES.md` §3.5.
- [ ] **8.6 Clarify Incomplete Issue Item**
  - Reported issue line "please" was incomplete — confirm details with user.

---

## 📌 Task Status Summary
- **Total Tasks**: 27
- **Completed**: 19
- **In Progress**: 0
- **Pending**: 8

