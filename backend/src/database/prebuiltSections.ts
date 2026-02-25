export interface PrebuiltSection {
  name: string;
  promptHint: string | null;
  category: string;
  disciplines: string[];
}

/** Disciplines applied to all general physician-authored sections */
const PHYSICIAN_DISCIPLINES = [
  'hospital_medicine', 'critical_care', 'emergency_medicine',
  'surgery', 'psychiatry', 'outpatient', 'specialty_medicine',
];

/** Disciplines applied to ICU/critical-care sections */
const ICU_DISCIPLINES = ['critical_care', 'surgery', 'emergency_medicine'];

export const PREBUILT_SECTIONS: PrebuiltSection[] = [
  // ─── General ──────────────────────────────────────────────────────────────
  { name: 'Chief Complaint',     promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'HPI',                 promptHint: 'History of Present Illness — onset, duration, character, severity, context', category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'Past Medical History', promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'Social History',      promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'Family History',      promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'Medications',         promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'Allergies',           promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'Review of Systems',   promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'Physical Exam',       promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'Assessment',          promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'Plan',                promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },
  { name: 'Disposition',         promptHint: null, category: 'general', disciplines: PHYSICIAN_DISCIPLINES },

  // ─── ICU / Critical Care ─────────────────────────────────────────────────
  // Note: "Neurological Status" has been renamed to "Neurological" (body_systems) via migration in seedPrebuilt()
  { name: 'Sedation & Analgesia',  promptHint: 'Document CPOT/RASS scores, agents used, target levels', category: 'icu', disciplines: ICU_DISCIPLINES },
  { name: 'Ventilator Management', promptHint: 'Mode, FiO2, PEEP, tidal volume, plateau pressure, compliance', category: 'icu', disciplines: ICU_DISCIPLINES },
  { name: 'Vasopressor Status',    promptHint: 'Current agents, doses, MAP target, hemodynamic response', category: 'icu', disciplines: ICU_DISCIPLINES },
  { name: 'Lines & Drains',        promptHint: 'Document all central/arterial lines, drains, tubes with dates', category: 'icu', disciplines: ICU_DISCIPLINES },
  { name: 'Infectious Disease',    promptHint: 'Active infections, cultures pending/resulted, antibiotics', category: 'icu', disciplines: ICU_DISCIPLINES },
  { name: 'Renal & Fluid Balance', promptHint: 'Creatinine trend, urine output, fluid balance, CRRT if applicable', category: 'icu', disciplines: ICU_DISCIPLINES },
  { name: 'Nutrition & GI',        promptHint: 'Enteral/parenteral nutrition, GI tolerance, bowel function', category: 'icu', disciplines: ICU_DISCIPLINES },
  { name: 'Goals of Care',         promptHint: 'Patient/family understanding, code status, palliative discussions', category: 'icu', disciplines: ICU_DISCIPLINES },
  { name: 'Code Status',           promptHint: null, category: 'icu', disciplines: ICU_DISCIPLINES },
  { name: 'Overnight Events',      promptHint: 'Significant events, interventions, responses since last note', category: 'icu', disciplines: ICU_DISCIPLINES },
  { name: 'Pending Studies',       promptHint: 'Labs, imaging, cultures, consults not yet resulted', category: 'icu', disciplines: ICU_DISCIPLINES },

  // ─── Specialty ───────────────────────────────────────────────────────────
  { name: 'Procedure Details',        promptHint: null, category: 'specialty', disciplines: ['surgery', 'critical_care', 'specialty_medicine', 'emergency_medicine'] },
  { name: 'Operative Findings',       promptHint: null, category: 'specialty', disciplines: ['surgery', 'critical_care'] },
  { name: 'Discharge Instructions',   promptHint: null, category: 'specialty', disciplines: ['hospital_medicine', 'surgery', 'outpatient', 'emergency_medicine'] },
  { name: 'Follow-up Plan',           promptHint: null, category: 'specialty', disciplines: ['hospital_medicine', 'surgery', 'outpatient', 'specialty_medicine'] },
  { name: 'Consult Recommendations',  promptHint: null, category: 'specialty', disciplines: ['hospital_medicine', 'critical_care', 'specialty_medicine'] },
  { name: 'Reason for Transfer',      promptHint: null, category: 'specialty', disciplines: ['hospital_medicine', 'critical_care', 'emergency_medicine'] },

  // ─── Body Systems ─────────────────────────────────────────────────────────
  // "Neurological" replaces the former "Neurological Status" (ICU) entry via rename migration.
  { name: 'Cardiovascular', promptHint: 'Heart rate, rhythm, murmurs, peripheral perfusion, edema, cardiac history', category: 'body_systems', disciplines: ['hospital_medicine', 'critical_care', 'emergency_medicine', 'specialty_medicine'] },
  { name: 'Pulmonary',      promptHint: 'Respiratory rate, breath sounds, oxygenation, work of breathing, pulmonary history', category: 'body_systems', disciplines: ['hospital_medicine', 'critical_care', 'emergency_medicine', 'specialty_medicine', 'respiratory_therapy'] },
  { name: 'Neurological',   promptHint: 'Mental status, cranial nerves, motor/sensory exam, reflexes, coordination, GCS', category: 'body_systems', disciplines: ['hospital_medicine', 'critical_care', 'emergency_medicine', 'specialty_medicine', 'psychiatry'] },
  { name: 'Psychiatric',    promptHint: 'Mood, affect, thought process, thought content, cognition, insight, judgment, safety assessment', category: 'body_systems', disciplines: ['psychiatry', 'hospital_medicine', 'specialty_medicine'] },
  { name: 'Dermatologic',   promptHint: 'Skin integrity, rashes, wounds, lesions, color, turgor, pressure injuries', category: 'body_systems', disciplines: ['specialty_medicine', 'hospital_medicine'] },
  { name: 'Ophthalmologic', promptHint: 'Visual acuity, pupils, extraocular movements, fundoscopic findings, eye symptoms', category: 'body_systems', disciplines: ['specialty_medicine', 'hospital_medicine'] },
  { name: 'GYN/OB',         promptHint: 'Obstetric/gynecologic history, LMP, pelvic exam findings, pregnancy status if applicable', category: 'body_systems', disciplines: ['specialty_medicine', 'hospital_medicine', 'emergency_medicine'] },
  { name: 'Urologic',       promptHint: 'Urinary symptoms, renal function, prostate exam if applicable, urologic history', category: 'body_systems', disciplines: ['specialty_medicine', 'hospital_medicine', 'emergency_medicine'] },
  { name: 'Endocrine',      promptHint: 'Glycemic control, thyroid function, adrenal status, electrolytes, endocrine history', category: 'body_systems', disciplines: ['specialty_medicine', 'hospital_medicine'] },

  // ─── Physical Therapy ────────────────────────────────────────────────────
  { name: 'Functional Status',          promptHint: 'Reason for referral, prior level of function, FIM scores, functional baseline', category: 'physical_therapy', disciplines: ['physical_therapy'] },
  { name: 'Range of Motion',            promptHint: 'Active and passive ROM measurements by joint, limitations noted with degrees', category: 'physical_therapy', disciplines: ['physical_therapy'] },
  { name: 'Strength Assessment',        promptHint: 'Manual muscle testing grades (0–5) by muscle group, bilateral comparison', category: 'physical_therapy', disciplines: ['physical_therapy'] },
  { name: 'Balance & Fall Risk',        promptHint: 'Berg Balance Scale, Timed Up and Go, fall risk category, fall precautions documented', category: 'physical_therapy', disciplines: ['physical_therapy'] },
  { name: 'Gait Assessment',            promptHint: 'Gait pattern, deviations observed, assistive device used, speed and endurance', category: 'physical_therapy', disciplines: ['physical_therapy'] },
  { name: 'Rehabilitation Goals',       promptHint: 'Short-term and long-term functional goals with measurable outcomes and timeframes', category: 'physical_therapy', disciplines: ['physical_therapy'] },
  { name: 'Treatment Plan (Rehab)',     promptHint: 'Proposed PT interventions, frequency per week, duration, anticipated progression', category: 'physical_therapy', disciplines: ['physical_therapy'] },
  { name: 'Home Exercise Program',      promptHint: 'Prescribed exercises with instructions, sets/reps/frequency, education provided', category: 'physical_therapy', disciplines: ['physical_therapy'] },
  { name: 'DME/Equipment Recommendations', promptHint: 'Durable medical equipment, orthotics, adaptive equipment recommendations with rationale', category: 'physical_therapy', disciplines: ['physical_therapy'] },

  // ─── Occupational Therapy ────────────────────────────────────────────────
  { name: 'Occupational Profile',   promptHint: 'Prior level of function, meaningful occupations, roles, values, client-centered goals', category: 'occupational_therapy', disciplines: ['occupational_therapy'] },
  { name: 'ADL Assessment',         promptHint: 'Basic ADLs: bathing, dressing, grooming, toileting, feeding — level of assistance required', category: 'occupational_therapy', disciplines: ['occupational_therapy'] },
  { name: 'Cognitive Assessment',   promptHint: 'Attention, memory, problem-solving, executive function, safety awareness, MMSE/MoCA results', category: 'occupational_therapy', disciplines: ['occupational_therapy'] },
  { name: 'Upper Extremity Function', promptHint: 'UE strength, ROM, coordination, fine motor skills, sensation, functional grasp and release', category: 'occupational_therapy', disciplines: ['occupational_therapy'] },
  { name: 'Home Modification Plan', promptHint: 'Recommended home modifications, adaptive equipment, environmental barriers identified', category: 'occupational_therapy', disciplines: ['occupational_therapy'] },
  { name: 'Caregiver Training',     promptHint: 'Caregiver education topics, training provided, competency demonstrated, ongoing support needs', category: 'occupational_therapy', disciplines: ['occupational_therapy'] },

  // ─── Speech-Language Pathology ───────────────────────────────────────────
  { name: 'Communication Assessment',      promptHint: 'Receptive and expressive language, speech intelligibility, cognitive-communication, AAC needs', category: 'speech_pathology', disciplines: ['speech_pathology'] },
  { name: 'Swallowing Assessment',         promptHint: 'Oral/pharyngeal/esophageal phase, DOSS severity rating, aspiration risk, bedside or instrumental findings', category: 'speech_pathology', disciplines: ['speech_pathology'] },
  { name: 'Oral Motor Exam',               promptHint: 'Lip, tongue, jaw, palate structure and function; facial symmetry; oral sensation and strength', category: 'speech_pathology', disciplines: ['speech_pathology'] },
  { name: 'Diet/Texture Recommendations',  promptHint: 'IDDSI diet level and liquid consistency, compensatory swallow strategies, safe eating techniques', category: 'speech_pathology', disciplines: ['speech_pathology'] },
  { name: 'Voice Assessment',              promptHint: 'Voice quality, resonance, pitch, loudness, GRBAS scale, vocal hygiene counseling, laryngeal function', category: 'speech_pathology', disciplines: ['speech_pathology'] },

  // ─── Respiratory Therapy ─────────────────────────────────────────────────
  { name: 'Respiratory Assessment (RT)', promptHint: 'Breath sounds, work of breathing, secretion management, cough effectiveness, peak flow', category: 'respiratory_therapy', disciplines: ['respiratory_therapy'] },
  { name: 'Oxygenation Status',          promptHint: 'O₂ delivery device and flow, FiO₂, SpO₂, ABG values, P/F ratio, oxygenation trend', category: 'respiratory_therapy', disciplines: ['respiratory_therapy', 'critical_care'] },
  { name: 'Airway Management',           promptHint: 'Airway type (ETT/trach), size and position, cuff pressure, tube care, suctioning frequency', category: 'respiratory_therapy', disciplines: ['respiratory_therapy', 'critical_care'] },
  { name: 'Inhaled Medication Plan',     promptHint: 'Bronchodilators, corticosteroids, mucolytics prescribed; nebulization schedule; patient response', category: 'respiratory_therapy', disciplines: ['respiratory_therapy'] },
  { name: 'Ventilator Weaning',          promptHint: 'Weaning protocol followed, SBT parameters and results, RSBI, extubation readiness criteria and plan', category: 'respiratory_therapy', disciplines: ['respiratory_therapy', 'critical_care'] },

  // ─── Case Management / Social Work ───────────────────────────────────────
  { name: 'Social Assessment',       promptHint: 'Living situation, support system, social determinants of health, psychosocial and safety needs', category: 'case_management', disciplines: ['case_management'] },
  { name: 'Insurance/Payor Status',  promptHint: 'Coverage type, authorization status, benefits verification, financial assistance options identified', category: 'case_management', disciplines: ['case_management'] },
  { name: 'Discharge Planning',      promptHint: 'Anticipated disposition, patient/family preferences, barriers to discharge, target discharge date', category: 'case_management', disciplines: ['case_management'] },
  { name: 'Post-Acute Care Options', promptHint: 'SNF, home health, inpatient rehab, LTAC options discussed; eligibility criteria; patient preference', category: 'case_management', disciplines: ['case_management'] },
  { name: 'Community Resources',     promptHint: 'Social services, community programs, transportation, food/housing resources, referrals placed', category: 'case_management', disciplines: ['case_management'] },
  { name: 'Care Coordination Notes', promptHint: 'Interdisciplinary communications, consults arranged, barriers escalated, family meeting summaries', category: 'case_management', disciplines: ['case_management'] },

  // ─── Nutrition & Dietetics ────────────────────────────────────────────────
  { name: 'Nutritional Assessment',   promptHint: 'Nutritional status, BMI, weight history, MUST/SGA risk screening, relevant labs (albumin, prealbumin)', category: 'nutrition', disciplines: ['nutrition_dietetics'] },
  { name: 'Dietary Recommendations',  promptHint: 'Caloric and protein targets, macronutrient goals, diet type/texture, enteral or parenteral nutrition plan', category: 'nutrition', disciplines: ['nutrition_dietetics'] },
];
