/**
 * Mock FHIR Service
 * Provides mock FHIR data for local development
 * Use when SMART launch is not available
 */

import { PatientSummary } from '../../types';
import {
  createComprehensiveMockPatientSummary,
  createFluidIOObservations,
  createImagingReports,
  createProcedures,
  createClinicalNotes,
} from '../../utils/comprehensiveMockData';

class MockFhirService {
  /**
   * Simulate delay for realistic testing
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get mock patient summary
   * Uses comprehensive mock data for realistic testing
   */
  async getPatientSummary(patientId: string): Promise<PatientSummary> {
    // Simulate network delay
    await this.delay(500);
    
    console.log(`[MOCK] Fetching comprehensive patient summary for patient: ${patientId}`);
    const summary = createComprehensiveMockPatientSummary();
    
    // Add extended data
    return {
      ...summary,
      fluidIO: createFluidIOObservations(),
      imagingReports: createImagingReports(),
      procedures: createProcedures(),
      clinicalNotes: createClinicalNotes(),
    };
  }

  /**
   * Get mock patient
   */
  async getPatient(_patientId: string) {
    await this.delay(300);
    const summary = createComprehensiveMockPatientSummary();
    return summary.patient;
  }

  /**
   * Get mock conditions
   */
  async getConditions(_patientId: string) {
    await this.delay(400);
    const summary = createComprehensiveMockPatientSummary();
    return summary.conditions;
  }

  /**
   * Get mock medications
   */
  async getMedications(_patientId: string) {
    await this.delay(400);
    const summary = createComprehensiveMockPatientSummary();
    return summary.medications;
  }

  /**
   * Get mock labs
   */
  async getLabs(_patientId: string) {
    await this.delay(400);
    const summary = createComprehensiveMockPatientSummary();
    return summary.recentLabs;
  }

  /**
   * Get mock vitals
   */
  async getVitals(_patientId: string) {
    await this.delay(400);
    const summary = createComprehensiveMockPatientSummary();
    return summary.recentVitals;
  }

  /**
   * Get mock allergies
   */
  async getAllergies(_patientId: string) {
    await this.delay(300);
    const summary = createComprehensiveMockPatientSummary();
    return summary.allergies;
  }
}

export const mockFhirService = new MockFhirService();

