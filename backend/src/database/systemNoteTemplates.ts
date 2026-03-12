import { PHYSICAL_EXAM_DEFAULT, REVIEW_OF_SYSTEMS_DEFAULT } from './prebuiltSections.js';

export interface SystemNoteTemplate {
  noteType: 'progress_note' | 'h_and_p' | 'transfer_note' | 'accept_note' | 'consult_note' | 'discharge_summary' | 'procedure_note';
  name: string;
  verbosity: 'concise' | 'brief' | 'standard' | 'detailed';
  sections: Array<{ name: string; promptHint: string | null }>;
}

const PE_PROMPT_HINT = `TEMPLATE-BASED SECTION. Start with this normal exam template and replace any system findings mentioned in the transcript with the actual patient findings. Keep normal findings for any system not addressed in the transcript.\n\n${PHYSICAL_EXAM_DEFAULT}`;
const ROS_PROMPT_HINT = `TEMPLATE-BASED SECTION. Start with this negative ROS template and replace any system that has positive findings mentioned in the transcript with the actual positives. Keep negative findings for any system not addressed in the transcript.\n\n${REVIEW_OF_SYSTEMS_DEFAULT}`;

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
      { name: 'Review of Systems', promptHint: ROS_PROMPT_HINT },
      { name: 'Physical Exam', promptHint: PE_PROMPT_HINT },
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
      { name: 'Physical Exam', promptHint: PE_PROMPT_HINT },
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
