/**
 * Resource Explorer Component
 * Displays all available FHIR resources for a patient
 * Helps understand Oracle Health/Cerner PowerChart structure
 */

import { useState, useEffect } from 'react';
import { comprehensiveResourceFetcher, ComprehensivePatientResources } from '../../services/fhir/comprehensiveResourceFetcher';
import { usePatientStore } from '../../stores/patientStore';
import LoadingSpinner from '../common/LoadingSpinner';

export default function ResourceExplorer() {
  const { patientSummary } = usePatientStore();
  const [resources, setResources] = useState<ComprehensivePatientResources | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResourceType, setSelectedResourceType] = useState<string | null>(null);
  const [showDocumentAnalysis, setShowDocumentAnalysis] = useState(false);

  const patientId = patientSummary?.patient?.id;

  const fetchAllResources = async () => {
    if (!patientId) {
      setError('No patient selected');
      return;
    }

    setIsFetching(true);
    setError(null);
    try {
      const result = await comprehensiveResourceFetcher.fetchAllResources(patientId);
      setResources(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch resources');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (patientId && !resources) {
      fetchAllResources();
    }
  }, [patientId]);

  const handleExportJSON = () => {
    if (!resources) return;
    const json = comprehensiveResourceFetcher.exportToJSON(resources);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${patientId}-resources-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const analyzeDocuments = () => {
    if (!resources) return null;
    const docRefs = resources.resources['DocumentReference']?.resources || [];
    return comprehensiveResourceFetcher.analyzeDocumentReferences(docRefs);
  };

  const documentAnalysis = analyzeDocuments();

  if (!patientId) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">No patient selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">FHIR Resource Explorer</h2>
            <p className="text-sm text-gray-600 mt-1">
              Explore all available resources for patient: {patientSummary?.patient?.name?.[0]?.given?.join(' ')} {patientSummary?.patient?.name?.[0]?.family}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchAllResources}
              disabled={isFetching}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isFetching ? 'Fetching...' : 'Refresh Resources'}
            </button>
            {resources && (
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Export JSON
              </button>
            )}
          </div>
        </div>

        {isFetching && (
          <div className="py-8">
            <LoadingSpinner message="Fetching all patient resources..." />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {resources && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Total Resource Types</p>
                  <p className="text-lg font-semibold">{resources.summary.totalResourceTypes}</p>
                </div>
                <div>
                  <p className="text-gray-600">Available Types</p>
                  <p className="text-lg font-semibold text-green-600">{resources.summary.availableResources.length}</p>
                </div>
                <div>
                  <p className="text-gray-600">Unavailable Types</p>
                  <p className="text-lg font-semibold text-gray-500">{resources.summary.unavailableResources.length}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Resources</p>
                  <p className="text-lg font-semibold">{resources.summary.totalResources}</p>
                </div>
              </div>
            </div>

            {/* Document Reference Analysis */}
            {documentAnalysis && documentAnalysis.total > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-blue-900">DocumentReference Analysis</h3>
                  <button
                    onClick={() => setShowDocumentAnalysis(!showDocumentAnalysis)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {showDocumentAnalysis ? 'Hide' : 'Show'} Details
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700">Total Documents</p>
                    <p className="text-lg font-semibold">{documentAnalysis.total}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Unique Types</p>
                    <p className="text-lg font-semibold">{Object.keys(documentAnalysis.byType).length}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Statuses</p>
                    <p className="text-lg font-semibold">{Object.keys(documentAnalysis.byStatus).length}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Categories</p>
                    <p className="text-lg font-semibold">{Object.keys(documentAnalysis.byCategory).length}</p>
                  </div>
                </div>
                {showDocumentAnalysis && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="font-medium text-blue-900 mb-2">By Type:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(documentAnalysis.byType).map(([type, count]) => (
                          <span key={type} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-blue-900 mb-2">Sample Structures:</p>
                      <pre className="bg-white p-3 rounded text-xs overflow-auto max-h-64">
                        {JSON.stringify(documentAnalysis.sampleStructures, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resource List */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Available Resources</h3>
              <div className="space-y-2">
                {resources.summary.availableResources.map(resourceType => {
                  const resource = resources.resources[resourceType];
                  return (
                    <div
                      key={resourceType}
                      className={`border rounded-lg p-3 cursor-pointer hover:bg-gray-50 ${
                        selectedResourceType === resourceType ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedResourceType(selectedResourceType === resourceType ? null : resourceType)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{resourceType}</p>
                          <p className="text-sm text-gray-600">
                            {resource.count} resource{resource.count !== 1 ? 's' : ''}
                            {resource.query && (
                              <span className="ml-2 text-xs text-gray-500">({resource.query})</span>
                            )}
                          </p>
                        </div>
                        <span className="text-green-600 text-sm font-medium">✓ Available</span>
                      </div>
                      {selectedResourceType === resourceType && resource.resources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-auto max-h-96">
                            {JSON.stringify(resource.resources.slice(0, 3), null, 2)}
                            {resource.resources.length > 3 && (
                              <div className="text-gray-500 mt-2">
                                ... and {resource.resources.length - 3} more
                              </div>
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Unavailable Resources */}
            {resources.summary.unavailableResources.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Unavailable Resources</h3>
                <div className="flex flex-wrap gap-2">
                  {resources.summary.unavailableResources.map(resourceType => {
                    const resource = resources.resources[resourceType];
                    return (
                      <div
                        key={resourceType}
                        className="bg-gray-100 border border-gray-300 rounded px-3 py-1 text-sm"
                        title={resource.error}
                      >
                        {resourceType}
                        {resource.error && (
                          <span className="ml-2 text-xs text-red-600">({resource.error.substring(0, 30)}...)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

