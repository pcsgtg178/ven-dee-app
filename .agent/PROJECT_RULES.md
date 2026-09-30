# Project Tech Stack & Architect Rules

## 1. Core Stack
- Framework: Next.js (use App Router only - do NOT use Pages router or getStaticProps)
- Language: TypeScript
- Styling: Tailwind CSS
- State Management: React Server Components (RSC) by default, use `'use client'` only when state/effects are required.