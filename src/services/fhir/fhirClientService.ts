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
  Bundle,
  PatientSummary,
} from '../../types';
import { smartAuthService } from '../auth/smartAuthService';

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
    return (bundle.entry || []).map(entry => entry.resource as Condition);
  }

  /**
   * Get patient observations
   */
  async getObservations(patientId: string): Promise<Observation[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getObservations(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Observation);
  }

  /**
   * Get vital signs
   */
  async getVitals(patientId: string): Promise<Observation[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getVitals(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Observation);
  }

  /**
   * Get laboratory results
   */
  async getLabs(patientId: string): Promise<Observation[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getLabs(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Observation);
  }

  /**
   * Get active medications
   */
  async getMedications(patientId: string): Promise<MedicationRequest[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getMedications(patientId));
    return (bundle.entry || []).map(entry => entry.resource as MedicationRequest);
  }

  /**
   * Get encounters
   */
  async getEncounters(patientId: string): Promise<Encounter[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getEncounters(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Encounter);
  }

  /**
   * Get diagnostic reports
   */
  async getDiagnosticReports(patientId: string): Promise<DiagnosticReport[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getDiagnosticReports(patientId));
    return (bundle.entry || []).map(entry => entry.resource as DiagnosticReport);
  }

  /**
   * Get procedures
   */
  async getProcedures(patientId: string): Promise<Procedure[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getProcedures(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Procedure);
  }

  /**
   * Get allergies
   */
  async getAllergies(patientId: string): Promise<AllergyIntolerance[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getAllergies(patientId));
    return (bundle.entry || []).map(entry => entry.resource as AllergyIntolerance);
  }

  /**
   * Get immunizations
   */
  async getImmunizations(patientId: string): Promise<Immunization[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getImmunizations(patientId));
    return (bundle.entry || []).map(entry => entry.resource as Immunization);
  }

  /**
   * Get care plans
   */
  async getCarePlans(patientId: string): Promise<CarePlan[]> {
    const bundle = await this.fetchBundle(FHIR_QUERIES.getCarePlans(patientId));
    return (bundle.entry || []).map(entry => entry.resource as CarePlan);
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
      recentLabs: labs.slice(0, 20), // Most recent 20 labs
      recentVitals: vitals.slice(0, 50), // Most recent 50 vitals
      allergies,
      recentEncounters: encounters.slice(0, 10), // Most recent 10 encounters
    };
  }
}

export const fhirClientService = new FHIRClientService();

