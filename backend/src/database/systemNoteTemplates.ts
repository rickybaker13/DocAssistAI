export interface SystemNoteTemplate {
  noteType: 'progress_note' | 'h_and_p' | 'transfer_note' | 'accept_note' | 'consult_note' | 'discharge_summary' | 'procedure_note';
  name: string;
  verbosity: 'brief' | 'standard' | 'detailed';
  sections: Array<{ name: string; promptHint: string | null }>;
}

export const SYSTEM_NOTE_TEMPLATES: SystemNoteTemplate[] = [
  {
    noteType: 'progress_note',
    name: 'Standard SOAP Note',
    verbosity: 'standard',
    sections: [
      { name: 'Subjective', promptHint: 'Patient-reported symptoms, complaints, interval history since last visit' },
      { name: 'Objective', promptHint: 'Vital signs, physical exam findings, labs, imaging' },
      { name: 'Assessment', promptHint: 'Clinical impression, problem list, differential diagnosis' },
      { name: 'Plan', promptHint: 'Treatment plan, medications, follow-up, consults ordered' },
    ],
  },
  {
    noteType: 'h_and_p',
    name: 'Standard H&P',
    verbosity: 'standard',
    sections: [
      { name: 'Chief Complaint', promptHint: null },
      { name: 'HPI', promptHint: 'History of Present Illness — onset, duration, character, severity, context' },
      { name: 'Past Medical History', promptHint: null },
      { name: 'Medications', promptHint: null },
      { name: 'Allergies', promptHint: null },
      { name: 'Social History', promptHint: null },
      { name: 'Family History', promptHint: null },
      { name: 'Review of Systems', promptHint: null },
      { name: 'Physical Exam', promptHint: null },
      { name: 'Assessment', promptHint: null },
      { name: 'Plan', promptHint: null },
    ],
  },
  {
    noteType: 'transfer_note',
    name: 'Standard Transfer Note',
    verbosity: 'standard',
    sections: [
      { name: 'Reason for Transfer', promptHint: null },
      { name: 'Clinical Summary', promptHint: 'Brief summary of admission diagnosis, hospital course, key events' },
      { name: 'Active Problems', promptHint: null },
      { name: 'Medications', promptHint: null },
      { name: 'Pending Studies', promptHint: 'Labs, imaging, cultures, consults not yet resulted' },
      { name: 'Disposition', promptHint: null },
    ],
  },
  {
    noteType: 'accept_note',
    name: 'Standard Accept Note',
    verbosity: 'standard',
    sections: [
      { name: 'Reason for Admission', promptHint: null },
      { name: 'HPI', promptHint: 'History of Present Illness' },
      { name: 'Past Medical History', promptHint: null },
      { name: 'Medications', promptHint: null },
      { name: 'Allergies', promptHint: null },
      { name: 'Assessment', promptHint: null },
      { name: 'Plan', promptHint: null },
    ],
  },
  {
    noteType: 'consult_note',
    name: 'Standard Consult Note',
    verbosity: 'standard',
    sections: [
      { name: 'Reason for Consult', promptHint: null },
      { name: 'HPI', promptHint: null },
      { name: 'Past Medical History', promptHint: null },
      { name: 'Physical Exam', promptHint: null },
      { name: 'Assessment', promptHint: 'Consult impression and differential' },
      { name: 'Consult Recommendations', promptHint: null },
    ],
  },
  {
    noteType: 'discharge_summary',
    name: 'Standard Discharge Summary',
    verbosity: 'standard',
    sections: [
      { name: 'Admission Diagnosis', promptHint: null },
      { name: 'Hospital Course', promptHint: 'Chronological summary of key events, interventions, and response to treatment' },
      { name: 'Discharge Diagnosis', promptHint: null },
      { name: 'Medications', promptHint: 'Discharge medication list with any changes from admission' },
      { name: 'Discharge Instructions', promptHint: null },
      { name: 'Follow-up Plan', promptHint: null },
    ],
  },
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
];
