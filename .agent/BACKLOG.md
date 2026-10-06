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

---

## 📌 Task Status Summary
- **Total Tasks**: 8
- **Completed**: 6
- **In Progress**: 0
- **Pending**: 2
