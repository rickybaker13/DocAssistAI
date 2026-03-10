---
name: clinical-template
description: >-
  Use when the user asks to "add a note type", "create a clinical template",
  "add a section", "build a note template", "new note type", or requests
  specialty-specific notes like "anesthesia preop evaluation", "labor epidural
  note", "difficult airway note", "wound care section", "dermatology procedure
  note". Also triggered by "what sections should a ___ note have" or similar
  clinical documentation design questions.
version: 0.1.0
---

# Clinical Template Builder

Create new clinical note types and reusable sections for DocAssistAI's medical scribe, backed by real-world clinical documentation standards and specialty society guidelines.

## Why This Exists

Users will request note types and sections specific to their specialty. An anesthesiology group needs preop evaluations, labor epidural notes, and difficult airway documentation. A wound care team needs different sections than an ICU team. Getting these right requires understanding clinical documentation standards, billing compliance requirements, and what experienced clinicians actually document. This skill handles the research and implementation together.

## Step 1: Classify the Request

Determine what the user is asking for:

- **New note type** — A complete template with an ordered list of sections (e.g., "anesthesia preop evaluation note"). Keywords: "note", "note type", "template"
- **New section** — A single reusable section for the section library (e.g., "airway assessment section"). Keywords: "section", "add a section"
- **Ambiguous** — Ask the user: "Do you want a complete note template (with all its sections), or a single section to add to existing templates?"

## Step 2: Research (Mandatory)

**Never skip this step.** Clinical documentation has specific requirements for billing, compliance, medicolegal protection, and specialty standards that cannot be invented from first principles.

### What to Search For

Run multiple web searches to build a complete picture:

1. **Clinical documentation standards:**
   - `"{note type}" clinical documentation requirements 2026`
   - `"{note type}" note template sections medical documentation`
   - `"{specialty}" documentation standards {professional society}` (e.g., "ASA documentation standards" for anesthesia)

2. **Billing and compliance requirements:**
   - `"{note type}" CMS billing documentation elements`
   - `"{note type}" medical decision making documentation requirements`
   - `"{specialty}" E/M documentation guidelines`

3. **Real-world examples:**
   - `"{note type}" EHR template example`
   - `"{note type}" clinical documentation checklist`
   - `"{specialty}" note template sections best practices`

### Trusted Source Hierarchy

Prefer sources in this order:
1. **CMS / Joint Commission** — Official regulatory requirements
2. **Specialty society guidelines** — ASA, ACS, AHA, ACOG, AAP, AAFP, etc.
3. **Academic medical center standards** — Documentation guidelines from teaching hospitals
4. **EHR vendor documentation** — Epic, Cerner, Meditech template galleries
5. **Peer-reviewed literature** — Documentation quality studies

### What to Extract from Research

For each section in the note type, document:
- **Required elements** — Must be present for billing/compliance
- **Standard elements** — Expected by clinicians, best practice
- **Optional elements** — Specialty-specific or situational
- **Standard terminology** — Correct clinical vocabulary (e.g., "Mallampati classification" not "mouth opening score")
- **Assessment tools/scores** — Specific instruments referenced in documentation (e.g., ASA Physical Status, Aldrete Score, RASS)

## Step 3: Check for Existing Sections

Before creating anything, check what already exists:

```bash
# See all existing prebuilt sections
grep -n "name:" /Users/bitbox/Documents/DocAssistAI/backend/src/database/prebuiltSections.ts | grep "'"
```

**Reuse existing sections.** If the new note type needs "Medications", "Allergies", "Assessment", "Physical Exam", etc. — use the exact same `name` and `promptHint` as the existing prebuilt section. Do NOT create duplicates.

## Step 4: Design

### For a New Note Type

1. **`noteType` slug** — snake_case, concise (e.g., `anesthesia_preop`, `labor_epidural`, `wound_care`)
2. **`name`** — Human-readable display name (e.g., "Anesthesia Preoperative Evaluation")
3. **`verbosity`** — Almost always `'standard'` unless the note type is inherently brief
4. **Sections array** — Ordered list of `{ name, promptHint }` objects:
   - Order sections in the clinical workflow sequence (history → exam → assessment → plan)
   - Reuse existing section names where they match (see Step 3)
   - Write new promptHints only for specialty-specific sections

### For a New Section

1. **`name`** — Title case, concise (e.g., "Airway Assessment", "Wound Description")
2. **`category`** — One of: `general`, `icu`, `specialty`, `body_systems`, `physical_therapy`, `occupational_therapy`, `speech_language_pathology`, `respiratory_therapy`, `case_management`, `nutrition_dietetics`. If none fit, use `specialty`.
3. **`disciplines`** — Array from: `hospital_medicine`, `critical_care`, `emergency_medicine`, `surgery`, `psychiatry`, `outpatient`, `specialty_medicine`, `physical_therapy`, `occupational_therapy`, `speech_language_pathology`, `respiratory_therapy`, `case_management`, `nutrition_dietetics`
4. **`promptHint`** — AI guidance (see rules below)

### promptHint Writing Rules

- Use clinical terminology, not layperson language
- Include specific assessment tools/scores when applicable (e.g., "Mallampati classification, thyromental distance, neck mobility, mouth opening")
- Use noun phrases and comma-separated lists matching the existing terse style
- Keep under 200 characters unless the section is template-based
- The promptHint guides the AI, not the human — no user-facing instructions
- `null` is acceptable for self-explanatory sections (e.g., "Chief Complaint", "Allergies")

### Template-Based Section Decision

Only create template-based default content (the `TEMPLATE-BASED SECTION` pattern) when:
- The section has a well-established "normal baseline" (like Physical Exam = normal exam)
- Clinicians typically document by exception (normal findings assumed, only positives replaced)
- Examples where this makes sense: Physical Exam, Review of Systems, Airway Assessment
- Examples where it does NOT: HPI, Plan, Assessment, Hospital Course (always patient-specific)

## Step 5: Implement

Follow the exact patterns in `references/patterns.md`.

### New Note Type — Files to Modify

**1. `backend/src/database/systemNoteTemplates.ts`**
- Add new value to the `noteType` union in the `SystemNoteTemplate` interface
- Add new template object to the `SYSTEM_NOTE_TEMPLATES` array
- If reusing PE/ROS, reference existing `PE_PROMPT_HINT` / `ROS_PROMPT_HINT` constants
- If new template-based section needed, add a new constant following the same pattern

**2. `src/components/scribe-standalone/NoteBuilderPage.tsx`**
- Add `{ value: 'slug', label: 'Display Name' }` to the `NOTE_TYPES` array

**3. `src/components/scribe-standalone/TemplatesPage.tsx`**
- Add the same entry to this file's `NOTE_TYPES` array (it is duplicated)

**4. (If template-based defaults needed) `src/lib/sectionDefaults.ts`**
- Export new default content constant
- Add to `SECTION_DEFAULT_CONTENT` map

**5. (If template-based defaults needed) `backend/src/database/prebuiltSections.ts`**
- Export new default content constant
- Reference it in the PREBUILT_SECTIONS entry's promptHint

### New Section — Files to Modify

**1. `backend/src/database/prebuiltSections.ts`**
- Add new entry to `PREBUILT_SECTIONS` array in the correct category comment block
- Use an existing discipline constant (`PHYSICIAN_DISCIPLINES`, `ICU_DISCIPLINES`) or create a new one if needed

**2. (If template-based) `src/lib/sectionDefaults.ts`**
- Export default content and add to `SECTION_DEFAULT_CONTENT` map

### EMR-Launch Files (skip unless asked)

These are NOT part of the production Scribe product:
- `src/components/cowriter/CoWriterPanel.tsx` — NOTE_TYPES array
- `src/components/scribe/ScribePanel.tsx` — NOTE_TYPES array + NOTE_TYPE_MAP

## Step 6: Verify

```bash
# Backend type-check (catches noteType union type errors)
cd /Users/bitbox/Documents/DocAssistAI/backend && npx tsc --noEmit

# Frontend type-check
cd /Users/bitbox/Documents/DocAssistAI && npx tsc --noEmit

# Backend tests
cd /Users/bitbox/Documents/DocAssistAI/backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribe" --no-coverage

# Frontend tests
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/
```

## Critical Rules

1. **Research before building.** Never create a note type or section without first researching what it should contain. Clinical accuracy is the entire point of this skill.
2. **Never fabricate clinical content.** If research does not clearly establish what belongs in a section, use `promptHint: null` rather than writing something clinically incorrect. Note this in the output to the user.
3. **Reuse existing sections.** Check `prebuiltSections.ts` before creating any section. "Medications", "Assessment", "Physical Exam", etc. already exist.
4. **Update ALL NOTE_TYPES locations.** The production Scribe has the list in both `NoteBuilderPage.tsx` and `TemplatesPage.tsx`. Missing one causes the note type to not appear in that UI.
5. **Update the TypeScript union.** Adding a new noteType to `SYSTEM_NOTE_TEMPLATES` without extending the `SystemNoteTemplate` interface union will cause a compile error.
6. **Template-based defaults have three touchpoints.** Default content lives in `prebuiltSections.ts` (backend export), `sectionDefaults.ts` (frontend export + map entry), and the promptHint string itself. All three must match.
7. **Present research findings to the user.** Before implementing, summarize what the research found — required sections, standard elements, relevant guidelines — and get user confirmation. The user is the clinician; they may want to adjust.
8. **Consistent formatting.** Match the exact alignment, whitespace, and string quoting style of existing entries in each file.
