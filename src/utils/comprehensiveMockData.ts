/**
 * Comprehensive Mock Data Generator
 * Creates realistic hospital admission data for complex patient scenarios
 * Based on 2-week admission with DKA, foot infection, stroke, MI, ICU stay
 */

import {
  PatientSummary,
  Patient,
  Condition,
  Observation,
  MedicationRequest,
  Encounter,
  DiagnosticReport,
  Procedure,
} from '../types';
import { createMockAllergies } from './mockData';

// Timeline constants
const ADMISSION_DATE = new Date();
ADMISSION_DATE.setDate(ADMISSION_DATE.getDate() - 14); // 2 weeks ago
const ICU_ADMISSION_DATE = new Date(ADMISSION_DATE);
ICU_ADMISSION_DATE.setDate(ICU_ADMISSION_DATE.getDate() + 3); // Day 4 of admission
const ICU_DISCHARGE_DATE = new Date(ICU_ADMISSION_DATE);
ICU_DISCHARGE_DATE.setDate(ICU_DISCHARGE_DATE.getDate() + 6); // 6 days in ICU
const STROKE_DATE = new Date(ICU_ADMISSION_DATE);
STROKE_DATE.setDate(STROKE_DATE.getDate() + 1); // Day 5 of admission
const MI_DATE = new Date(ICU_ADMISSION_DATE);
MI_DATE.setDate(MI_DATE.getDate() + 2); // Day 6 of admission

/**
 * Generate comprehensive patient data
 */
export function createComprehensiveMockPatientSummary(): PatientSummary {
  return {
    patient: createMockPatient(),
    conditions: createComprehensiveConditions(),
    medications: createComprehensiveMedications(),
    recentLabs: createComprehensiveLabs(),
    recentVitals: createComprehensiveVitals(),
    allergies: createMockAllergies() as any,
    recentEncounters: createComprehensiveEncounters(),
  };
}

function createMockPatient(): Patient {
  return {
    resourceType: 'Patient',
    id: 'mock-patient-123',
    name: [
      {
        family: 'Doe',
        given: ['John', 'Michael'],
      },
    ],
    birthDate: '1985-06-15',
    gender: 'male',
    identifier: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR',
              display: 'Medical Record Number',
            },
          ],
        },
        value: 'MRN-123456',
      },
    ],
  } as Patient;
}

/**
 * Create comprehensive conditions including admission diagnoses and complications
 */
function createComprehensiveConditions(): Condition[] {
  const conditions: Condition[] = [];

  // Pre-existing conditions
  conditions.push({
    resourceType: 'Condition',
    id: 'condition-diabetes',
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
    },
    code: {
      coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Diabetes mellitus type 2' }],
      text: 'Type 2 Diabetes Mellitus',
    },
    onsetDateTime: '2020-01-15',
    subject: { reference: 'Patient/mock-patient-123' },
  } as Condition);

  conditions.push({
    resourceType: 'Condition',
    id: 'condition-hypertension',
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
    },
    code: {
      coding: [{ system: 'http://snomed.info/sct', code: '38341003', display: 'Hypertensive disorder' }],
      text: 'Hypertension',
    },
    onsetDateTime: '2018-03-20',
    subject: { reference: 'Patient/mock-patient-123' },
  } as Condition);

  // Admission diagnoses
  conditions.push({
    resourceType: 'Condition',
    id: 'condition-dka',
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'resolved', display: 'Resolved' }],
    },
    code: {
      coding: [{ system: 'http://snomed.info/sct', code: '420422005', display: 'Diabetic ketoacidosis' }],
      text: 'Diabetic Ketoacidosis',
    },
    onsetDateTime: ADMISSION_DATE.toISOString(),
    abatementDateTime: new Date(ADMISSION_DATE.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    subject: { reference: 'Patient/mock-patient-123' },
  } as Condition);

  conditions.push({
    resourceType: 'Condition',
    id: 'condition-foot-infection',
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
    },
    code: {
      coding: [{ system: 'http://snomed.info/sct', code: '42399005', display: 'Foot infection' }],
      text: 'Left Foot Cellulitis/Infection',
    },
    onsetDateTime: ADMISSION_DATE.toISOString(),
    subject: { reference: 'Patient/mock-patient-123' },
  } as Condition);

  // Complications during admission
  conditions.push({
    resourceType: 'Condition',
    id: 'condition-stroke',
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
    },
    code: {
      coding: [{ system: 'http://snomed.info/sct', code: '230690007', display: 'Cerebrovascular accident' }],
      text: 'Acute Ischemic Stroke',
    },
    onsetDateTime: STROKE_DATE.toISOString(),
    subject: { reference: 'Patient/mock-patient-123' },
  } as Condition);

  conditions.push({
    resourceType: 'Condition',
    id: 'condition-mi',
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
    },
    code: {
      coding: [{ system: 'http://snomed.info/sct', code: '22298006', display: 'Myocardial infarction' }],
      text: 'Acute ST-Elevation Myocardial Infarction',
    },
    onsetDateTime: MI_DATE.toISOString(),
    subject: { reference: 'Patient/mock-patient-123' },
  } as Condition);

  conditions.push({
    resourceType: 'Condition',
    id: 'condition-sepsis',
    clinicalStatus: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'resolved', display: 'Resolved' }],
    },
    code: {
      coding: [{ system: 'http://snomed.info/sct', code: '91302008', display: 'Septic shock' }],
      text: 'Septic Shock',
    },
    onsetDateTime: ICU_ADMISSION_DATE.toISOString(),
    abatementDateTime: new Date(ICU_ADMISSION_DATE.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    subject: { reference: 'Patient/mock-patient-123' },
  } as Condition);

  return conditions;
}

/**
 * Create comprehensive medication list including IV meds, vasopressors, etc.
 */
function createComprehensiveMedications(): MedicationRequest[] {
  const medications: MedicationRequest[] = [];

  // Pre-admission medications
  medications.push({
    resourceType: 'MedicationRequest',
    id: 'med-metformin',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '860975', display: 'Metformin Hydrochloride 500 MG' }],
      text: 'Metformin 500mg',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    dosageInstruction: [{
      timing: { repeat: { frequency: 2, period: 1, periodUnit: 'd' } },
      doseAndRate: [{ doseQuantity: { value: 500, unit: 'mg' } }],
    }],
  } as MedicationRequest);

  medications.push({
    resourceType: 'MedicationRequest',
    id: 'med-amlodipine',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '314076', display: 'Amlodipine 5 MG' }],
      text: 'Amlodipine 5mg',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    dosageInstruction: [{
      timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd' } },
      doseAndRate: [{ doseQuantity: { value: 5, unit: 'mg' } }],
    }],
  } as MedicationRequest);

  // IV Insulin (DKA treatment)
  medications.push({
    resourceType: 'MedicationRequest',
    id: 'med-iv-insulin',
    status: 'completed',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '16590', display: 'Insulin Regular Human' }],
      text: 'Regular Insulin IV',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    authoredOn: ADMISSION_DATE.toISOString(),
    dosageInstruction: [{
      text: 'IV infusion titrated to glucose',
      timing: { repeat: { frequency: 1, period: 1, periodUnit: 'h' } },
    }],
  } as MedicationRequest);

  // IV Antibiotics (foot infection/sepsis)
  medications.push({
    resourceType: 'MedicationRequest',
    id: 'med-vancomycin',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '11124', display: 'Vancomycin' }],
      text: 'Vancomycin IV',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    authoredOn: ADMISSION_DATE.toISOString(),
    dosageInstruction: [{
      text: '1g IV q12h',
      timing: { repeat: { frequency: 2, period: 1, periodUnit: 'd' } },
      doseAndRate: [{ doseQuantity: { value: 1000, unit: 'mg' } }],
    }],
  } as MedicationRequest);

  medications.push({
    resourceType: 'MedicationRequest',
    id: 'med-pip-tazo',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '16592', display: 'Piperacillin-Tazobactam' }],
      text: 'Piperacillin-Tazobactam IV',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    authoredOn: ADMISSION_DATE.toISOString(),
    dosageInstruction: [{
      text: '4.5g IV q6h',
      timing: { repeat: { frequency: 4, period: 1, periodUnit: 'd' } },
      doseAndRate: [{ doseQuantity: { value: 4.5, unit: 'g' } }],
    }],
  } as MedicationRequest);

  // Vasopressors (septic shock)
  medications.push({
    resourceType: 'MedicationRequest',
    id: 'med-norepinephrine',
    status: 'completed',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '7487', display: 'Norepinephrine' }],
      text: 'Norepinephrine IV',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    authoredOn: ICU_ADMISSION_DATE.toISOString(),
    dosageInstruction: [{
      text: 'IV infusion titrated to MAP >65',
      timing: { repeat: { frequency: 1, period: 1, periodUnit: 'min' } },
    }],
  } as MedicationRequest);

  // Pain medications
  medications.push({
    resourceType: 'MedicationRequest',
    id: 'med-morphine',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '7052', display: 'Morphine' }],
      text: 'Morphine IV',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    authoredOn: ADMISSION_DATE.toISOString(),
    dosageInstruction: [{
      text: '2-4mg IV q4h PRN pain',
      timing: { repeat: { frequency: 6, period: 1, periodUnit: 'd' } },
      doseAndRate: [{ doseQuantity: { value: 2, unit: 'mg' } }],
    }],
  } as MedicationRequest);

  // Aspirin (post-MI)
  medications.push({
    resourceType: 'MedicationRequest',
    id: 'med-aspirin',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '1191', display: 'Aspirin' }],
      text: 'Aspirin 81mg',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    authoredOn: MI_DATE.toISOString(),
    dosageInstruction: [{
      timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd' } },
      doseAndRate: [{ doseQuantity: { value: 81, unit: 'mg' } }],
    }],
  } as MedicationRequest);

  // Clopidogrel (post-MI)
  medications.push({
    resourceType: 'MedicationRequest',
    id: 'med-clopidogrel',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '32968', display: 'Clopidogrel' }],
      text: 'Clopidogrel 75mg',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    authoredOn: MI_DATE.toISOString(),
    dosageInstruction: [{
      timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd' } },
      doseAndRate: [{ doseQuantity: { value: 75, unit: 'mg' } }],
    }],
  } as MedicationRequest);

  // Atorvastatin (post-MI)
  medications.push({
    resourceType: 'MedicationRequest',
    id: 'med-atorvastatin',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '83367', display: 'Atorvastatin' }],
      text: 'Atorvastatin 80mg',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    authoredOn: MI_DATE.toISOString(),
    dosageInstruction: [{
      timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd' } },
      doseAndRate: [{ doseQuantity: { value: 80, unit: 'mg' } }],
    }],
  } as MedicationRequest);

  return medications;
}

/**
 * Create comprehensive vital signs (25 per day for 14 days = 350 observations)
 */
function createComprehensiveVitals(): Observation[] {
  const vitals: Observation[] = [];
  const totalDays = 14;
  const readingsPerDay = 25; // q1h in ICU, less frequent on floor

  for (let day = 0; day < totalDays; day++) {
    const currentDate = new Date(ADMISSION_DATE);
    currentDate.setDate(currentDate.getDate() + day);
    const isICUDay = day >= 3 && day < 9; // Days 4-9 in ICU
    const intervalHours = isICUDay ? 1 : 2; // Hourly in ICU, q2h on floor

    for (let reading = 0; reading < readingsPerDay; reading++) {
      const readingTime = new Date(currentDate);
      readingTime.setHours(0 + (reading * intervalHours));
      readingTime.setMinutes(Math.floor(Math.random() * 60));

      // Temperature (varies with infection/sepsis)
      const tempBase = isICUDay && day < 6 ? 101.5 : 98.6; // Fever during septic shock
      const temp = tempBase + (Math.random() * 2 - 1) * 0.5;
      vitals.push(createVitalObservation('temperature', temp, '[degF]', readingTime, '8310-5', 'Body temperature'));

      // Blood Pressure (elevated, worse during sepsis)
      const sysBP = isICUDay && day < 6 ? 85 + Math.random() * 20 : 130 + Math.random() * 20;
      const diaBP = isICUDay && day < 6 ? 45 + Math.random() * 15 : 75 + Math.random() * 15;
      vitals.push(createBPObservation(sysBP, diaBP, readingTime));

      // Heart Rate (tachycardic during sepsis)
      const hr = isICUDay && day < 6 ? 110 + Math.random() * 30 : 70 + Math.random() * 20;
      vitals.push(createVitalObservation('heart-rate', hr, '/min', readingTime, '8867-4', 'Heart rate'));

      // Respiratory Rate (tachypneic during sepsis/vent)
      const rr = isICUDay && day < 6 ? 24 + Math.random() * 8 : 16 + Math.random() * 4;
      vitals.push(createVitalObservation('respiratory-rate', rr, '/min', readingTime, '9279-1', 'Respiratory rate'));

      // Pain Score (0-10)
      const painScore = day < 3 ? 6 + Math.random() * 3 : day < 9 ? 4 + Math.random() * 3 : 2 + Math.random() * 2;
      vitals.push(createVitalObservation('pain-score', Math.round(painScore), '', readingTime, '72514-3', 'Pain severity'));
    }
  }

  return vitals.sort((a, b) => {
    const dateA = a.effectiveDateTime ? new Date(a.effectiveDateTime).getTime() : 0;
    const dateB = b.effectiveDateTime ? new Date(b.effectiveDateTime).getTime() : 0;
    return dateB - dateA; // Most recent first
  });
}

function createVitalObservation(
  type: string,
  value: number,
  unit: string,
  dateTime: Date,
  loincCode: string,
  display: string
): Observation {
  return {
    resourceType: 'Observation',
    id: `vital-${type}-${dateTime.getTime()}`,
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'vital-signs',
        display: 'Vital Signs',
      }],
    }],
    code: {
      coding: [{ system: 'http://loinc.org', code: loincCode, display }],
      text: display,
    },
    subject: { reference: 'Patient/mock-patient-123' },
    effectiveDateTime: dateTime.toISOString(),
    valueQuantity: {
      value: Math.round(value * 10) / 10,
      unit,
      system: 'http://unitsofmeasure.org',
      code: unit,
    },
  } as Observation;
}

function createBPObservation(sysBP: number, diaBP: number, dateTime: Date): Observation {
  return {
    resourceType: 'Observation',
    id: `vital-bp-${dateTime.getTime()}`,
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'vital-signs',
        display: 'Vital Signs',
      }],
    }],
    code: {
      coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }],
      text: 'Blood Pressure',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    effectiveDateTime: dateTime.toISOString(),
    component: [
      {
        code: {
          coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }],
        },
        valueQuantity: {
          value: Math.round(sysBP),
          unit: 'mm[Hg]',
        },
      },
      {
        code: {
          coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }],
        },
        valueQuantity: {
          value: Math.round(diaBP),
          unit: 'mm[Hg]',
        },
      },
    ],
  } as Observation;
}

/**
 * Create comprehensive lab results including cultures
 */
function createComprehensiveLabs(): Observation[] {
  const labs: Observation[] = [];
  const today = new Date();

  // Daily labs during admission
  for (let day = 0; day < 14; day++) {
    const labDate = new Date(ADMISSION_DATE);
    labDate.setDate(labDate.getDate() + day);
    labDate.setHours(6); // Morning labs

    // Basic metabolic panel
    const glucose = day < 2 ? 350 + Math.random() * 100 : 120 + Math.random() * 40; // High during DKA
    labs.push(createLabObservation('2339-0', 'Glucose', glucose, 'mg/dL', labDate));

    const creatinine = 1.0 + Math.random() * 0.5;
    labs.push(createLabObservation('2160-0', 'Creatinine', creatinine, 'mg/dL', labDate));

    const sodium = 135 + Math.random() * 5;
    labs.push(createLabObservation('2951-2', 'Sodium', sodium, 'mEq/L', labDate));

    const potassium = 3.5 + Math.random() * 1.0;
    labs.push(createLabObservation('2823-3', 'Potassium', potassium, 'mEq/L', labDate));

    // Complete blood count
    const wbc = day >= 3 && day < 9 ? 15 + Math.random() * 5 : 7 + Math.random() * 3; // Elevated during sepsis
    labs.push(createLabObservation('6690-2', 'WBC', wbc, 'K/uL', labDate));

    const hgb = 12 + Math.random() * 3;
    labs.push(createLabObservation('718-7', 'Hemoglobin', hgb, 'g/dL', labDate));

    const plt = 200 + Math.random() * 100;
    labs.push(createLabObservation('777-3', 'Platelets', plt, 'K/uL', labDate));

    // Lactate (elevated during sepsis)
    if (day >= 3 && day < 9) {
      const lactate = 2.5 + Math.random() * 3;
      labs.push(createLabObservation('2524-7', 'Lactate', lactate, 'mmol/L', labDate));
    }

    // Troponin (elevated after MI)
    if (day >= 6) {
      const troponin = day === 6 ? 5 + Math.random() * 3 : 0.5 + Math.random() * 0.5;
      labs.push(createLabObservation('6598-7', 'Troponin I', troponin, 'ng/mL', labDate));
    }
  }

  // Blood cultures (multiple sets)
  const cultureDates = [
    new Date(ADMISSION_DATE),
    new Date(ICU_ADMISSION_DATE),
    new Date(ICU_ADMISSION_DATE.getTime() + 24 * 60 * 60 * 1000),
  ];
  cultureDates.forEach((date, idx) => {
    labs.push({
      resourceType: 'Observation',
      id: `lab-blood-culture-${idx}`,
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'laboratory',
          display: 'Laboratory',
        }],
      }],
      code: {
        coding: [{ system: 'http://loinc.org', code: '600-7', display: 'Blood culture' }],
        text: 'Blood Culture',
      },
      subject: { reference: 'Patient/mock-patient-123' },
      effectiveDateTime: date.toISOString(),
      valueString: idx === 1 ? 'Staphylococcus aureus (MSSA)' : 'No growth',
    } as Observation);
  });

  // Respiratory cultures
  const respCultureDate = new Date(ICU_ADMISSION_DATE);
  labs.push({
    resourceType: 'Observation',
    id: 'lab-resp-culture',
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'laboratory',
        display: 'Laboratory',
      }],
    }],
    code: {
      coding: [{ system: 'http://loinc.org', code: '634-6', display: 'Respiratory culture' }],
      text: 'Respiratory Culture',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    effectiveDateTime: respCultureDate.toISOString(),
    valueString: 'Staphylococcus aureus',
  } as Observation);

  // Urine cultures
  labs.push({
    resourceType: 'Observation',
    id: 'lab-urine-culture',
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'laboratory',
        display: 'Laboratory',
      }],
    }],
    code: {
      coding: [{ system: 'http://loinc.org', code: '630-4', display: 'Urine culture' }],
      text: 'Urine Culture',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    effectiveDateTime: ADMISSION_DATE.toISOString(),
    valueString: 'E. coli >100,000 CFU/mL',
  } as Observation);

  return labs.sort((a, b) => {
    const dateA = a.effectiveDateTime ? new Date(a.effectiveDateTime).getTime() : 0;
    const dateB = b.effectiveDateTime ? new Date(b.effectiveDateTime).getTime() : 0;
    return dateB - dateA;
  });
}

function createLabObservation(loincCode: string, display: string, value: number, unit: string, dateTime: Date): Observation {
  return {
    resourceType: 'Observation',
    id: `lab-${loincCode}-${dateTime.getTime()}`,
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'laboratory',
        display: 'Laboratory',
      }],
    }],
    code: {
      coding: [{ system: 'http://loinc.org', code: loincCode, display }],
      text: display,
    },
    subject: { reference: 'Patient/mock-patient-123' },
    effectiveDateTime: dateTime.toISOString(),
    valueQuantity: {
      value: Math.round(value * 100) / 100,
      unit,
      system: 'http://unitsofmeasure.org',
      code: unit,
    },
  } as Observation;
}

/**
 * Create comprehensive encounters (ED, Floor, ICU)
 */
function createComprehensiveEncounters(): Encounter[] {
  const encounters: Encounter[] = [];

  // ED Encounter
  encounters.push({
    resourceType: 'Encounter',
    id: 'encounter-ed',
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'EMER',
      display: 'emergency',
    },
    type: [{
      coding: [{
        system: 'http://www.ama-assn.org/go/cpt',
        code: '99281',
        display: 'Emergency department visit',
      }],
    }],
    subject: { reference: 'Patient/mock-patient-123' },
    period: {
      start: ADMISSION_DATE.toISOString(),
      end: new Date(ADMISSION_DATE.getTime() + 4 * 60 * 60 * 1000).toISOString(),
    },
  } as Encounter);

  // Floor Encounter (Days 1-3)
  encounters.push({
    resourceType: 'Encounter',
    id: 'encounter-floor-1',
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'IMP',
      display: 'inpatient encounter',
    },
    type: [{
      coding: [{
        system: 'http://www.ama-assn.org/go/cpt',
        code: '99221',
        display: 'Initial hospital care',
      }],
    }],
    subject: { reference: 'Patient/mock-patient-123' },
    period: {
      start: new Date(ADMISSION_DATE.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      end: ICU_ADMISSION_DATE.toISOString(),
    },
  } as Encounter);

  // ICU Encounter (Days 4-9)
  encounters.push({
    resourceType: 'Encounter',
    id: 'encounter-icu',
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'IMP',
      display: 'inpatient encounter',
    },
    type: [{
      coding: [{
        system: 'http://www.ama-assn.org/go/cpt',
        code: '99291',
        display: 'Critical care',
      }],
    }],
    subject: { reference: 'Patient/mock-patient-123' },
    period: {
      start: ICU_ADMISSION_DATE.toISOString(),
      end: ICU_DISCHARGE_DATE.toISOString(),
    },
  } as Encounter);

  // Floor Encounter (Days 10-14)
  encounters.push({
    resourceType: 'Encounter',
    id: 'encounter-floor-2',
    status: 'active',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'IMP',
      display: 'inpatient encounter',
    },
    type: [{
      coding: [{
        system: 'http://www.ama-assn.org/go/cpt',
        code: '99231',
        display: 'Subsequent hospital care',
      }],
    }],
    subject: { reference: 'Patient/mock-patient-123' },
    period: {
      start: ICU_DISCHARGE_DATE.toISOString(),
      end: undefined, // Still ongoing
    },
  } as Encounter);

  return encounters;
}

/**
 * Create I&O observations (fluid intake/output)
 */
export function createFluidIOObservations(): Observation[] {
  const observations: Observation[] = [];

  for (let day = 0; day < 14; day++) {
    const currentDate = new Date(ADMISSION_DATE);
    currentDate.setDate(currentDate.getDate() + day);
    const isICUDay = day >= 3 && day < 9;

    // Daily totals
    const intake = isICUDay ? 3000 + Math.random() * 1000 : 2000 + Math.random() * 500;
    const output = isICUDay ? 2500 + Math.random() * 800 : 1500 + Math.random() * 500;

    // Intake
    observations.push({
      resourceType: 'Observation',
      id: `io-intake-${day}`,
      status: 'final',
      code: {
        coding: [{ system: 'http://loinc.org', code: '22636-1', display: 'Fluid intake' }],
        text: 'Total Fluid Intake',
      },
      subject: { reference: 'Patient/mock-patient-123' },
      effectiveDateTime: currentDate.toISOString(),
      valueQuantity: {
        value: Math.round(intake),
        unit: 'mL',
      },
    } as Observation);

    // Output
    observations.push({
      resourceType: 'Observation',
      id: `io-output-${day}`,
      status: 'final',
      code: {
        coding: [{ system: 'http://loinc.org', code: '22637-9', display: 'Fluid output' }],
        text: 'Total Fluid Output',
      },
      subject: { reference: 'Patient/mock-patient-123' },
      effectiveDateTime: currentDate.toISOString(),
      valueQuantity: {
        value: Math.round(output),
        unit: 'mL',
      },
    } as Observation);
  }

  return observations;
}

/**
 * Create diagnostic reports (imaging studies)
 */
export function createImagingReports(): DiagnosticReport[] {
  const reports: DiagnosticReport[] = [];

  // Daily chest X-rays
  for (let day = 0; day < 14; day++) {
    const xrayDate = new Date(ADMISSION_DATE);
    xrayDate.setDate(xrayDate.getDate() + day);
    xrayDate.setHours(8);

    reports.push({
      resourceType: 'DiagnosticReport',
      id: `report-cxr-${day}`,
      status: 'final',
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '36620-2',
          display: 'Chest X-ray',
        }],
        text: 'Chest X-ray',
      },
      subject: { reference: 'Patient/mock-patient-123' },
      effectiveDateTime: xrayDate.toISOString(),
      conclusion: day >= 3 && day < 9
        ? 'Bilateral lower lobe infiltrates consistent with pneumonia. Improved compared to prior.'
        : 'Clear lungs bilaterally.',
    } as DiagnosticReport);
  }

  // CT Head (for stroke)
  reports.push({
    resourceType: 'DiagnosticReport',
    id: 'report-ct-head',
    status: 'final',
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '25056-9',
        display: 'CT Head',
      }],
      text: 'CT Head without contrast',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    effectiveDateTime: STROKE_DATE.toISOString(),
    conclusion: 'Acute ischemic infarct in left MCA territory. No hemorrhage.',
  } as DiagnosticReport);

  // CT Chest (for pneumonia)
  reports.push({
    resourceType: 'DiagnosticReport',
    id: 'report-ct-chest',
    status: 'final',
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '25057-7',
        display: 'CT Chest',
      }],
      text: 'CT Chest with contrast',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    effectiveDateTime: ICU_ADMISSION_DATE.toISOString(),
    conclusion: 'Bilateral lower lobe consolidations with pleural effusions. Findings consistent with pneumonia.',
  } as DiagnosticReport);

  // CT Abdomen (for sepsis workup)
  reports.push({
    resourceType: 'DiagnosticReport',
    id: 'report-ct-abdomen',
    status: 'final',
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '25058-5',
        display: 'CT Abdomen',
      }],
      text: 'CT Abdomen/Pelvis with contrast',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    effectiveDateTime: ICU_ADMISSION_DATE.toISOString(),
    conclusion: 'No acute intra-abdominal process. Foot infection noted.',
  } as DiagnosticReport);

  // Echocardiogram (post-MI)
  reports.push({
    resourceType: 'DiagnosticReport',
    id: 'report-echo',
    status: 'final',
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '34551-2',
        display: 'Echocardiogram',
      }],
      text: 'Transthoracic Echocardiogram',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    effectiveDateTime: new Date(MI_DATE.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    conclusion: 'EF 45%. Regional wall motion abnormality in anterior wall. Mild mitral regurgitation.',
  } as DiagnosticReport);

  return reports;
}

/**
 * Create procedures
 */
export function createProcedures(): Procedure[] {
  const procedures: Procedure[] = [];

  // Left heart catheterization
  procedures.push({
    resourceType: 'Procedure',
    id: 'proc-cath',
    status: 'completed',
    code: {
      coding: [{
        system: 'http://www.ama-assn.org/go/cpt',
        code: '93458',
        display: 'Left heart catheterization',
      }],
      text: 'Left Heart Catheterization',
    },
    subject: { reference: 'Patient/mock-patient-123' },
    performedDateTime: new Date(MI_DATE.getTime() + 12 * 60 * 60 * 1000).toISOString(),
    outcome: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '385669000',
        display: 'Successful',
      }],
    },
  } as Procedure);

  return procedures;
}

/**
 * Create clinical notes (as DocumentReference resources would be represented)
 */
export function createClinicalNotes(): any[] {
  const notes: any[] = [];

  // H&P (Admission note)
  notes.push({
    id: 'note-hp',
    type: 'H&P',
    author: 'Dr. Smith, Internal Medicine',
    date: ADMISSION_DATE.toISOString(),
    content: `HISTORY AND PHYSICAL

CHIEF COMPLAINT: Diabetic ketoacidosis and left foot infection

HISTORY OF PRESENT ILLNESS:
39-year-old male with Type 2 Diabetes Mellitus presents with 3-day history of polyuria, polydipsia, and left foot pain/swelling. Patient reports poor adherence to insulin regimen over past week. Left foot became red, swollen, and tender 2 days ago.

PAST MEDICAL HISTORY:
- Type 2 Diabetes Mellitus (diagnosed 2020)
- Hypertension (diagnosed 2018)
- Allergic to Penicillin (severe rash)

PHYSICAL EXAMINATION:
Vitals: T 101.2°F, BP 145/90, HR 110, RR 22, O2 Sat 96% RA
General: Ill-appearing, diaphoretic
Cardiac: Regular rhythm, no murmurs
Respiratory: Clear to auscultation
Abdomen: Soft, non-tender
Left Foot: Erythema, warmth, swelling, tenderness to palpation. Small ulceration on plantar surface.

ASSESSMENT AND PLAN:
1. Diabetic Ketoacidosis - Start IV insulin, fluid resuscitation, correct electrolytes
2. Left Foot Cellulitis - Start IV antibiotics (Vancomycin + Piperacillin-Tazobactam), wound care
3. Type 2 Diabetes - Continue Metformin, optimize insulin regimen
4. Hypertension - Continue Amlodipine`,
  });

  // Daily Progress Notes (IM Service)
  for (let day = 1; day <= 14; day++) {
    const noteDate = new Date(ADMISSION_DATE);
    noteDate.setDate(noteDate.getDate() + day);
    noteDate.setHours(8);

    if (day >= 4 && day <= 9) continue; // ICU days handled separately

    notes.push({
      id: `note-progress-im-${day}`,
      type: 'Progress Note',
      author: 'Dr. Smith, Internal Medicine',
      date: noteDate.toISOString(),
      content: `PROGRESS NOTE - Day ${day}

SUBJECTIVE:
Patient reports ${day < 3 ? 'improving' : 'stable'} condition. ${day < 3 ? 'Foot pain decreasing.' : 'Feeling better overall.'}

OBJECTIVE:
Vitals stable. Labs improving. Wound care ongoing.

ASSESSMENT:
1. DKA - Resolved
2. Foot infection - Improving
${day >= 10 ? '3. Post-MI - Stable\n4. Post-stroke - Stable' : ''}

PLAN:
Continue current management.`,
    });
  }

  // ICU Accept Note
  notes.push({
    id: 'note-icu-accept',
    type: 'ICU Accept Note',
    author: 'Dr. Johnson, Critical Care',
    date: ICU_ADMISSION_DATE.toISOString(),
    content: `ICU ACCEPT NOTE

Patient transferred to ICU for septic shock and respiratory failure.

REASON FOR TRANSFER:
Patient developed hypotension, tachycardia, and respiratory distress. Blood cultures positive for Staphylococcus aureus. Requires vasopressor support and mechanical ventilation.

ASSESSMENT:
1. Septic Shock - On norepinephrine, improving
2. Respiratory Failure - Intubated, vent settings: AC/VC, FiO2 60%, PEEP 8
3. DKA - Resolved
4. Foot Infection - Source of sepsis

PLAN:
- Continue vasopressors, titrate to MAP >65
- Ventilator management
- IV antibiotics
- Monitor closely`,
  });

  // ICU Daily Progress Notes (MD, NP, PA)
  const icuProviders = ['Dr. Johnson, Critical Care', 'NP Martinez, Critical Care', 'PA Thompson, Critical Care'];
  for (let day = 0; day < 6; day++) {
    const noteDate = new Date(ICU_ADMISSION_DATE);
    noteDate.setDate(noteDate.getDate() + day);

    icuProviders.forEach((provider, shift) => {
      const shiftTime = new Date(noteDate);
      shiftTime.setHours(8 + (shift * 8)); // 8am, 4pm, midnight

      notes.push({
        id: `note-icu-${day}-${shift}`,
        type: 'ICU Progress Note',
        author: provider,
        date: shiftTime.toISOString(),
        content: `ICU PROGRESS NOTE - Day ${day + 1}, Shift ${shift + 1}

VENTILATOR:
${day < 3 ? 'AC/VC mode, FiO2 60%, PEEP 8, TV 500mL' : 'Weaning, CPAP trial'}

VASOPRESSORS:
${day < 2 ? 'Norepinephrine 0.1 mcg/kg/min, MAP 68' : 'Off vasopressors'}

ASSESSMENT:
Septic shock improving. ${day < 3 ? 'Remains intubated.' : 'Extubated successfully.'}

PLAN:
Continue current management.`,
      });
    });
  }

  // Floor Accept Note (back from ICU)
  notes.push({
    id: 'note-floor-accept-2',
    type: 'Accept Note',
    author: 'Dr. Smith, Internal Medicine',
    date: ICU_DISCHARGE_DATE.toISOString(),
    content: `ACCEPT NOTE - Return to Floor

Patient transferred back to floor from ICU. Status post septic shock, now resolved. Post-MI and post-stroke, both stable.

ASSESSMENT:
1. Post-septic shock - Resolved
2. Post-MI - Stable on dual antiplatelet therapy
3. Post-stroke - Stable, no new deficits
4. Foot infection - Improving

PLAN:
Continue antibiotics, cardiac medications, monitor closely.`,
  });

  // Consult Notes
  notes.push({
    id: 'note-consult-cardio',
    type: 'Consultation',
    author: 'Dr. Williams, Cardiology',
    date: new Date(MI_DATE.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    content: `CARDIOLOGY CONSULTATION

REASON: Acute ST-elevation MI

ASSESSMENT:
Acute anterior STEMI. Patient underwent left heart cath showing 90% LAD stenosis, stented successfully.

RECOMMENDATIONS:
- Dual antiplatelet therapy (Aspirin 81mg, Clopidogrel 75mg)
- High-intensity statin (Atorvastatin 80mg)
- Beta-blocker (Metoprolol 25mg BID)
- Follow-up echo in 48 hours`,
  });

  notes.push({
    id: 'note-consult-neuro',
    type: 'Consultation',
    author: 'Dr. Brown, Neurology',
    date: new Date(STROKE_DATE.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    content: `NEUROLOGY CONSULTATION

REASON: Acute ischemic stroke

ASSESSMENT:
Acute left MCA territory infarct. Patient has right-sided weakness. NIHSS 8.

RECOMMENDATIONS:
- Aspirin 81mg daily
- Statin therapy
- Physical therapy evaluation
- Speech therapy evaluation
- Monitor for complications`,
  });

  notes.push({
    id: 'note-consult-id',
    type: 'Consultation',
    author: 'Dr. Davis, Infectious Disease',
    date: new Date(ICU_ADMISSION_DATE.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    content: `INFECTIOUS DISEASE CONSULTATION

REASON: Septic shock, positive blood cultures

ASSESSMENT:
MSSA bacteremia, likely source from foot infection. Currently on appropriate antibiotics.

RECOMMENDATIONS:
- Continue Vancomycin + Piperacillin-Tazobactam
- 14-day course of antibiotics
- Follow blood cultures
- Wound care for foot infection`,
  });

  // Nursing Assessments
  for (let day = 0; day < 14; day++) {
    const currentDate = new Date(ADMISSION_DATE);
    currentDate.setDate(currentDate.getDate() + day);
    const isICUDay = day >= 3 && day < 9;
    const assessmentsPerDay = isICUDay ? 6 : 3; // 6x/day in ICU, 3x/day on floor

    for (let assessment = 0; assessment < assessmentsPerDay; assessment++) {
      const assessmentTime = new Date(currentDate);
      assessmentTime.setHours(7 + (assessment * (isICUDay ? 4 : 8))); // q4h ICU, q8h floor

      notes.push({
        id: `note-nurse-${day}-${assessment}`,
        type: 'Nursing Assessment',
        author: `RN ${['Smith', 'Jones', 'Williams', 'Brown', 'Davis', 'Miller'][assessment % 6]}`,
        date: assessmentTime.toISOString(),
        content: `NURSING ASSESSMENT

NEURO:
${day >= 5 ? 'Alert, oriented x3. Right-sided weakness noted.' : 'Alert, oriented x4. No focal deficits.'}

CARDIOVASCULAR:
${isICUDay && day < 6 ? 'Tachycardic, hypotensive. On vasopressors.' : 'Stable, regular rhythm.'}

RESPIRATORY:
${isICUDay && day < 3 ? 'Intubated, vented. Breath sounds clear.' : 'Clear to auscultation bilaterally.'}

SKIN:
Foot wound: ${day < 5 ? 'Erythematous, draining' : 'Improving, less erythema'}

PAIN:
${day < 3 ? 'Reports 6/10 pain in left foot' : day < 9 ? 'Reports 4/10 pain' : 'Reports 2/10 pain'}`,
      });
    }
  }

  // RT Assessments (during vent)
  for (let day = 0; day < 3; day++) {
    const ventDate = new Date(ICU_ADMISSION_DATE);
    ventDate.setDate(ventDate.getDate() + day);

    for (let shift = 0; shift < 3; shift++) {
      const shiftTime = new Date(ventDate);
      shiftTime.setHours(7 + (shift * 8));

      notes.push({
        id: `note-rt-${day}-${shift}`,
        type: 'RT Assessment',
        author: `RT ${['Johnson', 'Martinez', 'Thompson'][shift]}`,
        date: shiftTime.toISOString(),
        content: `RESPIRATORY THERAPY ASSESSMENT

VENTILATOR SETTINGS:
Mode: AC/VC
FiO2: ${60 - (day * 5)}%
PEEP: 8 cmH2O
Tidal Volume: 500mL
Rate: 16/min

ASSESSMENT:
Patient tolerating vent settings well. Secretions moderate. Suctioned q4h.

PLAN:
Continue current settings. Consider weaning trial if continues to improve.`,
      });
    }
  }

  // Physical Therapy Notes (starting day 6, after stroke)
  for (let day = 6; day <= 14; day++) {
    const ptDate = new Date(ADMISSION_DATE);
    ptDate.setDate(ptDate.getDate() + day);
    ptDate.setHours(10); // Morning PT sessions

    notes.push({
      id: `note-pt-${day}`,
      type: 'PT Progress Note',
      author: 'PT Anderson, Physical Therapy',
      date: ptDate.toISOString(),
      content: `PHYSICAL THERAPY PROGRESS NOTE

SUBJECTIVE:
Patient reports ${day < 10 ? 'difficulty' : 'improving ability'} with mobility. ${day < 10 ? 'Right leg weakness persists.' : 'Right leg strength improving.'}

OBJECTIVE:
Vital Signs: BP 130/80, HR 85, O2 Sat 98% RA
Range of Motion:
- Right hip: Flexion ${day < 10 ? '90' : '110'}°, Extension ${day < 10 ? '-5' : '0'}°
- Right knee: Flexion ${day < 10 ? '100' : '120'}°, Extension ${day < 10 ? '-10' : '0'}°
- Right ankle: Dorsiflexion ${day < 10 ? '5' : '10'}°, Plantarflexion ${day < 10 ? '30' : '40'}°

Strength (0-5 scale):
- Right hip flexors: ${day < 10 ? '3/5' : '4/5'}
- Right knee extensors: ${day < 10 ? '3/5' : '4/5'}
- Right ankle dorsiflexors: ${day < 10 ? '2/5' : '3/5'}

Functional Assessment:
- Bed mobility: ${day < 10 ? 'Moderate assist' : 'Minimal assist'}
- Sit to stand: ${day < 10 ? 'Maximal assist' : 'Moderate assist'}
- Ambulation: ${day < 10 ? 'Not attempted' : day < 12 ? '10 feet with walker, moderate assist' : '25 feet with walker, minimal assist'}

Treatment Provided:
- Therapeutic exercises: ${day < 10 ? 'ROM, strengthening' : 'Gait training, balance'}
- Duration: 45 minutes
- Patient tolerance: Good

ASSESSMENT:
Right hemiparesis secondary to left MCA stroke. ${day < 10 ? 'Significant functional limitations.' : 'Showing steady improvement in strength and mobility.'}

PLAN:
- Continue daily PT sessions
- Focus on ${day < 10 ? 'strengthening and ROM' : 'gait training and balance'}
- Family education on safe transfers
- Discharge planning: ${day < 12 ? 'Consider SNF vs home with home health PT' : 'Home with home health PT recommended'}`,
    });
  }

  // Speech Therapy Notes (starting day 6, after stroke)
  for (let day = 6; day <= 14; day += 2) { // Every other day
    const stDate = new Date(ADMISSION_DATE);
    stDate.setDate(stDate.getDate() + day);
    stDate.setHours(11); // Late morning ST sessions

    notes.push({
      id: `note-st-${day}`,
      type: 'ST Progress Note',
      author: 'ST Roberts, Speech Therapy',
      date: stDate.toISOString(),
      content: `SPEECH THERAPY PROGRESS NOTE

SUBJECTIVE:
Patient reports ${day < 10 ? 'difficulty' : 'improving ability'} with speech and swallowing. Family notes ${day < 10 ? 'slurred speech' : 'clearer speech'}.

OBJECTIVE:
Swallow Assessment:
- Oral phase: ${day < 10 ? 'Impaired, delayed initiation' : 'Functional'}
- Pharyngeal phase: ${day < 10 ? 'Delayed swallow reflex, trace penetration' : 'Timely swallow, no penetration'}
- Laryngeal elevation: ${day < 10 ? 'Reduced' : 'Adequate'}
- Cough: ${day < 10 ? 'Weak' : 'Strong'}

Speech Assessment:
- Articulation: ${day < 10 ? 'Mildly impaired, slurred' : 'Mildly impaired, improving'}
- Voice quality: ${day < 10 ? 'Hoarse' : 'Normal'}
- Fluency: ${day < 10 ? 'Dysfluent' : 'Fluent'}

Cognitive Assessment:
- Orientation: ${day < 10 ? 'x2-3' : 'x4'}
- Attention: ${day < 10 ? 'Moderately impaired' : 'Mildly impaired'}
- Memory: ${day < 10 ? 'Short-term memory deficits' : 'Improving'}

Treatment Provided:
- Swallow therapy: ${day < 10 ? 'Compensatory strategies, exercises' : 'Advanced exercises'}
- Speech therapy: ${day < 10 ? 'Articulation drills' : 'Conversational practice'}
- Cognitive therapy: ${day < 10 ? 'Attention tasks' : 'Memory strategies'}
- Duration: 30 minutes
- Patient tolerance: Good

ASSESSMENT:
Dysarthria and dysphagia secondary to left MCA stroke. ${day < 10 ? 'Moderate deficits present.' : 'Showing improvement with therapy.'}

PLAN:
- Continue ST sessions ${day < 10 ? 'daily' : 'every other day'}
- ${day < 10 ? 'Modified diet: Pureed, nectar-thick liquids' : 'Diet upgrade: Mechanical soft, thin liquids'}
- Family education on safe swallowing
- Monitor for aspiration`,
    });
  }

  // Wound Care Notes (for foot infection, starting day 1)
  for (let day = 1; day <= 14; day += 2) { // Every other day
    const wcDate = new Date(ADMISSION_DATE);
    wcDate.setDate(wcDate.getDate() + day);
    wcDate.setHours(14); // Afternoon wound care

    notes.push({
      id: `note-wc-${day}`,
      type: 'Wound Care Note',
      author: 'WC Specialist Taylor, Wound Care',
      date: wcDate.toISOString(),
      content: `WOUND CARE PROGRESS NOTE

SUBJECTIVE:
Patient reports ${day < 5 ? 'persistent' : 'decreasing'} pain in left foot. ${day < 5 ? 'Wound draining.' : 'Wound appears to be healing.'}

OBJECTIVE:
Wound Location: Left foot, plantar surface, medial aspect
Wound Size: ${day < 5 ? '3.5 x 2.0 cm' : day < 10 ? '2.5 x 1.5 cm' : '1.5 x 1.0 cm'} (${day < 5 ? 'increased' : day < 10 ? 'stable' : 'decreased'} from last visit)
Wound Depth: ${day < 5 ? '0.5 cm' : day < 10 ? '0.3 cm' : '0.2 cm'}
Wound Appearance:
- Base: ${day < 5 ? 'Yellow slough, 50%' : day < 10 ? 'Pink granulation, 70%' : 'Pink granulation, 90%'}
- Edges: ${day < 5 ? 'Irregular, macerated' : day < 10 ? 'Regular, attached' : 'Regular, well-attached'}
- Surrounding skin: ${day < 5 ? 'Erythematous, warm, edematous' : day < 10 ? 'Mild erythema, cool' : 'Normal color, cool'}

Drainage:
- Amount: ${day < 5 ? 'Moderate, serosanguinous' : day < 10 ? 'Minimal, serous' : 'None'}
- Odor: ${day < 5 ? 'Foul' : day < 10 ? 'Mild' : 'None'}

Treatment Provided:
- Debridement: ${day < 5 ? 'Sharp debridement of slough' : 'None'}
- Dressing: ${day < 5 ? 'Alginate with secondary cover' : day < 10 ? 'Hydrocolloid' : 'Foam dressing'}
- Offloading: ${day < 10 ? 'Wheelchair, no weight bearing' : 'Partial weight bearing with boot'}
- Duration: 20 minutes

ASSESSMENT:
Left foot diabetic ulcer, ${day < 5 ? 'infected, improving with antibiotics' : day < 10 ? 'healing, granulation tissue present' : 'healing well, significant improvement'}.

PLAN:
- Continue current dressing regimen
- ${day < 5 ? 'Continue antibiotics' : 'Monitor for infection'}
- ${day < 10 ? 'Continue offloading' : 'Gradual return to weight bearing'}
- Reassess in ${day < 5 ? '2 days' : '3-4 days'}
- Patient education on foot care`,
    });
  }

  // Palliative Care Note (day 8, during ICU stay)
  const pcDate = new Date(ICU_ADMISSION_DATE);
  pcDate.setDate(pcDate.getDate() + 5);
  pcDate.setHours(15);

  notes.push({
    id: 'note-pc-1',
    type: 'Palliative Care Note',
    author: 'PC Specialist Wilson, Palliative Care',
    date: pcDate.toISOString(),
    content: `PALLIATIVE CARE CONSULTATION

REASON FOR CONSULT:
Family request for goals of care discussion given patient's critical illness (septic shock, MI, stroke).

SUBJECTIVE:
Patient is intubated and sedated. Family reports patient is a 39-year-old male with Type 2 DM. Previously independent, lives alone. No advance directive on file. Family expresses concern about prognosis and quality of life.

OBJECTIVE:
Current Status:
- Intubated, sedated
- On vasopressors (improving)
- Post-MI, post-stroke
- Multiple comorbidities

Family Meeting:
- Attended by: Wife, mother, two siblings
- Duration: 45 minutes
- Topics discussed: Prognosis, goals of care, code status, potential outcomes

ASSESSMENT:
Family is understandably distressed by patient's critical condition. They value patient's independence and quality of life. They are open to discussing goals of care but need more time to process information.

PLAN:
- Continue supportive care
- Family meeting scheduled for tomorrow
- Discuss code status preferences
- Provide emotional support to family
- Reassess goals of care as clinical status evolves
- Consider ethics consultation if needed`,
  });

  // Chaplain Services Note (day 9)
  const chDate = new Date(ICU_ADMISSION_DATE);
  chDate.setDate(chDate.getDate() + 6);
  chDate.setHours(16);

  notes.push({
    id: 'note-ch-1',
    type: 'Chaplain Note',
    author: 'Chaplain Martinez, Chaplain Services',
    date: chDate.toISOString(),
    content: `CHAPLAIN SERVICES NOTE

VISIT TYPE:
Pastoral care visit with patient and family

SUBJECTIVE:
Family expresses faith-based concerns and requests spiritual support. Patient is sedated but family present at bedside.

OBJECTIVE:
- Visit duration: 30 minutes
- Location: ICU room
- Attendees: Patient (sedated), wife, mother, two siblings
- Religious affiliation: ${'Catholic (family report)'}

SPIRITUAL ASSESSMENT:
- Family identifies as Catholic
- Expresses faith in God's plan
- Requests prayer and spiritual guidance
- Concerned about patient's soul and eternal life
- Values sacraments (requested priest visit)

INTERVENTIONS PROVIDED:
- Prayer with family
- Spiritual counseling
- Discussion of faith and hope
- Arranged for priest visit for sacrament of the sick
- Provided religious materials

ASSESSMENT:
Family is finding strength in their faith during this difficult time. They appreciate spiritual support and are comforted by prayer and religious services.

PLAN:
- Continue regular visits
- Coordinate with priest for sacraments
- Provide ongoing spiritual support
- Be available for family as needed
- Document any spiritual concerns or requests`,
  });

  return notes;
}

