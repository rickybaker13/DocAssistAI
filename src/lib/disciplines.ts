/** Canonical discipline options — used by registration, settings, and section library filtering.
 *  `value` must match the snake_case keys in prebuiltSections.ts disciplines arrays. */
export const DISCIPLINE_OPTIONS: { value: string; label: string }[] = [
  { value: 'hospital_medicine',     label: 'Hospital Medicine' },
  { value: 'critical_care',         label: 'Critical Care / ICU' },
  { value: 'emergency_medicine',    label: 'Emergency Medicine' },
  { value: 'surgery',               label: 'Surgery' },
  { value: 'psychiatry',            label: 'Psychiatry' },
  { value: 'outpatient',            label: 'Outpatient / Primary Care' },
  { value: 'specialty_medicine',    label: 'Specialty Medicine' },
  { value: 'physical_therapy',      label: 'Physical Therapy' },
  { value: 'occupational_therapy',  label: 'Occupational Therapy' },
  { value: 'speech_pathology',      label: 'Speech-Language Pathology' },
  { value: 'respiratory_therapy',   label: 'Respiratory Therapy' },
  { value: 'case_management',       label: 'Case Management / Social Work' },
  { value: 'nutrition_dietetics',   label: 'Nutrition & Dietetics' },
];
