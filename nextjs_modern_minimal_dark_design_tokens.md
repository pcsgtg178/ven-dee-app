# Modern Minimal Dark --- Design Tokens for Next.js

Design tokens for a Next.js + React application. The implementation uses
CSS custom properties, so it works with CSS Modules and can optionally
be mapped to Tailwind CSS.

## Design direction

-   Style: Modern Minimal Dark
-   Brand accent: Muted Purple (`#A78BFA`)
-   Principle: Neutral surfaces first; semantic colors only when they
    communicate meaning.
-   Typography: Noto Sans Thai / Noto Sans, or the project's existing
    font.
-   Spacing: 4px base grid
-   Radius: 4--24px

## 1. Suggested structure

``` text
src/
├── app/
│   ├── globals.css
│   └── layout.tsx
└── components/
```

## 2. Core tokens

Add to `src/app/globals.css`.

``` css
:root {
  color-scheme: dark;

  /* Background and surfaces */
  --color-background: #101114;
  --color-surface: #1A1B20;
  --color-surface-elevated: #22242A;
  --color-surface-variant: #282930;

  /* Borders */
  --color-border: #303139;
  --color-divider: #292A30;

  /* Brand */
  --color-primary: #A78BFA;
  --color-primary-hover: #B9A5FC;
  --color-primary-pressed: #8B6DE0;
  --color-primary-container: #30234B;
  --color-on-primary: #171020;

  /* Text */
  --color-text-primary: #F1F1F3;
  --color-text-secondary: #A1A1AA;
  --color-text-tertiary: #777881;
  --color-text-disabled: #62636D;

  /* Semantic status */
  --color-success: #6EBA99;
  --color-success-container: #1C3029;
  --color-warning: #D6A45F;
  --color-warning-container: #352819;
  --color-error: #E47782;
  --color-error-container: #3A2027;
  --color-info: #79B8D9;
  --color-info-container: #1D2D39;

  /* Icons and overlay */
  --color-icon-primary: #D4D4D8;
  --color-icon-secondary: #A1A1AA;
  --color-icon-disabled: #62636D;
  --color-overlay: rgb(0 0 0 / 50%);

  /* Spacing: 4px base scale */
  --spacing-xxs: 2px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 20px;
  --spacing-2xl: 24px;
  --spacing-3xl: 32px;
  --spacing-4xl: 40px;
  --spacing-5xl: 48px;

  /* Radius */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-pill: 999px;

  /* Typography */
  --font-sans: "Noto Sans Thai", "Noto Sans", system-ui, sans-serif;
  --text-caption: 12px;
  --text-body: 14px;
  --text-subtitle: 16px;
  --text-title: 20px;
  --text-headline: 24px;
  --text-display: 32px;

  /* Elevation */
  --shadow-card: 0 2px 8px rgb(0 0 0 / 16%);
  --shadow-popover: 0 8px 24px rgb(0 0 0 / 28%);
}

html,
body {
  min-height: 100%;
  background: var(--color-background);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

body {
  margin: 0;
  font-size: var(--text-body);
  line-height: 1.5;
}
```

> If using Tailwind CSS v4, keep the project's existing
> `@import "tailwindcss";` at the top of `globals.css`. If using
> Tailwind CSS v3, keep its existing `@tailwind` directives. The tokens
> above can be added alongside either setup.

## 3. Token reference

### Colors

  ----------------------------------------------------------------------------
  Token                        Hex                     Usage
  ---------------------------- ----------------------- -----------------------
  `--color-background`         `#101114`               Main app background

  `--color-surface`            `#1A1B20`               Cards and panels

  `--color-surface-elevated`   `#22242A`               Dialogs and elevated
                                                       surfaces

  `--color-surface-variant`    `#282930`               Secondary surfaces

  `--color-border`             `#303139`               Card and input borders

  `--color-divider`            `#292A30`               Separators

  `--color-primary`            `#A78BFA`               Primary actions and
                                                       selected states

  `--color-success`            `#6EBA99`               Positive / normal
                                                       status

  `--color-warning`            `#D6A45F`               Low stock / caution

  `--color-error`              `#E47782`               Error / negative stock

  `--color-info`               `#79B8D9`               Informational status
  ----------------------------------------------------------------------------

### Spacing

  Token               Value
  ----------------- -------
  `--spacing-xxs`       2px
  `--spacing-xs`        4px
  `--spacing-sm`        8px
  `--spacing-md`       12px
  `--spacing-lg`       16px
  `--spacing-xl`       20px
  `--spacing-2xl`      24px
  `--spacing-3xl`      32px
  `--spacing-4xl`      40px
  `--spacing-5xl`      48px

### Radius

  Token               Value Suggested use
  ----------------- ------- --------------------
  `--radius-xs`         4px Small details
  `--radius-sm`         8px Badges
  `--radius-md`        12px Inputs and buttons
  `--radius-lg`        16px Compact panels
  `--radius-xl`        20px Cards
  `--radius-2xl`       24px Dialogs
  `--radius-pill`     999px Chips and pills

## 4. Reusable component styles

These can live in `globals.css` or in CSS Modules.

``` css
.card {
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
}

.button-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  min-height: 40px;
  padding: 0 var(--spacing-lg);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.button-primary:hover {
  background: var(--color-primary-hover);
}

.button-primary:active {
  background: var(--color-primary-pressed);
}

.button-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  min-height: 40px;
  padding: 0 var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
  font: inherit;
  cursor: pointer;
}

.input {
  box-sizing: border-box;
  width: 100%;
  min-height: 42px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
  font: inherit;
}

.input::placeholder {
  color: var(--color-text-tertiary);
}

.input:focus-visible {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgb(167 139 250 / 18%);
}

.badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--text-caption);
  font-weight: 600;
}

.badge-success {
  color: var(--color-success);
  background: var(--color-success-container);
}

.badge-warning {
  color: var(--color-warning);
  background: var(--color-warning-container);
}

.badge-error {
  color: var(--color-error);
  background: var(--color-error-container);
}

.badge-info {
  color: var(--color-info);
  background: var(--color-info-container);
}

.divider {
  height: 1px;
  border: 0;
  background: var(--color-divider);
}
```

## 5. Using tokens in a Next.js component

``` tsx
export function InventoryCard() {
  return (
    <article className="card">
      <h2
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: "var(--text-title)",
          fontWeight: 600,
        }}
      >
        Botox
      </h2>

      <p
        style={{
          marginTop: "var(--spacing-sm)",
          color: "var(--color-warning)",
        }}
      >
        คงเหลือ: 0 ยูนิต
      </p>

      <button className="button-primary">
        รับเข้า
      </button>
    </article>
  );
}
```

## 6. Optional Tailwind CSS v4 integration

If using Tailwind CSS v4, map the raw design variables into Tailwind's
theme namespace. To avoid CSS variable naming collisions, the following
example uses `--ds-*` as the source token names. If you use this
mapping, rename the corresponding variables in `:root` from `--color-*`
to `--ds-color-*`, and likewise for font and radius variables.

``` css
@theme inline {
  --color-background: var(--ds-color-background);
  --color-surface: var(--ds-color-surface);
  --color-surface-elevated: var(--ds-color-surface-elevated);
  --color-border: var(--ds-color-border);
  --color-primary: var(--ds-color-primary);
  --color-success: var(--ds-color-success);
  --color-warning: var(--ds-color-warning);
  --color-error: var(--ds-color-error);
  --color-info: var(--ds-color-info);

  --font-sans: var(--ds-font-sans);

  --radius-sm: var(--ds-radius-sm);
  --radius-md: var(--ds-radius-md);
  --radius-lg: var(--ds-radius-lg);
  --radius-xl: var(--ds-radius-xl);
  --radius-2xl: var(--ds-radius-2xl);
}
```

Example Tailwind usage after mapping:

``` tsx
<div className="rounded-xl border border-border bg-surface p-4">
  <h2 className="text-xl font-semibold text-primary">
    Inventory
  </h2>
</div>
```

If you are on Tailwind CSS v3, you can continue using CSS variables
directly in arbitrary-value utilities, or extend `tailwind.config.ts`
with the token values.

## 7. Optional Next.js font setup

With `next/font/google`, a Thai font can be loaded in
`src/app/layout.tsx`.

``` tsx
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-sans-thai",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={notoSansThai.variable}>
      <body>{children}</body>
    </html>
  );
}
```

Then set the font token in `globals.css`:

``` css
:root {
  --font-sans: var(--font-noto-sans-thai), system-ui, sans-serif;
}
```

If the project already has a font configured, keep it and point
`--font-sans` to that font instead.

## 8. UI color rules

  Component                    Recommended treatment
  ---------------------------- -----------------------------------------
  Primary button               Solid purple
  Secondary button             Neutral dark gray
  Action button                Neutral surface with muted icon
  Selected navigation item     Purple
  Unselected navigation item   Gray
  Status badge                 Muted semantic color + tinted container
  Card                         Consistent neutral surface
  Divider                      Subtle dark border
  Floating action button       Solid purple; avoid gradients

### Suggested color balance

Treat this as a visual guideline, not a strict measurement:

-   60% Background: `#101114`
-   30% Surface: `#22242A`
-   10% Accent: `#A78BFA`

Use semantic colors only when they communicate status or meaning.

## 9. Implementation principles

1.  Do not hard-code hex colors inside individual components. Use shared
    CSS variables.
2.  Keep cards and action controls neutral by default.
3.  Reserve purple for primary actions, selected states, and key brand
    moments.
4.  Use green, amber, red, and blue only for semantic status.
5.  Reuse spacing, radius, and typography tokens consistently.
6.  Keep tokens independent of components so the system can evolve
    without rewriting the UI.
7.  If Light Mode is added later, define a separate
    `[data-theme="light"]` variable set while keeping component styles
    unchanged.

------------------------------------------------------------------------

**Design system:** Modern Minimal Dark\
**Primary accent:** Muted Purple (`#A78BFA`)\
**Framework:** Next.js + React\
**Styling:** CSS custom properties; optional Tailwind CSS integration
