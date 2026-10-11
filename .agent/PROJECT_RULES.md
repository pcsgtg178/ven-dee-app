# Project Tech Stack & Architecture Rules

## 1. Core Stack & Framework Rules
- **Architecture**: Next.js Fullstack PWA — **Single-User Personal Companion App** (ออกแบบสำหรับพยาบาลใช้งานคนเดียว ไม่ต้องมี Multi-tenant / Multi-user login isolation, จัดเก็บข้อมูลตารางเวร, งานเคหะบริบาล, ธุระส่วนตัว และ Todo ภายใต้ชุดข้อมูลส่วนตัวเดี่ยว).
- **Framework**: Next.js 15+ (App Router only — do NOT use Pages router or legacy data fetching like `getStaticProps` / `getServerSideProps`).
- **Database & Backend**: **Supabase** (PostgreSQL) connected directly via Next.js Server Actions & API Route Handlers, hosted on Supabase and deployed on **Vercel**.
  - Client SDK: `@supabase/supabase-js` and `@supabase/ssr`.
  - Environment Variables configured in `.env.local` and Vercel Environment Variables:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY` (Server-side / Admin operations only).
- **Language**: TypeScript (`strict: true`). All domain data structures must adhere to definitions in `@/types/vendee.ts`.
- **Styling**: Tailwind CSS with custom theme colors (`shift-black`, `shift-red`, `shift-red-badge`, `shift-red-text`). Support Tailwind dark mode classes (`dark:`).
- **State Management**:
  - React Server Components (RSC) by default for data fetching and SSR.
  - Add `'use client'` directive strictly on interactive components requiring local React state (`useState`, `useReducer`), browser APIs, PWA hooks, or client side-effects (`useEffect`).
  - Keep client state localized (do NOT introduce Redux or Zustand without explicit architectural approval).

## 2. Directory Structure & Naming Conventions
```
ven-dee-app/
├── .agent/                # Domain & Project Agent Rules (PROJECT_RULES.md, DOMAIN_RULES.md, BACKLOG.md)
├── app/                   # App Router pages, Server Actions, and API Route Handlers
│   ├── actions/           # Next.js Server Actions for fullstack data operations
│   ├── api/               # Server API route handlers (/api/v1/...) if needed for external webhooks/PWA sync
│   └── (routes)/          # Feature pages (kebab-case URLs)
├── components/            # Reusable UI components (PascalCase filenames)
├── docs/                  # System Design & API Requirements Documentation
├── hooks/                 # Custom React Hooks (camelCase starting with `use`)
├── lib/                   # Utilities, conflict detection logic, formatters (camelCase)
│   └── supabase/          # Supabase client helpers (client.ts, server.ts, middleware.ts)
└── types/                 # TypeScript interfaces & domain types (vendee.ts, supabase.ts)
```

## 3. Component & Code Standards
- **Component File Naming**: PascalCase (e.g., `ShiftCard.tsx`, `SwapTrailModal.tsx`).
- **Exports**: Default export for page/layout components; named exports for reusable UI primitives.
- **Props Interfaces**: Explicitly define component props interfaces using TypeScript (`interface ShiftCardProps`).
- **Icons & Visual Indicators**: Standardize shift badge colors and icons via `SHIFT_CONFIG` and `SHIFT_CATEGORY_CONFIG` in `types/vendee.ts`.
- **Form State Reset Policy (Creation Forms)**:
  - When creating/adding a new Todo or record (e.g., `ModalAddTodo`, `ModalSellShift`), all input fields (notes, price, extra fields, medications, buyer name, sale price) MUST default to empty/blank values.
  - Form state MUST NOT retain inputs from previously submitted forms. All fields must be explicitly cleared/reset when opening the form and immediately after successful form submission.

## 4. API, Data Layer & Supabase Integration Standards
- **Direct Database Operations**: All data persistence (saving, updating, deleting shifts, swaps, service records) must be executed inside Next.js Server Actions or Route Handlers using the server-side Supabase client (`lib/supabase/server.ts`). External HTTP calls to an Express.js server are strictly removed.
- **Response Format**: Follow standard JSON Envelope / Action Result format:
  ```json
  { "success": true, "data": { ... }, "message": "..." }
  ```
  ```json
  { "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": [] } }
  ```
- **Error Codes**: Use standard domain error codes (`DUPLICATE_SHIFT`, `CONFLICT_WITH_SHIFT`, `CONFLICT_WITH_SERVICE`, `SHIFT_IS_LOCKED`, `QUOTA_DEFICIT_WARNING`, `SHIFT_ALREADY_SOLD`, `CANNOT_SELL_LOCKED_SHIFT`, `INVALID_SALE_OPERATION`, `DATABASE_ERROR`).
- **Data Mutability & Deletion Safety**:
  - Shift swap & shift sale transactions and service creation must validate concurrency and business invariants before persisting to Supabase.
  - Transactions modifying shift ownership (Swap or Sale) must update `status`, `swapMeta` or `saleMeta`, and append audit trails atomically using Supabase transactions or Server Actions.
  - **Refer Shift Selling Standards**:
    - Selling Refer shifts (`r1`, `r2`) operates as a one-way transfer (`status: "sold_out"`).
    - Must record `saleMeta` containing `buyerName`, `salePriceSatang` (Satang Standard: Integer, 1 THB = 100 Satang), `soldDate`, `paymentStatus` (`unpaid` / `paid`), and optional `note`.
    - Does NOT impact mandatory monthly black shift quota (`DEFAULT_BLACK_SHIFT_QUOTA = 14`).
    - Once sold, seller is freed from 24-hr Standby constraint on that date.
  - Deletion of shifts involved in swap chains (`status: "swapped_out"`, `parentShiftId` references), sold shifts (`status: "sold_out"`), or locked shifts (`isLocked: true`) must be rejected to prevent data corruption and loss of financial audit trails.
  - Rollback (Undo Swap) operations must execute atomically on both sides: restoring the original parent shift (`parentShiftId`) to `active` while cancelling/reverting the shift received during that swap (`status: "cancelled"`).
  - Rollback (Undo Sale) operations for sold Refer shifts must restore the shift to `active`, purge `saleMeta`, and update financial summaries, permitted only if `shiftDate >= CURRENT_DATE` and `isLocked: false`.
  - Same-day same-shift-type swaps are permitted ONLY when converting between Black (`black`) and Red (`red`) categories (e.g., Morning Black ↔ Morning Red). Swapping into the exact same category on the same date must be rejected (`DUPLICATE_SHIFT`).

## 5. iPhone / Apple Calendar Export & Protocol Standards

### 5.1 iCalendar (RFC 5545) Specification Standards
- **MIME Types & HTTP Header Policies**:
  - Direct File Download: `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="vendee-{month}.ics"`
  - Live WebCal Feed: `Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: inline; filename="vendee-feed.ics"`, `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`
- **RFC 5545 Formatting Rules**:
  - Line terminators MUST be CRLF (`\r\n`). Bare LF (`\n`) is strictly prohibited.
  - Line folding: Lines exceeding 75 octets MUST be folded with `\r\n ` (CRLF followed by a whitespace).
  - Escaping: Text values (`SUMMARY`, `DESCRIPTION`, `LOCATION`) must escape backslashes (`\\`), semicolons (`\;`), commas (`\,`), and newlines (`\n`).
  - Embed standard `VTIMEZONE` block for `Asia/Bangkok` (Standard Time +0700, no DST) in calendar streams.

### 5.2 Next.js App Router Architecture for Calendar Integration
- **Route Handlers**:
  - `app/api/calendar/export/route.ts`: On-demand `.ics` file generation and download with query params (`month`, `startDate`, `endDate`, `includeOff`, `categories`).
  - `app/api/calendar/feed/route.ts`: Continuous WebCal subscription endpoint supporting `https://` and `webcal://` URL schemes for iOS Calendar.
- **Generator Utility**:
  - `lib/calendar/icsGenerator.ts`: Pure TypeScript RFC 5545 generator with zero unvetted external dependencies, preventing bundle bloat and ensuring full control over Apple Calendar compatibility.

### 5.3 Security & Feed Token Management
- **Single-User Security**:
  - WebCal feeds must require a persistent, cryptographically secure feed token (e.g., `/api/calendar/feed?token=<secure_token>`).
  - Unauthorized requests must return HTTP 401 (`UNAUTHORIZED`).
  - Provide UI option to regenerate feed token if the subscription link is compromised.

### 5.4 iOS / Safari UX Integration
- **Direct Download & Native Import**:
  - Tapping export on iOS Safari prompts the native "Add to Calendar" sheet.
- **One-tap WebCal Subscription**:
  - Support `webcal://` link scheme to directly open the iOS "Subscribe to Calendar" sheet.
- **Export UI Component**:
  - `components/ModalExportCalendar.tsx`: Modal providing direct download, WebCal subscription copy, and filter controls (เวร รพ., งานเคหะ, ธุระส่วนตัว, เวรออฟ).