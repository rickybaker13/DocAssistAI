import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import { usePatientStore } from './stores/patientStore';
import { smartAuthService } from './services/auth/smartAuthService';
import { fhirClientService } from './services/fhir/fhirClientService';
import { mockFhirService } from './services/fhir/mockFhirService';
import { shouldUseMockData } from './utils/mockData';
import PatientDashboard from './components/patient/PatientDashboard';
import ChatInterface from './components/chat/ChatInterface';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorMessage from './components/common/ErrorMessage';

function App() {
  const { isAuthenticated, setAuthenticated, setLoading, setError, error } = useAuthStore();
  const { setPatientSummary, setLoading: setPatientLoading } = usePatientStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true);
        setIsInitializing(true);

        // Check if we should use mock data (for local development)
        const useMockData = shouldUseMockData();

        if (useMockData) {
          console.log('[DEV MODE] Using mock data for local development');
          // Create mock launch context
          const mockLaunchContext = {
            patientId: 'mock-patient-123',
            encounterId: undefined,
            userId: undefined,
            fhirClient: null as any, // Mock client
          };
          setAuthenticated(mockLaunchContext);

          // Load mock patient data
          setPatientLoading(true);
          const patientSummary = await mockFhirService.getPatientSummary('mock-patient-123');
          setPatientSummary(patientSummary);
          setPatientLoading(false);
        } else {
          // Launch SMART app (production/EHR mode)
          const launchContext = await smartAuthService.launch();
          setAuthenticated(launchContext);

          // Load patient data
          setPatientLoading(true);
          const patientSummary = await fhirClientService.getPatientSummary(launchContext.patientId);
          setPatientSummary(patientSummary);
          setPatientLoading(false);
        }

        setIsInitializing(false);
        setLoading(false);
      } catch (err) {
        console.error('App initialization error:', err);
        
        // If SMART launch fails and we're in dev mode, try mock data as fallback
        if (import.meta.env.DEV && !shouldUseMockData()) {
          console.log('[DEV MODE] SMART launch failed, falling back to mock data');
          try {
            const mockLaunchContext = {
              patientId: 'mock-patient-123',
              encounterId: undefined,
              userId: undefined,
              fhirClient: null as any,
            };
            setAuthenticated(mockLaunchContext);
            setPatientLoading(true);
            const patientSummary = await mockFhirService.getPatientSummary('mock-patient-123');
            setPatientSummary(patientSummary);
            setPatientLoading(false);
            setIsInitializing(false);
            setLoading(false);
            return;
          } catch (mockErr) {
            console.error('Mock data fallback also failed:', mockErr);
          }
        }
        
        setError(err instanceof Error ? err.message : 'Failed to initialize application');
        setIsInitializing(false);
        setLoading(false);
      }
    };

    initializeApp();
  }, [setAuthenticated, setLoading, setError, setPatientSummary, setPatientLoading]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner message="Initializing DocAssistAI..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">DocAssistAI</h1>
          <p className="text-gray-600 mb-4">Please launch this app from Oracle Health EHR</p>
          {import.meta.env.DEV && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-yellow-800">
                <strong>Development Mode:</strong> To test locally with mock data, set{' '}
                <code className="bg-yellow-100 px-1 rounded">VITE_USE_MOCK_DATA=true</code> in your .env.local file
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">DocAssistAI</h1>
              <p className="text-sm text-gray-600 mt-1">Clinical Assistant powered by AI</p>
            </div>
            {shouldUseMockData() && (
              <div className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                MOCK DATA MODE
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Dashboard - Takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <PatientDashboard />
          </div>

          {/* Chat Interface - Takes 1 column on large screens */}
          <div className="lg:col-span-1">
            <ChatInterface />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

