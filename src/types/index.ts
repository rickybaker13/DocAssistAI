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
export type DocumentReference = fhir.DocumentReference;
export type Communication = fhir.Communication;
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
  // Extended data (optional, for comprehensive mock data)
  fluidIO?: Observation[];
  imagingReports?: DiagnosticReport[];
  procedures?: Procedure[];
  clinicalNotes?: any[];
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

// Discovery Types
export interface NormalizedNote {
  id: string;
  type: string;
  author: string;
  date: string;
  content: string;
  source: 'DocumentReference' | 'Communication';
  metadata?: {
    category?: string[];
    status?: string;
    subject?: string;
  };
}

export interface NoteTypeAnalysis {
  type: string;
  count: number;
  sampleNotes: NormalizedNote[];
  providers: string[];
  dateRange: {
    earliest: string;
    latest: string;
  };
}

export interface ProviderTypeAnalysis {
  provider: string;
  role?: string;
  service?: string;
  count: number;
  noteTypes: string[];
}

export interface DiscoveryReport {
  totalNotes: number;
  noteTypes: NoteTypeAnalysis[];
  providerTypes: ProviderTypeAnalysis[];
  dateRange: {
    earliest: string;
    latest: string;
  };
  generatedAt: string;
}


// Signal / Briefing Types — shared between BriefingPanel and SignalDomainCard
export interface SignalDomain {
  name: string;
  findings: string[];
  trend?: 'improving' | 'worsening' | 'stable' | 'new';
}

export interface PatientSignal {
  headline: string;
  domains: SignalDomain[];
  pending: string[];
  stable: string[];
  generatedAt: string;
  timeWindowHours: number;
}

// ICU Patient Data — comprehensive parallel fetch result
export interface ICUPatientData {
  patient: Patient;
  conditions: Condition[];
  medications: MedicationRequest[];
  medicationAdmins: any[];
  labs: Observation[];
  vitals: Observation[];
  encounters: Encounter[];
  allergies: AllergyIntolerance[];
  diagnosticReports: DiagnosticReport[];
  procedures: Procedure[];
  notes: any[];
  deviceMetrics: any[];
  fetchedAt: string;
}
