/**
 * Open Sandbox FHIR Service
 * Direct HTTP calls to Open Sandbox (no authentication required)
 */

import { FHIR_QUERIES } from '../../config/fhirConfig';
import {
  Patient,
  Condition,
  Observation,
  MedicationRequest,
  Encounter,
  DiagnosticReport,
  Procedure,
  AllergyIntolerance,
  DocumentReference,
  Communication,
  Bundle,
  PatientSummary,
} from '../../types';
import { appConfig } from '../../config/appConfig';

class OpenSandboxService {
  private baseUrl: string;

  constructor() {
    // Use Open Sandbox base URL (no auth required)
    // Default to Open Sandbox if not specified
    const configuredUrl = appConfig.fhirBaseUrl;
    if (configuredUrl && configuredUrl.includes('fhir-open.cerner.com')) {
      this.baseUrl = configuredUrl;
    } else {
      // Default Open Sandbox URL
      this.baseUrl = 'https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d';
    }
    console.log('[Open Sandbox] Using base URL:', this.baseUrl);
  }

  /**
   * Make a direct HTTP request to Open Sandbox
   */
  private async fetch<T>(resourcePath: string): Promise<T> {
    const url = `${this.baseUrl}/${resourcePath}`;
    console.log('[Open Sandbox] Fetching:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FHIR request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get patient information
   */
  async getPatient(patientId: string): Promise<Patient> {
    try {
      const patient = await this.fetch<Patient>(FHIR_QUERIES.getPatient(patientId));
      
      // Check if we got an OperationOutcome error instead of a Patient resource
      if ((patient as any).resourceType === 'OperationOutcome') {
        const outcome = patient as any;
        const errorMsg = outcome.issue?.[0]?.details?.text || outcome.issue?.[0]?.diagnostics || 'Patient not found';
        throw new Error(`Patient ${patientId} not found in Open Sandbox: ${errorMsg}`);
      }
      
      return patient;
    } catch (err: any) {
      if (err.message?.includes('not found') || err.message?.includes('404')) {
        throw new Error(`Patient ${patientId} does not exist in Oracle Health Open Sandbox. Try patient ID: 12742400`);
      }
      throw err;
    }
  }

  /**
   * Get patient conditions
   */
  async getConditions(patientId: string): Promise<Condition[]> {
    const bundle = await this.fetch<Bundle>(FHIR_QUERIES.getConditions(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Condition);
  }

  /**
   * Get patient observations
   */
  async getObservations(patientId: string): Promise<Observation[]> {
    const bundle = await this.fetch<Bundle>(FHIR_QUERIES.getObservations(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Observation);
  }

  /**
   * Get vital signs
   */
  async getVitals(patientId: string): Promise<Observation[]> {
    const bundle = await this.fetch<Bundle>(FHIR_QUERIES.getVitals(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Observation);
  }

  /**
   * Get laboratory results
   */
  async getLabs(patientId: string): Promise<Observation[]> {
    const bundle = await this.fetch<Bundle>(FHIR_QUERIES.getLabs(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Observation);
  }

  /**
   * Get active medications
   */
  async getMedications(patientId: string): Promise<MedicationRequest[]> {
    const bundle = await this.fetch<Bundle>(FHIR_QUERIES.getMedications(patientId));
    return (bundle.entry || []).map(entry => entry.resource as MedicationRequest);
  }

  /**
   * Get encounters
   */
  async getEncounters(patientId: string): Promise<Encounter[]> {
    const bundle = await this.fetch<Bundle>(FHIR_QUERIES.getEncounters(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Encounter);
  }

  /**
   * Get diagnostic reports
   */
  async getDiagnosticReports(patientId: string): Promise<DiagnosticReport[]> {
    const bundle = await this.fetch<Bundle>(FHIR_QUERIES.getDiagnosticReports(patientId));
    return (bundle.entry || []).map(entry => entry.resource as DiagnosticReport);
  }

  /**
   * Get procedures
   */
  async getProcedures(patientId: string): Promise<Procedure[]> {
    const bundle = await this.fetch<Bundle>(FHIR_QUERIES.getProcedures(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Procedure);
  }

  /**
   * Get allergies
   */
  async getAllergies(patientId: string): Promise<AllergyIntolerance[]> {
    const bundle = await this.fetch<Bundle>(FHIR_QUERIES.getAllergies(patientId));
    return (bundle.entry || []).map(entry => entry.resource as AllergyIntolerance);
  }

  /**
   * Get document references (clinical notes)
   * Tries both 'subject' (FHIR R4) and 'patient' (legacy) parameters for compatibility
   */
  async getDocumentReferences(patientId: string): Promise<DocumentReference[]> {
    let documents: DocumentReference[] = [];
    
    // Try 'subject' parameter first (FHIR R4 standard)
    try {
      console.log(`[Open Sandbox] Trying DocumentReference query with subject=Patient/${patientId}`);
      const bundle = await this.fetch<Bundle>(`DocumentReference?subject=Patient/${patientId}&_sort=-date&_count=100`);
      documents = (bundle.entry || []).map(entry => entry.resource as DocumentReference);
      console.log(`[Open Sandbox] Found ${documents.length} DocumentReference(s) using 'subject' parameter`);
    } catch (err: any) {
      console.warn('[Open Sandbox] Query with "subject" parameter failed, trying "patient" parameter:', err.message);
      
      // Fallback to 'patient' parameter (some servers use this)
      try {
        console.log(`[Open Sandbox] Trying DocumentReference query with patient=${patientId}`);
        const bundle = await this.fetch<Bundle>(`DocumentReference?patient=${patientId}&_sort=-date&_count=100`);
        documents = (bundle.entry || []).map(entry => entry.resource as DocumentReference);
        console.log(`[Open Sandbox] Found ${documents.length} DocumentReference(s) using 'patient' parameter`);
      } catch (fallbackErr: any) {
        console.error('[Open Sandbox] Both query formats failed:', fallbackErr.message);
        return [];
      }
    }
    
    if (documents.length === 0) {
      console.warn(`[Open Sandbox] No DocumentReferences found for patient ${patientId}`);
      console.log(`[Open Sandbox] This patient may not have clinical notes, or the query format may need adjustment`);
      return [];
    }
    
    // Validate that each document belongs to the correct patient
    const validatedDocuments = documents.filter(doc => {
      const subjectRef = doc.subject?.reference;
      if (!subjectRef) {
        console.warn(`[Open Sandbox] DocumentReference ${doc.id} has no subject reference - filtering out`);
        return false;
      }
      
      // Extract patient ID from reference (format: "Patient/123456" or just "123456")
      const refPatientId = subjectRef.replace('Patient/', '').split('/')[0];
      if (refPatientId !== patientId) {
        console.warn(`[Open Sandbox] DocumentReference ${doc.id} belongs to different patient: ${refPatientId} (expected: ${patientId}) - filtering out`);
        return false;
      }
      
      return true;
    });
    
    if (validatedDocuments.length < documents.length) {
      const filteredCount = documents.length - validatedDocuments.length;
      console.warn(`[Open Sandbox] Filtered out ${filteredCount} DocumentReference(s) that don't match patient ${patientId}`);
    }
    
    console.log(`[Open Sandbox] Returning ${validatedDocuments.length} valid DocumentReference(s) for patient ${patientId}`);
    return validatedDocuments;
  }

  /**
   * Get communications (alternative note storage)
   * Note: Open Sandbox may not support Communication resources
   */
  async getCommunications(patientId: string): Promise<Communication[]> {
    try {
      // Try Communication resource, but it may not be supported in Open Sandbox
      const bundle = await this.fetch<Bundle>(`Communication?subject=Patient/${patientId}&_sort=-sent&_count=100`);
      return (bundle.entry || []).map(entry => entry.resource as Communication);
    } catch (err: any) {
      // Communication resource may not be available in Open Sandbox - that's okay
      console.log('[Open Sandbox] Communication resource not available (this is normal for Open Sandbox)');
      return [];
    }
  }

  /**
   * Get comprehensive patient summary
   */
  async getPatientSummary(patientId: string): Promise<PatientSummary> {
    console.log('[Open Sandbox] Fetching patient summary for:', patientId);
    
    const [patient, conditions, medications, allergies, labs, vitals, encounters, documentRefs, communications] = 
      await Promise.all([
        this.getPatient(patientId).catch(err => {
          console.warn('[Open Sandbox] Failed to fetch patient:', err);
          return null;
        }),
        this.getConditions(patientId).catch(err => {
          console.warn('[Open Sandbox] Failed to fetch conditions:', err);
          return [];
        }),
        this.getMedications(patientId).catch(err => {
          console.warn('[Open Sandbox] Failed to fetch medications:', err);
          return [];
        }),
        this.getAllergies(patientId).catch(err => {
          console.warn('[Open Sandbox] Failed to fetch allergies:', err);
          return [];
        }),
        this.getLabs(patientId).catch(err => {
          console.warn('[Open Sandbox] Failed to fetch labs:', err);
          return [];
        }),
        this.getVitals(patientId).catch(err => {
          console.warn('[Open Sandbox] Failed to fetch vitals:', err);
          return [];
        }),
        this.getEncounters(patientId).catch(err => {
          console.warn('[Open Sandbox] Failed to fetch encounters:', err);
          return [];
        }),
        this.getDocumentReferences(patientId).catch(err => {
          console.warn('[Open Sandbox] Failed to fetch document references:', err);
          return [];
        }),
        this.getCommunications(patientId).catch(err => {
          console.warn('[Open Sandbox] Failed to fetch communications:', err);
          return [];
        }),
      ]);

    if (!patient) {
      throw new Error(`Failed to fetch patient ${patientId} from Open Sandbox`);
    }

    // Convert DocumentReference and Communication to clinical notes format
    let clinicalNotes = [
      ...(documentRefs || []).map(doc => ({
        id: doc.id,
        type: doc.type?.coding?.[0]?.display || doc.type?.text || 'Clinical Note',
        author: doc.author?.[0]?.display || 'Unknown',
        date: doc.date || doc.meta?.lastUpdated,
        content: doc.content?.[0]?.attachment?.data || doc.description || '',
        source: 'DocumentReference',
      })),
      ...(communications || []).map(comm => ({
        id: comm.id,
        type: comm.category?.[0]?.coding?.[0]?.display || 'Communication',
        author: comm.sender?.display || 'Unknown',
        date: comm.sent || comm.meta?.lastUpdated,
        content: comm.payload?.[0]?.contentString || comm.payload?.[0]?.contentAttachment?.data || '',
        source: 'Communication',
      })),
    ];

    // If no notes found in sandbox, use mock notes for testing
    if (clinicalNotes.length === 0) {
      console.log('[Open Sandbox] No clinical notes found in sandbox. Using mock notes for testing.');
      try {
        const { createClinicalNotes } = await import('../../utils/comprehensiveMockData');
        clinicalNotes = createClinicalNotes();
      } catch (err) {
        console.warn('[Open Sandbox] Failed to load mock notes:', err);
      }
    }

    console.log(`[Open Sandbox] Using ${clinicalNotes.length} clinical notes (${documentRefs?.length || 0} from DocumentReferences, ${communications?.length || 0} from Communications, ${clinicalNotes.length - (documentRefs?.length || 0) - (communications?.length || 0)} mock notes)`);

    return {
      patient,
      conditions: conditions || [],
      medications: medications || [],
      allergies: allergies || [],
      labResults: labs || [],
      vitalSigns: vitals || [],
      encounters: encounters || [],
      clinicalNotes: clinicalNotes || [],
    };
  }
}

export const openSandboxService = new OpenSandboxService();

