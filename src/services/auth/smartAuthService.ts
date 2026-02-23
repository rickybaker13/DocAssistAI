/**
 * SMART on FHIR Authentication Service
 * Handles OAuth 2.0 flow and token management
 * Implements SMART App Launch Framework: https://hl7.org/fhir/smart-app-launch/app-launch.html
 */

import { fhir } from 'fhirclient';
import { SMARTLaunchContext } from '../../types';
import { SMART_SCOPES } from '../../config/fhirConfig';
import { appConfig } from '../../config/appConfig';

class SMARTAuthService {
  private client: fhir.Client | null = null;
  private launchContext: SMARTLaunchContext | null = null;

  /**
   * Initialize SMART launch and authenticate
   * Supports both EHR Launch and Standalone Launch per SMART spec
   */
  async launch(): Promise<SMARTLaunchContext> {
    try {
      // Check if we're already authenticated (from redirect handler)
      if (typeof window !== 'undefined' && sessionStorage.getItem('smart_authenticated') === 'true') {
        console.log('[SMART] Already authenticated, restoring session...');
        // Try to restore client from session
        try {
          const client = await fhir.oauth2.ready();
          const patientId = client.patient?.id || sessionStorage.getItem('smart_patient_id');
          if (patientId) {
            this.client = client;
            this.launchContext = {
              patientId,
              encounterId: client.encounter?.id,
              userId: client.user?.id,
              fhirClient: client,
            };
            return this.launchContext;
          }
        } catch (e) {
          // Session expired or invalid, clear and re-authenticate
          sessionStorage.removeItem('smart_authenticated');
          sessionStorage.removeItem('smart_patient_id');
          sessionStorage.removeItem('smart_server_url');
        }
      }

      // Check if we have launch parameters in URL (EHR Launch)
      const urlParams = new URLSearchParams(window.location.search);
      const hasLaunchParam = urlParams.has('launch') || urlParams.has('iss');
      
      let client: fhir.Client;

      if (hasLaunchParam) {
        // EHR Launch: fhirclient will auto-detect launch parameters from URL
        console.log('[SMART] Detected EHR Launch - using URL parameters');
        client = await fhir.oauth2.ready();
      } else {
        // Standalone Launch: Check if we're on redirect page
        // Note: redirect.html is served as static file, but we check for /redirect in path
        const isRedirectPage = window.location.pathname.includes('/redirect');
        
        if (isRedirectPage) {
          // We're on the redirect page - fhirclient will handle the OAuth callback
          console.log('[SMART] On redirect page, processing OAuth callback...');
          client = await fhir.oauth2.ready();
        } else if (urlParams.has('code')) {
          // We have an authorization code in URL (shouldn't happen on main app, but handle it)
          console.log('[SMART] Authorization code in URL, redirecting to redirect handler...');
          window.location.href = '/redirect.html' + window.location.search;
          throw new Error('Redirecting to redirect handler');
        } else {
          // No launch context - need to initiate authorization
          // Use fhirclient's authorize method which handles discovery automatically
          // Per Oracle Health docs: FHIR APIs advertise authorization URLs via /.well-known/smart-configuration
          console.log('[SMART] No launch context found - initiating standalone launch');
          
          if (!appConfig.fhirBaseUrl || !appConfig.clientId || !appConfig.redirectUri) {
            throw new Error('Missing required configuration: FHIR Base URL, Client ID, or Redirect URI');
          }
          
          // Use fhirclient's authorize method - it will discover endpoints via /.well-known/smart-configuration
          // Per Oracle Health: "Each EHR's instance of our FHIR APIs advertises the URLs of its respective 
          // authorization server in its Well-Known SMART Configuration document"
          console.log('[SMART] Using fhirclient authorize with discovery...');
          console.log('[SMART] Config:', {
            clientId: appConfig.clientId,
            redirectUri: appConfig.redirectUri,
            fhirBaseUrl: appConfig.fhirBaseUrl,
          });
          
          // For Standalone Launch, remove 'launch' scope (it's only for EHR Launch)
          // Oracle Health: "They request launch or launch/patient in scopes in a pure standalone flow. 
          // Those scopes are really for EHR-launched flows and can cause invalid scope errors in standalone."
          const standaloneScopes = SMART_SCOPES.filter(s => s !== 'launch').join(' ');
          console.log('[SMART] Standalone Launch - using scopes without launch:', standaloneScopes);
          
          try {
            await fhir.oauth2.authorize({
              clientId: appConfig.clientId,
              redirectUri: appConfig.redirectUri,
              scope: standaloneScopes,
              iss: appConfig.fhirBaseUrl,
            });
          } catch (authError: any) {
            console.error('[SMART] Authorization error:', authError);
            // Check if it's a discovery error
            if (authError.message?.includes('well-known') || authError.message?.includes('discovery')) {
              throw new Error(`Failed to discover SMART configuration. Check FHIR Base URL: ${appConfig.fhirBaseUrl}`);
            }
            throw authError;
          }
          
          // This will redirect, so we won't reach here
          throw new Error('Redirecting to authorization server');
        }
      }
      
      // Get launch context
      const patientId = client.patient?.id;
      if (!patientId) {
        throw new Error('No patient ID in launch context');
      }
      
      const encounterId = client.encounter?.id;
      const userId = client.user?.id;

      console.log('[SMART] Launch successful:', {
        patientId,
        encounterId,
        userId,
        serverUrl: client.state.serverUrl,
      });

      this.client = client;
      this.launchContext = {
        patientId,
        encounterId,
        userId,
        fhirClient: client,
      };

      // Store auth state for future page loads
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('smart_authenticated', 'true');
        sessionStorage.setItem('smart_patient_id', patientId);
        if (client.state?.serverUrl) {
          sessionStorage.setItem('smart_server_url', client.state.serverUrl);
        }
      }

      return this.launchContext;
    } catch (error: any) {
      console.error('[SMART] Launch failed:', error);
      
      // If it's a redirect error, that's expected - let it happen
      if (error.message?.includes('Redirecting')) {
        throw error;
      }
      
      throw new Error(`Failed to launch SMART application: ${error.message}`);
    }
  }

  /**
   * Note: Authorization URL building removed - fhirclient handles this automatically
   * Per Oracle Health docs: "Each EHR's instance of our FHIR APIs advertises the URLs 
   * of its respective authorization server in its Well-Known SMART Configuration document"
   * 
   * The fhirclient library automatically:
   * 1. Fetches /.well-known/smart-configuration from FHIR base URL
   * 2. Discovers authorization_endpoint and token_endpoint
   * 3. Handles PKCE (required per SMART spec)
   * 4. Constructs proper authorization URL
   */

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
    
    // Clear session storage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('smart_authenticated');
      sessionStorage.removeItem('smart_patient_id');
      sessionStorage.removeItem('smart_server_url');
    }
  }
}

export const smartAuthService = new SMARTAuthService();

