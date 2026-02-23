/**
 * FHIR Client Service
 * Handles all FHIR API interactions
 */

import { fhir } from 'fhirclient';
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
  Immunization,
  CarePlan,
  DocumentReference,
  Communication,
  Bundle,
  PatientSummary,
  ICUPatientData,
} from '../../types';
import { smartAuthService } from '../auth/smartAuthService';

// Convenience type alias for FHIR bundle entry (typed as any to match the
// repo-wide pattern under the fhirclient type resolution issue on this env)
type BundleEntry = any;

class FHIRClientService {
  /**
   * Get FHIR client
   */
  private getClient(): fhir.Client {
    return smartAuthService.getClient();
  }

  /**
   * Fetch a single resource
   */
  async fetchResource<T>(resourceUrl: string): Promise<T> {
    const client = this.getClient();
    const response = await client.request<T>(resourceUrl);
    return response;
  }

  /**
   * Fetch multiple resources (bundle)
   */
  async fetchBundle(resourceUrl: string): Promise<Bundle> {
    return this.fetchResource<Bundle>(resourceUrl);
  }

  /**
   * Get patient information
   */
  async getPatient(patientId: string): Promise<Patient> {
    return this.fetchResource<Patient>(FHIR_QUERIES.getPatient(patientId));
  }

  /**
   * Get patient conditions (diagnoses)
   */
  async getConditions(patientId: string): Promise<Condition[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getConditions(patientId));
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as Condition);
  }

  /**
   * Get patient observations
   */
  async getObservations(patientId: string): Promise<Observation[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getObservations(patientId));
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as Observation);
  }

  /**
   * Get vital signs
   * @param patientId - Patient ID
   * @param count - Maximum number of results (default: uses fhirConfig default)
   * @param hoursBack - If provided, restrict results to this many hours back
   */
  async getVitals(patientId: string, count?: number, hoursBack?: number): Promise<Observation[]> {
    let query: string;
    if (count !== undefined || hoursBack !== undefined) {
      const resolvedCount = count ?? 200;
      let q = `Observation?patient=${patientId}&category=vital-signs&_sort=-date&_count=${resolvedCount}`;
      if (hoursBack !== undefined) {
        const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
        q += `&date=ge${since}`;
      }
      query = q;
    } else {
      query = FHIR_QUERIES.getVitals(patientId);
    }
    const bundle = await this.fetchBundle(query);
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as Observation);
  }

  /**
   * Get laboratory results
   * @param patientId - Patient ID
   * @param count - Maximum number of results (default: uses fhirConfig default)
   * @param hoursBack - If provided, restrict results to this many hours back
   */
  async getLabs(patientId: string, count?: number, hoursBack?: number): Promise<Observation[]> {
    let query: string;
    if (count !== undefined || hoursBack !== undefined) {
      const resolvedCount = count ?? 100;
      let q = `Observation?patient=${patientId}&category=laboratory&_sort=-date&_count=${resolvedCount}`;
      if (hoursBack !== undefined) {
        const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
        q += `&date=ge${since}`;
      }
      query = q;
    } else {
      query = FHIR_QUERIES.getLabs(patientId);
    }
    const bundle = await this.fetchBundle(query);
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as Observation);
  }

  /**
   * Get active medications
   */
  async getMedications(patientId: string): Promise<MedicationRequest[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getMedications(patientId));
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as MedicationRequest);
  }

  /**
   * Get encounters
   */
  async getEncounters(patientId: string): Promise<Encounter[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getEncounters(patientId));
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as Encounter);
  }

  /**
   * Get diagnostic reports
   */
  async getDiagnosticReports(patientId: string): Promise<DiagnosticReport[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getDiagnosticReports(patientId));
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as DiagnosticReport);
  }

  /**
   * Get procedures
   */
  async getProcedures(patientId: string): Promise<Procedure[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getProcedures(patientId));
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as Procedure);
  }

  /**
   * Get allergies
   */
  async getAllergies(patientId: string): Promise<AllergyIntolerance[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getAllergies(patientId));
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as AllergyIntolerance);
  }

  /**
   * Get immunizations
   */
  async getImmunizations(patientId: string): Promise<Immunization[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getImmunizations(patientId));
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as Immunization);
  }

  /**
   * Get care plans
   */
  async getCarePlans(patientId: string): Promise<CarePlan[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getCarePlans(patientId));
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as CarePlan);
  }

  /**
   * Get document references (clinical notes)
   * Validates that each document belongs to the correct patient
   */
  async getDocumentReferences(patientId: string): Promise<DocumentReference[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getDocumentReferences(patientId));
    const documents = (bundle.entry || []).map((entry: BundleEntry) => entry.resource as DocumentReference);

    // Validate that each document belongs to the correct patient
    const validatedDocuments = documents.filter((doc: DocumentReference) => {
      const subjectRef = doc.subject?.reference;
      if (!subjectRef) {
        console.warn(`[FHIR Client] DocumentReference ${doc.id} has no subject reference - filtering out`);
        return false;
      }

      // Extract patient ID from reference (format: "Patient/123456" or just "123456")
      const refPatientId = subjectRef.replace('Patient/', '').split('/')[0];
      if (refPatientId !== patientId) {
        console.warn(`[FHIR Client] DocumentReference ${doc.id} belongs to different patient: ${refPatientId} (expected: ${patientId}) - filtering out`);
        return false;
      }

      return true;
    });

    if (validatedDocuments.length < documents.length) {
      const filteredCount = documents.length - validatedDocuments.length;
      console.warn(`[FHIR Client] Filtered out ${filteredCount} DocumentReference(s) that don't match patient ${patientId}`);
    }

    return validatedDocuments;
  }

  /**
   * Get communications (alternative note storage)
   */
  async getCommunications(patientId: string): Promise<Communication[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getCommunications(patientId));
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as Communication);
  }

  // -------------------------------------------------------------------------
  // ICU-specific extensions
  // -------------------------------------------------------------------------

  /**
   * Get medication administrations (drip titrations, PRN doses — critical in ICU)
   * @param patientId - Patient ID
   * @param count - Maximum number of results (default: 100)
   * Note: MedicationAdministration is not in the existing type imports; using any[].
   */
  async getMedicationAdministrations(patientId: string, count = 100): Promise<any[]> {
    const bundle = await this.fetchBundle(
      `MedicationAdministration?patient=${patientId}&_sort=-effective-time&_count=${count}`
    );
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource);
  }

  /**
   * Get device/ventilator metrics as Observations with vital-signs category.
   * Cerner exposes device/ventilator data as Observations, not DeviceMetric resources.
   * DeviceMetric is not in Cerner's patient-compartment FHIR API, and
   * "DeviceMetric?patient=" is not a valid FHIR R4 search parameter.
   * This intentionally overlaps with getVitals — the Signal Engine can deduplicate.
   * @param patientId - Patient ID
   * @param count - Maximum number of results (default: 200)
   */
  async getDeviceMetrics(patientId: string, count = 200): Promise<Observation[]> {
    // Cerner exposes device/ventilator data as Observations, not DeviceMetric resources
    // DeviceMetric is not in Cerner's patient-compartment FHIR API
    const bundle = await this.fetchBundle(
      `Observation?patient=${patientId}&category=vital-signs&_sort=-date&_count=${count}`
    );
    return (bundle.entry || [])
      .map((entry: BundleEntry) => entry?.resource)
      .filter(Boolean) as Observation[];
  }

  /**
   * Get clinical notes via DocumentReference
   * @param patientId - Patient ID
   * @param count - Maximum number of results (default: 20)
   */
  async getClinicalNotes(patientId: string, count = 20): Promise<DocumentReference[]> {
    const bundle = await this.fetchBundle(
      `DocumentReference?patient=${patientId}&_sort=-date&_count=${count}`
    );
    return (bundle.entry || []).map((entry: BundleEntry) => entry.resource as DocumentReference);
  }

  /**
   * Get comprehensive ICU patient data in a single parallel fetch.
   * Core clinical resources fail-fast if unavailable.
   * Optional/device-specific resources (medicationAdmins, deviceMetrics, notes)
   * degrade gracefully — returning empty arrays — so a single unsupported
   * resource type (e.g. DeviceMetric on Cerner) does not abort the entire call.
   */
  async getICUPatientData(patientId: string): Promise<ICUPatientData> {
    // safeGet wraps optional resource fetches: logs a warning and returns []
    // instead of propagating the error through Promise.all.
    const safeGet = <T>(p: Promise<T[]>, label: string): Promise<T[]> =>
      p.catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[FhirClientService] Optional resource "${label}" unavailable: ${msg}`);
        return [] as T[];
      });

    const [
      patient,
      conditions,
      medications,
      medicationAdmins,
      labs,
      vitals,
      encounters,
      allergies,
      diagnosticReports,
      procedures,
      notes,
      deviceMetrics,
    ] = await Promise.all([
      // Core clinical resources — fail-fast if missing
      this.getPatient(patientId),
      this.getConditions(patientId),
      this.getMedications(patientId),
      // Optional/device-specific resource — degrades gracefully
      safeGet(this.getMedicationAdministrations(patientId), 'MedicationAdministration'),
      // Core clinical resources (continued) — fail-fast if missing
      this.getLabs(patientId),
      this.getVitals(patientId),
      this.getEncounters(patientId),
      this.getAllergies(patientId),
      this.getDiagnosticReports(patientId),
      this.getProcedures(patientId),
      // Optional/device-specific resources — degrade gracefully
      safeGet(this.getClinicalNotes(patientId), 'DocumentReference (clinical notes)'),
      safeGet(this.getDeviceMetrics(patientId), 'DeviceMetric (Observation/vital-signs)'),
    ]);

    return {
      patient,
      conditions,
      medications,
      medicationAdmins,
      labs,
      vitals,
      encounters,
      allergies,
      diagnosticReports,
      procedures,
      notes,
      deviceMetrics,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Get comprehensive patient summary
   */
  async getPatientSummary(patientId: string): Promise<PatientSummary> {
    const [patient, conditions, medications, labs, vitals, allergies, encounters] = await Promise.all([
      this.getPatient(patientId),
      this.getConditions(patientId),
      this.getMedications(patientId),
      this.getLabs(patientId),
      this.getVitals(patientId),
      this.getAllergies(patientId),
      this.getEncounters(patientId),
    ]);

    return {
      patient,
      conditions,
      medications,
      recentLabs: labs.slice(0, 100), // Most recent 100 labs (expanded for comprehensive data)
      recentVitals: vitals.slice(0, 200), // Most recent 200 vitals (expanded for comprehensive data)
      allergies,
      recentEncounters: encounters.slice(0, 10), // Most recent 10 encounters
    };
  }
}

export const fhirClientService = new FHIRClientService();
