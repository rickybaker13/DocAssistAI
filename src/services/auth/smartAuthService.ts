/**
 * SMART on FHIR Authentication Service
 * Handles OAuth 2.0 flow and token management
 */

import { fhir } from 'fhirclient';
import { SMARTLaunchContext } from '../../types';
import { SMART_SCOPES, appConfig } from '../../config';

class SMARTAuthService {
  private client: fhir.Client | null = null;
  private launchContext: SMARTLaunchContext | null = null;

  /**
   * Initialize SMART launch and authenticate
   */
  async launch(): Promise<SMARTLaunchContext> {
    try {
      const client = await fhir.oauth2.ready();
      
      // Get launch context
      const patientId = client.patient.id;
      const encounterId = client.encounter?.id;
      const userId = client.user?.id;

      this.client = client;
      this.launchContext = {
        patientId,
        encounterId,
        userId,
        fhirClient: client,
      };

      return this.launchContext;
    } catch (error) {
      console.error('SMART launch failed:', error);
      throw new Error('Failed to launch SMART application');
    }
  }

  /**
   * Get current FHIR client
   */
  getClient(): fhir.Client {
    if (!this.client) {
      throw new Error('SMART client not initialized. Call launch() first.');
    }
    return this.client;
  }

  /**
   * Get launch context
   */
  getLaunchContext(): SMARTLaunchContext {
    if (!this.launchContext) {
      throw new Error('Launch context not available. Call launch() first.');
    }
    return this.launchContext;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.client !== null;
  }

  /**
   * Get patient ID from launch context
   */
  getPatientId(): string {
    if (!this.launchContext) {
      throw new Error('Launch context not available');
    }
    return this.launchContext.patientId;
  }

  /**
   * Logout and clear session
   */
  logout(): void {
    this.client = null;
    this.launchContext = null;
  }
}

export const smartAuthService = new SMARTAuthService();

