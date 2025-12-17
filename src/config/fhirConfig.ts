/**
 * FHIR Configuration and Resource Types
 * Defines supported FHIR resources and scopes for DocAssistAI
 */

export const FHIR_RESOURCES = {
  Patient: 'Patient',
  Condition: 'Condition',
  Observation: 'Observation',
  MedicationRequest: 'MedicationRequest',
  Encounter: 'Encounter',
  DiagnosticReport: 'DiagnosticReport',
  Procedure: 'Procedure',
  AllergyIntolerance: 'AllergyIntolerance',
  Immunization: 'Immunization',
  CarePlan: 'CarePlan',
  DocumentReference: 'DocumentReference',
  Communication: 'Communication',
  ServiceRequest: 'ServiceRequest',
} as const;

/**
 * SMART on FHIR Scopes
 * Comprehensive scopes for read/write access to patient resources
 */
export const SMART_SCOPES = [
  'openid',
  'fhirUser',
  'launch',
  'patient/*.read',
  'patient/*.write',
  'user/*.read',
  'offline_access',
];

/**
 * FHIR Resource Queries
 * Common query parameters for fetching resources
 */
export const FHIR_QUERIES = {
  // Patient resources
  getPatient: (patientId: string) => `Patient/${patientId}`,
  
  // Conditions (diagnoses)
  getConditions: (patientId: string) => `Condition?patient=${patientId}&_sort=-date`,
  
  // Observations (labs, vitals)
  getObservations: (patientId: string) => `Observation?patient=${patientId}&_sort=-date&_count=100`,
  getVitals: (patientId: string) => `Observation?patient=${patientId}&category=vital-signs&_sort=-date`,
  getLabs: (patientId: string) => `Observation?patient=${patientId}&category=laboratory&_sort=-date`,
  
  // Medications
  getMedications: (patientId: string) => `MedicationRequest?patient=${patientId}&status=active&_sort=-date`,
  
  // Encounters
  getEncounters: (patientId: string) => `Encounter?patient=${patientId}&_sort=-date&_count=50`,
  
  // Diagnostic Reports
  getDiagnosticReports: (patientId: string) => `DiagnosticReport?patient=${patientId}&_sort=-date&_count=50`,
  
  // Procedures
  getProcedures: (patientId: string) => `Procedure?patient=${patientId}&_sort=-date`,
  
  // Allergies
  getAllergies: (patientId: string) => `AllergyIntolerance?patient=${patientId}`,
  
  // Immunizations
  getImmunizations: (patientId: string) => `Immunization?patient=${patientId}&_sort=-date`,
  
  // Care Plans
  getCarePlans: (patientId: string) => `CarePlan?patient=${patientId}&status=active`,
} as const;

export type FHIRResourceType = typeof FHIR_RESOURCES[keyof typeof FHIR_RESOURCES];

