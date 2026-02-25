# CMS/ICD-10 Terminology Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Flag informal/vague clinical terms inline in note sections with an amber underline and offer ICD-10-preferred replacements via a click-triggered popover — zero latency, zero API cost — while also updating all AI prompts to generate ICD-10 compliant language from the start.

**Architecture:** Rule-based client-side dictionary (`cms-terms.ts`) → synchronous `useCodingHighlights` hook → overlay div behind each `NoteSectionEditor` textarea → click-triggered `CodingTermPopover`. AI prompts get a short ICD-10 terminology instruction. No new backend endpoints.

**Tech Stack:** React/TypeScript/Tailwind (frontend), Vitest + Testing Library (frontend tests), Jest/Supertest (backend tests)

**Correction from design doc:** The textarea editor is `NoteSectionEditor.tsx`, not `NoteCanvas.tsx`. NoteCanvas is the section builder drag-and-drop component.

---

### Task 1: CMS Term Dictionary

**Files:**
- Create: `src/lib/cms-terms.ts`
- Create: `src/lib/cms-terms.test.ts`

**Step 1: Write the failing test**

Add `src/lib/cms-terms.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CMS_TERMS, CmsTerm } from './cms-terms';

describe('CMS_TERMS dictionary', () => {
  it('exports a non-empty array of CmsTerm objects', () => {
    expect(Array.isArray(CMS_TERMS)).toBe(true);
    expect(CMS_TERMS.length).toBeGreaterThan(10);
  });

  it('every entry has required fields with non-empty values', () => {
    for (const term of CMS_TERMS) {
      expect(typeof term.vague).toBe('string');
      expect(term.vague.length).toBeGreaterThan(0);
      expect(Array.isArray(term.preferred)).toBe(true);
      expect(term.preferred.length).toBeGreaterThan(0);
      expect(typeof term.note).toBe('string');
      expect(term.note.length).toBeGreaterThan(0);
    }
  });

  it('vague field for "high blood pressure" entry exists', () => {
    const entry = CMS_TERMS.find(t => t.vague.toLowerCase().includes('high blood pressure'));
    expect(entry).toBeDefined();
    expect(entry!.preferred[0]).toMatch(/hypertension/i);
  });

  it('vague field for "CHF" entry exists and preferred terms specify type', () => {
    const entry = CMS_TERMS.find(t => t.vague === 'CHF');
    expect(entry).toBeDefined();
    expect(entry!.preferred.some(p => /systolic|diastolic/i.test(p))).toBe(true);
  });

  it('vague field for "diabetic nephritis" entry exists and preferred uses nephropathy', () => {
    const entry = CMS_TERMS.find(t => t.vague.toLowerCase().includes('diabetic nephritis'));
    expect(entry).toBeDefined();
    expect(entry!.preferred[0]).toMatch(/nephropathy/i);
  });

  it('no duplicate vague entries', () => {
    const vagueTerms = CMS_TERMS.map(t => t.vague.toLowerCase());
    const unique = new Set(vagueTerms);
    expect(unique.size).toBe(vagueTerms.length);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/cms-terms.test.ts
```
Expected: FAIL with "Cannot find module './cms-terms'"

**Step 3: Write the implementation**

Create `src/lib/cms-terms.ts` with the `CmsTerm` interface and `CMS_TERMS` array. Each entry has: `vague: string`, `preferred: string[]`, `note: string`, `icd10?: string`, `excludeContext?: string` (regex string — if matches within 40 chars of a hit, suppresses the flag to prevent false positives on already-specific language).

Key entries to include (expand to ~40 total):

| vague | preferred[0] | excludeContext |
|---|---|---|
| `high blood pressure` | `Essential (primary) hypertension` | — |
| `CHF` | `Acute systolic heart failure` | `systolic\|diastolic\|HFrEF\|HFpEF` |
| `heart failure` (unqualified) | `Acute systolic heart failure` | `systolic\|diastolic\|HFrEF\|HFpEF\|acute on chronic` |
| `congestive heart failure` | `Acute systolic heart failure` | `systolic\|diastolic` |
| `fluid in lungs` | `Pulmonary edema` | — |
| `irregular heartbeat` | `Atrial fibrillation, paroxysmal` | — |
| `atrial fibrillation` | `Atrial fibrillation, paroxysmal` | `paroxysmal\|persistent\|longstanding\|permanent` |
| `AFib` | `AFib, paroxysmal` | `paroxysmal\|persistent\|longstanding\|permanent` |
| `peripheral vascular disease` | `Peripheral artery disease` | — |
| `PVD` | `Peripheral artery disease` | — |
| `heart attack` | `Acute STEMI` | — |
| `diabetic nephritis` | `Type 2 DM with diabetic nephropathy` | — |
| `sugar diabetes` | `Type 2 diabetes mellitus` | — |
| `thyroid problem` | `Hypothyroidism` | — |
| `COPD` | `COPD without acute exacerbation` | `without\|with acute\|exacerbation\|lower respiratory` |
| `stroke` | `Ischemic stroke` | `ischemic\|hemorrhagic\|TIA\|transient` |
| `mini stroke` | `TIA (transient ischemic attack)` | — |
| `dementia` | `Alzheimer's dementia` | `alzheimer\|vascular\|lewy\|frontotemporal` |
| `kidney disease` | `CKD Stage 3` | `stage\|ESRD\|end.stage\|CKD` |
| `kidney failure` | `ESRD (End-Stage Renal Disease)` | `acute\|ESRD\|end.stage\|stage` |
| `anemia` | `Iron deficiency anemia` | `iron\|chronic\|B12\|folate\|hemolytic` |
| `knee pain` | `Primary osteoarthritis, right knee` | — |
| `hip pain` | `Primary osteoarthritis, right hip` | — |
| `back pain` | `Low back pain` | — |
| `sepsis` | `Sepsis due to Staph aureus` | `due to\|strep\|staph\|gram\|e\\.\\s*coli` |
| `pneumonia` | `Community-acquired pneumonia` | `community\|hospital\|aspiration\|pneumococcal` |
| `cancer` | `Malignant neoplasm of [site] (primary)` | `malignant\|neoplasm\|carcinoma\|lymphoma` |
| `depression` | `Major depressive disorder, single episode` | `major\|persistent\|dysthymia\|bipolar` |
| `anxiety` | `Generalized anxiety disorder` | `generalized\|panic\|social\|separation` |
| `obesity` | `Morbid obesity (BMI ≥40, Class III)` | `morbid\|class I\|class II\|class III\|BMI` |
| `history of diabetes` | `Type 2 diabetes mellitus (if still managed)` | — |
| `history of hypertension` | `Essential (primary) hypertension (if still managed)` | — |
| `history of heart failure` | `Chronic systolic heart failure (if still managed)` | — |
| `history of stroke` | `Sequelae of ischemic stroke with [deficit]` | — |
| `history of COPD` | `COPD without acute exacerbation (if still managed)` | — |

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/cms-terms.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/cms-terms.ts src/lib/cms-terms.test.ts
git commit -m "feat(scribe): add ICD-10/CMS term dictionary with 35+ entries"
```

---

### Task 2: useCodingHighlights Hook

**Files:**
- Create: `src/hooks/useCodingHighlights.ts`
- Create: `src/hooks/useCodingHighlights.test.ts`

**Step 1: Write the failing test**

Create `src/hooks/useCodingHighlights.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findCodingMatches } from './useCodingHighlights';

describe('findCodingMatches', () => {
  it('returns empty array for empty string', () => {
    expect(findCodingMatches('')).toEqual([]);
  });

  it('returns empty array when no vague terms present', () => {
    expect(findCodingMatches('Patient has essential (primary) hypertension.')).toHaveLength(0);
  });

  it('detects "high blood pressure" and returns correct positions', () => {
    const text = 'Patient has high blood pressure managed on lisinopril.';
    const matches = findCodingMatches(text);
    expect(matches).toHaveLength(1);
    expect(text.slice(matches[0].start, matches[0].end).toLowerCase()).toBe('high blood pressure');
  });

  it('detects "CHF" case-insensitively', () => {
    const text = 'Assessment: chf with reduced ejection fraction.';
    const matches = findCodingMatches(text);
    expect(matches.some(m => m.original.toLowerCase() === 'chf')).toBe(true);
  });

  it('does NOT flag "CHF" when already qualified with systolic', () => {
    const text = 'Acute on chronic systolic CHF with EF 30%.';
    const matches = findCodingMatches(text);
    expect(matches.find(m => m.original.toLowerCase() === 'chf')).toBeUndefined();
  });

  it('does NOT flag "heart failure" when already specific', () => {
    expect(findCodingMatches('Patient has acute systolic heart failure.')).toHaveLength(0);
  });

  it('detects multiple vague terms in one text', () => {
    const text = 'Dx: CHF, kidney disease.';
    expect(findCodingMatches(text).length).toBeGreaterThanOrEqual(2);
  });

  it('returns matches sorted by start position', () => {
    const matches = findCodingMatches('Patient has CHF and kidney disease.');
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].start).toBeGreaterThan(matches[i - 1].start);
    }
  });

  it('returns non-overlapping matches', () => {
    const matches = findCodingMatches('heart failure and heart failure again');
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].start).toBeGreaterThanOrEqual(matches[i - 1].end);
    }
  });

  it('includes the correct CmsTerm on each match', () => {
    const matches = findCodingMatches('Assessment: high blood pressure.');
    expect(matches[0].term.preferred[0]).toMatch(/hypertension/i);
  });

  it('detects "history of stroke" as flagged', () => {
    const matches = findCodingMatches('PMH: history of stroke, HTN.');
    expect(matches.some(m => m.term.vague.includes('history of stroke'))).toBe(true);
  });

  it('does not flag "COPD" when "without acute exacerbation" appears nearby', () => {
    expect(findCodingMatches('COPD without acute exacerbation, stable.')).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/hooks/useCodingHighlights.test.ts
```
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

Create `src/hooks/useCodingHighlights.ts`:

```typescript
import { useMemo } from 'react';
import { CMS_TERMS, CmsTerm } from '../lib/cms-terms';

export interface Match {
  start: number;
  end: number;
  original: string;
  term: CmsTerm;
}

/**
 * Pure function — exported for unit testing without React.
 * Scans text against CMS_TERMS, returns non-overlapping matches sorted by start.
 */
export function findCodingMatches(text: string): Match[] {
  if (!text) return [];
  const matches: Match[] = [];

  for (const term of CMS_TERMS) {
    const escaped = term.vague.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
    let m: RegExpExecArray | null;

    while ((m = regex.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;

      // Suppress if already-specific context detected nearby
      if (term.excludeContext) {
        const ctx = text.slice(Math.max(0, start - 40), Math.min(text.length, end + 40));
        if (new RegExp(term.excludeContext, 'i').test(ctx)) continue;
      }

      // Skip overlapping matches
      if (matches.some(e => start < e.end && end > e.start)) continue;

      matches.push({ start, end, original: m[0], term });
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

/** React hook: memoized match list, recomputed only when text changes. */
export function useCodingHighlights(text: string): Match[] {
  return useMemo(() => findCodingMatches(text), [text]);
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/hooks/useCodingHighlights.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useCodingHighlights.ts src/hooks/useCodingHighlights.test.ts
git commit -m "feat(scribe): add useCodingHighlights hook for ICD-10 term detection"
```

---

### Task 3: CodingTermPopover Component

**Files:**
- Create: `src/components/scribe-standalone/CodingTermPopover.tsx`
- Create: `src/components/scribe-standalone/CodingTermPopover.test.tsx`

**Step 1: Write the failing test**

Create `src/components/scribe-standalone/CodingTermPopover.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodingTermPopover } from './CodingTermPopover';
import { Match } from '../../hooks/useCodingHighlights';

const makeMatch = (): Match => ({
  start: 12, end: 15, original: 'CHF',
  term: {
    vague: 'CHF',
    preferred: ['Acute systolic heart failure', 'Chronic diastolic heart failure', 'Acute on chronic systolic HF'],
    note: 'ICD-10 I50.9 unspecified carries no HCC weight',
    icd10: 'I50.x',
  },
});

describe('CodingTermPopover', () => {
  it('renders the vague term and note', () => {
    render(<CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/"CHF"/)).toBeInTheDocument();
    expect(screen.getByText(/HCC weight/i)).toBeInTheDocument();
  });

  it('renders all preferred alternatives as buttons', () => {
    render(<CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Acute systolic heart failure/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chronic diastolic heart failure/i })).toBeInTheDocument();
  });

  it('calls onReplace with selected term when option button clicked', () => {
    const onReplace = vi.fn();
    render(<CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={onReplace} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Acute systolic heart failure/i }));
    expect(onReplace).toHaveBeenCalledWith('Acute systolic heart failure');
  });

  it('calls onDismiss when skip button clicked', () => {
    const onDismiss = vi.fn();
    render(<CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when Escape key pressed', () => {
    const onDismiss = vi.fn();
    render(<CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when clicking outside', () => {
    const onDismiss = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <CodingTermPopover match={makeMatch()} position={{ x: 100, y: 200 }} onReplace={vi.fn()} onDismiss={onDismiss} />
      </div>
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/scribe-standalone/CodingTermPopover.test.tsx
```
Expected: FAIL

**Step 3: Write the implementation**

Create `src/components/scribe-standalone/CodingTermPopover.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { Match } from '../../hooks/useCodingHighlights';

interface Props {
  match: Match;
  position: { x: number; y: number };
  onReplace: (preferred: string) => void;
  onDismiss: () => void;
}

export const CodingTermPopover: React.FC<Props> = ({ match, position, onReplace, onDismiss }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onDismiss]);

  const leftPos = Math.max(8, Math.min(position.x - 8, window.innerWidth - 320));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`ICD-10 term suggestion for "${match.original}"`}
      style={{ position: 'fixed', left: leftPos, top: position.y + 12, zIndex: 60, width: 300 }}
      className="bg-white border border-amber-200 rounded-xl shadow-xl p-3 text-sm"
    >
      <div className="mb-1.5">
        <span className="font-semibold text-amber-700">⚠ "{match.original}"</span>
        {match.term.icd10 && (
          <span className="ml-2 text-xs text-gray-400">({match.term.icd10})</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-2 leading-snug">{match.term.note}</p>
      <div className="flex flex-col gap-1 mb-2">
        {match.term.preferred.map(p => (
          <button
            key={p}
            onClick={() => onReplace(p)}
            className="text-left text-xs px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-medium transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
      <button onClick={onDismiss} aria-label="Skip this suggestion" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
        ✕ skip
      </button>
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/scribe-standalone/CodingTermPopover.test.tsx
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/scribe-standalone/CodingTermPopover.tsx src/components/scribe-standalone/CodingTermPopover.test.tsx
git commit -m "feat(scribe): add CodingTermPopover for ICD-10 replacement options"
```

---

### Task 4: NoteSectionEditor Overlay Integration

**Files:**
- Modify: `src/components/scribe-standalone/NoteSectionEditor.tsx`
- Create: `src/components/scribe-standalone/NoteSectionEditor.test.tsx`

**Context:** `NoteSectionEditor` has a plain `<textarea>`. We add a highlight overlay behind it (same font/padding) with amber underlines on flagged terms. Clicking the textarea detects if cursor is on a match and opens `CodingTermPopover`.

**Step 1: Write the failing tests**

Create `src/components/scribe-standalone/NoteSectionEditor.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteSectionEditor } from './NoteSectionEditor';

const base = { id: 'sec-1', section_name: 'Assessment', content: '', confidence: null, display_order: 0 };

describe('NoteSectionEditor', () => {
  it('renders section name in header', () => {
    render(<NoteSectionEditor section={base} onChange={vi.fn()} onFocusedAI={vi.fn()} />);
    expect(screen.getByText('ASSESSMENT')).toBeInTheDocument();
  });

  it('renders highlight overlay container', () => {
    const section = { ...base, content: 'Patient has high blood pressure.' };
    render(<NoteSectionEditor section={section} onChange={vi.fn()} onFocusedAI={vi.fn()} />);
    expect(document.querySelector('[data-testid="coding-highlight-overlay"]')).toBeInTheDocument();
  });

  it('shows amber badge in header when vague terms detected', () => {
    const section = { ...base, content: 'Assessment: CHF.' };
    render(<NoteSectionEditor section={section} onChange={vi.fn()} onFocusedAI={vi.fn()} />);
    expect(screen.getByTitle(/ICD-10 coding term/i)).toBeInTheDocument();
  });

  it('opens CodingTermPopover when clicking on a flagged term position', () => {
    const section = { ...base, content: 'Assessment: CHF on lisinopril.' };
    render(<NoteSectionEditor section={section} onChange={vi.fn()} onFocusedAI={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    // "Assessment: " = 12 chars; CHF starts at index 12
    Object.defineProperty(textarea, 'selectionStart', { get: () => 12, configurable: true });
    fireEvent.click(textarea, { clientX: 150, clientY: 300 });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does NOT open popover when clicking non-flagged position', () => {
    const section = { ...base, content: 'Patient has essential hypertension.' };
    render(<NoteSectionEditor section={section} onChange={vi.fn()} onFocusedAI={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    Object.defineProperty(textarea, 'selectionStart', { get: () => 0, configurable: true });
    fireEvent.click(textarea, { clientX: 50, clientY: 300 });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('replaces vague term when popover option selected', () => {
    const onChange = vi.fn();
    const section = { ...base, content: 'Assessment: CHF on lisinopril.' };
    render(<NoteSectionEditor section={section} onChange={onChange} onFocusedAI={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    Object.defineProperty(textarea, 'selectionStart', { get: () => 12, configurable: true });
    fireEvent.click(textarea, { clientX: 150, clientY: 300 });
    fireEvent.click(screen.getByRole('button', { name: /Acute systolic heart failure/i }));

    expect(onChange).toHaveBeenCalledWith('sec-1', 'Assessment: Acute systolic heart failure on lisinopril.');
  });

  it('closes popover without change when skip is clicked', () => {
    const onChange = vi.fn();
    const section = { ...base, content: 'Assessment: CHF on lisinopril.' };
    render(<NoteSectionEditor section={section} onChange={onChange} onFocusedAI={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    Object.defineProperty(textarea, 'selectionStart', { get: () => 12, configurable: true });
    fireEvent.click(textarea, { clientX: 150, clientY: 300 });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/scribe-standalone/NoteSectionEditor.test.tsx
```
Expected: FAIL

**Step 3: Write the implementation**

Replace `src/components/scribe-standalone/NoteSectionEditor.tsx` with:

```tsx
import React, { useRef, useState } from 'react';
import { useCodingHighlights, Match } from '../../hooks/useCodingHighlights';
import { CodingTermPopover } from './CodingTermPopover';

interface Section {
  id: string;
  section_name: string;
  content: string | null;
  confidence: number | null;
  display_order: number;
}

interface Props {
  section: Section;
  onChange: (id: string, content: string) => void;
  onFocusedAI: (section: Section) => void;
  onDelete?: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.8 ? 'bg-green-100 text-green-700' : confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{pct}%</span>;
}

/** Build overlay nodes: all text color:transparent, flagged spans get amber bottom border. */
function buildOverlayNodes(text: string, matches: Match[]): React.ReactNode {
  if (!matches.length) return <span style={{ color: 'transparent' }}>{text}</span>;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      nodes.push(<span key={`t${cursor}`} style={{ color: 'transparent' }}>{text.slice(cursor, match.start)}</span>);
    }
    nodes.push(
      <mark key={`m${match.start}`} style={{ color: 'transparent', background: 'transparent', borderBottom: '2px solid #f59e0b', padding: 0 }}>
        {text.slice(match.start, match.end)}
      </mark>
    );
    cursor = match.end;
  }
  if (cursor < text.length) {
    nodes.push(<span key={`t${cursor}`} style={{ color: 'transparent' }}>{text.slice(cursor)}</span>);
  }
  return <>{nodes}</>;
}

export const NoteSectionEditor: React.FC<Props> = ({ section, onChange, onFocusedAI, onDelete }) => {
  const text = section.content || '';
  const matches = useCodingHighlights(text);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(section.id, e.target.value);
    setActiveMatch(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const pos = e.currentTarget.selectionStart;
    const hit = matches.find(m => pos >= m.start && pos <= m.end);
    if (hit) {
      setActiveMatch(hit);
      setPopoverPos({ x: e.clientX, y: e.clientY });
    } else {
      setActiveMatch(null);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (overlayRef.current) overlayRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const handleReplace = (preferred: string) => {
    if (!activeMatch) return;
    const newText = text.slice(0, activeMatch.start) + preferred + text.slice(activeMatch.end);
    onChange(section.id, newText);
    setActiveMatch(null);
    setPopoverPos(null);
  };

  const handleDismiss = () => { setActiveMatch(null); setPopoverPos(null); };

  const copySection = () => navigator.clipboard.writeText(text);

  // Both overlay and textarea must share identical layout styles
  const sharedStyle: React.CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    padding: '0.5rem 0.75rem',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  };

  const rows = Math.max(3, Math.ceil((text.length || 1) / 80));

  return (
    <div className={`border rounded-xl overflow-hidden ${section.confidence !== null && section.confidence < 0.5 ? 'border-yellow-300' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{section.section_name}</span>
          <ConfidenceBadge confidence={section.confidence} />
          {matches.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium"
              title={`${matches.length} ICD-10 coding term${matches.length > 1 ? 's' : ''} to review`}
            >
              ⚠ {matches.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onFocusedAI(section)} aria-label="Focused AI"
            className="text-xs text-purple-600 border border-purple-200 rounded px-2 py-0.5 hover:bg-purple-50 transition-colors">
            ⚡ Focused AI
          </button>
          <button onClick={copySection} aria-label="Copy section" className="text-xs text-gray-400 hover:text-gray-600 px-1" title="Copy section">⎘</button>
          {onDelete && (
            <button onClick={onDelete} aria-label={`Delete ${section.section_name} section`}
              className="text-xs text-gray-300 hover:text-red-400 px-1 transition-colors" title="Remove section">×</button>
          )}
        </div>
      </div>

      <div className="relative">
        {/* Highlight overlay — behind the textarea */}
        <div
          ref={overlayRef}
          data-testid="coding-highlight-overlay"
          aria-hidden="true"
          style={{ ...sharedStyle, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}
        >
          {buildOverlayNodes(text, matches)}
          {'\n'}
        </div>

        {/* Transparent textarea on top */}
        <textarea
          value={text}
          onChange={handleChange}
          onClick={handleClick}
          onScroll={handleScroll}
          style={{ ...sharedStyle, background: 'transparent', position: 'relative' }}
          className="w-full focus:outline-none resize-none min-h-[80px]"
          rows={rows}
        />
      </div>

      {activeMatch && popoverPos && (
        <CodingTermPopover match={activeMatch} position={popoverPos} onReplace={handleReplace} onDismiss={handleDismiss} />
      )}
    </div>
  );
};
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/scribe-standalone/NoteSectionEditor.test.tsx
```
Expected: PASS

**Step 5: Run full frontend suite**

```bash
npx vitest run src/
```
Expected: All tests green

**Step 6: Commit**

```bash
git add src/components/scribe-standalone/NoteSectionEditor.tsx src/components/scribe-standalone/NoteSectionEditor.test.tsx
git commit -m "feat(scribe): add ICD-10 highlight overlay and popover to NoteSectionEditor"
```

---

### Task 5: Backend AI Prompt Updates

**Files:**
- Modify: `backend/src/routes/scribeAi.ts`
- Modify: `backend/src/routes/scribeAi.test.ts`

**Step 1: Write the failing tests**

Add one test to each of the 4 `describe` blocks in `backend/src/routes/scribeAi.test.ts`:

Inside `describe('POST /generate')`:
```typescript
it('system prompt includes ICD-10 terminology instruction', async () => {
  mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
    sections: [{ name: 'Assessment', content: 'Essential hypertension.', confidence: 0.9 }],
  }) } as any);
  await request(app).post('/api/ai/scribe/generate').set('Cookie', authCookie)
    .send({ transcript: 'HTN.', sections: [{ name: 'Assessment' }], noteType: 'progress_note' });
  const sys: string = (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
  expect(sys).toMatch(/ICD-10|icd-10/i);
  expect(sys).toMatch(/essential.*hypertension|preferred terminology/i);
});
```

Inside `describe('POST /ghost-write')`:
```typescript
it('system prompt includes ICD-10 terminology instruction', async () => {
  mockAiChat.mockResolvedValueOnce({ content: 'Essential hypertension, on lisinopril.' } as any);
  await request(app).post('/api/ai/scribe/ghost-write').set('Cookie', authCookie)
    .send({ chatAnswer: 'HTN on lisinopril', destinationSection: 'Assessment' });
  const sys: string = (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
  expect(sys).toMatch(/ICD-10|icd-10/i);
});
```

Inside `describe('POST /focused')`:
```typescript
it('system prompt includes ICD-10 terminology instruction', async () => {
  mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
    analysis: 'Good.', citations: [], suggestions: [], confidence_breakdown: '',
  }) } as any);
  await request(app).post('/api/ai/scribe/focused').set('Cookie', authCookie)
    .send({ sectionName: 'Assessment', content: 'HTN.', transcript: '' });
  const sys: string = (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
  expect(sys).toMatch(/ICD-10|icd-10/i);
});
```

Inside `describe('POST /resolve-suggestion')`:
```typescript
it('system prompt includes ICD-10 terminology instruction', async () => {
  mockAiChat.mockResolvedValueOnce({
    content: JSON.stringify({ ready: true, noteText: 'Essential (primary) hypertension.' }),
  } as any);
  await request(app).post('/api/ai/scribe/resolve-suggestion').set('Cookie', authCookie)
    .send({ suggestion: 'Document BP', sectionName: 'Assessment', transcript: 'HTN.' });
  const sys: string = (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
  expect(sys).toMatch(/ICD-10|icd-10/i);
});
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribeAi" --no-coverage
```
Expected: 4 new tests FAIL

**Step 3: Write the implementation**

In `backend/src/routes/scribeAi.ts`, add this constant after the imports:

```typescript
const ICD10_TERMINOLOGY_INSTRUCTION = `Use ICD-10-CM preferred terminology throughout. Examples: 'essential (primary) hypertension' not 'high blood pressure'; 'Type 2 diabetes mellitus' not 'diabetes' or 'diabetic'; specify systolic/diastolic and acute/chronic/acute-on-chronic for heart failure; 'COPD with acute exacerbation' or 'COPD without acute exacerbation' not 'COPD' alone; 'sequelae of CVA with [deficit]' not 'history of stroke' when deficits persist. Avoid 'history of [condition]' for conditions still actively managed — in ICD-10, 'history of' means fully resolved.`;
```

Then append `\n${ICD10_TERMINOLOGY_INSTRUCTION}` to each of the four `systemPrompt` template literals (inside `/generate`, `/ghost-write`, `/focused`, and `/resolve-suggestion`). Add it as the last line before the closing backtick.

**Step 4: Run tests to verify they pass**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribeAi" --no-coverage
```
Expected: All 22 tests green

**Step 5: Run full test suite**

```bash
npx vitest run src/ && cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribe" --no-coverage
```
Expected: All frontend and backend tests green

**Step 6: Commit**

```bash
git add backend/src/routes/scribeAi.ts backend/src/routes/scribeAi.test.ts
git commit -m "feat(scribe): add ICD-10 terminology instruction to all AI system prompts"
```

---

### Task 6: Update CLAUDE.md and Push

**Step 1: Add to CLAUDE.md**

Add a new section after the FocusedAIPanel Architecture section:

```markdown
## CMS/ICD-10 Terminology Feature

- **`src/lib/cms-terms.ts`:** Client-side dictionary (~40 entries). `CmsTerm` shape: `vague`, `preferred[]`, `note`, `icd10?`, `excludeContext?` (regex — suppresses match if found within 40 chars).
- **`src/hooks/useCodingHighlights.ts`:** `useCodingHighlights(text)` → `Match[]` (memoized). `findCodingMatches(text)` is the pure function for unit testing.
- **`CodingTermPopover.tsx`:** `position: fixed` popover; closes on Escape, click-outside, or skip.
- **`NoteSectionEditor.tsx`:** Overlay div (`data-testid="coding-highlight-overlay"`) behind a transparent textarea. Overlay text is `color: transparent`; flagged `<mark>` spans add `border-bottom: 2px solid #f59e0b`. Click detection via `onClick` → `selectionStart` → match lookup.
- **`ICD10_TERMINOLOGY_INSTRUCTION`:** Constant in `scribeAi.ts` appended to all 4 system prompts.
- **Gotcha:** `excludeContext` on `CmsTerm` suppresses a match when its regex matches within 40 chars (prevents false flags on "acute systolic CHF", "COPD without exacerbation", etc.).
- **Overlay layout:** Overlay and textarea must share identical `fontFamily`, `fontSize`, `lineHeight`, `padding` — any mismatch causes underlines to misalign with text.
```

**Step 2: Commit and push**

```bash
git add CLAUDE.md
git commit -m "docs: document CMS/ICD-10 terminology feature in CLAUDE.md"
git push
```

---

## Test Coverage Summary

| File | New tests |
|---|---|
| `src/lib/cms-terms.test.ts` | 6 |
| `src/hooks/useCodingHighlights.test.ts` | 12 |
| `src/components/scribe-standalone/CodingTermPopover.test.tsx` | 6 |
| `src/components/scribe-standalone/NoteSectionEditor.test.tsx` | 7 |
| `backend/src/routes/scribeAi.test.ts` | 4 |
| **Total** | **35** |
