/**
 * Mock FHIR Service
 * Provides mock FHIR data for local development
 * Use when SMART launch is not available
 */

import { PatientSummary } from '../../types';
import { createMockPatientSummary } from '../../utils/mockData';

class MockFhirService {
  /**
   * Simulate delay for realistic testing
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get mock patient summary
   */
  async getPatientSummary(patientId: string): Promise<PatientSummary> {
    // Simulate network delay
    await this.delay(500);
    
    console.log(`[MOCK] Fetching patient summary for patient: ${patientId}`);
    return createMockPatientSummary();
  }

  /**
   * Get mock patient
   */
  async getPatient(patientId: string) {
    await this.delay(300);
    const summary = createMockPatientSummary();
    return summary.patient;
  }

  /**
   * Get mock conditions
   */
  async getConditions(patientId: string) {
    await this.delay(400);
    const summary = createMockPatientSummary();
    return summary.conditions;
  }

  /**
   * Get mock medications
   */
  async getMedications(patientId: string) {
    await this.delay(400);
    const summary = createMockPatientSummary();
    return summary.medications;
  }

  /**
   * Get mock labs
   */
  async getLabs(patientId: string) {
    await this.delay(400);
    const summary = createMockPatientSummary();
    return summary.recentLabs;
  }

  /**
   * Get mock vitals
   */
  async getVitals(patientId: string) {
    await this.delay(400);
    const summary = createMockPatientSummary();
    return summary.recentVitals;
  }

  /**
   * Get mock allergies
   */
  async getAllergies(patientId: string) {
    await this.delay(300);
    const summary = createMockPatientSummary();
    return summary.allergies;
  }
}

export const mockFhirService = new MockFhirService();

