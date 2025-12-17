/**
 * Mock Data Utilities
 * Provides mock FHIR data for local development and testing
 * without requiring Oracle Health EHR access
 */

import { PatientSummary, Patient, Condition, Observation, MedicationRequest, AllergyIntolerance } from '../types';

/**
 * Generate mock patient data
 */
export const createMockPatient = (): Patient => {
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
};

/**
 * Generate mock conditions
 */
export const createMockConditions = (): Condition[] => {
  return [
    {
      resourceType: 'Condition',
      id: 'condition-1',
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active',
          },
        ],
      },
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '44054006',
            display: 'Diabetes mellitus type 2',
          },
        ],
        text: 'Type 2 Diabetes Mellitus',
      },
      onsetDateTime: '2020-01-15',
      subject: {
        reference: 'Patient/mock-patient-123',
      },
    },
    {
      resourceType: 'Condition',
      id: 'condition-2',
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active',
          },
        ],
      },
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '38341003',
            display: 'Hypertensive disorder',
          },
        ],
        text: 'Hypertension',
      },
      onsetDateTime: '2018-03-20',
      subject: {
        reference: 'Patient/mock-patient-123',
      },
    },
  ] as Condition[];
};

/**
 * Generate mock medications
 */
export const createMockMedications = (): MedicationRequest[] => {
  return [
    {
      resourceType: 'MedicationRequest',
      id: 'med-1',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: '860975',
            display: 'Metformin Hydrochloride 500 MG Oral Tablet',
          },
        ],
        text: 'Metformin 500mg',
      },
      subject: {
        reference: 'Patient/mock-patient-123',
      },
      dosageInstruction: [
        {
          timing: {
            repeat: {
              frequency: 2,
              period: 1,
              periodUnit: 'd',
            },
          },
          doseAndRate: [
            {
              doseQuantity: {
                value: 500,
                unit: 'mg',
              },
            },
          ],
        },
      ],
    },
    {
      resourceType: 'MedicationRequest',
      id: 'med-2',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: '314076',
            display: 'Amlodipine 5 MG Oral Tablet',
          },
        ],
        text: 'Amlodipine 5mg',
      },
      subject: {
        reference: 'Patient/mock-patient-123',
      },
      dosageInstruction: [
        {
          timing: {
            repeat: {
              frequency: 1,
              period: 1,
              periodUnit: 'd',
            },
          },
          doseAndRate: [
            {
              doseQuantity: {
                value: 5,
                unit: 'mg',
              },
            },
          ],
        },
      ],
    },
  ] as MedicationRequest[];
};

/**
 * Generate mock allergies
 */
export const createMockAllergies = (): AllergyIntolerance[] => {
  return [
    {
      resourceType: 'AllergyIntolerance',
      id: 'allergy-1',
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: 'active',
            display: 'Active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: 'confirmed',
            display: 'Confirmed',
          },
        ],
      },
      type: 'allergy',
      category: ['medication'],
      criticality: 'high',
      code: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: '7980',
            display: 'Penicillin',
          },
        ],
        text: 'Penicillin',
      },
      patient: {
        reference: 'Patient/mock-patient-123',
      },
      reaction: [
        {
          manifestation: [
            {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: '271807003',
                  display: 'Rash',
                },
              ],
              text: 'Rash',
            },
          ],
          severity: 'severe',
        },
      ],
    },
  ] as AllergyIntolerance[];
};

/**
 * Generate mock lab observations
 */
export const createMockLabs = (): Observation[] => {
  const today = new Date();
  const dates = [
    new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  ];

  return [
    {
      resourceType: 'Observation',
      id: 'lab-1',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: 'Laboratory',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '2339-0',
            display: 'Glucose [Mass/volume] in Blood',
          },
        ],
        text: 'Blood Glucose',
      },
      subject: {
        reference: 'Patient/mock-patient-123',
      },
      effectiveDateTime: dates[0].toISOString(),
      valueQuantity: {
        value: 145,
        unit: 'mg/dL',
        system: 'http://unitsofmeasure.org',
        code: 'mg/dL',
      },
      interpretation: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: 'H',
              display: 'High',
            },
          ],
        },
      ],
    },
    {
      resourceType: 'Observation',
      id: 'lab-2',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: 'Laboratory',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '718-7',
            display: 'Hemoglobin [Mass/volume] in Blood',
          },
        ],
        text: 'Hemoglobin',
      },
      subject: {
        reference: 'Patient/mock-patient-123',
      },
      effectiveDateTime: dates[1].toISOString(),
      valueQuantity: {
        value: 14.2,
        unit: 'g/dL',
        system: 'http://unitsofmeasure.org',
        code: 'g/dL',
      },
    },
    {
      resourceType: 'Observation',
      id: 'lab-3',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: 'Laboratory',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '2093-3',
            display: 'Cholesterol [Mass/volume] in Serum or Plasma',
          },
        ],
        text: 'Total Cholesterol',
      },
      subject: {
        reference: 'Patient/mock-patient-123',
      },
      effectiveDateTime: dates[2].toISOString(),
      valueQuantity: {
        value: 195,
        unit: 'mg/dL',
        system: 'http://unitsofmeasure.org',
        code: 'mg/dL',
      },
    },
  ] as Observation[];
};

/**
 * Generate mock vital signs
 */
export const createMockVitals = (): Observation[] => {
  const today = new Date();
  const dates = [
    new Date(today.getTime() - 0 * 60 * 60 * 1000), // Now
    new Date(today.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
    new Date(today.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
  ];

  return [
    {
      resourceType: 'Observation',
      id: 'vital-1',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel',
          },
        ],
        text: 'Blood Pressure',
      },
      subject: {
        reference: 'Patient/mock-patient-123',
      },
      effectiveDateTime: dates[0].toISOString(),
      component: [
        {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8480-6',
                display: 'Systolic blood pressure',
              },
            ],
          },
          valueQuantity: {
            value: 132,
            unit: 'mm[Hg]',
          },
        },
        {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8462-4',
                display: 'Diastolic blood pressure',
              },
            ],
          },
          valueQuantity: {
            value: 85,
            unit: 'mm[Hg]',
          },
        },
      ],
    },
    {
      resourceType: 'Observation',
      id: 'vital-2',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate',
          },
        ],
        text: 'Heart Rate',
      },
      subject: {
        reference: 'Patient/mock-patient-123',
      },
      effectiveDateTime: dates[1].toISOString(),
      valueQuantity: {
        value: 72,
        unit: '/min',
        system: 'http://unitsofmeasure.org',
        code: '/min',
      },
    },
    {
      resourceType: 'Observation',
      id: 'vital-3',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature',
          },
        ],
        text: 'Temperature',
      },
      subject: {
        reference: 'Patient/mock-patient-123',
      },
      effectiveDateTime: dates[2].toISOString(),
      valueQuantity: {
        value: 98.6,
        unit: '[degF]',
        system: 'http://unitsofmeasure.org',
        code: '[degF]',
      },
    },
  ] as Observation[];
};

/**
 * Generate complete mock patient summary
 */
export const createMockPatientSummary = (): PatientSummary => {
  return {
    patient: createMockPatient(),
    conditions: createMockConditions(),
    medications: createMockMedications(),
    recentLabs: createMockLabs(),
    recentVitals: createMockVitals(),
    allergies: createMockAllergies(),
    recentEncounters: [],
  };
};

/**
 * Check if we're in development mode and should use mock data
 */
export const shouldUseMockData = (): boolean => {
  return import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_DATA === 'true';
};

