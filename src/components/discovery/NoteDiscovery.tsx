/**
 * Note Discovery Component
 * Main UI for note discovery and analysis
 */

import { useState, useEffect } from 'react';
import { useDiscoveryStore } from '../../stores/discoveryStore';
import { noteDiscoveryService } from '../../services/discovery/noteDiscoveryService';
import { usePatientStore } from '../../stores/patientStore';
import { useAuthStore } from '../../stores/authStore';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import NoteTypeExplorer from './NoteTypeExplorer';

export default function NoteDiscovery() {
  const { patientSummary } = usePatientStore();
  const { isAuthenticated } = useAuthStore();
  const {
    isDiscovering,
    discoveryError,
    discoveryReport,
    discoveredNotes,
    activeTab,
    setDiscovering,
    setDiscoveryError,
    setDiscoveryReport,
    setDiscoveredNotes,
    setActiveTab,
  } = useDiscoveryStore();

  const [patientId, setPatientId] = useState<string>('');

  useEffect(() => {
    if (patientSummary?.patient?.id) {
      setPatientId(patientSummary.patient.id);
    } else if (isAuthenticated) {
      // Try to get patient ID from auth context
      const authContext = useAuthStore.getState();
      if ((authContext as any).patientId) {
        setPatientId((authContext as any).patientId);
      }
    }
  }, [patientSummary, isAuthenticated]);

  const handleDiscover = async () => {
    if (!patientId) {
      setDiscoveryError('Patient ID is required');
      return;
    }

    setDiscovering(true);
    setDiscoveryError(null);

    try {
      // Discover notes from FHIR
      const notes = await noteDiscoveryService.discoverNotes(patientId);
      
      if (!notes || notes.length === 0) {
        console.warn('[Note Discovery] No notes found for patient:', patientId);
        setDiscoveryReport({
          totalNotes: 0,
          noteTypes: [],
          providers: [],
          structures: [],
          suggestedMappings: {},
        });
        return;
      }
      setDiscoveredNotes(notes);

      // Generate discovery report
      const report = noteDiscoveryService.generateDiscoveryReport(notes);
      setDiscoveryReport(report);

      // Optionally send to backend for AI analysis
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
        const response = await fetch(`${backendUrl}/api/discovery/analyze-notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: notes.map(n => ({
              id: n.id,
              type: n.type,
              author: n.author,
              date: n.date,
              content: n.content,
            })),
            patientId,
          }),
        });

        if (response.ok) {
          const analysisResult = await response.json();
          console.log('[Note Discovery] Backend analysis complete:', analysisResult);
        }
      } catch (backendError: any) {
        console.warn('[Note Discovery] Backend analysis failed:', backendError);
        // Continue without backend analysis
      }
    } catch (error: any) {
      console.error('[Note Discovery] Error:', error);
      setDiscoveryError(error.message || 'Failed to discover notes');
    } finally {
      setDiscovering(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'noteTypes', label: 'Note Types' },
    { id: 'providers', label: 'Providers' },
    { id: 'structures', label: 'Structures' },
    { id: 'mapping', label: 'Mapping' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Note Discovery</h2>
        <p className="text-gray-600">Discover and analyze clinical notes from FHIR resources</p>
      </div>

      {/* Discovery Controls */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient ID
            </label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Enter patient ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleDiscover}
              disabled={isDiscovering || !patientId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isDiscovering ? 'Discovering...' : 'Discover Notes'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {discoveryError && (
        <div className="mb-6">
          <ErrorMessage message={discoveryError} />
        </div>
      )}

      {/* Loading State */}
      {isDiscovering && (
        <div className="mb-6">
          <LoadingSpinner message="Discovering notes from FHIR resources..." />
        </div>
      )}

      {/* Discovery Results */}
      {discoveryReport && !isDiscovering && (
        <>
          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{discoveryReport.totalNotes}</div>
                    <div className="text-sm text-gray-600">Total Notes</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{discoveryReport.noteTypes.length}</div>
                    <div className="text-sm text-gray-600">Note Types</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{discoveryReport.providerTypes.length}</div>
                    <div className="text-sm text-gray-600">Providers</div>
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Date Range</h3>
                  <p className="text-gray-600">
                    {discoveryReport.dateRange.earliest && discoveryReport.dateRange.latest
                      ? `${new Date(discoveryReport.dateRange.earliest).toLocaleDateString()} - ${new Date(discoveryReport.dateRange.latest).toLocaleDateString()}`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'noteTypes' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Note Types</h3>
                {discoveryReport.noteTypes.map((noteType) => (
                  <div key={noteType.type} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900">{noteType.type}</h4>
                      <span className="text-sm text-gray-500">{noteType.count} notes</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Providers: {noteType.providers.join(', ')}</p>
                      <p className="mt-1">
                        Date Range: {noteType.dateRange.earliest && noteType.dateRange.latest
                          ? `${new Date(noteType.dateRange.earliest).toLocaleDateString()} - ${new Date(noteType.dateRange.latest).toLocaleDateString()}`
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'providers' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Providers</h3>
                {discoveryReport.providerTypes.map((provider) => (
                  <div key={provider.provider} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900">{provider.provider}</h4>
                      <span className="text-sm text-gray-500">{provider.count} notes</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {provider.role && <p>Role: {provider.role}</p>}
                      {provider.service && <p>Service: {provider.service}</p>}
                      <p className="mt-1">Note Types: {provider.noteTypes.join(', ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'structures' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Note Structures</h3>
                <p className="text-gray-600">Structure analysis requires backend AI analysis. Check console for details.</p>
              </div>
            )}

            {activeTab === 'mapping' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Note Type Mapping</h3>
                <p className="text-gray-600">Mapping interface coming soon. Check backend analysis for suggested mappings.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Note Explorer */}
      {discoveredNotes.length > 0 && (
        <div className="mt-8">
          <NoteTypeExplorer notes={discoveredNotes} />
        </div>
      )}
    </div>
  );
}

