# Project Tech Stack & Architecture Rules

## 1. Core Stack & Framework Rules
- **Architecture**: Next.js Fullstack PWA (Single repository containing UI, Server Actions / Route Handlers, and Database integration — NO external Express.js API backend required).
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
  - When creating/adding a new Todo or record (e.g., `ModalAddTodo`), all input fields (notes, price, extra fields, medications) MUST default to empty/blank values.
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
- **Error Codes**: Use standard domain error codes (`DUPLICATE_SHIFT`, `CONFLICT_WITH_SHIFT`, `CONFLICT_WITH_SERVICE`, `SHIFT_IS_LOCKED`, `QUOTA_DEFICIT_WARNING`, `DATABASE_ERROR`).
- **Data Mutability & Deletion Safety**:
  - Shift swap transactions and service creation must validate concurrency and business invariants before persisting to Supabase.
  - Transactions modifying shift ownership must update `status`, `swapMeta`, and append `SwapTrailNode` entries atomically using Supabase transactions or RPC / stored procedure if necessary.
  - Deletion of shifts involved in swap chains (`status: "swapped_out"`, `parentShiftId` references) or locked shifts (`isLocked: true`) must be rejected to prevent broken parent references (`PARENT_SHIFT_NOT_FOUND`).
  - Rollback (Undo Swap) operations must execute atomically on both sides: restoring the original parent shift (`parentShiftId`) to `active` while cancelling/reverting the shift received during that swap (`status: "cancelled"`).
  - Same-day same-shift-type swaps are permitted ONLY when converting between Black (`black`) and Red (`red`) categories (e.g., Morning Black ↔ Morning Red). Swapping into the exact same category on the same date must be rejected (`DUPLICATE_SHIFT`).