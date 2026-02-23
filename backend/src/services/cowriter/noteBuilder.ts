/**
 * Co-Writer Note Builder
 * Builds structured prompts for chart-grounded clinical note generation
 */

export const NOTE_SECTION_PROMPTS: Record<string, string[]> = {
  'Progress Note': ['Subjective', 'Objective', 'Assessment', 'Plan'],
  'H&P': ['Chief Complaint', 'History of Present Illness', 'Past Medical History', 'Medications', 'Allergies', 'Review of Systems', 'Physical Exam', 'Assessment', 'Plan'],
  'Transfer Note': ['Reason for Transfer', 'Hospital Course', 'Current Clinical Status', 'Active Problems', 'Current Medications', 'Pending Items', 'Disposition'],
  'Accept Note': ['Reason for Consultation', 'Pertinent History', 'Current Data Review', 'Assessment', 'Recommendations'],
  'Consult Note': ['Reason for Consultation', 'History', 'Relevant Data', 'Assessment', 'Recommendations'],
  'Discharge Summary': ['Admission Diagnosis', 'Hospital Course', 'Discharge Diagnosis', 'Discharge Condition', 'Discharge Medications', 'Follow-up Instructions'],
  'Procedure Note': ['Procedure', 'Indication', 'Technique', 'Findings', 'Complications', 'Plan'],
};

export function buildCoWriterPrompt(
  noteType: string,
  timelineData: string,
  additionalContext?: string
): string {
  const sections = NOTE_SECTION_PROMPTS[noteType] || NOTE_SECTION_PROMPTS['Progress Note'];

  return `You are a critical care physician AI assistant writing a ${noteType}.

Generate each section using ONLY the patient chart data provided below.
For each factual claim, append a brief citation: [Lab: <name> <value> <timestamp>] or [Vital: <name> <value> <timestamp>] or [Note: <type> <timestamp>].
Write in standard medical prose. Be clinically precise and concise.
If a section lacks sufficient data, write "Insufficient data available" for that section.

REQUIRED SECTIONS: ${sections.join(', ')}

PATIENT CHART DATA:
${timelineData}

${additionalContext ? `ADDITIONAL CLINICIAN CONTEXT:\n${additionalContext}` : ''}

Return JSON with this exact structure:
{
  "noteType": "${noteType}",
  "sections": [
    { "name": "Section Name", "content": "Section text with inline citations", "sources": ["source1", "source2"] }
  ],
  "generatedAt": "<ISO timestamp>"
}`;
}
