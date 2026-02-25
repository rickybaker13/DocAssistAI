# CMS/ICD-10 Terminology Feature — Design

**Date:** 2026-02-24
**Status:** Approved

## Problem

Clinical notes generated and edited in the app may use vague or informal terms that don't satisfy CMS and ICD-10-CM documentation requirements. Vague terminology leads to unspecified codes (low HCC weight), claim denials, and audit risk. Hospitals actively push providers to use ICD-10-preferred language.

## Goals

1. AI generates ICD-10-compliant terminology from the start (automatic)
2. Any vague terms that persist in the note are flagged inline with an amber underline (always-on)
3. Clicking a flagged term presents a popover with 1-3 ICD-10-grounded replacement options
4. No latency, no API cost, no disruption to the writing UX

## Non-Goals

- AI-driven scanning (ruled out — adds latency and cost)
- Specialty-specific deep expansion (V1 covers general medicine / high-frequency HCC conditions)
- Mandatory enforcement (clinician can always skip/dismiss a flag)

## Decisions

| Question | Decision | Reason |
|---|---|---|
| Automatic + active review or just one? | Both | Prompts reduce flags; inline catches the rest |
| Review UI location | Always-on inline (Option C) | Non-intrusive; doesn't require user to open a panel |
| Check mechanism | Rule-based dictionary, client-side (Option A) | Zero latency, zero API cost, critical for UX |
| Interaction on click | Inline popover with alternatives (Option A) | Fastest path to replacement; stays in context |

## Architecture

### 1. Term Dictionary — `src/lib/cms-terms.ts`

Client-side module. No backend dependency. Single source of truth for both the inline highlights and the AI prompt instruction text.

```ts
interface CmsTerm {
  vague: string;        // case-insensitive match string
  preferred: string[];  // ordered ICD-10 alternatives (1–3 items)
  note: string;         // shown in popover: why this term matters
  icd10?: string;       // representative ICD-10 code(s) for reference
}
```

**Initial dictionary (~60 entries) — grounded in ICD-10-CM Official Guidelines:**

| Vague term | Preferred alternatives | ICD-10 reason |
|---|---|---|
| `high blood pressure` | Essential (primary) hypertension | I10 — "benign/malignant" eliminated in ICD-10 |
| `HTN, stable` | Hypertension, well-controlled on [med] | Requires management link for HCC |
| `diabetes` (alone) | Type 2 diabetes mellitus, Type 1 diabetes mellitus | Type mandatory; E11 vs E10 |
| `diabetic` (alone) | Type 2 diabetes mellitus | "Diabetic" alone → unspecified |
| `diabetic nephritis` | Type 2 DM with diabetic nephropathy | "Nephritis" not in ICD-10 combination codes — use nephropathy |
| `heart failure` (unqualified) | Acute systolic HF, Chronic diastolic HF, Acute on chronic systolic HF | I50.9 unspecified carries no HCC weight |
| `CHF` | Acute systolic HF, Chronic diastolic HF, Acute on chronic systolic HF | Same as above |
| `COPD` (alone) | COPD without exacerbation, COPD with acute exacerbation | J44.9 unspecified vs J44.0/J44.1 |
| `fluid in lungs` | Pulmonary edema, Pleural effusion | Two distinct codes; clinically different |
| `stroke` (unqualified) | Ischemic stroke, Hemorrhagic stroke, TIA | Type and laterality required |
| `history of stroke` | Sequelae of CVA with [deficit], History of CVA (if fully resolved) | "History of" = resolved in ICD-10 |
| `history of [active condition]` | Use active diagnosis | ICD-10 "history of" means no longer present |
| `kidney disease` | CKD Stage 1–5, ESRD | Stage required for HCC weight |
| `anemia` (alone) | Iron deficiency anemia, Anemia of chronic disease, B12 deficiency anemia | D64.9 unspecified has no HCC value |
| `dementia` (alone) | Alzheimer's dementia, Vascular dementia, Lewy body dementia | Type required |
| `obesity` | BMI ≥40 (Class III), BMI 35–39.9 (Class II), BMI 30–34.9 (Class I) | Class affects HCC weight |
| `sepsis` (without organism) | Sepsis due to [organism], Severe sepsis | Organism specificity improves coding |
| `pneumonia` (without organism) | Community-acquired pneumonia, Hospital-acquired pneumonia, Pneumococcal pneumonia | Organism/setting specificity |
| `atrial fibrillation` (alone) | Paroxysmal AFib, Persistent AFib, Longstanding persistent AFib, Permanent AFib | Type required for accurate coding |
| `peripheral vascular disease` | Peripheral artery disease, Atherosclerosis of native arteries | PVD is not an ICD-10 index term |
| `chronic pain` (alone) | Chronic pain syndrome, Chronic pain due to [cause] | Needs etiology link |

**False-positive prevention:** Matching uses word-boundary checks. Already-specific terms (e.g., "essential hypertension", "Type 2 diabetes") must not trigger flags. Each entry defines an `exclude` pattern to skip when already-specific language is present in the surrounding context.

---

### 2. Hook — `src/hooks/useCodingHighlights.ts`

```ts
type Match = { start: number; end: number; original: string; term: CmsTerm }
function useCodingHighlights(text: string): Match[]
```

- Runs synchronously on every render (pure function, no side effects)
- Uses `RegExp` with word-boundary (`\b`) and case-insensitive flag
- Returns array of non-overlapping matches sorted by `start`
- Returns `[]` for empty/null text

---

### 3. Overlay Technique — `NoteCanvas.tsx`

Each section textarea gets a highlight wrapper:

```
┌─ wrapper div (position: relative) ──────────────────┐
│  ┌─ highlight overlay (position: absolute) ────────┐ │
│  │  ...text with <mark> amber underlines...         │ │
│  │  (pointer-events: none, color: transparent)      │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌─ textarea (background: transparent, on top) ────┐ │
│  │  ...normal editable text...                     │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

- Overlay and textarea share identical font, size, padding, line-height
- Scroll sync: `overlay.scrollTop = textarea.scrollTop` via `onScroll`
- `onClick` on textarea: reads `selectionStart`, checks if within any `Match` range, opens popover if yes
- Overlay `<mark>` spans: `color: transparent; border-bottom: 2px solid amber; background: transparent`

---

### 4. Popover — `CodingTermPopover.tsx`

```
┌──────────────────────────────────────────────────────────┐
│  ⚠  "CHF"  —  ICD-10 requires type + acuity            │
│                                                          │
│  [Acute systolic HF]  [Chronic diastolic HF]            │
│  [Acute on chronic systolic HF]             [✕ skip]   │
└──────────────────────────────────────────────────────────┘
```

- Props: `match: Match | null`, `anchorPosition: {x, y}`, `onReplace(preferred: string)`, `onDismiss()`
- `position: fixed`, z-index above note content
- Closes on: button click, ✕ skip, click-outside, `Escape`, section change
- Replacement: `newText = text.slice(0, match.start) + preferred + text.slice(match.end)` → `onChange`

---

### 5. AI Prompt Updates — `backend/src/routes/scribeAi.ts`

Add to system prompts for all four endpoints (`generate`, `ghost-write`, `resolve-suggestion`, `focused`):

> *"Use ICD-10-CM preferred terminology throughout. Examples: 'essential (primary) hypertension' not 'high blood pressure'; 'Type 2 diabetes mellitus' not 'diabetes' or 'diabetic'; specify systolic/diastolic and acute/chronic/acute-on-chronic for heart failure; 'COPD with acute exacerbation' not 'COPD' alone; 'sequelae of CVA' not 'history of stroke' when deficits persist. Avoid 'history of [condition]' for conditions still being actively managed."*

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/cms-terms.ts` | New — ICD-10 term dictionary |
| `src/hooks/useCodingHighlights.ts` | New — match scanner hook |
| `src/components/scribe-standalone/CodingTermPopover.tsx` | New — popover component |
| `src/components/scribe-standalone/NoteCanvas.tsx` | Modified — overlay + click detection |
| `backend/src/routes/scribeAi.ts` | Modified — ICD-10 instruction in 4 prompts |
| `src/lib/cms-terms.test.ts` | New — dictionary coverage tests |
| `src/hooks/useCodingHighlights.test.ts` | New — hook unit tests |
| `src/components/scribe-standalone/CodingTermPopover.test.tsx` | New — popover component tests |
| `src/components/scribe-standalone/NoteCanvas.test.tsx` | Modified — overlay + replacement tests |
| `backend/src/routes/scribeAi.test.ts` | Modified — prompt instruction tests |

## Testing Strategy

- **Dictionary:** Every entry detects its vague term; already-specific forms produce zero matches
- **Hook:** Correct `Match[]` positions; no false positives; empty input returns `[]`
- **Popover:** Renders alternatives from match; `onReplace` fires with correct string; closes on dismiss/Escape/outside click
- **NoteCanvas:** Overlay renders when matches exist; clicking flagged position opens popover; replacement updates section content; scroll sync works
- **Backend prompts:** Each of the 4 endpoints' system prompt contains the ICD-10 instruction (same pattern as the FEMA artifact test)
