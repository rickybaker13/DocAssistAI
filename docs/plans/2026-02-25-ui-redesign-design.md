# DocAssist Scribe — UI Redesign Design

**Date:** 2026-02-25
**Status:** Approved for implementation

---

## Goals

Transform the current plain, light-mode UI into a polished, dark-first clinical tool that:
- Projects trust and professionalism to physicians
- Works beautifully on both mobile (bedside) and desktop (workstation)
- Uses dark as the default theme (reduces eye strain on night shifts)
- Replaces emoji icons with a proper icon library

---

## Design Direction: Option A — Slate + Teal

**"Clinical monitor aesthetic"** — deep slate backgrounds with teal accents, evoking hospital monitoring equipment, ECG lines, and surgical scrubs.

---

## Design System

### Color Tokens

```css
/* Background layers */
--app-bg:       #020617;   /* slate-950 — outermost page */
--surface:      #0f172a;   /* slate-900 — sidebar, nav */
--card:         #1e293b;   /* slate-800 — cards, section editors */
--elevated:     #334155;   /* slate-700 — modals, drawers, hover states */
--border:       #334155;   /* slate-700 */
--border-subtle:#1e293b;   /* slate-800 */

/* Teal accent */
--primary:      #2dd4bf;   /* teal-400 — CTAs, active nav, AI indicators */
--primary-hover:#5eead4;   /* teal-300 */
--primary-dark: #0d9488;   /* teal-600 — pressed */
--primary-bg:   #042f2e;   /* teal-950 — tinted backgrounds */

/* Text */
--text-primary:   #f8fafc; /* slate-50 */
--text-secondary: #94a3b8; /* slate-400 */
--text-disabled:  #475569; /* slate-600 */
--text-inverse:   #0f172a; /* slate-900 — on teal buttons */

/* Semantic status (adjusted for dark) */
--success:     #34d399;   /* emerald-400 */
--success-bg:  #064e3b;   /* emerald-950 */
--warning:     #fbbf24;   /* amber-400 */
--warning-bg:  #451a03;   /* amber-950 */
--error:       #f87171;   /* red-400 */
--error-bg:    #450a0a;   /* red-950 */
--info:        #38bdf8;   /* sky-400 */
--info-bg:     #082f49;   /* sky-950 */
--purple:      #a78bfa;   /* violet-400 — ghost-write */
--purple-bg:   #2e1065;   /* violet-950 */
```

### Typography

```
Fonts to load via Google Fonts:
  - Inter (100–900) — body and UI
  - Inter Display (500, 600) — headings only
  - JetBrains Mono (400) — clinical identifiers (MRN, ICD codes)

Usage:
  Page titles:    Inter Display 600, 20–24px, tracking-tight, slate-50
  Section labels: Inter 500, 13px, uppercase, tracking-wider, slate-400
  Body text:      Inter 400, 14px, leading-6, slate-100
  Input text:     Inter 400, 14px, slate-50
  Caption/meta:   Inter 400, 12px, slate-400
  Clinical IDs:   JetBrains Mono 400, 13px, teal-400
```

### Icons

Replace all emoji and text symbols with **Lucide React** (`lucide-react` npm package).

| Current      | Lucide Icon     | Usage                          |
|--------------|-----------------|--------------------------------|
| 💬           | `MessageSquare` | Chat drawer toggle             |
| 🎙           | `Mic`           | Record button                  |
| 🗑           | `Trash2`        | Delete note / section          |
| ⚡           | `Zap`           | AI analysis trigger            |
| ✓ / ✓ Added  | `Check`         | Suggestion applied             |
| × / ✕        | `X`             | Close / dismiss                |
| +            | `Plus`          | New note, add section          |
| ←            | `ArrowLeft`     | Back navigation                |
| →            | `ArrowRight`    | Forward / apply                |
| ▾            | `ChevronDown`   | Dropdowns                      |
| ↑↓ (drag)    | `GripVertical`  | Section drag handle            |
| 📋           | `ClipboardList` | Note / template                |
| 👤           | `User`          | Account / auth                 |
| 🔍           | `Search`        | Search bar                     |
| ⚙            | `Settings`      | Settings / verbosity           |
| 🔊           | `Volume2`       | Audio playback                 |
| ✦ / spark    | `Sparkles`      | AI-powered features            |

Standard icon size: **16px** (inline text), **20px** (buttons), **24px** (nav/header).

---

## Layout Architecture

### Mobile (< 768px)

- **Top bar:** Fixed, `--surface` background, app name + user avatar icon
- **Bottom tab bar:** Fixed, 4 tabs — Dashboard, New Note, Templates, Account
  - Active tab: teal-400 icon + label
  - Inactive: slate-400
  - Background: `--surface` with `backdrop-blur` (glass effect)
- **Content area:** Full-width, `--app-bg` background, `pb-20` (clear bottom nav)
- **Modals/drawers:** Slide up from bottom with `rounded-t-2xl`

### Desktop (≥ 768px)

- **Left sidebar:** 240px fixed, `--surface` background
  - Logo/app name at top
  - Nav items: Dashboard, New Note, Templates
  - Bottom: User info + logout
  - Active item: teal-400 text + subtle teal-950 bg pill
- **Main content:** Remaining width, `--app-bg` background, `max-w-4xl mx-auto px-6`
- **Top bar hidden** on desktop (sidebar handles nav)

### Responsive Pattern

Both layouts share the same components — CSS controls which chrome appears:
```
md:hidden     → hide bottom nav on desktop
hidden md:flex → hide mobile top bar on desktop
```

---

## Screen-by-Screen Changes

### Login / Register

**Current:** White card on gray background, generic blue button.

**New:**
- Full-screen dark background (`--app-bg`)
- Centered logo mark: teal circle with stethoscope/cross icon (SVG, inline)
- "DocAssist Scribe" in Inter Display 600, slate-50
- "Clinical documentation, simplified" in slate-400
- Card: `--card` background, `border border-slate-700`, `rounded-2xl`, `shadow-2xl`
- Inputs: dark-styled — `bg-slate-900 border-slate-700 text-slate-50 placeholder-slate-500`
  - Focus ring: `ring-2 ring-teal-400`
- Primary button: `bg-teal-400 text-slate-900 font-semibold` (not white text — the teal is light enough that dark text has better contrast)
- "Create account" link: `text-teal-400 hover:text-teal-300`

### Dashboard

**Current:** Gray background, blue "+ New Note", flat list of white cards.

**New:**
- Header: "My Notes" in Inter Display 600 + date/greeting ("Good morning, Dr. Smith")
- Search bar: `--card` background, `SearchIcon` prefix, dark-styled
- Filter pills: active = `bg-teal-400/20 text-teal-400 border-teal-400/30`; inactive = `bg-slate-800 text-slate-400`
- Note cards (`NoteCard`):
  - Background: `--card`, hover → `--elevated`
  - Left border accent: `border-l-4 border-teal-400` (draft) or `border-emerald-400` (finalized)
  - Note title + patient label in slate-50; metadata in slate-400
  - Status badge: pill with dark semantic colors
  - Smooth `transition-all duration-150` on hover
- "+ New Note" button: teal-400 fill with Plus icon, fixed bottom-right on mobile (FAB)

### Note Builder Page

**Current:** Two-column grid on desktop, but visually flat.

**New:**
- Section library: `--surface` background left panel, search box at top, draggable items with `GripVertical` icon
- Note canvas: `--card` section cards, teal left accent on each section, drag handles visible on hover
- Template selector: horizontal pill row, selected = teal border
- Verbosity toggle (Brief / Standard / Detailed): segmented control pill, teal active

### Note Page (ScribeNotePage)

**Current:** Flat white cards, emoji "⚡ AI" button, no visual hierarchy.

**New:**
- Page header: patient label + note type badge + status pill + "Finalize" button (right-aligned)
- Section editor cards: `--card` bg, `border-l-4` left accent (color = confidence level — teal > 80%, amber 50–80%, red < 50%)
- Section title: Inter 500 uppercase slate-400, ICD code pills in `JetBrains Mono teal-400`
- Textarea: `bg-transparent border-none text-slate-100` (editor blends into card)
- AI trigger button: `Sparkles` icon + "AI" label, `text-teal-400 hover:bg-teal-400/10`
- Confidence score: small pill top-right of card — emerald/amber/red based on level
- ICD-10 underlines: amber-400 (same as before, already visible on dark)

### Focused AI Panel

**Current:** Overlaid white panel, lots of sections competing for attention.

**New:**
- Slide-in from right on desktop (not an overlay — push layout or fixed 400px right panel)
- On mobile: bottom sheet
- Header: "AI Analysis" + `Sparkles` icon, `X` close, teal border-bottom divider
- Suggestions: each in a `--card` card with left accent, `ArrowRight` apply button (teal)
  - Applied: `Check` icon, dimmed opacity, `border-emerald-400/30`
- Citations (guidelines): sky-950 bg cards with sky-400 border
- Ghost-write preview: diff view — removed text in red-400, added text in emerald-400
- Progress bar (batch): teal-400 fill on slate-700 track

### Chat Drawer

**Current:** Fixed bottom-right with emoji 💬 button, white chat bubbles.

**New:**
- FAB button: teal-400 circle, `MessageSquare` icon, subtle shadow-teal glow
- Drawer: `--surface` bg, `rounded-t-2xl` on mobile / `rounded-l-2xl` panel on desktop
- User messages: teal-400/20 bg, teal-400 text
- Assistant messages: `--card` bg, slate-50 text
- Ghost-write section: violet-950 bg, violet-400 border
- Input: `--elevated` bg, `ArrowRight` send icon as teal button

---

## Components

### Button Variants

```
Primary:     bg-teal-400 text-slate-900 font-semibold hover:bg-teal-300
             active:bg-teal-600 rounded-lg px-4 py-2
Secondary:   bg-slate-700 text-slate-100 hover:bg-slate-600
             border border-slate-600 rounded-lg px-4 py-2
Ghost:       text-slate-400 hover:text-slate-100 hover:bg-slate-800
             rounded-lg px-3 py-2
Danger:      text-red-400 hover:bg-red-950 rounded-lg px-3 py-2
Icon button: p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-100
```

### Input Fields

```
Base:   bg-slate-900 border border-slate-700 rounded-lg px-3 py-2
        text-slate-50 placeholder-slate-500
        text-sm focus:outline-none focus:ring-2 focus:ring-teal-400
        focus:border-teal-400 transition-colors
```

### Cards

```
Base:   bg-slate-800 border border-slate-700 rounded-xl p-4
Hover:  hover:bg-slate-700 hover:border-slate-600
        transition-all duration-150
```

### Badges / Pills

```
Status - Draft:       bg-amber-950 text-amber-400 border border-amber-400/30
Status - Finalized:   bg-emerald-950 text-emerald-400 border border-emerald-400/30
Confidence - High:    bg-teal-950 text-teal-400
Confidence - Medium:  bg-amber-950 text-amber-400
Confidence - Low:     bg-red-950 text-red-400
```

### Loading States

Replace CSS spinners with:
- **Skeleton loaders** for card lists (pulsing `--elevated` rectangles)
- **Spinner** kept for record/transcription (full-screen overlay with teal ring)

---

## Animations

All transitions use `transition-all duration-150 ease-out` unless noted.

- Button hover/press: scale(0.98) on active
- Card hover: `translate-y-[-1px] shadow-lg`
- Modal/drawer open: slide + fade (200ms)
- Suggestion apply: check icon fades in, row dims (300ms)
- Batch progress bar: smooth width transition (eased)
- FAB: subtle `shadow-[0_0_20px_rgba(45,212,191,0.3)]` teal glow on hover

---

## Implementation Scope

### Files to change (frontend)

1. **`src/index.css`** — CSS variables, font imports, base dark styles, scrollbar styling
2. **`tailwind.config.js`** — Add slate/teal theme tokens, dark mode `class` strategy
3. **`src/main.tsx`** or `App.tsx` — Add `dark` class to `<html>`, Google Fonts link
4. **`package.json`** — Add `lucide-react`
5. **All Scribe components** (14 files) — Replace emoji → Lucide, Tailwind class swap to dark tokens

### Key principle

No new component library (shadcn/Radix). Pure Tailwind + Lucide. The existing component structure stays intact — only styles and icons change. This minimizes test churn and keeps the implementation straightforward.

---

## Success Criteria

- [ ] All screens dark by default
- [ ] No emoji icons remain in Scribe components
- [ ] Login, Dashboard, Note page, AI panel, Chat drawer all updated
- [ ] Mobile bottom nav works on < 768px
- [ ] Desktop sidebar works on ≥ 768px
- [ ] All existing tests still pass
- [ ] Teal accent used consistently for all interactive / AI elements
