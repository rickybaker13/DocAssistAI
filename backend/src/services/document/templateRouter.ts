/**
 * Template Router (Pattern 2: Routing)
 * Routes document generation requests to appropriate templates
 * based on user role, service, and note type
 */

export interface UserContext {
  userId?: string;
  role: 'MD' | 'NP' | 'PA' | 'RN' | 'PT' | 'ST' | 'RT' | 'WC' | 'PC' | 'CH' | 'OTHER';
  service?: string; // e.g., 'Internal Medicine', 'Cardiology', 'Physical Therapy'
  name?: string; // e.g., 'Dr. Smith', 'NP Martinez'
}

export interface DocumentRequest {
  noteType: 'h_and_p' | 'progress_note' | 'procedure_note' | 'accept_note' | 'discharge_summary' | 'consult_note';
  userContext: UserContext;
  patientId: string;
  date?: string;
}

export interface Template {
  id: string;
  name: string;
  noteType: DocumentRequest['noteType'];
  role: UserContext['role'][];
  service?: string; // Optional: service-specific template
  provider?: string; // Optional: provider-specific template
  sections: string[];
  structure: string; // Template structure/format
}

export class TemplateRouter {
  private templates: Template[] = [];
  private learnedTemplates: Template[] = [];

  constructor() {
    this.loadTemplates();
  }

  /**
   * Add learned templates to router
   */
  addLearnedTemplates(learned: Template[]): void {
    this.learnedTemplates = learned;
    console.log(`[Template Router] Added ${learned.length} learned templates`);
  }

  /**
   * Clear learned templates
   */
  clearLearnedTemplates(): void {
    this.learnedTemplates = [];
  }

  /**
   * Get all templates (hardcoded + learned)
   */
  getAllTemplates(): Template[] {
    return [...this.templates, ...this.learnedTemplates];
  }

  /**
   * Route document request to appropriate template
   * Priority: Learned templates > Hardcoded templates
   */
  route(request: DocumentRequest): Template {
    // First, try learned templates
    if (this.learnedTemplates.length > 0) {
      // Try provider-specific learned template
      if (request.userContext.name) {
        const learnedProviderTemplate = this.learnedTemplates.find(
          t => t.noteType === request.noteType &&
          t.provider === request.userContext.name &&
          (t.role.includes(request.userContext.role) || t.role.length === 0)
        );
        if (learnedProviderTemplate) {
          console.log(`[Template Router] Using learned provider-specific template: ${learnedProviderTemplate.id}`);
          return learnedProviderTemplate;
        }
      }

      // Try service-specific learned template
      if (request.userContext.service) {
        const learnedServiceTemplate = this.learnedTemplates.find(
          t => t.noteType === request.noteType &&
          t.service === request.userContext.service &&
          (t.role.includes(request.userContext.role) || t.role.length === 0)
        );
        if (learnedServiceTemplate) {
          console.log(`[Template Router] Using learned service-specific template: ${learnedServiceTemplate.id}`);
          return learnedServiceTemplate;
        }
      }

      // Try role-specific learned template
      const learnedRoleTemplate = this.learnedTemplates.find(
        t => t.noteType === request.noteType &&
        t.role.includes(request.userContext.role) &&
        !t.service &&
        !t.provider
      );
      if (learnedRoleTemplate) {
        console.log(`[Template Router] Using learned role-specific template: ${learnedRoleTemplate.id}`);
        return learnedRoleTemplate;
      }
    }

    // Fallback to hardcoded templates
    // First, try to find provider-specific template
    if (request.userContext.name) {
      const providerTemplate = this.templates.find(
        t => t.noteType === request.noteType &&
        t.provider === request.userContext.name &&
        (t.role.includes(request.userContext.role) || t.role.length === 0)
      );
      if (providerTemplate) {
        console.log(`[Template Router] Using provider-specific template: ${providerTemplate.id}`);
        return providerTemplate;
      }
    }

    // Then, try service-specific template
    if (request.userContext.service) {
      const serviceTemplate = this.templates.find(
        t => t.noteType === request.noteType &&
        t.service === request.userContext.service &&
        (t.role.includes(request.userContext.role) || t.role.length === 0)
      );
      if (serviceTemplate) {
        console.log(`[Template Router] Using service-specific template: ${serviceTemplate.id}`);
        return serviceTemplate;
      }
    }

    // Finally, use role-specific default template
    const roleTemplate = this.templates.find(
      t => t.noteType === request.noteType &&
      t.role.includes(request.userContext.role) &&
      !t.service &&
      !t.provider
    );
    if (roleTemplate) {
      console.log(`[Template Router] Using role-specific template: ${roleTemplate.id}`);
      return roleTemplate;
    }

    // Fallback to generic template
    const genericTemplate = this.templates.find(
      t => t.noteType === request.noteType &&
      t.role.length === 0 &&
      !t.service &&
      !t.provider
    );
    if (genericTemplate) {
      console.log(`[Template Router] Using generic template: ${genericTemplate.id}`);
      return genericTemplate;
    }

    throw new Error(`No template found for note type: ${request.noteType}, role: ${request.userContext.role}`);
  }

  /**
   * Get all templates for a note type
   */
  getTemplatesForNoteType(noteType: DocumentRequest['noteType']): Template[] {
    return this.templates.filter(t => t.noteType === noteType);
  }

  /**
   * Load templates (in real implementation, this would load from database/config)
   */
  private loadTemplates(): void {
    // Generic templates
    this.templates.push(
      // H&P Templates
      {
        id: 'hp-generic',
        name: 'Generic History & Physical',
        noteType: 'h_and_p',
        role: [],
        sections: ['Chief Complaint', 'History of Present Illness', 'Review of Systems', 'Past Medical History', 'Medications', 'Allergies', 'Physical Examination', 'Assessment and Plan'],
        structure: `HISTORY AND PHYSICAL

CHIEF COMPLAINT:
{chief_complaint}

HISTORY OF PRESENT ILLNESS:
{history_of_present_illness}

REVIEW OF SYSTEMS:
{review_of_systems}

PAST MEDICAL HISTORY:
{past_medical_history}

MEDICATIONS:
{medications}

ALLERGIES:
{allergies}

PHYSICAL EXAMINATION:
{physical_examination}

ASSESSMENT AND PLAN:
{assessment_and_plan}`,
      },
      // Progress Note Templates
      {
        id: 'progress-generic',
        name: 'Generic Progress Note',
        noteType: 'progress_note',
        role: [],
        sections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
        structure: `PROGRESS NOTE

SUBJECTIVE:
{subjective}

OBJECTIVE:
{objective}

ASSESSMENT:
{assessment}

PLAN:
{plan}`,
      },
      // MD/NP/PA Templates
      {
        id: 'progress-md-np-pa',
        name: 'MD/NP/PA Progress Note',
        noteType: 'progress_note',
        role: ['MD', 'NP', 'PA'],
        sections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
        structure: `PROGRESS NOTE

SUBJECTIVE:
Patient reports: {subjective}

OBJECTIVE:
Vitals: {vitals}
Labs: {labs}
Imaging: {imaging}
Physical Exam: {physical_exam}

ASSESSMENT:
{assessment}

PLAN:
{plan}`,
      },
      // Physical Therapy Template
      {
        id: 'progress-pt',
        name: 'Physical Therapy Progress Note',
        noteType: 'progress_note',
        role: ['PT'],
        service: 'Physical Therapy',
        sections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
        structure: `PHYSICAL THERAPY PROGRESS NOTE

SUBJECTIVE:
Patient reports: {subjective}

OBJECTIVE:
Vital Signs: {vitals}
Range of Motion: {rom}
Strength: {strength}
Functional Assessment: {functional_assessment}
Treatment Provided: {treatment_provided}

ASSESSMENT:
{assessment}

PLAN:
{plan}`,
      },
      // Speech Therapy Template
      {
        id: 'progress-st',
        name: 'Speech Therapy Progress Note',
        noteType: 'progress_note',
        role: ['ST'],
        service: 'Speech Therapy',
        sections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
        structure: `SPEECH THERAPY PROGRESS NOTE

SUBJECTIVE:
Patient reports: {subjective}

OBJECTIVE:
Swallow Assessment: {swallow_assessment}
Speech Assessment: {speech_assessment}
Cognitive Assessment: {cognitive_assessment}
Treatment Provided: {treatment_provided}

ASSESSMENT:
{assessment}

PLAN:
{plan}`,
      },
      // Respiratory Therapy Template
      {
        id: 'progress-rt',
        name: 'Respiratory Therapy Progress Note',
        noteType: 'progress_note',
        role: ['RT'],
        service: 'Respiratory Therapy',
        sections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
        structure: `RESPIRATORY THERAPY PROGRESS NOTE

SUBJECTIVE:
Patient reports: {subjective}

OBJECTIVE:
Respiratory Rate: {respiratory_rate}
Oxygen Saturation: {oxygen_saturation}
Ventilator Settings: {ventilator_settings}
Breath Sounds: {breath_sounds}
Treatment Provided: {treatment_provided}

ASSESSMENT:
{assessment}

PLAN:
{plan}`,
      },
      // Wound Care Template
      {
        id: 'progress-wc',
        name: 'Wound Care Progress Note',
        noteType: 'progress_note',
        role: ['WC'],
        service: 'Wound Care',
        sections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
        structure: `WOUND CARE PROGRESS NOTE

SUBJECTIVE:
Patient reports: {subjective}

OBJECTIVE:
Wound Location: {wound_location}
Wound Size: {wound_size}
Wound Appearance: {wound_appearance}
Drainage: {drainage}
Treatment Provided: {treatment_provided}

ASSESSMENT:
{assessment}

PLAN:
{plan}`,
      },
      // Discharge Summary Template
      {
        id: 'discharge-generic',
        name: 'Generic Discharge Summary',
        noteType: 'discharge_summary',
        role: [],
        sections: ['Admission Diagnosis', 'Discharge Diagnosis', 'Hospital Course', 'Discharge Medications', 'Discharge Instructions', 'Follow-up'],
        structure: `DISCHARGE SUMMARY

ADMISSION DIAGNOSIS:
{admission_diagnosis}

DISCHARGE DIAGNOSIS:
{discharge_diagnosis}

HOSPITAL COURSE:
{hospital_course}

DISCHARGE MEDICATIONS:
{discharge_medications}

DISCHARGE INSTRUCTIONS:
{discharge_instructions}

FOLLOW-UP:
{follow_up}`,
      },
      // Accept Note Template
      {
        id: 'accept-generic',
        name: 'Generic Accept Note',
        noteType: 'accept_note',
        role: [],
        sections: ['Reason for Transfer', 'Current Status', 'Assessment', 'Plan'],
        structure: `ACCEPT NOTE

REASON FOR TRANSFER:
{reason_for_transfer}

CURRENT STATUS:
{current_status}

ASSESSMENT:
{assessment}

PLAN:
{plan}`,
      }
    );

    // Provider-specific templates (mock examples)
    this.templates.push(
      {
        id: 'progress-dr-smith',
        name: 'Dr. Smith Progress Note Template',
        noteType: 'progress_note',
        role: ['MD'],
        provider: 'Dr. Smith',
        sections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
        structure: `PROGRESS NOTE - Internal Medicine

SUBJECTIVE:
Patient reports: {subjective}

OBJECTIVE:
Vitals: {vitals}
Labs: {labs}
Imaging: {imaging}

ASSESSMENT:
{assessment}

PLAN:
{plan}

Dr. Smith, MD
Internal Medicine`,
      },
      {
        id: 'progress-np-martinez',
        name: 'NP Martinez Progress Note Template',
        noteType: 'progress_note',
        role: ['NP'],
        provider: 'NP Martinez',
        sections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
        structure: `PROGRESS NOTE

SUBJECTIVE:
{subjective}

OBJECTIVE:
{objective}

ASSESSMENT:
{assessment}

PLAN:
{plan}

NP Martinez, NP
Reviewed by: {supervising_physician}`,
      }
    );
  }
}

export const templateRouter = new TemplateRouter();

