# Billing Code Suggestions — Design Document

> Date: 2026-03-08
> Status: Approved

## Problem

Billing code suggestions (ICD-10, CPT, E/M) are now table stakes across AI scribe competitors. Commure includes them in all plans at $59/mo; Freed gates behind $119/mo; Suki charges $299-399/mo. DocAssistAI at $20/mo can offer this as an included feature with minimal additional API cost (~$0.02-0.05/note) since the note content already exists — it's a prompt engineering + UI feature.

Many independent clinicians and small practices handle their own coding. Adding this broadens the target market beyond users whose groups have billing offices.

## Design

### User Setting

- **New toggle in Settings:** "Billing Code Suggestions" — off by default
- **New column:** `billing_codes_enabled BOOLEAN DEFAULT FALSE` on `scribe_users`
- **New endpoints:** `GET /api/scribe/settings` and `PATCH /api/scribe/settings`

### Workflow

1. User enables billing codes in Settings
2. User records encounter → note generates → user reviews/edits sections
3. User clicks "Finalize Note"
4. If `billing_codes_enabled`: auto-fires `POST /api/ai/scribe/billing-codes` with full note content
5. "Billing Codes" tab appears in the note page header with badge showing code count
6. User reviews codes, copies to billing system

### UI Layout

**Desktop (>= md):** Two tabs in note page header: `Note | Billing Codes (7)`
- Clicking "Billing Codes" swaps the main content area in-place (no navigation)
- Tab content shows:
  - **ICD-10 Diagnoses** — code, description, confidence %, supporting note snippet
  - **CPT / E&M** — procedure codes with E/M level and MDM reasoning
  - **Missing Documentation** — warnings about gaps that could strengthen coding
  - **Copy All Codes** button — formatted list to clipboard

**Mobile (< md):** "Billing Codes" tab opens a full-screen sheet/overlay
- Swipe down or X button to return to note
- Same content layout, single-column

### Backend Endpoint

```
POST /api/ai/scribe/billing-codes
Auth: scribeAuthMiddleware + scribeSubscriptionMiddleware

Request:
{
  sections: [{ name: string, content: string }],
  transcript: string,
  noteType: string,
  specialty: string
}

Response:
{
  icd10_codes: [{
    code: string,           // "E11.9"
    description: string,    // "Type 2 diabetes mellitus without complications"
    confidence: number,     // 0.0-1.0
    supporting_text: string // snippet from note that supports this code
  }],
  cpt_codes: [{
    code: string,           // "99223"
    description: string,    // "Initial hospital care, high complexity"
    confidence: number,
    reasoning: string       // MDM complexity justification
  }],
  em_level: {
    suggested: string,      // "99223"
    mdm_complexity: string, // "High"
    reasoning: string       // why this level
  },
  missing_documentation: string[],
  disclaimer: string        // "Suggested codes — clinician review required"
}
```

- **Temperature:** 0.2 (highest precision)
- **PII scrubbing:** follows existing pattern (scrub before AI, re-inject after)
- **Prompt caching:** system prompt with ICD-10/CPT guidelines cached via `cache_control: { type: 'ephemeral' }`
- **Model:** Uses configured AI provider (Anthropic Claude by default)

### State Management

Add to encounter item in `scribeNoteStore`:
```typescript
billingCodes: {
  icd10_codes: BillingCode[];
  cpt_codes: BillingCode[];
  em_level: EMLevel | null;
  missing_documentation: string[];
  disclaimer: string;
} | null;
billingCodesLoading: boolean;
billingCodesError: string | null;
```

Add to `scribeAuthStore` user settings:
```typescript
billing_codes_enabled: boolean;
```

### Files to Create / Modify

**New files:**
- `src/components/scribe-standalone/BillingCodesPanel.tsx` — main codes display component
- `backend/src/routes/scribeSettings.ts` — user settings endpoints (or add to existing auth routes)

**Modified files:**
- `backend/src/routes/scribeAi.ts` — add `/billing-codes` endpoint
- `backend/src/database/migrations.ts` — add `billing_codes_enabled` column
- `backend/src/models/scribeUser.ts` — add field to interface
- `src/components/scribe-standalone/ScribeNotePage.tsx` — add tab UI + trigger on finalize
- `src/stores/scribeNoteStore.ts` — add billing codes state
- `src/components/scribe-standalone/ScribeSettingsPage.tsx` — add toggle
- `backend/src/server.ts` — mount settings route (if new file)

### Prompt Design

System prompt includes:
- ICD-10-CM coding guidelines (laterality, specificity, acute/chronic, 7th character)
- CPT E&M 2021 MDM-based framework (problem complexity, data review, risk)
- Instruction to return structured JSON only
- Instruction to include supporting text snippets from the note
- Instruction to flag missing documentation

### Scope Exclusions (YAGNI)

- No database persistence for extracted codes (client-side only, same as notes)
- No HCC coding
- No modifier suggestions
- No auto-submission to payers (always informational, human-in-the-loop)
- No manual code editing/adding (V1 is read-only suggestions + copy)
- No code history/tracking across encounters

### Cost Impact

- ~$0.02-0.05 per note in additional Claude API cost (short extraction prompt on existing text)
- At 300 encounters/month per user: ~$6-15/month additional cost
- Included in standard $20/mo plan — competitive advantage vs $119-399/mo competitors
