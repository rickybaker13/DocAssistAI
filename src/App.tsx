import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import { usePatientStore } from './stores/patientStore';
import { smartAuthService } from './services/auth/smartAuthService';
import { fhirClientService } from './services/fhir/fhirClientService';
import { mockFhirService } from './services/fhir/mockFhirService';
import { aiService } from './services/ai/aiService';
import { shouldUseMockData } from './utils/mockData';
import { openSandboxService } from './services/fhir/openSandboxService';
import PatientDashboard from './components/patient/PatientDashboard';
import ChatInterface from './components/chat/ChatInterface';
import DocumentGenerator from './components/document/DocumentGenerator';
import NoteDiscovery from './components/discovery/NoteDiscovery';
import ResourceExplorer from './components/explorer/ResourceExplorer';
import ClinicalNotesViewer from './components/notes/ClinicalNotesViewer';
import { ScribePanel } from './components/scribe/ScribePanel';
import { BriefingPanel } from './components/briefing/BriefingPanel';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorMessage from './components/common/ErrorMessage';
import ConnectionStatus from './components/common/ConnectionStatus';

function App() {
  const { isAuthenticated, setAuthenticated, setLoading, setError, error } = useAuthStore();
  const { setPatientSummary, setLoading: setPatientLoading } = usePatientStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeView, setActiveView] = useState<'briefing' | 'main' | 'discovery' | 'explorer' | 'notes' | 'scribe'>('briefing');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true);
        setIsInitializing(true);

        // Check for temporary mock data mode (from URL parameter)
        const urlParams = new URLSearchParams(window.location.search);
        const tempMockMode = urlParams.get('mock') === 'true';
        
        // Check if we should use Open Sandbox (no auth, real FHIR data)
        const useOpenSandbox = import.meta.env.VITE_USE_OPEN_SANDBOX === 'true';
        
        // Check if we should use mock data (for local development)
        const useMockData = shouldUseMockData() || (tempMockMode && import.meta.env.DEV);

        if (useOpenSandbox) {
          console.log('[Open Sandbox Mode] Using Open Sandbox (no auth required, real FHIR data)');
          
          // Use a known test patient ID from Open Sandbox
          // Common test patient IDs: 12742400, 4342009, 12724067, 12742648, etc.
          // Try different IDs if one doesn't have notes
          const testPatientId = import.meta.env.VITE_OPEN_SANDBOX_PATIENT_ID || '12742400';
          console.log(`[Open Sandbox] Using patient ID: ${testPatientId}`);
          console.log(`[Open Sandbox] To use a different patient, set VITE_OPEN_SANDBOX_PATIENT_ID in .env.local`);
          
          // Create mock launch context (no real OAuth needed)
          const openSandboxLaunchContext = {
            patientId: testPatientId,
            encounterId: undefined,
            userId: undefined,
            fhirClient: null as any, // Not needed for Open Sandbox
          };
          setAuthenticated(openSandboxLaunchContext);

          // Load real patient data from Open Sandbox
          setPatientLoading(true);
          try {
            const patientSummary = await openSandboxService.getPatientSummary(testPatientId);
            setPatientSummary(patientSummary);
            
            // Index patient data for RAG
            try {
              await aiService.indexPatientData(patientSummary);
              console.log('[RAG] Patient data indexed successfully');
            } catch (error: any) {
              console.warn('[RAG] Failed to index patient data:', error.message);
              // Continue even if RAG indexing fails
            }
            
            setPatientLoading(false);
            setIsInitializing(false);
            setLoading(false);
          } catch (error: any) {
            console.error('[Open Sandbox] Failed to load patient data:', error);
            setError(`Failed to load patient from Open Sandbox: ${error.message}`);
            setPatientLoading(false);
            setIsInitializing(false);
            setLoading(false);
          }
        } else if (useMockData) {
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
          
          // Index patient data for RAG
          try {
            await aiService.indexPatientData(patientSummary);
            console.log('[RAG] Patient data indexed successfully');
          } catch (error: any) {
            console.warn('[RAG] Failed to index patient data:', error.message);
            // Continue even if RAG indexing fails
          }

          // Learn templates from clinical notes if available
          if (patientSummary.clinicalNotes && patientSummary.clinicalNotes.length > 0) {
            try {
              const { templateLearningService } = await import('./services/document/templateLearningService');
              const learningResult = await templateLearningService.learnFromNotes(patientSummary.clinicalNotes);
              if (learningResult.success && learningResult.data) {
                console.log(`[Template Learning] Learned ${learningResult.data.templatesDiscovered} templates from ${patientSummary.clinicalNotes.length} notes`);
              }
            } catch (error: any) {
              console.warn('[Template Learning] Failed to learn templates:', error.message);
              // Continue even if template learning fails
            }
          }
          
          setPatientLoading(false);
        } else {
          // Launch SMART app (production/EHR mode)
          // Check if we're on the redirect page - if so, don't try to launch here
          if (window.location.pathname.includes('/redirect')) {
            // Note: redirect.html is served as static file, React app handles /redirect path
            console.log('[App] On redirect page, skipping launch - redirect handler will process');
            setIsInitializing(false);
            setLoading(false);
            return;
          }
          
          const launchContext = await smartAuthService.launch();
          setAuthenticated(launchContext);

          // Load patient data
          setPatientLoading(true);
          const patientSummary = await fhirClientService.getPatientSummary(launchContext.patientId);
          setPatientSummary(patientSummary);
          
          // Index patient data for RAG
          try {
            await aiService.indexPatientData(patientSummary);
            console.log('[RAG] Patient data indexed successfully');
          } catch (error: any) {
            console.warn('[RAG] Failed to index patient data:', error.message);
            // Continue even if RAG indexing fails
          }

          // Learn templates from clinical notes if available
          if (patientSummary.clinicalNotes && patientSummary.clinicalNotes.length > 0) {
            try {
              const { templateLearningService } = await import('./services/document/templateLearningService');
              const learningResult = await templateLearningService.learnFromNotes(patientSummary.clinicalNotes);
              if (learningResult.success && learningResult.data) {
                console.log(`[Template Learning] Learned ${learningResult.data.templatesDiscovered} templates from ${patientSummary.clinicalNotes.length} notes`);
              }
            } catch (error: any) {
              console.warn('[Template Learning] Failed to learn templates:', error.message);
              // Continue even if template learning fails
            }
          }
          
          setPatientLoading(false);
        }

        setIsInitializing(false);
        setLoading(false);
      } catch (err: any) {
        console.error('App initialization error:', err);
        console.error('Error details:', {
          message: err?.message,
          stack: err?.stack,
          name: err?.name
        });
        
        // If it's a redirect error, that's expected - don't treat as error
        if (err?.message?.includes('Redirecting')) {
          console.log('[App] Redirect in progress, waiting for OAuth callback...');
          setIsInitializing(false);
          setLoading(false);
          return;
        }
        
        // Log configuration for debugging
        if (err?.message?.includes('configuration') || err?.message?.includes('Missing')) {
          console.error('[App] Configuration check:', {
            fhirBaseUrl: import.meta.env.VITE_FHIR_BASE_URL,
            clientId: import.meta.env.VITE_CLIENT_ID ? '***' : 'MISSING',
            redirectUri: import.meta.env.VITE_REDIRECT_URI,
            useMockData: shouldUseMockData()
          });
        }
        
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
        <div className="text-center max-w-2xl mx-auto px-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">DocAssistAI</h1>
          <p className="text-gray-600 mb-6">Please launch this app from Oracle Health EHR</p>
          
          {import.meta.env.DEV && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-3">
                  <strong>Development Mode:</strong> To test locally with mock data, set{' '}
                  <code className="bg-yellow-100 px-1 rounded">VITE_USE_MOCK_DATA=true</code> in your .env.local file
                </p>
                <button
                  onClick={() => {
                    window.location.href = '/smart-launcher.html';
                  }}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Launch SMART App (Sandbox)
                </button>
              </div>
              
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Quick Test Options:</strong>
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <a
                    href="/smart-launcher.html"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium inline-block text-center"
                  >
                    Open SMART Launcher
                  </a>
                  <a
                    href="/debug-smart.html"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium inline-block text-center"
                  >
                    Debug Connection
                  </a>
                  <button
                    onClick={() => {
                      // Enable mock data mode temporarily via URL parameter
                      window.location.href = '/?mock=true';
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                  >
                    Use Mock Data (Temporary)
                  </button>
                </div>
              </div>
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
            <div className="flex items-center gap-4">
              {import.meta.env.DEV && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveView('briefing')}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      activeView === 'briefing'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Briefing
                  </button>
                  <button
                    onClick={() => setActiveView('main')}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      activeView === 'main'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Main
                  </button>
                  <button
                    onClick={() => setActiveView('discovery')}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      activeView === 'discovery'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Discovery
                  </button>
                  <button
                    onClick={() => setActiveView('explorer')}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      activeView === 'explorer'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Resource Explorer
                  </button>
                  <button
                    onClick={() => setActiveView('notes')}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      activeView === 'notes'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Clinical Notes
                  </button>
                  <button
                    onClick={() => setActiveView('scribe')}
                    className={`px-3 py-1 text-sm font-medium rounded ${
                      activeView === 'scribe'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Scribe
                  </button>
                </div>
              )}
              {shouldUseMockData() && (
                <div className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                  MOCK DATA MODE
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Connection Status */}
        {!shouldUseMockData() && (
          <div className="mb-6">
            <ConnectionStatus />
          </div>
        )}

        {activeView === 'briefing' ? (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Patient Briefing</h2>
              <p className="text-sm text-gray-600 mt-1">AI-generated ICU patient signal briefing</p>
            </div>
            <BriefingPanel />
          </div>
        ) : activeView === 'discovery' ? (
          <NoteDiscovery />
        ) : activeView === 'explorer' ? (
          <ResourceExplorer />
        ) : activeView === 'notes' ? (
          <ClinicalNotesViewer />
        ) : activeView === 'scribe' ? (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Scribe</h2>
              <p className="text-sm text-gray-600 mt-1">Record and generate clinical notes with AI</p>
            </div>
            <ScribePanel />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Patient Dashboard and Document Generator */}
              <div className="lg:col-span-2 space-y-6">
                <PatientDashboard />
                
                {/* Document Generator Section */}
                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Document Generator</h2>
                    <p className="text-sm text-gray-600 mt-1">Generate clinical notes with AI assistance</p>
                  </div>
                  <div className="p-6">
                    <DocumentGenerator />
                  </div>
                </div>
              </div>

              {/* Right Column - Chat Interface */}
              <div className="lg:col-span-1">
                <ChatInterface />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

