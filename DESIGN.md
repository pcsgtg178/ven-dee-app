---
name: VenDee Care
description: Mobile-first PWA for nurses to log shifts, swap/sell shifts and manage customer services. Clean, warm, healthcare feel (green + sea blue), Thai-language UI, light + dark themes.
colors:
  # --- Surfaces (light) ---
  app-bg: "#F8FAF6"
  card-bg: "#FFFFFF"
  surface-subtle: "#EEF4EC"
  # --- Brand: Primary (health green / customer service) ---
  primary-light: "#DCFCE7"
  primary: "#16A34A"
  primary-dark: "#14532D"
  # --- Brand: Secondary (sea blue / shifts & medical) ---
  secondary-light: "#E0F2FE"
  secondary: "#0284C7"
  secondary-dark: "#0369A1"
  # --- Text ---
  text-main: "#0F172A"
  text-muted: "#64748B"
  # --- Shift categories ---
  shift-black: "#1E293B"
  shift-black-badge: "#F1F5F9"
  shift-black-text: "#0F172A"
  shift-red: "#EF4444"
  shift-red-badge: "#FEE2E2"
  shift-red-text: "#B91C1C"
  shift-green: "#059669"   # emerald-600 (Refer R1/R2)
  shift-purple: "#9333EA"  # purple-600 (CTM/CTA, clinic)
  shift-gray: "#4B5563"    # gray-600 (Off)
  # --- Semantic / event ---
  personal-event: "#F43F5E" # rose-500
  warning: "#F59E0B"        # amber (swapped out, unpaid)
  success: "#059669"        # emerald (sold, paid)
  danger: "#EF4444"
  # --- Dark theme ---
  dark-background: "#090D16"
  dark-foreground: "#F1F5F9"
  dark-card: "#18181B"      # zinc-900
  dark-border: "#27272A"    # zinc-800
  dark-text-muted: "#A1A1AA" # zinc-400
  # --- Calendar (FullCalendar; always white for badge contrast) ---
  calendar-bg: "#FFFFFF"
  calendar-border: "#E2E8F0"
  calendar-header-text: "#334155"
  calendar-other-month: "#94A3B8"
  calendar-button-bg: "#F1F5F9"
typography:
  font-family:
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif'
  scale:
    micro:    { fontSize: 10px,    fontWeight: 700 }  # status chips
    caption:  { fontSize: 11px,    fontWeight: 600 }  # tags, meta
    small:    { fontSize: 12px,    fontWeight: 500 }  # text-xs
    body:     { fontSize: 14px,    fontWeight: 700 }  # text-sm card titles
    body-lg:  { fontSize: 16px,    fontWeight: 700 }  # text-base; min input size (iOS no-zoom)
    code-pill:{ fontSize: 20px,    fontWeight: 900 }  # shift code (2xl on sm+: 24px)
    calendar-title: { fontSize: 1.05rem, fontWeight: 700, letterSpacing: -0.01em }
    calendar-day:   { fontSize: 0.8rem,  fontWeight: 700 }
    calendar-event: { fontSize: 0.72rem, fontWeight: 700 }
  smoothing: antialiased
rounded:
  xs: 6px     # calendar events
  sm: 8px     # rounded-lg, icon buttons, inline actions
  md: 12px    # rounded-xl, badges, inner info boxes, inputs
  lg: 16px    # rounded-2xl, cards
  full: 9999px # pills, calendar buttons
spacing:
  base: 4px
  "0.5": 2px
  "1": 4px
  "1.5": 6px
  "2": 8px
  "2.5": 10px
  "3": 12px
  "3.5": 14px   # card padding
  "4": 16px
  card-padding: 14px
  stripe-width: 6px      # w-1.5 left color stripe
  tap-target-min: 44px
elevation:
  card: "shadow-xs"
  card-hover: "shadow-md"
  button: "shadow-2xs"
  badge: "shadow-xs"
motion:
  transition-default: "all 150ms ease-in-out"
  press: "active:scale-95"
  sync-beam: "1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite"
layout:
  safe-area: ["pt-safe", "pb-safe", "pl-safe", "pr-safe"]  # env(safe-area-inset-*)
  viewport: "device-width, initial-scale 1, no user scaling, viewport-fit cover"
  theme-color: { light: "#FFFFFF", dark: "#090D16" }
components:
  card:
    backgroundColor: "{colors.card-bg}"
    border: "1px solid {colors.surface-subtle}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
    shadow: "{elevation.card}"
    hoverShadow: "{elevation.card-hover}"
    dark: { backgroundColor: "{colors.dark-card}", border: "1px solid {colors.dark-border}" }
  card-stripe:
    position: "absolute left/top/bottom 0"
    width: "{spacing.stripe-width}"
  shift-code-pill:
    height: 44px
    minWidth: 48px
    rounded: "{rounded.md}"
    textColor: "#FFFFFF"
    typography: "{typography.scale.code-pill}"
  badge:
    rounded: "{rounded.md}"
    padding: "4px 10px"
    typography: "{typography.scale.small}"
  chip:
    rounded: "{rounded.sm}"
    padding: "2px 6px"
    typography: "{typography.scale.micro}"
  icon-button:
    rounded: "{rounded.sm}"
    padding: 6px
    iconSize: 16px
    textColor: "{colors.text-muted}"
    hover: "tinted -50 background + semantic icon color"
    press: "scale 0.95"
  action-button-primary:
    backgroundColor: "{colors.success}"
    hover: "#047857"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  input:
    minHeight: 44px
    fontSize: 16px   # mobile, prevents iOS auto-zoom
  calendar-button:
    rounded: "{rounded.full}"
    padding: "0.3rem 0.65rem"
    backgroundColor: "{colors.calendar-button-bg}"
    activeBackgroundColor: "{colors.secondary}"
---

# VenDee Care — Design System

Source of truth for visual tokens. Extracted from [`app/globals.css`](app/globals.css) (`@theme`), [`tailwind.config.ts`](tailwind.config.ts), [`types/vendee.ts`](types/vendee.ts) and the components in `app/components/`.

## 1. Principles

- **Mobile-first PWA**: touch targets ≥ 44px, safe-area padding, no tap highlight, no 300ms delay (`touch-action: manipulation`), inputs ≥ 16px on mobile.
- **Warm & clean healthcare**: off-white-green canvas, green for *customer service*, sea-blue for *shifts/medical*.
- **Color encodes meaning**: shift category and activity type are always identifiable by a left color stripe + badge color.
- **Calendar is always white**: FullCalendar ignores dark mode to keep shift badges high-contrast.
- **Dark mode** via `.dark` class on `<html>` (`@custom-variant dark`), persisted in `localStorage` key `vendee_theme`, falling back to `prefers-color-scheme`.

## 2. Color

### Core palette (registered in Tailwind `@theme`)

| Token | Light | Use |
|---|---|---|
| `app-bg` | `#F8FAF6` | Page background |
| `card-bg` | `#FFFFFF` | Cards, modals |
| `surface-subtle` | `#EEF4EC` | Card borders, chips, muted fills |
| `primary` / `-light` / `-dark` | `#16A34A` / `#DCFCE7` / `#14532D` | Customer services, positive CTAs |
| `secondary` / `-light` / `-dark` | `#0284C7` / `#E0F2FE` / `#0369A1` | Shifts, links, active states, swap |
| `text-main` | `#0F172A` | Primary text |
| `text-muted` | `#64748B` | Secondary text, icons |

### Shift category tokens

| Category | Stripe | Code pill | Meaning |
|---|---|---|---|
| default / black | `bg-secondary` | `shift-black` `#1E293B` (dark: slate-100 on slate-900) | Regular shifts (morning/afternoon/night) |
| red | `shift-red` `#EF4444` | `shift-red` + white | OT / red shift (badge `#FEE2E2`, text `#B91C1C`) |
| green | `emerald-600` | `emerald-600` + white | Refer R1/R2 (sellable) |
| purple | `purple-600` | `purple-600` + white | CTM / CTA |
| gray | `gray-500/600` | `gray-600` + white | Off |

### Activity-type accents

| Type | Accent | Badge |
|---|---|---|
| Customer service | `primary` | `emerald-100/800` |
| Clinic work | `purple-600` | `purple-100/800` |
| Personal event | `rose-500` | `rose-100/800` |
| Swapped (info box) | `sky-50 / sky-200` | text `sky-900` |
| Sold (info box) | `emerald-50 / emerald-200` | text `emerald-900` |
| Swapped-out warning | `amber-50 / amber-200` | text `amber-900` |

Tag badge pattern (service type, medication category, relationship): `bg-{hue}-100 text-{hue}-800 dark:bg-{hue}-950/60 dark:text-{hue}-300`.
Hues: emerald, amber, sky, purple, violet, rose, pink, indigo, slate.

### Dark theme

| Token | Value |
|---|---|
| Background | `#090D16` |
| Foreground | `#F1F5F9` |
| Card | `zinc-900` `#18181B` |
| Card border | `zinc-800` `#27272A` |
| Muted text | `zinc-400` `#A1A1AA` |
| Strong text | `#FFFFFF` |
| Tinted surfaces | `{hue}-950` at 30–60% opacity |

### Calendar (FullCalendar Monarch, blue palette)

`--fc-monarch-primary: #0284C7` · hover `#0369A1` · down `#075985` · background `#FFFFFF` · border `#E2E8F0` · strong border `#CBD5E1` · muted `#F1F5F9` · highlight `rgba(2,132,199,.08)`.

## 3. Typography

- **Family**: system UI stack (no web font) — good Thai fallback and zero load cost.
- **Weights**: heavy use of 700 (titles, badges), 900 for shift code, 600 for tags, 500 for meta.
- **Scale**: 10 / 11 / 12 / 14 / 16 / 20–24 px (see front matter).
- Line height: `leading-snug` on card titles.

## 4. Shape, spacing, elevation

- **Radius**: cards `16px`, badges/inner boxes/inputs `12px`, icon buttons `8px`, calendar events `6px`, pills `9999px`.
- **Spacing**: Tailwind 4px grid; card padding `14px`; content indented `pl-2` next to the `6px` stripe; gaps mostly `4–12px`.
- **Elevation**: flat by default (`shadow-xs`), `shadow-md` on hover; buttons `shadow-2xs`.

## 5. Motion

- Default transition `all 150ms ease-in-out`.
- Press feedback `active:scale-95` on buttons.
- Sync loading beam: `translateX(-100% → 100%)`, 1.5s, `cubic-bezier(.4,0,.2,1)`, infinite (`.animate-sync-beam`).

## 6. Component recipes

**Activity card**
```
relative overflow-hidden rounded-2xl border p-3.5 shadow-xs hover:shadow-md transition-all
border-surface-subtle bg-card-bg dark:border-zinc-800 dark:bg-zinc-900
+ <div class="absolute left-0 top-0 bottom-0 w-1.5 {accent}" />
```

**Icon button**: `rounded-lg p-1.5 text-text-muted hover:bg-{hue}-50 hover:text-{hue} active:scale-95 transition-all dark:hover:bg-zinc-800`

**Primary action**: `rounded-xl px-2.5 py-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95`; disabled: `bg-slate-200 text-slate-400 opacity-60 cursor-not-allowed` (dark: `bg-zinc-800 text-zinc-500`).

**Info box** (swap/sale): `rounded-xl p-2.5 text-xs border bg-{hue}-50 border-{hue}-200 dark:bg-{hue}-950/40 dark:border-{hue}-800/80`.

## 7. Accessibility & platform

- Min tap target 44px for date/time inputs; 16px input font on ≤768px.
- Safe-area helpers: `.pt-safe`, `.pb-safe`, `.pl-safe`, `.pr-safe`.
- Theme colors: light `#FFFFFF`, dark `#090D16`; `lang="th"`.

## 8. Known inconsistencies (suggested cleanup)

- Tokens are duplicated in `tailwind.config.ts` and `@theme` in `globals.css`; Tailwind v4 only needs the latter.
- Many hard-coded hex values in the `.fc-*` overrides — could map to `calendar-*` variables.
- Dark surfaces use `zinc-*` while the dark page background is a custom navy `#090D16`, and some text uses `slate-*`; consider dedicated `--color-dark-*` tokens.
- `emerald-600`, `purple-600`, `gray-600`, `rose-500` are used as brand-level colors but aren't named tokens yet (`shift-green/purple/gray`, `personal-event` proposed above).
