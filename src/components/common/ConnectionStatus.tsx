/**
 * Connection Status Component
 * Shows whether the app is connected to Oracle Health sandbox
 */

import { useEffect, useState } from 'react';
import { smartAuthService } from '../../services/auth/smartAuthService';
import { fhirClientService } from '../../services/fhir/fhirClientService';
import { usePatientStore } from '../../stores/patientStore';

interface ConnectionStatus {
  connected: boolean;
  authenticated: boolean;
  patientId?: string;
  patientName?: string;
  userId?: string;
  canAccessData: boolean;
  error?: string;
}

export default function ConnectionStatus() {
  const { patientSummary } = usePatientStore();
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    authenticated: false,
    canAccessData: false,
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      // Check if we're in Open Sandbox mode
      const useOpenSandbox = import.meta.env.VITE_USE_OPEN_SANDBOX === 'true';
      
      if (useOpenSandbox) {
        // Open Sandbox mode - no authentication needed
        if (patientSummary?.patient) {
          const patientName = patientSummary.patient.name?.[0]?.text || 
                            patientSummary.patient.name?.[0]?.given?.join(' ') + ' ' + 
                            patientSummary.patient.name?.[0]?.family || 'Unknown';
          
          setStatus({
            connected: true,
            authenticated: true,
            patientId: patientSummary.patient.id,
            patientName,
            canAccessData: true,
          });
          setIsChecking(false);
          return;
        } else {
          setStatus({
            connected: false,
            authenticated: false,
            canAccessData: false,
            error: 'Loading patient data from Open Sandbox...',
          });
          setIsChecking(false);
          return;
        }
      }
      
      // Check if SMART client is initialized
      if (!smartAuthService.isAuthenticated()) {
        setStatus({
          connected: false,
          authenticated: false,
          canAccessData: false,
          error: 'Not authenticated. Complete SMART launch first.',
        });
        setIsChecking(false);
        return;
      }

      const client = smartAuthService.getClient();
      const launchContext = smartAuthService.getLaunchContext();

      // Test authenticated API call
      const patient = await client.request(`Patient/${launchContext.patientId}`);
      const patientName = patient.name?.[0]?.text || patient.name?.[0]?.given?.join(' ') + ' ' + patient.name?.[0]?.family || 'Unknown';

      // Try to fetch conditions to verify data access
      try {
        await client.request(`Condition?patient=${launchContext.patientId}&_count=1`);
      } catch (err) {
        // Some resources might not be available, that's okay
      }

      setStatus({
        connected: true,
        authenticated: true,
        patientId: launchContext.patientId,
        patientName,
        userId: launchContext.userId,
        canAccessData: true,
      });
    } catch (error: any) {
      setStatus({
        connected: false,
        authenticated: false,
        canAccessData: false,
        error: error.message || 'Connection check failed',
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, [patientSummary]);

  if (isChecking) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-blue-800">Checking connection status...</span>
        </div>
      </div>
    );
  }

  if (status.connected && status.authenticated) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-green-900 mb-1">✅ Connected to Oracle Health Sandbox</h3>
            <div className="text-sm text-green-800 space-y-1">
              <p><strong>Patient:</strong> {status.patientName} ({status.patientId})</p>
              {status.userId && <p><strong>User ID:</strong> {status.userId}</p>}
              <p><strong>Data Access:</strong> {status.canAccessData ? '✅ Can fetch patient data' : '❌ Cannot access data'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-900 mb-1">⚠️ Not Connected to Sandbox</h3>
          <div className="text-sm text-yellow-800">
            <p className="mb-2">{status.error || 'App is not authenticated with Oracle Health sandbox.'}</p>
            <p className="mb-2"><strong>To connect:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Launch app from Oracle Health EHR sandbox, OR</li>
              <li>Use the test launcher at <code className="bg-yellow-100 px-1 rounded">/smart-launcher.html</code></li>
            </ol>
            <button
              onClick={checkConnection}
              className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
            >
              Check Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

