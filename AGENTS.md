<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

---

# VenDee App - Agent Guidelines & Configuration Index

All project rules, coding standards, architecture conventions, nurse domain invariants, and task backlogs for the **VenDee (เวรดี)** application are maintained in the **`.agent/`** directory.

Agents working on this repository MUST reference and adhere to the rules in the following files:

- **[.agent/PROJECT_RULES.md](file:///.agent/PROJECT_RULES.md)**: Tech stack standards (Next.js 15 App Router, TypeScript `strict: true`, Tailwind CSS), directory structure, component standards, form state reset policies, and API standards (JSON envelope, domain error codes, deletion safety & rollback handling).
- **[.agent/DOMAIN_RULES.md](file:///.agent/DOMAIN_RULES.md)**: Nurse domain invariants, shift types, quotas, color codes, conflict detection rules, shift swap rules (top-up swap, same-day category swap), and locking/rollback lifecycle rules.
- **[.agent/BACKLOG.md](file:///.agent/BACKLOG.md)**: Active feature backlog, task tracking, and work roadmap.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
