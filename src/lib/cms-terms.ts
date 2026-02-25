export interface CmsTerm {
  /** The vague/non-specific term to flag */
  vague: string;
  /** ICD-10-preferred replacement options (1-3), most specific first */
  preferred: string[];
  /** Brief clinical note explaining why this term matters for coding */
  note: string;
  /** Representative ICD-10 code(s) for reference */
  icd10?: string;
  /**
   * Regex string (case-insensitive). If this pattern matches within 40 characters
   * of the flagged term, the match is suppressed (term is already specific enough).
   */
  excludeContext?: string;
}

export const CMS_TERMS: CmsTerm[] = [
  // ── Cardiovascular ──────────────────────────────────────────────────────────
  {
    vague: 'high blood pressure',
    preferred: ['Essential (primary) hypertension'],
    note: 'ICD-10 I10: use "essential (primary) hypertension" unless secondary cause documented.',
    icd10: 'I10',
  },
  {
    vague: 'CHF',
    preferred: [
      'Acute systolic heart failure',
      'Chronic systolic heart failure',
      'Acute diastolic heart failure',
      'Chronic diastolic heart failure',
    ],
    note: 'ICD-10 requires systolic vs. diastolic and acute vs. chronic — "CHF" alone maps to I50.9 (unspecified, no HCC weight).',
    icd10: 'I50.x',
    excludeContext: 'systolic|diastolic|HFrEF|HFpEF|acute.on.chronic',
  },
  {
    vague: 'heart failure',
    preferred: [
      'Acute systolic heart failure',
      'Chronic systolic heart failure',
      'Acute on chronic systolic heart failure',
    ],
    note: 'ICD-10 requires type (systolic/diastolic) and acuity (acute/chronic). Unspecified = I50.9 with no HCC value.',
    icd10: 'I50.x',
    excludeContext: 'systolic|diastolic|HFrEF|HFpEF|acute.on.chronic',
  },
  {
    vague: 'congestive heart failure',
    preferred: [
      'Acute systolic heart failure',
      'Chronic systolic heart failure',
      'Acute on chronic diastolic heart failure',
    ],
    note: '"Congestive" is not an ICD-10 qualifier — specify systolic vs. diastolic and acuity.',
    icd10: 'I50.x',
    excludeContext: 'systolic|diastolic|HFrEF|HFpEF|acute.on.chronic',
  },
  {
    vague: 'fluid in lungs',
    preferred: ['Pulmonary edema'],
    note: 'ICD-10 J81.x: use "pulmonary edema" for specificity.',
    icd10: 'J81.x',
  },
  {
    vague: 'irregular heartbeat',
    preferred: ['Atrial fibrillation, paroxysmal', 'Atrial flutter, typical', 'Premature atrial contractions'],
    note: 'Specify the arrhythmia type for correct ICD-10 mapping and HCC capture.',
  },
  {
    vague: 'atrial fibrillation',
    preferred: ['Atrial fibrillation, paroxysmal', 'Atrial fibrillation, persistent', 'Atrial fibrillation, longstanding persistent', 'Permanent atrial fibrillation'],
    note: 'ICD-10 I48.x requires paroxysmal/persistent/longstanding persistent/permanent.',
    icd10: 'I48.x',
    excludeContext: 'paroxysmal|persistent|longstanding|permanent',
  },
  {
    vague: 'AFib',
    preferred: ['AFib, paroxysmal', 'AFib, persistent', 'AFib, longstanding persistent'],
    note: 'ICD-10 I48.x requires type qualifier (paroxysmal/persistent/longstanding/permanent).',
    icd10: 'I48.x',
    excludeContext: 'paroxysmal|persistent|longstanding|permanent',
  },
  {
    vague: 'peripheral vascular disease',
    preferred: ['Peripheral artery disease', 'Peripheral arterial disease with intermittent claudication'],
    note: 'PVD is ambiguous; ICD-10 distinguishes peripheral artery disease (I73.9) from venous disease.',
    icd10: 'I73.9',
  },
  {
    vague: 'PVD',
    preferred: ['Peripheral artery disease', 'Peripheral arterial disease with claudication'],
    note: 'PVD is ambiguous — use "peripheral artery disease" for ICD-10 specificity.',
    icd10: 'I73.9',
  },
  {
    vague: 'heart attack',
    preferred: ['Acute STEMI (ST-elevation MI)', 'Acute NSTEMI (non-ST-elevation MI)'],
    note: 'ICD-10 I21.x requires STEMI vs. NSTEMI and site of infarct.',
    icd10: 'I21.x',
  },

  // ── Diabetes ─────────────────────────────────────────────────────────────────
  {
    vague: 'diabetic nephritis',
    preferred: ['Type 2 DM with diabetic nephropathy', 'Type 1 DM with diabetic nephropathy'],
    note: '"Nephritis" is not a valid ICD-10 diabetic complication — use "nephropathy" (E11.21/E10.21).',
    icd10: 'E11.21',
  },
  {
    vague: 'sugar diabetes',
    preferred: ['Type 2 diabetes mellitus', 'Type 1 diabetes mellitus'],
    note: 'Use the full ICD-10 term; specify type 1 vs. type 2 for correct E10/E11 code.',
    icd10: 'E11.9 / E10.9',
  },
  {
    vague: 'history of diabetes',
    preferred: ['Type 2 diabetes mellitus (if still managed)', 'Type 1 diabetes mellitus (if still managed)'],
    note: 'ICD-10: "history of" = fully resolved. If still managed with meds/diet, code as active E11/E10.',
  },

  // ── Pulmonary ────────────────────────────────────────────────────────────────
  {
    vague: 'COPD',
    preferred: ['COPD without acute exacerbation', 'COPD with acute exacerbation', 'COPD with acute lower respiratory infection'],
    note: 'ICD-10 J44.x requires exacerbation status; J44.1 (with exacerbation) vs. J44.0/J44.9.',
    icd10: 'J44.x',
    excludeContext: 'without|with acute|exacerbation|lower respiratory',
  },
  {
    vague: 'history of COPD',
    preferred: ['COPD without acute exacerbation (if still managed)'],
    note: 'If patient still uses inhalers or has ongoing disease, code as active J44.9, not history.',
  },
  {
    vague: 'pneumonia',
    preferred: ['Community-acquired pneumonia', 'Hospital-acquired pneumonia', 'Aspiration pneumonia'],
    note: 'ICD-10 J18.9 is unspecified — specify organism or acquisition site when known.',
    icd10: 'J18.x',
    excludeContext: 'community|hospital|aspiration|pneumococcal|staphylococcal',
  },

  // ── Neurological ─────────────────────────────────────────────────────────────
  {
    vague: 'stroke',
    preferred: ['Ischemic stroke', 'Hemorrhagic stroke (intracerebral hemorrhage)', 'Sequelae of ischemic stroke with [deficit]'],
    note: 'Specify ischemic vs. hemorrhagic; if chronic/resolved, use sequelae codes I69.x with specific deficit.',
    icd10: 'I63.x / I61.x',
    excludeContext: 'ischemic|hemorrhagic|TIA|transient|sequelae',
  },
  {
    vague: 'mini stroke',
    preferred: ['TIA (transient ischemic attack)', 'Transient ischemic attack'],
    note: 'ICD-10 G45.9: document as TIA — "mini stroke" has no code mapping.',
    icd10: 'G45.9',
  },
  {
    vague: 'dementia',
    preferred: ["Alzheimer's dementia", 'Vascular dementia', "Lewy body dementia", 'Frontotemporal dementia'],
    note: 'ICD-10 requires type specification for proper HCC capture (F01/F02/F03).',
    icd10: 'F01-F03',
    excludeContext: "alzheimer|vascular|lewy|frontotemporal",
  },
  {
    vague: 'history of stroke',
    preferred: ['Sequelae of ischemic stroke with [specify deficit]', 'Personal history of ischemic stroke (if fully resolved)'],
    note: 'Active deficits → sequelae code I69.x. Fully resolved → Z86.73 (personal history).',
    icd10: 'I69.x / Z86.73',
  },

  // ── Renal ────────────────────────────────────────────────────────────────────
  {
    vague: 'kidney disease',
    preferred: ['CKD Stage 3a', 'CKD Stage 3b', 'CKD Stage 4', 'CKD Stage 5'],
    note: 'ICD-10 N18.x requires stage (1-5) or ESRD; "kidney disease" alone = N18.9 (unspecified, no HCC).',
    icd10: 'N18.x',
    excludeContext: 'stage|ESRD|end[\s-]stage|CKD',
  },
  {
    vague: 'kidney failure',
    preferred: ['ESRD (End-Stage Renal Disease)', 'Acute kidney injury (AKI)', 'Acute-on-chronic kidney disease'],
    note: 'Specify ESRD (N18.6), AKI (N17.x), or acute-on-chronic for proper ICD-10 coding.',
    icd10: 'N18.6 / N17.x',
    excludeContext: 'acute|ESRD|end[\s-]stage|stage',
  },

  // ── Hematology ───────────────────────────────────────────────────────────────
  {
    vague: 'anemia',
    preferred: ['Iron deficiency anemia', 'Anemia of chronic disease', 'B12 deficiency anemia', 'Folate deficiency anemia'],
    note: 'ICD-10 D64.9 (unspecified) gives no HCC. Specify type for D50-D53 codes.',
    icd10: 'D50-D64',
    excludeContext: 'iron|chronic|B12|folate|hemolytic|aplastic',
  },

  // ── Musculoskeletal ──────────────────────────────────────────────────────────
  {
    vague: 'knee pain',
    preferred: ['Primary osteoarthritis, right knee', 'Primary osteoarthritis, left knee', 'Bilateral primary osteoarthritis of knee'],
    note: 'Specify site (right/left/bilateral) and type (osteoarthritis, meniscal, etc.) for M17.x.',
    icd10: 'M17.x',
  },
  {
    vague: 'hip pain',
    preferred: ['Primary osteoarthritis, right hip', 'Primary osteoarthritis, left hip', 'Coxarthrosis, bilateral'],
    note: 'Specify site and type; hip OA = M16.x, requires laterality.',
    icd10: 'M16.x',
  },
  {
    vague: 'back pain',
    preferred: ['Low back pain', 'Lumbar radiculopathy', 'Lumbar spinal stenosis without neurogenic claudication'],
    note: 'Specify location and etiology; "back pain" = M54.5 (low back) at minimum.',
    icd10: 'M54.x',
  },

  // ── Infectious / Sepsis ──────────────────────────────────────────────────────
  {
    vague: 'sepsis',
    preferred: ['Sepsis due to Staphylococcus aureus', 'Sepsis due to Streptococcus', 'Sepsis, unspecified organism'],
    note: 'ICD-10 A41.x requires causative organism when known; A41.9 only if truly unknown.',
    icd10: 'A41.x',
    excludeContext: 'due to|strep|staph|gram|e\\.\\s*coli|klebsiella',
  },

  // ── Oncology ─────────────────────────────────────────────────────────────────
  {
    vague: 'cancer',
    preferred: ['Malignant neoplasm of [site] (primary)', 'Secondary malignant neoplasm of [site]'],
    note: 'Specify primary vs. secondary, histology, and site for C00-C97 codes; affects HCC/risk adjustment.',
    icd10: 'C00-C97',
    excludeContext: 'malignant|neoplasm|carcinoma|lymphoma|sarcoma',
  },

  // ── Psychiatry ───────────────────────────────────────────────────────────────
  {
    vague: 'depression',
    preferred: ['Major depressive disorder, single episode, moderate', 'Major depressive disorder, recurrent, moderate', 'Persistent depressive disorder (dysthymia)'],
    note: 'ICD-10 F32/F33 requires episode type (single/recurrent) and severity (mild/mod/severe).',
    icd10: 'F32.x / F33.x',
    excludeContext: 'major|persistent|dysthymia|bipolar',
  },
  {
    vague: 'anxiety',
    preferred: ['Generalized anxiety disorder', 'Panic disorder', 'Social anxiety disorder'],
    note: 'Specify type for F40/F41 codes; "anxiety" alone = F41.9 (unspecified).',
    icd10: 'F41.x',
    excludeContext: 'generalized|panic|social|separation|adjustment',
  },

  // ── Endocrine / Metabolic ────────────────────────────────────────────────────
  {
    vague: 'thyroid problem',
    preferred: ['Hypothyroidism', 'Hyperthyroidism (Graves disease)', 'Thyroid nodule'],
    note: 'Specify the thyroid condition; ICD-10 E00-E07 requires type.',
    icd10: 'E00-E07',
  },
  {
    vague: 'obesity',
    preferred: ['Morbid obesity (BMI ≥40, Class III)', 'Obesity Class II (BMI 35-39.9)', 'Obesity Class I (BMI 30-34.9)'],
    note: 'ICD-10 E66.x requires class specification based on BMI; E66.01 = morbid (severe) obesity.',
    icd10: 'E66.x',
    excludeContext: 'morbid|class I|class II|class III|BMI',
  },

  // ── "History of" warnings ────────────────────────────────────────────────────
  {
    vague: 'history of hypertension',
    preferred: ['Essential (primary) hypertension (if still managed)'],
    note: 'ICD-10: "history of" = fully resolved. Hypertension controlled on meds is still active — code I10.',
  },
  {
    vague: 'history of heart failure',
    preferred: ['Chronic systolic heart failure (if still managed)', 'Chronic diastolic heart failure (if still managed)'],
    note: 'If patient takes diuretics/ACEi for HF, it is active. Use I50.x, not history code Z87.39.',
  },
];
