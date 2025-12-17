/**
 * TypeScript type definitions for DocAssistAI
 */

import { fhir } from 'fhirclient';

// FHIR Types (re-exported from fhirclient)
export type Patient = fhir.Patient;
export type Condition = fhir.Condition;
export type Observation = fhir.Observation;
export type MedicationRequest = fhir.MedicationRequest;
export type Encounter = fhir.Encounter;
export type DiagnosticReport = fhir.DiagnosticReport;
export type Procedure = fhir.Procedure;
export type AllergyIntolerance = fhir.AllergyIntolerance;
export type Immunization = fhir.Immunization;
export type CarePlan = fhir.CarePlan;
export type Bundle = fhir.Bundle;

// SMART Launch Context
export interface SMARTLaunchContext {
  patientId: string;
  encounterId?: string;
  userId?: string;
  fhirClient: fhir.Client;
}

// AI Service Types
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Patient Summary Types
export interface PatientSummary {
  patient: Patient;
  conditions: Condition[];
  medications: MedicationRequest[];
  recentLabs: Observation[];
  recentVitals: Observation[];
  allergies: AllergyIntolerance[];
  recentEncounters: Encounter[];
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  patientContext?: boolean;
}

// Document Generation Types
export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'progress_note' | 'soap_note' | 'discharge_summary' | 'consult_note';
  sections: string[];
}

export interface GeneratedDocument {
  template: DocumentTemplate;
  content: string;
  patientId: string;
  generatedAt: Date;
}

