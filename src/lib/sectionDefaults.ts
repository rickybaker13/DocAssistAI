/**
 * Default content for template-based note sections.
 *
 * Physical Exam: 6-system normal exam baseline.
 * Review of Systems: 5-point negative ROS.
 *
 * When a user manually adds one of these sections (or the AI generates without
 * transcript data for them), the default content serves as the starting template.
 * The AI merges transcript findings into these defaults, replacing pertinent
 * normal/negative findings with the patient's actual findings.
 */

export const PHYSICAL_EXAM_DEFAULT = `General: Well-appearing, in no acute distress. Alert and oriented.
Neurological: Alert and oriented x4. Cranial nerves II-XII grossly intact. Strength 5/5 in all extremities. Sensation intact to light touch.
Cardiovascular: Regular rate and rhythm. Normal S1, S2. No murmurs, rubs, or gallops. No peripheral edema.
Pulmonary: Clear to auscultation bilaterally. No wheezes, rhonchi, or rales. No increased work of breathing.
Abdominal: Soft, non-tender, non-distended. Normoactive bowel sounds in all four quadrants. No organomegaly.
Skin/Extremities: Warm, dry, intact. No rashes or lesions. No clubbing, cyanosis, or edema.`;

export const REVIEW_OF_SYSTEMS_DEFAULT = `Constitutional: Denies fever, chills, night sweats, or unintentional weight changes.
Cardiovascular: Denies chest pain, palpitations, orthopnea, or lower extremity swelling.
Pulmonary: Denies shortness of breath, cough, wheezing, or hemoptysis.
Gastrointestinal: Denies nausea, vomiting, diarrhea, constipation, or abdominal pain.
Neurological: Denies headache, dizziness, numbness, tingling, or focal weakness.`;

/** Map of section names to their default content for prepopulation */
export const SECTION_DEFAULT_CONTENT: Record<string, string> = {
  'Physical Exam': PHYSICAL_EXAM_DEFAULT,
  'Review of Systems': REVIEW_OF_SYSTEMS_DEFAULT,
};
