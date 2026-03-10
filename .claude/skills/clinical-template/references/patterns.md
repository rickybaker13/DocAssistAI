# Clinical Template Patterns — Code Reference

Exact code patterns from the DocAssistAI codebase for adding note types and sections.

---

## 1. Adding a New Note Type

### File: `backend/src/database/systemNoteTemplates.ts`

**Step 1a — Extend the noteType union:**

```typescript
// Current interface (line 3-8):
export interface SystemNoteTemplate {
  noteType: 'progress_note' | 'h_and_p' | 'transfer_note' | 'accept_note' | 'consult_note' | 'discharge_summary' | 'procedure_note';
  //        ^^^^^^^^^^^^^ add new value here, e.g.: | 'anesthesia_preop'
  name: string;
  verbosity: 'brief' | 'standard' | 'detailed';
  sections: Array<{ name: string; promptHint: string | null }>;
}
```

**Step 1b — (Optional) Add template-based constant if needed:**

Existing pattern (lines 10-11):
```typescript
const PE_PROMPT_HINT = `TEMPLATE-BASED SECTION. Start with this normal exam template and replace any system findings mentioned in the transcript with the actual patient findings. Keep normal findings for any system not addressed in the transcript.\n\n${PHYSICAL_EXAM_DEFAULT}`;
const ROS_PROMPT_HINT = `TEMPLATE-BASED SECTION. Start with this negative ROS template and replace any system that has positive findings mentioned in the transcript with the actual positives. Keep negative findings for any system not addressed in the transcript.\n\n${REVIEW_OF_SYSTEMS_DEFAULT}`;
```

New constant example (e.g., for Airway Assessment):
```typescript
const AIRWAY_ASSESSMENT_PROMPT_HINT = `TEMPLATE-BASED SECTION. Start with this normal airway assessment template and replace any findings mentioned in the transcript with the actual patient findings. Keep normal findings for any item not addressed in the transcript.\n\n${AIRWAY_ASSESSMENT_DEFAULT}`;
```

If you add a new default, you must also import it:
```typescript
import { PHYSICAL_EXAM_DEFAULT, REVIEW_OF_SYSTEMS_DEFAULT, AIRWAY_ASSESSMENT_DEFAULT } from './prebuiltSections.js';
```

**Step 1c — Add template to SYSTEM_NOTE_TEMPLATES array:**

Example — procedure_note (the most fully-featured existing template):
```typescript
  {
    noteType: 'procedure_note',
    name: 'Standard Procedure Note',
    verbosity: 'standard',
    sections: [
      { name: 'Procedure Details', promptHint: 'Procedure name, date, operator, assistant' },
      { name: 'Indication', promptHint: null },
      { name: 'Pre-procedure Assessment', promptHint: 'Consent, time-out, patient status before procedure' },
      { name: 'Procedure Description', promptHint: 'Step-by-step description of the procedure performed' },
      { name: 'Post-procedure Assessment', promptHint: 'Immediate patient status and findings after procedure' },
      { name: 'Complications', promptHint: 'Any complications encountered; if none write "No immediate complications"' },
    ],
  },
```

Example — a new anesthesia preop note:
```typescript
  {
    noteType: 'anesthesia_preop',
    name: 'Anesthesia Preoperative Evaluation',
    verbosity: 'standard',
    sections: [
      { name: 'Surgical Procedure', promptHint: 'Planned procedure, surgeon, date, surgical site/side' },
      { name: 'HPI', promptHint: 'History of Present Illness — reason for surgery, symptom timeline' },
      { name: 'Past Medical History', promptHint: null },
      { name: 'Past Surgical/Anesthetic History', promptHint: 'Prior surgeries, anesthetic complications, difficult airway history, PONV, MH risk' },
      { name: 'Medications', promptHint: null },
      { name: 'Allergies', promptHint: null },
      { name: 'Airway Assessment', promptHint: 'Mallampati class, thyromental distance, neck ROM, mouth opening, dentition, BMI, OSA screening' },
      { name: 'Physical Exam', promptHint: PE_PROMPT_HINT },
      { name: 'Review of Systems', promptHint: ROS_PROMPT_HINT },
      { name: 'Pre-op Labs & Studies', promptHint: 'CBC, BMP, coags, ECG, CXR, type & screen — results and relevance' },
      { name: 'ASA Physical Status', promptHint: 'ASA classification (I-VI) with justification' },
      { name: 'Anesthetic Plan', promptHint: 'Planned anesthetic technique (GA, regional, MAC), monitors, access, special considerations' },
      { name: 'Informed Consent', promptHint: 'Risks discussed (awareness, nerve injury, PONV, transfusion), patient understanding confirmed' },
    ],
  },
```

### File: `src/components/scribe-standalone/NoteBuilderPage.tsx`

Add to the NOTE_TYPES array (line 13-21):
```typescript
const NOTE_TYPES = [
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'h_and_p', label: 'H&P' },
  { value: 'transfer_note', label: 'Transfer Note' },
  { value: 'accept_note', label: 'Accept Note' },
  { value: 'consult_note', label: 'Consult Note' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'procedure_note', label: 'Procedure Note' },
  // ADD NEW ENTRY HERE:
  { value: 'anesthesia_preop', label: 'Anesthesia Preop Evaluation' },
];
```

### File: `src/components/scribe-standalone/TemplatesPage.tsx`

Same format, same position (line 9-17):
```typescript
const NOTE_TYPES = [
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'h_and_p', label: 'H&P' },
  { value: 'transfer_note', label: 'Transfer Note' },
  { value: 'accept_note', label: 'Accept Note' },
  { value: 'consult_note', label: 'Consult Note' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'procedure_note', label: 'Procedure Note' },
  // ADD NEW ENTRY HERE (must match NoteBuilderPage):
  { value: 'anesthesia_preop', label: 'Anesthesia Preop Evaluation' },
];
```

---

## 2. Adding a New Section

### File: `backend/src/database/prebuiltSections.ts`

**Interface:**
```typescript
export interface PrebuiltSection {
  name: string;
  promptHint: string | null;
  category: string;
  disciplines: string[];
}
```

**Discipline constants:**
```typescript
const PHYSICIAN_DISCIPLINES = [
  'hospital_medicine', 'critical_care', 'emergency_medicine',
  'surgery', 'psychiatry', 'outpatient', 'specialty_medicine',
];

const ICU_DISCIPLINES = ['critical_care', 'surgery', 'emergency_medicine'];
```

Create a new constant if the disciplines don't fit existing ones:
```typescript
const ANESTHESIA_DISCIPLINES = ['surgery', 'critical_care', 'specialty_medicine'];
```

**Adding a section — place it in the correct category comment block:**
```typescript
  // ─── Specialty ───────────────────────────────────────────────────────────
  { name: 'Procedure Details',        promptHint: null, category: 'specialty', disciplines: ['surgery', 'critical_care', 'specialty_medicine', 'emergency_medicine'] },
  // ... existing entries ...
  // ADD NEW ENTRY in the correct category block:
  { name: 'Airway Assessment',        promptHint: 'Mallampati class, thyromental distance, neck ROM, mouth opening, dentition, BMI, OSA screening', category: 'specialty', disciplines: ANESTHESIA_DISCIPLINES },
```

**Existing categories and where to add:**
```
// ─── General ──────────────────────────────────────────────────────────────
// ─── ICU / Critical Care ─────────────────────────────────────────────────
// ─── Specialty ───────────────────────────────────────────────────────────
// ─── Body Systems ─────────────────────────────────────────────────────────
// ─── Physical Therapy ────────────────────────────────────────────────────
// ─── Occupational Therapy ────────────────────────────────────────────────
// ─── Speech-Language Pathology ───────────────────────────────────────────
// ─── Respiratory Therapy ─────────────────────────────────────────────────
// ─── Case Management / Social Work ───────────────────────────────────────
// ─── Nutrition & Dietetics ────────────────────────────────────────────────
```

---

## 3. Adding Template-Based Default Content

Only for sections with a well-established "normal baseline" where clinicians document by exception.

### File: `backend/src/database/prebuiltSections.ts`

Export the default content constant (placed near the top, after existing defaults):
```typescript
export const AIRWAY_ASSESSMENT_DEFAULT = `Mallampati: Class I. Full visibility of soft palate, fauces, uvula, tonsillar pillars.
Thyromental Distance: >6 cm (3 fingerbreadths).
Neck Mobility: Full range of motion, adequate extension.
Mouth Opening: >4 cm (3 fingerbreadths).
Dentition: Intact, no loose or prominent teeth. No dental prosthetics.
BMI: Within normal limits.
OSA Screening: STOP-BANG score < 3, low risk.
Overall: No predictors of difficult airway identified.`;
```

Then in the PREBUILT_SECTIONS array entry, reference it with the template marker:
```typescript
{ name: 'Airway Assessment', promptHint: `TEMPLATE-BASED SECTION. Start with this normal airway assessment template and replace any findings mentioned in the transcript with the actual patient findings. Keep normal findings for any item not addressed in the transcript.\n\n${AIRWAY_ASSESSMENT_DEFAULT}`, category: 'specialty', disciplines: ANESTHESIA_DISCIPLINES },
```

### File: `src/lib/sectionDefaults.ts`

Duplicate the default content for frontend prepopulation:
```typescript
export const AIRWAY_ASSESSMENT_DEFAULT = `Mallampati: Class I. Full visibility of soft palate, fauces, uvula, tonsillar pillars.
Thyromental Distance: >6 cm (3 fingerbreadths).
Neck Mobility: Full range of motion, adequate extension.
Mouth Opening: >4 cm (3 fingerbreadths).
Dentition: Intact, no loose or prominent teeth. No dental prosthetics.
BMI: Within normal limits.
OSA Screening: STOP-BANG score < 3, low risk.
Overall: No predictors of difficult airway identified.`;
```

Add to the SECTION_DEFAULT_CONTENT map:
```typescript
export const SECTION_DEFAULT_CONTENT: Record<string, string> = {
  'Physical Exam': PHYSICAL_EXAM_DEFAULT,
  'Review of Systems': REVIEW_OF_SYSTEMS_DEFAULT,
  'Airway Assessment': AIRWAY_ASSESSMENT_DEFAULT,  // <-- add here
};
```

---

## 4. Existing Sections Reference

These sections already exist in `prebuiltSections.ts`. Reuse them by name — do NOT create duplicates:

**General:** Chief Complaint, HPI, Past Medical History, Social History, Family History, Medications, Allergies, Review of Systems, Vital Signs, Physical Exam, Assessment, Plan, Disposition

**ICU:** Sedation & Analgesia, Ventilator Management, Vasopressor Status, Lines & Drains, Infectious Disease, Renal & Fluid Balance, Nutrition & GI, Goals of Care, Code Status, Overnight Events, Pending Studies

**Specialty:** Procedure Details, Operative Findings, Discharge Instructions, Follow-up Plan, Consult Recommendations, Reason for Transfer

**Body Systems:** Cardiovascular, Pulmonary, Neurological, Psychiatric, Dermatologic, Ophthalmologic, GYN/OB, Urologic, Endocrine

**Physical Therapy:** Functional Status, Range of Motion, Strength Assessment, Balance & Fall Risk, Gait Assessment, Rehabilitation Goals, Treatment Plan (Rehab), Home Exercise Program, DME/Equipment Recommendations

**Occupational Therapy:** Occupational Profile, ADL Assessment, Cognitive Assessment, Upper Extremity Function, Home Modification Plan, Caregiver Training

**Speech-Language Pathology:** Communication Assessment, Swallowing Assessment, Oral Motor Exam, Diet/Texture Recommendations, Voice Assessment

**Respiratory Therapy:** Respiratory Assessment (RT), Oxygenation Status, Airway Management, Inhaled Medication Plan, Ventilator Weaning

**Case Management:** Social Assessment, Insurance/Payor Status, Discharge Planning, Post-Acute Care Options, Community Resources, Care Coordination Notes

**Nutrition:** Nutritional Assessment, Dietary Recommendations

---

## 5. Checklists

### New Note Type Checklist

- [ ] Research completed — clinical standards, billing requirements, specialty guidelines
- [ ] Existing sections reused where applicable (checked `prebuiltSections.ts`)
- [ ] Extended `noteType` union in `SystemNoteTemplate` interface (`systemNoteTemplates.ts`)
- [ ] Added template object to `SYSTEM_NOTE_TEMPLATES` array (`systemNoteTemplates.ts`)
- [ ] Added to `NOTE_TYPES` in `NoteBuilderPage.tsx`
- [ ] Added to `NOTE_TYPES` in `TemplatesPage.tsx`
- [ ] (If template-based defaults) Added default exports to `prebuiltSections.ts` and `sectionDefaults.ts`
- [ ] Backend type-check passes: `cd backend && npx tsc --noEmit`
- [ ] Frontend type-check passes: `npx tsc --noEmit`
- [ ] Tests pass

### New Section Checklist

- [ ] Research completed — what this section should contain
- [ ] Confirmed section doesn't already exist in `prebuiltSections.ts`
- [ ] Added to `PREBUILT_SECTIONS` array in correct category block (`prebuiltSections.ts`)
- [ ] (If template-based) Added default exports to `prebuiltSections.ts` and `sectionDefaults.ts`
- [ ] Backend type-check passes
- [ ] Tests pass
